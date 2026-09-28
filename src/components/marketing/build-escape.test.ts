/**
 * Every element that arrives hidden carries the escape hatch.
 *
 * ## The failure this exists to stop
 *
 * Motion writes `initial` as an **inline style during server rendering**. So a
 * built element arrives in the HTML already clipped, blurred or translated,
 * and something has to undo that for the two kinds of visitor who will never
 * see the animation:
 *
 *   - **No JavaScript.** Nothing ever hydrates, so nothing ever removes the
 *     clip. The `<noscript>` rule in `layout.tsx` does it instead.
 *   - **`prefers-reduced-motion`.** `useReducedMotion()` cannot run on the
 *     server, so the first paint is clipped even for someone who asked for
 *     less motion. The rule at the end of `globals.css` does it, one frame
 *     before React would.
 *
 * Both key off `[data-build]`. Miss the attribute and the region is simply
 * blank — no error, no warning, and invisible to anyone testing in a normal
 * browser. It had already happened: the hero's recovered-text lines were
 * server-rendered at `clip-path: inset(0% 100% 0% 0%)` with no hatch, so the
 * parser's pane — the thing the whole hero is an argument about — was an empty
 * rectangle with scripting off.
 *
 * ## Why source text and not a rendered tree
 *
 * The rule is about what an author wrote, and it has to hold for a component
 * nothing currently renders. Parsing the source catches it at the point of
 * writing; rendering catches it only where a test happens to mount the thing.
 * A crude check that runs on every file beats a precise one that runs on three.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/components/marketing", "src/components/shell", "src/components/ui"];

function sources(): { file: string; text: string }[] {
  const found: { file: string; text: string }[] = [];
  for (const root of ROOTS) {
    for (const name of readdirSync(path.join(process.cwd(), root))) {
      if (!name.endsWith(".tsx")) continue;
      const file = path.join(root, name);
      found.push({ file, text: readFileSync(path.join(process.cwd(), file), "utf8") });
    }
  }
  return found;
}

/**
 * The opening tag of every `<m.something …>` in a file, with its attributes.
 *
 * Deliberately not a parser. These are hand-written components in one
 * codebase, every one of them formatted by the same Prettier config, and a
 * regex that reads to the first `>` at the end of a line is enough to hold
 * them to a rule. A dependency on a TypeScript AST to assert one attribute
 * would be a worse trade.
 */
function motionTags(text: string): string[] {
  // Two shapes appear in these files: a multi-line element whose `>` sits on
  // its own line, and a single-line one that closes with `/>` or `>` inline.
  const multi = [...text.matchAll(/<m\.[a-zA-Z]+\b[\s\S]*?\n\s*\/?>/g)].map((m) => m[0]);
  const single = [...text.matchAll(/<m\.[a-zA-Z]+\b[^\n>]*\/?>/g)].map((m) => m[0]);
  return [...multi, ...single];
}

/**
 * Whether this element starts in a state that hides its content.
 *
 * `variants` counts: a variant's `hidden` state is where the clip lives, and
 * the element inherits `animate` from its group. `initial={false}` and a bare
 * `style` do not — one opts out of the initial render entirely and the other
 * is a live value rather than a starting state.
 */
function arrivesHidden(tag: string): boolean {
  if (/\bvariants=\{/.test(tag)) return true;
  const initial = /\binitial=\{([\s\S]*?)\}\s*\n/.exec(tag);
  if (!initial) return false;
  return /clipPath|opacity|scale|\by:|\bx:|filter/.test(initial[1]!);
}

describe("the build escape hatch", () => {
  it("is on every element that arrives hidden", () => {
    const offenders: string[] = [];

    for (const { file, text } of sources()) {
      for (const tag of motionTags(text)) {
        if (!arrivesHidden(tag)) continue;
        if (/\bdata-build\b/.test(tag)) continue;
        offenders.push(`${file}: ${tag.split("\n")[0]!.trim()}`);
      }
    }

    expect(
      offenders,
      "these are server-rendered hidden and nothing will ever reveal them " +
        "without JavaScript:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("finds the components it is supposed to be checking", () => {
    // A regex that silently matches nothing is a test that silently passes.
    const total = sources().reduce((sum, { text }) => sum + motionTags(text).length, 0);
    expect(total, "no <m.*> elements found — the scan has stopped working").toBeGreaterThan(12);
  });

  it("keeps both rules that read the attribute", () => {
    const layout = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout, "the <noscript> reveal").toContain("[data-build]");

    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced, "the reduced-motion reveal").toContain("[data-build]");
  });
});
