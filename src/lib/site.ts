/**
 * The public origin, in one place.
 *
 * §12 Q2 is answered: the origin is `https://sixseconds.tech`, registered
 * 2026-09-10. Everything that needs an absolute URL (canonical links, Open
 * Graph, `robots.txt`, the sitemap) reads it from here, so it stayed one
 * environment variable rather than a search through the app — and moving to a
 * different domain later is still only `.env.production` plus DNS, with no
 * rebuild.
 *
 * Nothing hardcodes the hostname, deliberately. `Caddyfile` takes it as
 * `{$SITE_DOMAIN}` and Auth.js takes it as `AUTH_URL`; the two must agree, and
 * `deploy/oracle/bootstrap.sh` refuses to start the stack until DNS actually
 * resolves to the instance.
 *
 * `AUTH_URL` is reused as the fallback because it already has to be the real
 * public origin for sign-in links to work (see `docs/RUNBOOK.md`). Two
 * variables that must agree are two variables that will eventually disagree.
 */

import { PRODUCT_NAME } from "./product";

const DEVELOPMENT_ORIGIN = "http://localhost:3000";

export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL;
  if (!configured) return DEVELOPMENT_ORIGIN;
  try {
    return new URL(configured).origin;
  } catch {
    return DEVELOPMENT_ORIGIN;
  }
}

export function siteUrl(pathname = "/"): string {
  return new URL(pathname, siteOrigin()).toString();
}

/**
 * True once a real origin is configured.
 *
 * `robots.ts` uses it to refuse indexing anywhere that is not the real site,
 * so a staging deployment cannot quietly compete with production in search
 * results — a mistake that is easy to make and slow to undo.
 */
export function isPublicDeployment(): boolean {
  return siteOrigin() !== DEVELOPMENT_ORIGIN;
}

/**
 * The public source repository.
 *
 * Written once here so the host is not spelled out in a marketing array
 * (§10.4). The trust-signals band links repository paths through
 * `repoFileUrl`, and a row that says "this is checkable" has to be a link
 * somebody can actually open — a bare path in a monospace font is addressed
 * to a developer who already has the checkout.
 */
export const REPO_URL = "https://github.com/M-J-7/ResumeForge";

/** A repository-relative path as a URL on the default branch. */
export function repoFileUrl(pathname: string): string {
  return `${REPO_URL}/blob/master/${pathname.replace(/^\/+/, "")}`;
}

export const SITE_NAME = PRODUCT_NAME;

export const SITE_DESCRIPTION =
  "Build a resume that parses cleanly. PDF, DOCX, and plain text, free forever. " +
  "Works without an account, and nothing is uploaded unless you ask.";
