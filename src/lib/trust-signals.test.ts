/**
 * P37 acceptance.
 *
 * Two things, and the first is the one worth having: **every numeric trust
 * signal is measured against this repository.** A test count on a marketing
 * page that quietly goes stale is a false statement, and "it was true when
 * written" is not a defence — so the number is checked rather than trusted.
 *
 * The second is that no user-visible surface hardcodes the product name, so
 * choosing one stays the one-line change `src/lib/product.ts` promises.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MEASURED, REFUSED_CLAIMS, TRUST_SIGNALS } from "./trust-signals";
import { repoFileUrl } from "./site";
import { PRODUCT_NAME } from "./product";
import { RULES } from "@/lib/lint/rules";

const ROOT = process.cwd();

/**
 * Files under a directory whose name matches, walked from disk.
 *
 * Deliberately not `git ls-files`. That reports the *index*, which on any
 * branch with uncommitted work both omits new test files and lists ones
 * deleted in the working tree — so it under-counts the tests and then throws
 * `ENOENT` reading a file that is gone. The filesystem is the thing being
 * described, so the filesystem is what is read.
 */
function filesUnder(dir: string, matches: (name: string) => boolean): string[] {
  const found: string[] = [];
  const walk = (relative: string) => {
    for (const entry of readdirSync(path.join(ROOT, relative), { withFileTypes: true })) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (matches(entry.name)) found.push(next);
    }
  };
  walk(dir);
  return found;
}

function countMatches(files: readonly string[], pattern: RegExp): number {
  let total = 0;
  for (const file of files) {
    const source = readFileSync(path.join(ROOT, file), "utf8");
    total += source.match(pattern)?.length ?? 0;
  }
  return total;
}

/* -------------------------------------------------------------------------- */

describe("every claim is checkable", () => {
  it("gives each signal a claim, a detail and somewhere to verify it", () => {
    /*
     * Four. It was five, when the grid carried six rows and two of them were
     * addressed to a developer — a count of this repository's tests, and the
     * evaluation of an AI feature. Both are still on the page, as one line
     * under the grid; neither is a reason for a job seeker to trust a resume
     * tool, which is what these tiles are for. The floor is here to stop the
     * section quietly emptying out, not to pin a layout.
     */
    expect(TRUST_SIGNALS.length).toBeGreaterThanOrEqual(4);
    for (const signal of TRUST_SIGNALS) {
      expect(signal.claim.length, signal.claim).toBeGreaterThan(10);
      expect(signal.detail.length, signal.claim).toBeGreaterThan(30);
      expect(signal.evidence.length, signal.claim).toBeGreaterThan(3);
    }
  });

  it("makes no outcome claim anywhere (D14)", () => {
    // The rule as a test rather than as a good intention. These are the exact
    // phrases the category uses, and the reason D14 exists.
    const FORBIDDEN =
      /\b(guarantee\w*|beat\s+the\s+(bots?|ats)|ats-proof|will\s+pass|more\s+interviews?|get\s+(you\s+)?hired|\d+%\s+more)\b/i;
    for (const signal of [...TRUST_SIGNALS.map((s) => `${s.claim} ${s.detail}`)]) {
      expect(FORBIDDEN.test(signal), signal).toBe(false);
    }
  });

  it("keeps the refusals specific enough to be worth printing", () => {
    // A complete sentence rather than a length floor: "A count of users we do
    // not have yet." is 36 characters and is exactly as specific as it needs
    // to be, while a 60-character vagueness would pass a length check.
    expect(REFUSED_CLAIMS.length).toBeGreaterThanOrEqual(3);
    for (const claim of REFUSED_CLAIMS) {
      expect(claim.endsWith("."), claim).toBe(true);
      expect(claim.split(/\s+/).length, claim).toBeGreaterThan(5);
    }
  });
});

describe("the measured numbers are actually measured", () => {
  it("points every piece of evidence at something that exists", () => {
    /*
     * The heading over these is "Things you can check for yourself", so a row
     * whose evidence link 404s is worse than no row at all — a stranger who
     * takes us up on it finds nothing, on the one section of the site that
     * cannot afford that.
     *
     * In-app links are checked against the route directory; repository links
     * are checked against the working tree, which is where a renamed or
     * deleted file actually shows up. This is also the gate that would have
     * caught the "optional AI enhancement runs on your device" row pointing at
     * an adapter for a feature that is switched off — not because the file was
     * missing, but because it is the check somebody runs while reading the row
     * again.
     */
    const repoPrefix = repoFileUrl("");
    for (const signal of TRUST_SIGNALS) {
      if (!signal.href) continue;

      if (signal.href.startsWith("/")) {
        const route = signal.href.replace(/^\//, "");
        // A route may live inside a route group — `src/app/(site)/check` serves
        // `/check` — so look in each group as well as at the top level.
        const app = path.join(ROOT, "src", "app");
        const roots = [
          app,
          ...readdirSync(app, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && /^\(.+\)$/.test(entry.name))
            .map((entry) => path.join(app, entry.name)),
        ];
        expect(
          roots.some((root) => existsSync(path.join(root, route, "page.tsx"))),
          `${signal.claim} links to /${route}, which is not a route`,
        ).toBe(true);
        continue;
      }

      expect(signal.href.startsWith(repoPrefix), signal.href).toBe(true);
      const file = decodeURIComponent(signal.href.slice(repoPrefix.length));
      expect(
        existsSync(path.join(ROOT, file)),
        `${signal.claim} links to ${file}, which is not in the repository`,
      ).toBe(true);
    }
  });

  it("counts the unit tests the same way the suite does", () => {
    const files = filesUnder("src", (name) => /[.]test[.]tsx?$/.test(name));
    expect(files.length).toBeGreaterThan(20);

    /*
     * Two numbers, because there are two (§10.4).
     *
     * `MEASURED.unitTests` is what the page claims, and it is a count of test
     * *cases* — the figure `pnpm test` prints, which is the figure a reader
     * following that row will actually see. `declared` counts test
     * *declarations*, which is all a regex can know: `it.each(TABLE)` is one
     * declaration and as many cases as `TABLE` has rows, and `describe.each`
     * multiplies everything inside it. Those tables are computed values
     * (`ALL_FIXTURES`, `ROLE_EXAMPLES.map(…)`), so no amount of parsing
     * recovers the case count without running the suite.
     *
     * The improvement plan asked for an equality here, on the assumption that
     * the two numbers were the same thing. They are not — 863 against 1,655 —
     * and an equality would have forced the page to under-claim by half.
     *
     * What the plan was pointing at is real, though: a floor alone guards
     * only the direction that cannot happen by accident, so half the suite
     * could be deleted and the claim would stay green. The tripwire for that
     * is `MEASURED.testDeclarations`, asserted exactly. It is rendered
     * nowhere; it exists so that *any* change in the size of the suite fails
     * a test and puts both numbers in front of whoever made the change.
     */
    const declared = countMatches(files, /\bit(?:\.each\([^)]*\))?\s*\(/g);
    expect(
      MEASURED.testDeclarations,
      `${declared} test declarations found; MEASURED.testDeclarations says ` +
        `${MEASURED.testDeclarations}. The suite changed size — set it to ${declared}, ` +
        "and re-read what `pnpm test` prints into MEASURED.unitTests while you are there.",
    ).toBe(declared);

    // A case is never fewer than its declaration, so a claim below this
    // cannot be a count of cases.
    expect(
      MEASURED.unitTests,
      `the page claims ${MEASURED.unitTests} tests, fewer than the ${declared} declared.`,
    ).toBeGreaterThanOrEqual(declared);
  });

  it("counts the end-to-end tests", () => {
    /*
     * `*.measured.spec.ts` is excluded, because `playwright.config.ts`
     * excludes it.
     *
     * The QA §11 pass lives in `e2e/` so it can share the helpers, but it is
     * not part of `pnpm test:e2e` — it needs ~120MB of vendored weights and a
     * machine somebody chose. Counting it here would put tests the suite does
     * not run into a number the landing page shows a stranger, which is
     * exactly the kind of claim this file exists to stop.
     */
    const files = filesUnder(
      "e2e",
      (name) => /[.]spec[.]ts$/.test(name) && !/[.]measured[.]spec[.]ts$/.test(name),
    );
    expect(files.length).toBeGreaterThan(3);
    const declared = countMatches(files, /^test\(/gm);
    expect(
      MEASURED.e2eTests,
      `the page claims ${MEASURED.e2eTests} end-to-end tests; ${declared} found.`,
    ).toBe(declared);
  });

  it("counts the lint rules against the engine itself", () => {
    expect(MEASURED.lintRules).toBe(RULES.length);
  });

  it("counts the skill vocabulary against the committed data file", () => {
    const data = JSON.parse(readFileSync(path.join(ROOT, "data", "skills.json"), "utf8")) as {
      skills: unknown[];
    };
    // A floor: the curated list is merged in at runtime on top of this.
    expect(MEASURED.skillTerms).toBeLessThanOrEqual(data.skills.length + 200);
    expect(MEASURED.skillTerms).toBeGreaterThan(data.skills.length - 500);
  });

  it("uses a measured value in the signal that quotes one", () => {
    /*
     * No signal quotes a number today: the one that did ("1,951 tests, and
     * the number is checked") moved to a line under the grid. The rule is
     * kept rather than deleted because it is about any *future* number — a
     * figure on this section has to be one the repository is measured
     * against, and the way that stops being true is somebody adding a tile
     * with a round number in it.
     *
     * The floor that asserted at least one such signal exists went with the
     * tile. `counts the unit tests the same way the suite does`, above, is
     * what keeps the figure the landing page still renders honest.
     */
    const withNumber = TRUST_SIGNALS.filter((s) => /\d/.test(s.claim));
    for (const signal of withNumber) {
      expect(signal.measured, signal.claim).toBeDefined();
      expect(signal.claim).toContain(MEASURED[signal.measured!].toLocaleString("en"));
    }
  });
});

describe("the product name lives in one place", () => {
  it("is not hardcoded on any user-visible surface", () => {
    // The acceptance criterion for P37, as a test: choosing a name has to
    // stay the one-line change `product.ts` promises, and the way that stops
    // being true is one component writing the string out.
    const surfaces = [
      ...filesUnder("src/app", (name) => name.endsWith(".tsx")),
      ...filesUnder("src/components", (name) => name.endsWith(".tsx")),
    ];

    const offenders = surfaces.filter((file) => {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      // Comments legitimately quote the current name when explaining the
      // title template; only code is checked.
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      return withoutComments.includes(PRODUCT_NAME);
    });

    expect(offenders, `these render the product name directly: ${offenders.join(", ")}`).toEqual(
      [],
    );
  });

  it("still has a name to render", () => {
    expect(PRODUCT_NAME.trim().length).toBeGreaterThan(0);
  });
});
