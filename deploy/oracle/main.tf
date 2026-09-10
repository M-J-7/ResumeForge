/**
 * The Oracle Cloud Always Free instance this app runs on.
 *
 * ## What this creates, and what it costs
 *
 * Nothing here is billable. Every resource is inside the Always Free
 * allowance, and the file is written so that staying inside it is checkable
 * rather than hoped for — see `ocpus`, `memory_in_gbs` and `boot_volume_size`
 * below, each of which is annotated with the limit it sits under.
 *
 *   1 × VM.Standard.A1.Flex   2 OCPU / 12 GB      (the whole A1 allowance)
 *   1 × 50 GB boot volume      of 200 GB total
 *   1 × reserved public IP     of 2
 *   1 × VCN, subnet, gateway   always free
 *
 * The A1 allowance **halved on 15 June 2026**, from 4 OCPU / 24 GB, with no
 * announcement; instances over the new limit were stopped from 18 August.
 * The numbers below are the current ones. A lot of guides still quote the old
 * ones, and following them produces an instance that is created and then
 * stopped six weeks later.
 *
 * ## The part that fails, and it is not this file
 *
 * `Out of host capacity` on `oci_core_instance` is the single most common
 * outcome of a first `terraform apply`, and it is not an error in the
 * configuration — A1 capacity in popular regions is genuinely exhausted most
 * of the time. `availability_domain_index` exists so a retry can move to
 * another domain without editing anything. See README.md for the whole
 * procedure; the short version is: retry, and retry in a quieter region.
 *
 * ## What it deliberately does not do
 *
 * It does not create DNS records, and it does not put any secret in the
 * instance. The public IP is an output; pointing a name at it is a manual
 * step because the domain is not owned by this configuration. Secrets are
 * written by `bootstrap.sh` on the box, so they never pass through Terraform
 * state — which is a file that ends up in a repository or a bucket far more
 * often than anybody plans.
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }
}

/*
 * Authentication comes from `~/.oci/config`, not from variables.
 *
 * `oci setup config` writes that file and the API key it references. Putting
 * the tenancy OCID, the user OCID and a private key path into `terraform.tfvars`
 * instead would mean four more secrets to keep out of git for no gain — the
 * CLI already has them, and `oci` is needed anyway to check capacity.
 */
provider "oci" {
  config_file_profile = var.oci_profile
  region              = var.region
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                      */
/* -------------------------------------------------------------------------- */

variable "oci_profile" {
  description = "Profile in ~/.oci/config to authenticate with."
  type        = string
  default     = "DEFAULT"
}

variable "region" {
  description = <<-EOT
    Your tenancy's home region, e.g. "uk-london-1", "us-ashburn-1".

    Always Free resources can only be created in the home region, and the home
    region cannot be changed after signup. If capacity here is exhausted, the
    answer is a new tenancy in a quieter region, not a different region in
    this one.
  EOT
  type        = string
}

variable "compartment_ocid" {
  description = <<-EOT
    Where to create everything. The tenancy OCID (the root compartment) is a
    valid answer and is what a personal account normally uses:
      oci iam compartment list --all --query 'data[0]."compartment-id"' --raw-output
  EOT
  type        = string
}

variable "availability_domain_index" {
  description = <<-EOT
    Which availability domain to try, from 0.

    This exists because of "Out of host capacity". Most regions have one AD
    (index 0 is the only choice); Ashburn, Phoenix and Frankfurt have three,
    and capacity differs between them minute to minute. Bump this and re-apply
    rather than editing the resource.
  EOT
  type        = number
  default     = 0
}

variable "ssh_public_key" {
  description = <<-EOT
    Contents of your SSH public key, e.g. file("~/.ssh/id_ed25519.pub").

    There is no password login and no console access worth relying on: if this
    is wrong, the instance is unreachable and the fix is to destroy and
    recreate it.
  EOT
  type        = string
}

variable "instance_name" {
  description = "Display name, and the hostname the instance gets."
  type        = string
  default     = "resume-builder"
}

variable "allowed_ssh_cidr" {
  description = <<-EOT
    Who may reach port 22.

    `0.0.0.0/0` is the default because a home connection rarely has a stable
    address and locking yourself out of the only way in is a worse first day
    than an exposed SSH port with key-only authentication. Narrow it once the
    deployment is settled; the app's own ports stay open to the world either
    way, since that is the point of them.
  EOT
  type        = string
  default     = "0.0.0.0/0"
}

/* -------------------------------------------------------------------------- */
/* The image                                                                   */
/* -------------------------------------------------------------------------- */

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

/*
 * Ubuntu 24.04 for aarch64, resolved rather than pinned to an OCID.
 *
 * Image OCIDs are per-region, so a pinned one makes this file work in exactly
 * one region. Ubuntu over Oracle Linux for one reason: Docker's own apt
 * repository publishes arm64 packages for it, and the compose plugin comes
 * with them. On Oracle Linux the supported path is podman, and `podman
 * compose` is not the same thing as `docker compose` in ways this stack would
 * find out about at the worst moment.
 */
data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

/* -------------------------------------------------------------------------- */
/* Network                                                                     */
/* -------------------------------------------------------------------------- */

resource "oci_core_vcn" "main" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.instance_name}-vcn"
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = "app"
}

resource "oci_core_internet_gateway" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.instance_name}-igw"
  enabled        = true
}

resource "oci_core_route_table" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.instance_name}-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.main.id
  }
}

/*
 * ## Half of the firewall. The other half is inside the instance
 *
 * Opening 80 and 443 here is necessary and **not sufficient**. Oracle's
 * images ship iptables rules that accept 22 and reject everything else, so an
 * instance with this security list still refuses HTTP — and it does so by
 * dropping the connection, which is indistinguishable from a DNS mistake or a
 * container that did not start. `cloud-init.yaml` inserts the matching local
 * rules. Neither half works alone, and this comment exists in both files.
 */
resource "oci_core_security_list" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.instance_name}-sl"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    protocol    = "6" # TCP
    source      = var.allowed_ssh_cidr
    description = "SSH"
    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    description = "HTTP — Let's Encrypt's HTTP-01 challenge needs this open, not only the redirect"
    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    description = "HTTPS"
    tcp_options {
      min = 443
      max = 443
    }
  }

  # Path MTU discovery. Without it, large responses hang rather than fail,
  # on exactly the networks that are hardest to debug from.
  ingress_security_rules {
    protocol    = "1" # ICMP
    source      = "0.0.0.0/0"
    description = "ICMP type 3 code 4 — path MTU discovery"
    icmp_options {
      type = 3
      code = 4
    }
  }
}

resource "oci_core_subnet" "main" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.main.id
  display_name      = "${var.instance_name}-subnet"
  cidr_block        = "10.0.1.0/24"
  route_table_id    = oci_core_route_table.main.id
  security_list_ids = [oci_core_security_list.main.id]
  dns_label         = "app"
}

/* -------------------------------------------------------------------------- */
/* The instance                                                                */
/* -------------------------------------------------------------------------- */

resource "oci_core_instance" "app" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_index].name
  display_name        = var.instance_name
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    # The entire Always Free Ampere allowance, as it stands after the
    # 15 June 2026 reduction. Asking for more creates a billable instance.
    ocpus         = 2
    memory_in_gbs = 12
  }

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ubuntu.images[0].id
    # Of 200 GB always-free block storage. The database is megabytes; this is
    # sized for the Docker build cache and the image layers, which are not.
    boot_volume_size_in_gbs = 50
  }

  create_vnic_details {
    subnet_id = oci_core_subnet.main.id
    # False, so a **reserved** address can be attached below. A VNIC cannot
    # hold both, and the ephemeral one is released when the instance is
    # terminated — which is the moment the DNS record pointing at it becomes
    # a record pointing at somebody else's machine.
    assign_public_ip = false
    hostname_label   = var.instance_name
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(file("${path.module}/cloud-init.yaml"))
  }

  # The boot volume is the database's disk. Terraform must never be one
  # `terraform apply` away from replacing it because an image was updated.
  lifecycle {
    ignore_changes = [source_details[0].source_id, metadata]
  }
}

/* -------------------------------------------------------------------------- */
/* A public address that outlives the instance                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reserved rather than ephemeral, and this is the difference between a rebuild
 * costing five minutes and costing a DNS propagation.
 *
 * An ephemeral public IP is released when the instance is terminated. Since
 * rebuilding is the standard answer to a broken instance — and, on Always
 * Free, to one that idle reclamation stopped — an ephemeral address means the
 * A record has to be repointed and re-propagated every time, during which the
 * site is down and Caddy is failing ACME challenges against a five-per-week
 * limit.
 *
 * ## The one condition on it being free
 *
 * Always Free covers two reserved public IPv4 addresses **while they remain
 * attached to an active VNIC**. This one is attached at creation and stays
 * attached for the life of the instance, so it is free in normal operation.
 *
 * `prevent_destroy` below deliberately keeps it through a
 * `terraform destroy` — that is the point of reserving it — and a reserved
 * address sitting detached is exactly the state the free allowance does not
 * cover. If you tear the instance down for more than a moment, either attach
 * the address to the replacement promptly or release it:
 *
 *   oci network public-ip delete --public-ip-id <ocid>
 *
 * It attaches to the VNIC's private IP, which is why the two data sources
 * below exist: the address is a property of the network interface, not of the
 * instance, and Terraform has no direct reference for it.
 */
data "oci_core_vnic_attachments" "app" {
  compartment_id      = var.compartment_ocid
  instance_id         = oci_core_instance.app.id
  availability_domain = oci_core_instance.app.availability_domain
}

data "oci_core_private_ips" "app" {
  vnic_id = data.oci_core_vnic_attachments.app.vnic_attachments[0].vnic_id
}

resource "oci_core_public_ip" "app" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.instance_name}-ip"
  lifetime       = "RESERVED"
  private_ip_id  = data.oci_core_private_ips.app.private_ips[0].id

  # The address is what DNS points at. Losing it to a `terraform apply` that
  # only meant to change something else is the failure this prevents.
  lifecycle {
    prevent_destroy = true
  }
}

/* -------------------------------------------------------------------------- */
/* The backup bucket                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Off-site replication lands in Oracle's own object storage, in this same
 * tenancy.
 *
 * ## Why here rather than Cloudflare R2
 *
 * R2's free tier is larger and its documentation is better. It is also
 * another account, another set of credentials and another service to be
 * up — for a database measured in megabytes, against a 20 GB Always Free
 * allowance that is already paid for by the account that has to exist anyway.
 * `litestream.yml` works with either; only `endpoint` and `region` differ, and
 * it documents both.
 *
 * The bucket is created here because a bucket is not a secret. The credentials
 * to write to it are, and they are **not** created here: `oci_identity_customer_secret_key`
 * would put the secret key into Terraform state, which is a file that ends up
 * in a repository or a bucket far more often than anybody plans. Two CLI
 * commands in the README create it instead, and it goes straight into
 * `.env.production` on the instance.
 */
data "oci_objectstorage_namespace" "ns" {
  compartment_id = var.compartment_ocid
}

resource "oci_objectstorage_bucket" "backups" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.ns.namespace
  name           = "${var.instance_name}-backups"

  # Never public. This is every user's resume data.
  access_type = "NoPublicAccess"

  # Litestream writes many small generations and cleans up after itself, but
  # a crashed replica can leave an incomplete multipart upload behind
  # indefinitely, and those are billable storage that nothing lists by default.
  object_events_enabled = false
  versioning            = "Disabled"

  lifecycle {
    prevent_destroy = true
  }
}

/* -------------------------------------------------------------------------- */
/* Outputs                                                                     */
/* -------------------------------------------------------------------------- */

output "public_ip_ocid" {
  description = "For `oci network public-ip delete`, if you ever tear this down."
  value       = oci_core_public_ip.app.id
}

output "litestream_endpoint" {
  description = "The `endpoint:` value for litestream.yml."
  value       = "https://${data.oci_objectstorage_namespace.ns.namespace}.compat.objectstorage.${var.region}.oraclecloud.com"
}

output "litestream_bucket" {
  description = "The `bucket:` value for litestream.yml."
  value       = oci_objectstorage_bucket.backups.name
}

output "public_ip" {
  description = "Point your domain's A record at this. Reserved, so it survives a rebuild."
  value       = oci_core_public_ip.app.ip_address
}

output "ssh" {
  description = "How to get in."
  value       = "ssh ubuntu@${oci_core_public_ip.app.ip_address}"
}

output "next_steps" {
  value = <<-EOT

    The instance exists. It is not serving anything yet, on purpose.

    1. Point a DNS A record at ${oci_core_public_ip.app.ip_address} and wait for
       it to resolve. Caddy asks Let's Encrypt for a certificate the moment it
       starts, and a name that does not resolve yet burns an attempt against
       the rate limit.

    2. ssh ubuntu@${oci_core_public_ip.app.ip_address}
       cd /opt/resume-builder
       sudo ./deploy/oracle/bootstrap.sh

    Give cloud-init a couple of minutes first. `cloud-init status --wait`
    tells you when it has finished; `/var/log/cloud-init-output.log` tells you
    why if it has not.
  EOT
}
