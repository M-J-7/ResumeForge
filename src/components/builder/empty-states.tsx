/**
 * Empty-state content.
 *
 * M0-T8 is explicit that these carry the product: every section needs a
 * real, well-written example rather than "No items yet", and for a fresher
 * with no jobs the Projects empty state is the single most important screen
 * in the app.
 *
 * So each one does three things: shows a worked example good enough to copy
 * the *shape* of, names the specific thing that makes a bullet strong, and —
 * where the section is one people wrongly think they cannot fill — says what
 * counts. The Experience and Projects copy in particular is written for
 * someone who believes they have nothing to put there.
 *
 * These deliberately do not write anything into the document. Per D8 we do
 * not generate resume content; the example is there to be read and learned
 * from, not inserted and lightly edited into a lie.
 */

import type { ReactNode } from "react";
import type { ExperienceLevel } from "@/lib/resume/experience-level";

export interface EmptyState {
  headline: string;
  body: ReactNode;
  /** A worked example, shown as it would appear on the finished resume. */
  example?: { title: string; meta?: string; bullets: string[] };
  /** Named things that qualify, for sections people wrongly skip. */
  counts?: string[];
}

const QUANTIFY_HINT =
  "The strongest bullets name a result and a number: what changed, by how much, over what period.";

export const EMPTY_STATES: Record<string, EmptyState> = {
  experience: {
    headline: "Add your first role",
    body: (
      <>
        Lead with what changed because you were there, not what you were assigned. {QUANTIFY_HINT}{" "}
        If you do not have a number, a scale or a before/after still beats a duty.
      </>
    ),
    example: {
      title: "Backend Engineer",
      meta: "Fabrikam GmbH · Jun 2019 – Feb 2022",
      bullets: [
        "Built the idempotency layer that eliminated duplicate charges, resolving 94% of billing disputes.",
        "Introduced contract testing across 9 services, cutting integration failures from 15 to 2 a month.",
      ],
    },
    counts: [
      "Internships and co-ops",
      "Part-time and summer work, including outside your field",
      "Freelance and contract work",
      "Military service",
      "Sustained volunteer roles with real responsibility",
    ],
  },

  projects: {
    // The most important empty state in the app, per M0-T8.
    headline: "Projects are how you show capability without a job title",
    body: (
      <>
        If your Experience section is thin, this is the section that gets you the interview.
        Recruiters read projects as evidence of what you can actually build. Describe it the way you
        would describe a job: what you made, who it was for, and what happened as a result.{" "}
        {QUANTIFY_HINT}
      </>
    ),
    example: {
      title: "Campus Placement Portal",
      meta: "Team Lead · Jan 2024 – May 2024",
      bullets: [
        "Built a placement portal used by 900 students across 14 departments in its first semester.",
        "Cut shortlisting time from three days to under an hour by automating eligibility filtering.",
      ],
    },
    counts: [
      "Coursework projects, especially the capstone",
      "Hackathon entries — including the ones that did not win",
      "Open-source contributions, however small",
      "Club, society, or student-government work you organised",
      "Teaching assistant or tutoring work",
      "Competitive programming and Kaggle placements",
      "Anything you built for yourself that someone else ended up using",
    ],
  },

  education: {
    headline: "Add your degree or programme",
    body: (
      <>
        Institution, credential, and dates are enough for most applications. Add a result only if it
        helps you — a strong GPA or class rank is worth including, a weak one is not worth
        volunteering.
      </>
    ),
    example: {
      title: "BTech, Information Technology",
      meta: "College of Engineering Pune · Aug 2022 – Present · 8.7 CGPA",
      bullets: ["Relevant coursework: Distributed Systems, Databases, Machine Learning."],
    },
  },

  skills: {
    headline: "Group your skills so a reader can scan them",
    body: (
      <>
        Group by kind — languages, frameworks, tools, platforms — rather than listing thirty things
        in one row. Include a skill only if you would be comfortable being asked about it in an
        interview. No proficiency bars or star ratings: a parser cannot read a slider, and a
        recruiter does not believe one.
      </>
    ),
    example: {
      title: "Languages & Frameworks",
      meta: "Go, TypeScript, Python, PostgreSQL, gRPC",
      bullets: [],
    },
  },

  certifications: {
    headline: "Add a certification",
    body: (
      <>
        Worth listing when the certificate is a hiring filter for the role — cloud, security,
        safety, accounting, clinical. A long tail of short online courses dilutes the strong ones
        rather than adding to them.
      </>
    ),
    example: {
      title: "Certified Kubernetes Administrator",
      meta: "Cloud Native Computing Foundation · Apr 2023",
      bullets: [],
    },
  },

  custom: {
    headline: "Add an entry to this section",
    body: (
      <>
        Custom sections are for things the standard ones do not cover — languages spoken,
        publications, patents, speaking, portfolio pieces. Keep the heading short and conventional
        so a parser recognises it.
      </>
    ),
    example: {
      title: "Languages",
      meta: "Spanish (native), Catalan (native), English (fluent), German (B2)",
      bullets: [],
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Per-band overrides (P35)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Copy that replaces a default for one experience band.
 *
 * **Additive, never edited.** Several of the strings above are asserted
 * verbatim by the two suites — `/hackathon entries/i`,
 * `/campus placement portal/i`, `/how you show capability without a job
 * title/i` — and they are asserted because they are the copy that carries
 * the fresher case. Overriding by band means the band that needs them keeps
 * them, and the band that does not stops being told about hackathons after
 * twelve years of work.
 *
 * Only the sections where the advice genuinely differs are overridden. A
 * band with nothing to say about Skills inherits the default, which is
 * better than a paraphrase written to fill the table.
 */
const LEVEL_OVERRIDES: Partial<Record<ExperienceLevel, Record<string, EmptyState>>> = {
  none: {
    experience: {
      headline: "No work history yet is a normal place to start",
      body: (
        <>
          Leave this empty for now and put your evidence under Projects — that section is above this
          one for exactly that reason. Come back here the moment you have an internship, a part-time
          job, or paid freelance work, whatever the field.
        </>
      ),
      counts: [
        "Internships, including unpaid ones",
        "Part-time and vacation work of any kind",
        "Paid freelance or tutoring work",
        "A role you held in a family business",
        "A sustained volunteer position with real responsibility",
      ],
    },
  },

  "under-2": {
    experience: {
      headline: "Add the role you have now, or the one you just left",
      body: (
        <>
          One or two roles is the normal shape at this stage, and a short history is not a weak one.
          Say what you changed rather than what you were assigned — {QUANTIFY_HINT}
        </>
      ),
      example: {
        title: "Junior Backend Engineer",
        meta: "Fabrikam GmbH · Aug 2024 – Present",
        bullets: [
          "Cut the nightly report job from 50 minutes to 9 by batching the three slowest queries.",
          "Wrote the onboarding runbook two later joiners used to ship in their first week.",
        ],
      },
    },
  },

  "10-plus": {
    experience: {
      headline: "The problem here is what to leave out",
      body: (
        <>
          Ten years of roles will not fit, and a reader stops at the top third anyway. Give the last
          three roles the detail and compress the rest to a line each — the early ones prove
          continuity, not capability. {QUANTIFY_HINT}
        </>
      ),
      example: {
        title: "Director of Engineering",
        meta: "Contoso Payments · Mar 2019 – Present",
        bullets: [
          "Grew the platform group from 6 to 34 across three countries with 91% two-year retention.",
          "Took settlement latency from 400ms to 90ms across 12 markets, unblocking two launches.",
        ],
      },
    },
    projects: {
      headline: "Optional at this stage",
      body: (
        <>
          With a long employment history, projects earn their space only when they show something
          the roles above do not — an open-source library people depend on, a patent, a talk
          circuit. Otherwise the room is better spent on the last three roles.
        </>
      ),
    },
  },
};

/**
 * The empty state for a section, adjusted for the band.
 *
 * Falls through to the default whenever no override exists, which is most of
 * the time and is the point: personalisation here is a small number of
 * deliberate substitutions, not a parallel set of copy to maintain.
 */
export function emptyStateFor(section: string, level: ExperienceLevel | null): EmptyState {
  const override = level ? LEVEL_OVERRIDES[level]?.[section] : undefined;
  return override ?? EMPTY_STATES[section]!;
}

/**
 * Where a candidate with no job history should look for evidence.
 *
 * Shown once, above the Projects step, for the "no experience" band only.
 * It exists because the commonest thing a fresher says is "I have nothing to
 * put on a resume", and that is almost never true — it is a cataloguing
 * problem, not an evidence problem. Naming the categories is the whole fix.
 *
 * A genuine differentiator for the Indian market specifically, which no
 * global competitor builds for: campus placement portals, competitive
 * programming, and TA work are the three that most often go unlisted.
 */
export const EVIDENCE_SOURCES: readonly { title: string; body: string }[] = [
  {
    title: "Coursework and the capstone",
    body: "The final-year project is a real project. Describe what it did and who it was for, not which subject it was submitted under.",
  },
  {
    title: "Hackathons",
    body: "Including the ones that did not place. What you built in 36 hours is evidence of what you can build.",
  },
  {
    title: "Club and society work",
    body: "Organising an event for four hundred people is operations experience. Say how many people, and what you were responsible for.",
  },
  {
    title: "Teaching assistant and tutoring work",
    body: "Paid or not, it is a role with a scope and an outcome. How many students, and over how long?",
  },
  {
    title: "Open source",
    body: "A merged pull request to something other people use counts, however small. Link it.",
  },
  {
    title: "Competitive programming",
    body: "A rating or a rank is a number, and numbers are what most fresher resumes lack.",
  },
  {
    title: "Anything you built that someone else used",
    body: "A script your lab still runs, a bot your hostel uses, a spreadsheet that replaced a process. Use counts.",
  },
];

export function EmptyStatePanel({ state }: { state: EmptyState }) {
  return (
    <div className="border-line-strong bg-surface-1/60 rounded-lg border border-dashed p-5">
      <h3 className="text-text text-sm font-semibold">{state.headline}</h3>
      <p className="text-muted mt-2 text-sm leading-relaxed">{state.body}</p>

      {state.counts ? (
        <div className="mt-4">
          <p className="text-muted text-xs font-semibold tracking-wide uppercase">What counts</p>
          <ul className="text-muted mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {state.counts.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-faint">
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.example ? (
        <div className="border-line mt-4 rounded-md border bg-white p-4">
          <p className="text-faint text-xs font-semibold tracking-wide uppercase">Example</p>
          <p className="text-text mt-2 text-sm font-semibold">{state.example.title}</p>
          {state.example.meta ? <p className="text-muted text-sm">{state.example.meta}</p> : null}
          {state.example.bullets.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {state.example.bullets.map((bullet) => (
                <li key={bullet} className="text-muted flex gap-2 text-sm">
                  <span aria-hidden className="text-faint">
                    •
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The evidence-sourcing panel (P35).
 *
 * Shown above the Projects step for the "no experience" band only. The
 * commonest thing a fresher says is "I have nothing to put on a resume", and
 * it is almost never true — it is a cataloguing problem, not an evidence
 * problem, and naming the categories is the whole fix.
 *
 * Nothing here is written into the document. It is a list of places to look,
 * which is what makes it advice rather than content generation (D8).
 */
export function EvidenceSources() {
  return (
    <section
      aria-label="Where to find evidence"
      className="border-line bg-surface-1 rounded-lg border p-5"
    >
      <h3 className="text-text text-sm font-semibold">You have more to put here than you think</h3>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        Nearly every fresher who says they have nothing to write has done several of these and has
        not counted them as work. Each one is a project entry: what you made, who it was for, and
        what happened.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {EVIDENCE_SOURCES.map((source) => (
          <li key={source.title}>
            <p className="text-text text-sm font-medium">{source.title}</p>
            <p className="text-muted text-sm">{source.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
