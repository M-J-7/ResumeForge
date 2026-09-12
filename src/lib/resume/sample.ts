/**
 * The sample resume the template gallery renders (P32-B3).
 *
 * ## Not a test fixture
 *
 * `src/test/fixtures/resumes.ts` holds documents shaped to exercise
 * pagination edges, non-Latin names and single-bullet roles. Those exist to
 * break things, and several are deliberately awkward. Shipping one to a
 * visitor comparing templates would show them a stress case and let them
 * conclude the product produces stress cases. This is a plain, unremarkable,
 * complete resume — which is what a template preview needs to be.
 *
 * It is also a *product* asset rather than a test one, so it belongs in the
 * bundle rather than being imported out of `src/test/` by a page.
 *
 * ## The same person as the landing page's illustration
 *
 * `components/marketing/PaperSample.tsx` shows Priya Raghunathan in markup,
 * for the reason documented there: a marketing page must not pull the
 * react-pdf bundle for a picture. The gallery *does* need real renders, so it
 * uses this — the same fictional person, so the two surfaces tell one story
 * rather than two.
 *
 * Every detail is invented. It is not anyone's resume, and the email and
 * phone are in the reserved example ranges.
 */

import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, type ResumeDocument } from "./schema";

/**
 * Ids are literal, not `createId()`.
 *
 * The module is evaluated once per page load and the thumbnail cache is keyed
 * by template id, so a document whose ids changed between renders would be a
 * needless source of difference in an artifact that is supposed to be stable.
 * Same reasoning the test fixtures give for the same choice.
 */
export const SAMPLE_RESUME: ResumeDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  contact: {
    fullName: "Priya Raghunathan",
    email: "priya@example.com",
    phone: "+1 415 555 0134",
    location: "Oakland, CA",
    links: [
      { id: "sample-link-1", label: "LinkedIn", url: "https://linkedin.com/in/example" },
      { id: "sample-link-2", label: "GitHub", url: "https://github.com/example" },
    ],
  },
  sections: [
    {
      id: "sample-summary",
      type: "summary",
      visible: true,
      content:
        "Platform engineer with six years building and operating the systems other teams ship on. " +
        "Most recently took a 40-service deployment pipeline from 38 minutes to 6.",
    },
    {
      id: "sample-experience",
      type: "experience",
      visible: true,
      entries: [
        {
          id: "sample-exp-1",
          title: "Senior Platform Engineer",
          organization: "Meridian Health",
          location: "Oakland, CA",
          dates: { start: { year: 2022, month: 3 }, end: null, current: true },
          bullets: [
            "Cut median deploy time from 38 minutes to 6 by moving 40 services onto a shared pipeline.",
            "Led the billing datastore migration with zero downtime across 2.1 million records.",
            "Reduced on-call pages 62% by replacing threshold alerts with error-budget burn rates.",
          ],
        },
        {
          id: "sample-exp-2",
          title: "Backend Engineer",
          organization: "Corvid Labs",
          location: "San Francisco, CA",
          dates: { start: { year: 2019, month: 7 }, end: { year: 2022, month: 2 }, current: false },
          bullets: [
            "Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.",
            "Introduced contract tests across 11 services, cutting integration failures from 18 a month to 3.",
          ],
        },
      ],
    },
    {
      id: "sample-education",
      type: "education",
      visible: true,
      entries: [
        {
          id: "sample-edu-1",
          institution: "Anna University",
          credential: "BE",
          field: "Computer Science",
          location: "Chennai, India",
          dates: { start: { year: 2015, month: 6 }, end: { year: 2019, month: 5 }, current: false },
          result: "First Class",
          bullets: [],
        },
      ],
    },
    {
      id: "sample-skills",
      type: "skills",
      visible: true,
      groups: [
        {
          id: "sample-skill-1",
          label: "Languages",
          skills: ["Go", "Python", "TypeScript", "SQL"],
        },
        {
          id: "sample-skill-2",
          label: "Infrastructure",
          skills: ["Kubernetes", "Terraform", "AWS", "Prometheus"],
        },
      ],
    },
    {
      id: "sample-projects",
      type: "projects",
      visible: true,
      entries: [
        {
          id: "sample-proj-1",
          name: "budget-burn",
          role: "Author",
          url: "https://github.com/example/budget-burn",
          dates: { start: { year: 2023, month: 4 }, end: { year: 2023, month: 9 }, current: false },
          bullets: [
            "Open-source error-budget calculator adopted by four teams inside two companies.",
          ],
        },
      ],
    },
    {
      id: "sample-certifications",
      type: "certifications",
      visible: true,
      entries: [
        {
          id: "sample-cert-1",
          name: "Certified Kubernetes Administrator",
          issuer: "Cloud Native Computing Foundation",
          issued: { year: 2022, month: 11 },
          credentialId: "",
          url: "",
        },
      ],
    },
  ],
  settings: { ...DEFAULT_SETTINGS },
};
