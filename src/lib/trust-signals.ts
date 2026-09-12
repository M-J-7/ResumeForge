/**
 * Trust signals that survive being checked (P37).
 *
 * ## The problem this replaces
 *
 * Every competitor's landing page has a social-proof slot: logos, star
 * ratings, "trusted by 2 million job seekers", "38% more interviews". D14
 * rules out the manufactured kind, and we have no users yet, so the honest
 * options were to leave the slot empty or to fill it with something true.
 *
 * ## The rule every entry here follows
 *
 * **Each one is checkable by a stranger**, and the `evidence` field says
 * where. Not "we care about privacy" — that is a value, and anybody can
 * claim it — but "the file never reaches our server, and here is the page
 * that proves it in your own browser".
 *
 * That distinction is the whole positioning. A competitor charging for
 * downloads cannot say "downloads are free"; one that generates letters with
 * a model cannot say "every sentence is yours"; one with no X-Ray cannot
 * substantiate a parse claim at all. These are not better-worded claims, they
 * are claims only we can make — which is why they are worth the slot that a
 * fabricated testimonial would otherwise take.
 *
 * `trust-signals.test.ts` asserts the numeric ones against the repository, so
 * a claim cannot drift away from the thing it is about. A test count that
 * quietly goes stale is a false statement on a marketing page, and the fact
 * that it was true when written is not a defence.
 *
 * ## What §10.4 changed, and why the heading was making a promise it broke
 *
 * The heading is "Things you can check for yourself". Four of the six
 * `evidence` values pointed at things a job seeker cannot open — a path
 * inside a repository, and a command that needs the checkout, Node and pnpm.
 * The claims were true; the column that was supposed to prove them was
 * addressed to a developer, and set in mono as if to confirm it.
 *
 * Two changes, both about the third column only:
 *
 *   - **`href`.** Every row now links to the cheapest thing the reader can
 *     actually open. In-product rows link in-product; repository rows link to
 *     the file on GitHub, built from one `REPO_URL` in `lib/site.ts` so the
 *     host is written once. `label` is what the link says, so the row reads
 *     as an instruction rather than as a path.
 *   - **Order.** The three a visitor can act on without leaving the browser
 *     come first. The two that only pay off for somebody with a checkout come
 *     last. Nothing was removed — a developer reading the list is a real
 *     reader, just not the first one.
 */

import { repoFileUrl } from "./site";

export interface TrustSignal {
  /** The claim, short enough to scan. */
  claim: string;
  /** Why it is true, in one line the reader can act on. */
  detail: string;
  /**
   * Where a stranger can verify it, named the way they would say it: "Open
   * the ATS check", not "/check". The path belongs in `href`.
   */
  evidence: string;
  /**
   * What `evidence` links to — a route in this app, or a file on GitHub.
   *
   * Optional, and one row deliberately has none: "Run `pnpm verify`" is a
   * command, not a destination, and inventing a link for it would be worse
   * than admitting that this one is for people with the checkout.
   */
  href?: string;
  /** Set when the claim is a number this repository can be measured against. */
  measured?: "unitTests" | "e2eTests" | "lintRules" | "skillTerms";
}

/**
 * The measured values, in one place.
 *
 * Written as constants rather than counted at runtime: counting test files at
 * build time would put a glob in the marketing bundle, and counting them at
 * runtime is not possible at all. The test beside this file measures the real
 * numbers and fails when these drift, which gets the accuracy without the
 * machinery.
 */
export const MEASURED = {
  /** What `pnpm test` prints — cases, not declarations. See the test. */
  unitTests: 1816,
  /**
   * Test *declarations* under `src`, pinned exactly.
   *
   * Rendered nowhere. It is the tripwire (§10.4): the claim above counts
   * cases, which cannot be recomputed without running the suite, so this is
   * the number a static check can hold to an equality. Any change in the size
   * of the suite fails `trust-signals.test.ts` and puts both figures in front
   * of whoever made the change — which is what stops half the tests being
   * deleted while the landing page goes on claiming the old total.
   */
  testDeclarations: 967,
  e2eTests: 85,
  lintRules: 14,
  skillTerms: 7432,
} as const;

export const TRUST_SIGNALS: readonly TrustSignal[] = [
  /*
   * Ordered by what it costs the reader to check, cheapest first. The three
   * that need nothing but this browser lead; the two that need a checkout
   * follow. That is not a ranking of how strong the claims are — it is a
   * ranking of how quickly the heading above them can be taken up on.
   */
  {
    claim: "We re-read the file we just made you, and show you the result",
    detail:
      "Not a claim that a resume is ATS-friendly — a measurement. The extraction runs on the actual PDF and grades what came back against what you typed.",
    evidence: "Open the X-Ray tab in the builder",
    href: "/builder",
  },
  {
    claim: "Your resume never reaches our server unless you ask",
    detail:
      "Without an account it is written to storage inside your own browser. The import parser and the ATS check both run in the page — there is no route on this server that accepts a resume file.",
    evidence: "Check a resume with your network tab open",
    href: "/check",
  },
  {
    claim: "You can take everything with you",
    detail:
      "Export the whole account as JSON Resume, import it anywhere that reads the format, and delete the account with one confirmation — every row, immediately, with no copy kept.",
    evidence: "Both controls are on your dashboard",
    href: "/dashboard",
  },
  {
    claim: "Every download is free, permanently",
    detail:
      "PDF, Word, plain text and JSON Resume. No paywall at the last step, no watermark, and no account needed to get your own work back out.",
    evidence: "Read the decision, dated and unreversed",
    href: repoFileUrl("docs/DECISIONS.md"),
  },
  {
    claim: "Optional AI enhancement runs on your device",
    detail:
      "Cover-letter Enhance downloads a small model once, then processes the selected paragraph in the browser. Your resume and letter text are not sent to a model API, and every suggestion needs your review before it changes the letter.",
    evidence: "Read the adapter that loads the model",
    href: repoFileUrl("src/lib/cover-letter/enhance.browser.ts"),
  },
  {
    claim: `${MEASURED.unitTests.toLocaleString("en")} tests, and the number is checked`,
    detail:
      "Including a test that fails if this sentence goes stale. Every emitter is pinned by golden extracted-text snapshots, so a change to the machine-readable output cannot pass unnoticed.",
    // No `href`: this one needs the repository, Node and pnpm, and is the one
    // row in the list that is honestly for a developer. Saying "clone it and
    // run this" is more useful than a link to a file that only restates it.
    evidence: "Clone the repository and run `pnpm verify`",
    measured: "unitTests",
  },
];

/**
 * What we refuse to say, kept beside what we do say.
 *
 * The landing page already has a "What we will not tell you" section, and
 * this is the list behind it. It belongs next to the trust signals rather
 * than somewhere else in the file, because the two are one argument: the
 * claims above are credible in proportion to the claims below being absent.
 */
export const REFUSED_CLAIMS: readonly string[] = [
  "That any resume is guaranteed to pass an applicant tracking system. Those systems are private, they differ from each other, and nobody outside them can promise this.",
  "A percentage more interviews. We have not run that study, and neither has anyone quoting a number at you.",
  "That a template, a font, or a colour changes whether you are hired.",
  "A count of users we do not have yet.",
];
