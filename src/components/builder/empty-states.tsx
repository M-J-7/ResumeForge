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

export function EmptyStatePanel({ state }: { state: EmptyState }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 p-5 dark:border-zinc-700 dark:bg-zinc-900/40">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{state.headline}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{state.body}</p>

      {state.counts ? (
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-wide text-zinc-700 uppercase dark:text-zinc-300">
            What counts
          </p>
          <ul className="mt-2 grid gap-1 text-sm text-zinc-600 sm:grid-cols-2 dark:text-zinc-400">
            {state.counts.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-zinc-400">
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.example ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Example
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {state.example.title}
          </p>
          {state.example.meta ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{state.example.meta}</p>
          ) : null}
          {state.example.bullets.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {state.example.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <span aria-hidden className="text-zinc-400">
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
