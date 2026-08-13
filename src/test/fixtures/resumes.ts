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

export const ALL_FIXTURES: ReadonlyArray<{ name: string; document: ResumeDocument }> = [
  { name: "mid-career", document: midCareerResume },
  { name: "fresher", document: fresherResume },
];
