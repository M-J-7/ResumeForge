/**
 * Two stylesheet rules that are load-bearing and that no other test can see.
 *
 * `axe` does not inspect `::selection` and the e2e suite cannot assert on a
 * highlight colour, so the only place the §10.5 fix can be pinned is here,
 * against the source. That is a weak form of testing and it is the right
 * amount for a rule whose failure mode is "selecting text looks like it did
 * nothing" — a regression a person would notice, eventually, and a test
 * catches immediately.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");

/** The declarations inside the first rule whose selector matches. */
function ruleBody(selector: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `${selector} is not in globals.css`).toBeGreaterThan(-1);
  const open = CSS.indexOf("{", start);
  return CSS.slice(open + 1, CSS.indexOf("}", open));
}

describe("::selection (§10.5)", () => {
  it("paints the highlight with the accent, not a near-ground tint", () => {
    // `--accent-weak` was here. Measured against the surface it sits on it is
    // ≈1.14:1 in light and ≈1.20:1 in dark — a tint, not a highlight — and
    // the text kept its normal colour, so dragging across a paragraph read as
    // doing nothing at all.
    const body = ruleBody("::selection {");
    expect(body).toContain("background: var(--accent)");
    expect(body).toContain("color: var(--on-accent)");
    expect(body).not.toContain("--accent-weak");
  });

  it("stays one rule, resolving its colours per context", () => {
    // `::selection` resolves custom properties from the element it originates
    // on, so one block covers light, `data-theme="dark"`, the
    // `prefers-color-scheme` fallback and `.band-invert`. A per-theme copy
    // would be four places to keep in step.
    const selectionRules = CSS.match(/^::selection \{/gm) ?? [];
    expect(selectionRules).toHaveLength(1);
  });

  it("overrides the one surface that is white in both themes", () => {
    // The rendered page keeps `--paper` white whatever the theme, so in dark
    // mode the accent above would paint a pale mint on white. The page
    // borrows the light pair instead.
    const body = ruleBody(".bg-paper ::selection");
    expect(body).toContain("#2f6b57");
    expect(body).toContain("#ffffff");
  });
});
