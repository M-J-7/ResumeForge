/**
 * M3-T4's acceptance, which the plan singles out:
 *
 *   > a stuffed resume scores *lower* than an honest one against the same JD.
 *   > This is the acceptance test that matters.
 *
 * The two fixtures below are built to make that comparison as unfavourable
 * as possible: the stuffed resume names *every* skill the posting asks for,
 * repeatedly, and the honest one names fewer. A keyword matcher without the
 * anti-gaming rules scores the stuffed one higher — that is precisely the
 * behaviour being ruled out.
 */

import { describe, expect, it } from "vitest";
import { parseJobDescription } from "@/lib/jd/parse";
import { buildSkillIndex } from "@/lib/skills/lookup";
import { createEmptyResume } from "@/lib/resume/factory";
import { CURRENT_SCHEMA_VERSION, type ResumeDocument } from "@/lib/resume/schema";
import { DEFAULT_SETTINGS } from "@/lib/resume/schema";
import { scoreResume } from "./score";

const skills = buildSkillIndex();

const JOB_DESCRIPTION = `Senior Platform Engineer

About us
We are a fast-growing company with a great team and a strong culture.

Requirements
- 5+ years with Kubernetes in production
- Strong Terraform and AWS experience
- Proficient in Go or Python
- Experience with PostgreSQL

Nice to have
- Prometheus and Grafana
- Experience with Kafka

Responsibilities
- Own the Kubernetes platform and its Terraform modules
- Improve observability across services
`;

const jd = parseJobDescription(JOB_DESCRIPTION);

function resumeWith(sections: ResumeDocument["sections"]): ResumeDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact: {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "",
      location: "London",
      links: [],
    },
    sections,
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Real work, described once each. Names *fewer* of the posting's skills than
 * the stuffed resume does — the comparison is meant to be hard to win.
 */
const honestResume = resumeWith([
  {
    id: "sec-exp",
    type: "experience",
    visible: true,
    entries: [
      {
        id: "exp-1",
        title: "Platform Engineer",
        organization: "Meridian Health",
        location: "London",
        dates: { start: { year: 2021, month: 4 }, end: null, current: true },
        bullets: [
          "Cut median deploy time from 38 minutes to 6 by moving 40 services onto a shared Kubernetes cluster.",
          "Replaced hand-rolled provisioning with Terraform modules, taking environment setup from two days to twenty minutes.",
          "Migrated the billing datastore to PostgreSQL with zero downtime across 2.1 million records.",
          "Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.",
        ],
      },
    ],
  },
  {
    id: "sec-skills",
    type: "skills",
    visible: true,
    groups: [{ id: "grp-1", label: "Tools", skills: ["AWS", "Prometheus"] }],
  },
]);

/**
 * Every requested skill, named many times, with nothing shown. This is what
 * "optimising for the keyword matcher" actually produces.
 */
const stuffedResume = resumeWith([
  {
    id: "sec-summary",
    type: "summary",
    visible: true,
    content:
      "Kubernetes Terraform AWS Go Python PostgreSQL Prometheus Grafana Kafka engineer. " +
      "Kubernetes expert with Terraform and AWS. Skilled in Kubernetes, Terraform, AWS, Go, Python.",
  },
  {
    id: "sec-exp",
    type: "experience",
    visible: true,
    entries: [
      {
        id: "exp-1",
        title: "Kubernetes Terraform AWS Engineer",
        organization: "Consulting",
        location: "London",
        dates: { start: { year: 2021, month: 4 }, end: null, current: true },
        bullets: [
          "Kubernetes, Terraform, AWS, Go, Python, PostgreSQL, Prometheus, Grafana, Kafka.",
          "Worked with Kubernetes and Terraform and AWS and Kubernetes and Terraform.",
        ],
      },
    ],
  },
  {
    id: "sec-skills",
    type: "skills",
    visible: true,
    groups: [
      {
        id: "grp-1",
        label: "Skills",
        skills: [
          "Kubernetes",
          "Terraform",
          "AWS",
          "Go",
          "Python",
          "PostgreSQL",
          "Prometheus",
          "Grafana",
          "Kafka",
        ],
      },
    ],
  },
]);

describe("the acceptance test that matters (M3-T4)", () => {
  it("scores a stuffed resume lower than an honest one against the same JD", () => {
    const honest = scoreResume(honestResume, jd, { skills });
    const stuffed = scoreResume(stuffedResume, jd, { skills });

    expect(stuffed.coverage).toBeLessThan(honest.coverage);
  });

  it("scores the stuffed resume lower on evidence too, by a wide margin", () => {
    const honest = scoreResume(honestResume, jd, { skills });
    const stuffed = scoreResume(stuffedResume, jd, { skills });

    // Coverage could in principle be close; evidence should not be. The
    // honest resume shows its skills in accomplishments, the stuffed one
    // lists them.
    expect(stuffed.evidence).toBeLessThan(honest.evidence);
  });

  it("says why, rather than silently deducting", () => {
    const stuffed = scoreResume(stuffedResume, jd, { skills });

    expect(stuffed.stuffingPenalty.applied).toBeGreaterThan(0);
    expect(stuffed.stuffingPenalty.reasons.join(" ")).toMatch(/keyword stuffing/i);
    expect(stuffed.recommendations.some((r) => r.kind === "stuffing")).toBe(true);
  });

  it("does not penalise the honest resume", () => {
    const honest = scoreResume(honestResume, jd, { skills });
    expect(honest.stuffingPenalty.applied).toBe(0);
  });
});

describe("section-weighted evidence", () => {
  it("ranks a skill shown in a bullet as demonstrated, not listed-only", () => {
    const result = scoreResume(honestResume, jd, { skills });
    const kubernetes = result.keywords.find((k) => k.skill.id === "kubernetes");

    expect(kubernetes?.status).toBe("demonstrated");
  });

  it("ranks a skill that only appears in the skills list as listed-only", () => {
    const result = scoreResume(honestResume, jd, { skills });
    const prometheus = result.keywords.find((k) => k.skill.id === "prometheus");

    expect(prometheus?.status).toBe("listed-only");
  });

  it("recommends showing a listed-only skill rather than just naming it", () => {
    const result = scoreResume(honestResume, jd, { skills });
    const advice = result.recommendations.find(
      (r) => r.kind === "listed-only" && r.skill.id === "prometheus",
    );

    expect(advice).toBeDefined();
  });

  it("does not accept a keyword list pasted into a bullet as a demonstration", () => {
    // The cheapest way around section-weighted evidence: the words that
    // score a quarter in a skills list score full marks in a bullet, and
    // moving them costs nothing.
    const disguised = resumeWith([
      {
        id: "sec-exp",
        type: "experience",
        visible: true,
        entries: [
          {
            id: "exp-1",
            title: "Engineer",
            organization: "Consulting",
            location: "London",
            dates: { start: { year: 2021, month: 4 }, end: null, current: true },
            bullets: ["Kubernetes, Terraform, AWS, PostgreSQL, Go."],
          },
        ],
      },
    ]);
    const result = scoreResume(disguised, jd, { skills });

    expect(result.keywords.find((k) => k.skill.id === "kubernetes")?.status).toBe("listed-only");
  });

  it("sees through a list padded with conjunctions", () => {
    // The same evasion with filler between the keywords, which defeats a
    // naive skills-per-word ratio. Content words are the denominator for
    // exactly this reason.
    const padded = resumeWith([
      {
        id: "sec-exp",
        type: "experience",
        visible: true,
        entries: [
          {
            id: "exp-1",
            title: "Engineer",
            organization: "Consulting",
            location: "London",
            dates: { start: { year: 2021, month: 4 }, end: null, current: true },
            bullets: ["Worked with Kubernetes and Terraform and AWS and PostgreSQL and Go."],
          },
        ],
      },
    ]);
    const result = scoreResume(padded, jd, { skills });

    expect(result.keywords.find((k) => k.skill.id === "kubernetes")?.status).toBe("listed-only");
  });

  it("still accepts a real accomplishment that happens to name several tools", () => {
    // The guard above must not fire on genuine writing. This names three
    // skills and is unambiguously a description of work.
    const real = resumeWith([
      {
        id: "sec-exp",
        type: "experience",
        visible: true,
        entries: [
          {
            id: "exp-1",
            title: "Engineer",
            organization: "Meridian",
            location: "London",
            dates: { start: { year: 2021, month: 4 }, end: null, current: true },
            bullets: [
              "Cut deploy time from 38 minutes to 6 by moving 40 services onto Kubernetes, " +
                "provisioned with Terraform and backed by PostgreSQL on AWS.",
            ],
          },
        ],
      },
    ]);
    const result = scoreResume(real, jd, { skills });

    expect(result.keywords.find((k) => k.skill.id === "kubernetes")?.status).toBe("demonstrated");
  });
});

describe("what the posting is asking for", () => {
  it("weighs a requirement above a nice-to-have", () => {
    const result = scoreResume(honestResume, jd, { skills });
    const kubernetes = result.keywords.find((k) => k.skill.id === "kubernetes");
    const kafka = result.keywords.find((k) => k.skill.id === "kafka");

    expect(kubernetes!.jdWeight).toBeGreaterThan(kafka!.jdWeight);
  });

  it("ignores skills named only under About us", () => {
    // A company describing its own stack is not asking the candidate for it.
    // `SECTION_WEIGHTS` gives `about` a weight of 0, and boilerplate sections
    // are dropped before any keyword is counted.
    const aboutOnly = parseJobDescription(
      "Engineer\n\nAbout us\nOur stack is Elasticsearch and Redis.\n\nRequirements\n- Kubernetes\n",
    );
    const result = scoreResume(honestResume, aboutOnly, { skills });

    expect(result.keywords.map((k) => k.skill.id)).not.toContain("elasticsearch");
    expect(result.keywords.map((k) => k.skill.id)).toContain("kubernetes");
  });

  it("records where each requirement was asked for", () => {
    const result = scoreResume(honestResume, jd, { skills });
    const kubernetes = result.keywords.find((k) => k.skill.id === "kubernetes");

    expect(kubernetes?.jdSections).toContain("required");
  });
});

describe("provenance — M3-T5's acceptance", () => {
  it("points every match at specific resume text", () => {
    const result = scoreResume(honestResume, jd, { skills });

    for (const keyword of result.keywords) {
      if (keyword.status === "missing") continue;
      expect(keyword.resumeEvidence.length).toBeGreaterThan(0);
      for (const evidence of keyword.resumeEvidence) {
        expect(evidence.sectionId).toBeTruthy();
        expect(evidence.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("quotes the posting for every requirement", () => {
    const result = scoreResume(honestResume, jd, { skills });
    for (const keyword of result.keywords) {
      expect(keyword.jdQuote.length).toBeGreaterThan(0);
    }
  });

  it("asks a question for a missing skill rather than writing the line (D8)", () => {
    const result = scoreResume(honestResume, jd, { skills });
    const missing = result.recommendations.find((r) => r.kind === "missing");

    // The whole D8 discipline in one assertion: it names the gap and asks,
    // never supplies prose the user would then have to defend.
    expect(missing).toBeDefined();
    if (missing?.kind === "missing") expect(missing.why).toMatch(/\?$/);
  });
});

describe("degenerate inputs", () => {
  it("flags a posting with nothing recognisable instead of scoring zero", () => {
    const vague = parseJobDescription(
      "Team Member\n\nRequirements\n- Strong communication and a positive attitude\n",
    );
    const result = scoreResume(honestResume, vague, { skills });

    // Scoring 0 here would read as "your resume is terrible" when it means
    // "we did not understand this posting".
    expect(result.unmatchedJd).toBe(true);
  });

  it("scores an empty resume at zero coverage without throwing", () => {
    const result = scoreResume(createEmptyResume(), jd, { skills });

    expect(result.coverage).toBe(0);
    expect(result.keywords.every((k) => k.status === "missing")).toBe(true);
  });

  it("ignores hidden sections", () => {
    // Both a correctness point and an anti-gaming one: a hidden section is
    // not in the document the employer receives, and parking a keyword list
    // in one must not lift the score.
    const hidden = resumeWith([
      {
        id: "sec-skills",
        type: "skills",
        visible: false,
        groups: [{ id: "grp-1", label: "Skills", skills: ["Kubernetes", "Terraform", "AWS"] }],
      },
    ]);
    const result = scoreResume(hidden, jd, { skills });

    expect(result.coverage).toBe(0);
  });
});
