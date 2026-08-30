/**
 * Golden resume fixtures.
 *
 * Ids are hardcoded, never generated. M0-T4 requires byte-identical PDF output
 * for identical input, so any randomness here would break determinism tests.
 *
 * This file grows through M0: P2 adds the long-career, single-bullet, and
 * overflow fixtures that the pagination invariants exercise.
 */

import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, type ResumeDocument } from "@/lib/resume/schema";
import { createEmptyResume } from "@/lib/resume/factory";

/**
 * A complete mid-career resume exercising every section type.
 *
 * The name carries é, Á, ñ, and ł deliberately: extended-Latin coverage is the
 * failure mode most likely to reach production unnoticed, because it is
 * invisible when testing with ASCII names.
 */
export const midCareerResume: ResumeDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  contact: {
    fullName: "José Ángel Muñoz-Łukasiewicz",
    email: "jose.munoz@example.com",
    phone: "+34 612 345 678",
    location: "Barcelona, Spain",
    links: [
      { id: "link-linkedin", label: "LinkedIn", url: "https://linkedin.com/in/josemunoz" },
      { id: "link-github", label: "GitHub", url: "https://github.com/josemunoz" },
    ],
  },
  sections: [
    {
      id: "sec-summary",
      type: "summary",
      visible: true,
      content:
        "Backend engineer with seven years building payment infrastructure at scale. " +
        "Led the migration that cut settlement latency from 400ms to 90ms across 12 markets.",
    },
    {
      id: "sec-experience",
      type: "experience",
      visible: true,
      entries: [
        {
          id: "exp-1",
          title: "Senior Backend Engineer",
          organization: "Contoso Payments",
          location: "Barcelona, Spain",
          dates: { start: { year: 2022, month: 3 }, end: null, current: true },
          bullets: [
            "Redesigned the settlement pipeline, cutting median latency from 400ms to 90ms across 12 markets.",
            "Led a four-person team through a zero-downtime migration of 2.3 billion ledger rows.",
            "Cut infrastructure spend 31% by replacing per-request container spin-up with a warm worker pool.",
          ],
        },
        {
          id: "exp-2",
          title: "Backend Engineer",
          organization: "Fabrikam GmbH",
          location: "Berlin, Germany",
          dates: { start: { year: 2019, month: 6 }, end: { year: 2022, month: 2 }, current: false },
          bullets: [
            "Built the idempotency layer that eliminated duplicate charges, resolving 94% of billing disputes.",
            "Introduced contract testing across 9 services, reducing integration failures from 15 to 2 per month.",
          ],
        },
      ],
    },
    {
      id: "sec-education",
      type: "education",
      visible: true,
      entries: [
        {
          id: "edu-1",
          institution: "Universitat Politècnica de Catalunya",
          credential: "BSc",
          field: "Computer Science",
          location: "Barcelona, Spain",
          dates: { start: { year: 2015, month: 9 }, end: { year: 2019, month: 6 }, current: false },
          result: "First Class",
          bullets: [],
        },
      ],
    },
    {
      id: "sec-skills",
      type: "skills",
      visible: true,
      groups: [
        {
          id: "skill-lang",
          label: "Languages & Frameworks",
          skills: ["Go", "TypeScript", "Python", "PostgreSQL", "gRPC"],
        },
        {
          id: "skill-infra",
          label: "Infrastructure",
          skills: ["Kubernetes", "Terraform", "AWS", "Kafka"],
        },
      ],
    },
    {
      id: "sec-projects",
      type: "projects",
      visible: true,
      entries: [
        {
          id: "proj-1",
          name: "ledger-diff",
          role: "Author",
          url: "https://github.com/josemunoz/ledger-diff",
          dates: { start: { year: 2023, month: 1 }, end: { year: 2023, month: 8 }, current: false },
          bullets: [
            "Open-source reconciliation tool for double-entry ledgers; 1.2k stars and used by three payment processors.",
          ],
        },
      ],
    },
    {
      id: "sec-certifications",
      type: "certifications",
      visible: true,
      entries: [
        {
          id: "cert-1",
          name: "Certified Kubernetes Administrator",
          issuer: "Cloud Native Computing Foundation",
          issued: { year: 2023, month: 4 },
          credentialId: "CKA-2023-8891",
          url: "",
        },
      ],
    },
    {
      id: "sec-custom-languages",
      type: "custom",
      visible: true,
      label: "Languages",
      entries: [
        {
          id: "custom-1",
          title: "Spanish (native), Catalan (native), English (fluent), German (B2)",
          subtitle: "",
          dates: null,
          bullets: [],
        },
      ],
    },
  ],
  settings: { ...DEFAULT_SETTINGS },
};

/**
 * A student with no work history. The Experience section stays present but
 * empty — fresher mode (M4-T8) reorders rather than deletes.
 */
export const fresherResume: ResumeDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  contact: {
    fullName: "Ananya Sharma",
    email: "ananya.sharma@example.com",
    phone: "+91 98765 43210",
    location: "Pune, India",
    links: [{ id: "f-link-1", label: "GitHub", url: "https://github.com/ananyasharma" }],
  },
  sections: [
    { id: "f-sec-summary", type: "summary", visible: true, content: "" },
    { id: "f-sec-experience", type: "experience", visible: true, entries: [] },
    {
      id: "f-sec-education",
      type: "education",
      visible: true,
      entries: [
        {
          id: "f-edu-1",
          institution: "College of Engineering Pune",
          credential: "BTech",
          field: "Information Technology",
          location: "Pune, India",
          dates: { start: { year: 2022, month: 8 }, end: null, current: true },
          result: "8.7 CGPA",
          bullets: [],
        },
      ],
    },
    {
      id: "f-sec-skills",
      type: "skills",
      visible: true,
      groups: [{ id: "f-skill-1", label: "Technical", skills: ["Java", "React", "SQL", "Git"] }],
    },
    {
      id: "f-sec-projects",
      type: "projects",
      visible: true,
      entries: [
        {
          id: "f-proj-1",
          name: "Campus Placement Portal",
          role: "Team Lead",
          url: "",
          dates: { start: { year: 2024, month: 1 }, end: { year: 2024, month: 5 }, current: false },
          bullets: [
            "Built a placement portal used by 900 students across 14 departments in its first semester.",
            "Cut shortlisting time from three days to under an hour by automating eligibility filtering.",
          ],
        },
      ],
    },
    { id: "f-sec-certifications", type: "certifications", visible: true, entries: [] },
  ],
  settings: { ...DEFAULT_SETTINGS, pageSize: "A4", density: "compact" },
};

/** Structurally valid but entirely empty — the state right after "Start building". */
export function emptyResume(): ResumeDocument {
  return createEmptyResume();
}

/**
 * Fifteen years across five roles. Exercises hint assignment at scale
 * (M0-T3's "5 roles" acceptance case) and gives the M0-T4 pagination sweep a
 * fixture with real page-boundary pressure. Bullet counts are deliberately
 * mixed, including one single-bullet role, so every branch of
 * `splitBullets` fires within one document.
 */
export const longCareerResume: ResumeDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  contact: {
    fullName: "Marcus Chen",
    email: "marcus.chen@example.com",
    phone: "+1 415 555 0182",
    location: "San Francisco, CA",
    links: [{ id: "lc-link-1", label: "LinkedIn", url: "https://linkedin.com/in/marcuschen" }],
  },
  sections: [
    {
      id: "lc-sec-summary",
      type: "summary",
      visible: true,
      content:
        "Engineering leader with fifteen years spanning individual contribution to VP-level scope, " +
        "across payments, logistics, and developer tooling.",
    },
    {
      id: "lc-sec-experience",
      type: "experience",
      visible: true,
      entries: [
        {
          id: "lc-exp-1",
          title: "VP of Engineering",
          organization: "Northwind Logistics",
          location: "San Francisco, CA",
          dates: { start: { year: 2021, month: 3 }, end: null, current: true },
          bullets: [
            "Grew the engineering org from 12 to 64 across four time zones without a quarter of missed roadmap commitments.",
            "Cut warehouse routing latency 60% by replacing the batch optimizer with a streaming solver.",
            "Introduced a blameless incident process that cut mean time to resolution from 4 hours to 35 minutes.",
            "Negotiated the cloud vendor migration that reduced infrastructure spend by $2.1M annually.",
          ],
        },
        {
          id: "lc-exp-2",
          title: "Director of Engineering",
          organization: "Adatum Freight",
          location: "Chicago, IL",
          dates: { start: { year: 2018, month: 6 }, end: { year: 2021, month: 2 }, current: false },
          bullets: [
            "Built the tracking platform that now serves 40,000 shipments a day across three continents.",
            "Stood up the first on-call rotation and SLO practice, taking uptime from 98.1% to 99.95%.",
            "Mentored six engineers into their first management roles.",
          ],
        },
        {
          id: "lc-exp-3",
          title: "Engineering Manager",
          organization: "Woodgrove Analytics",
          location: "Austin, TX",
          dates: { start: { year: 2016, month: 1 }, end: { year: 2018, month: 5 }, current: false },
          bullets: [
            "Shipped the real-time dashboard rebuild that cut customer-reported latency complaints by 80%.",
          ],
        },
        {
          id: "lc-exp-4",
          title: "Senior Software Engineer",
          organization: "Contoso Data",
          location: "Austin, TX",
          dates: {
            start: { year: 2012, month: 9 },
            end: { year: 2015, month: 12 },
            current: false,
          },
          bullets: [
            "Designed the partitioning scheme that let the core datastore scale from 2TB to 40TB without a rewrite.",
            "Led the on-call handoff from the founding team to a rotating six-engineer roster.",
          ],
        },
        {
          id: "lc-exp-5",
          title: "Software Engineer",
          organization: "Fabrikam Systems",
          location: "Boston, MA",
          dates: { start: { year: 2009, month: 7 }, end: { year: 2012, month: 8 }, current: false },
          bullets: [
            "Built the first automated test suite for the billing service, catching 30+ regressions before release over two years.",
            "Rewrote the nightly batch job in a way that cut its runtime from 6 hours to 45 minutes.",
            "Onboarded and paired with four new graduate hires across two summers.",
          ],
        },
      ],
    },
    {
      id: "lc-sec-education",
      type: "education",
      visible: true,
      entries: [
        {
          id: "lc-edu-1",
          institution: "University of Texas at Austin",
          credential: "BSc",
          field: "Computer Science",
          location: "Austin, TX",
          dates: { start: { year: 2005, month: 9 }, end: { year: 2009, month: 5 }, current: false },
          result: "",
          bullets: [],
        },
      ],
    },
    {
      id: "lc-sec-skills",
      type: "skills",
      visible: true,
      groups: [
        {
          id: "lc-skill-1",
          label: "Leadership",
          skills: ["Org design", "Roadmapping", "Hiring", "Mentorship"],
        },
        {
          id: "lc-skill-2",
          label: "Technical",
          skills: ["Distributed systems", "Go", "PostgreSQL", "Kafka"],
        },
      ],
    },
  ],
  settings: { ...DEFAULT_SETTINGS },
};

/**
 * A single role with exactly one bullet — the header and bullet fuse into
 * one atomic block (rule 2) and there is nothing left in the entry that
 * could orphan (M0-T3's third acceptance case, isolated from the noise of
 * a full resume).
 */
export const singleBulletRoleResume: ResumeDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  contact: {
    fullName: "Priya Natarajan",
    email: "priya.natarajan@example.com",
    phone: "+1 512 555 0143",
    location: "Remote",
    links: [],
  },
  sections: [
    { id: "sb-sec-summary", type: "summary", visible: true, content: "" },
    {
      id: "sb-sec-experience",
      type: "experience",
      visible: true,
      entries: [
        {
          id: "sb-exp-1",
          title: "Freelance Consultant",
          organization: "Independent",
          location: "Remote",
          dates: { start: { year: 2023, month: 1 }, end: null, current: true },
          bullets: [
            "Advised three Series A startups on infrastructure cost reduction, saving a combined $400k annually.",
          ],
        },
      ],
    },
    { id: "sb-sec-education", type: "education", visible: true, entries: [] },
    { id: "sb-sec-skills", type: "skills", visible: true, groups: [] },
    { id: "sb-sec-projects", type: "projects", visible: true, entries: [] },
    { id: "sb-sec-certifications", type: "certifications", visible: true, entries: [] },
  ],
  settings: { ...DEFAULT_SETTINGS },
};

/**
 * Builds a resume whose final role has exactly `bulletCount` bullets,
 * holding everything else in `longCareerResume` fixed. Used to sweep the
 * page break across a role boundary in the pagination-invariant test
 * (plan §2.5's sequencing note): two static fixtures can pass by luck,
 * sweeping a bullet count through the boundary is what actually surfaces a
 * react-pdf break-control failure.
 */
export function buildOverflowFixture(bulletCount: number): ResumeDocument {
  const bullets = Array.from(
    { length: bulletCount },
    (_, i) =>
      `Delivered platform improvement number ${i + 1}, cutting latency and raising reliability for every downstream consumer.`,
  );

  const sections = longCareerResume.sections.map((section) => {
    if (section.type !== "experience") return section;
    const last = section.entries[section.entries.length - 1];
    if (!last) return section;
    return { ...section, entries: [...section.entries.slice(0, -1), { ...last, bullets }] };
  });

  return { ...longCareerResume, sections };
}

export const ALL_FIXTURES: ReadonlyArray<{ name: string; document: ResumeDocument }> = [
  { name: "mid-career", document: midCareerResume },
  { name: "fresher", document: fresherResume },
  { name: "long-career", document: longCareerResume },
  { name: "single-bullet-role", document: singleBulletRoleResume },
];
