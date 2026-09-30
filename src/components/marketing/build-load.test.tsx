/**
 * The above-the-fold build is CSS, and it is still the same build.
 *
 * `trigger="load"` groups render plain markup animated by keyframes in
 * `globals.css`, because a Motion reveal cannot start before hydration and
 * the page's largest text used to wait seconds for it (`Build.tsx`). Two
 * things have to stay true for that to be a fix rather than a regression:
 *
 * 1. **The HTML is not hidden.** Nothing in a load group may be
 *    server-rendered with an inline clip, blur or offset — that inline style
 *    is exactly what made the text wait for JavaScript.
 * 2. **The keyframes are the variants.** There are now two descriptions of
 *    one motion, and two descriptions drift. Every number here is read from
 *    `motion-tokens.ts` and looked for in the stylesheet, so changing the
 *    feel in one place and not the other fails the build.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildGroup, Built, BuiltListItem, DrawnRule } from "./Build";
import { MotionProvider } from "./MotionProvider";
import { BUILD, EASE_SOFT, buildItem, buildRow, drawRule, dropPaper } from "./motion-tokens";

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** The body of `@keyframes name`, from its `from` and `to` blocks. */
function keyframes(name: string): { from: string; to: string } {
  const start = css.indexOf(`@keyframes ${name} {`);
  expect(start, `@keyframes ${name} is missing from globals.css`).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf("\n}\n", start));
  const block = (label: string) => {
    const open = body.indexOf(`${label} {`);
    return body.slice(open, body.indexOf("}", open));
  };
  return { from: block("from"), to: block("to") };
}

/** A declaration block for an exact selector. */
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `no rule for ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}\n", start));
}

type Hidden = Record<string, string | number>;

describe("the load group's HTML", () => {
  it("arrives unclipped, carrying the escape hatch and its place in the stagger", () => {
    const html = renderToStaticMarkup(
      <BuildGroup trigger="load" stagger={0.08}>
        <Built>
          <h1>Title</h1>
        </Built>
        <div>
          <Built order={3}>
            <p>Nested</p>
          </Built>
        </div>
        <ul>
          <BuiltListItem>Item</BuiltListItem>
        </ul>
        <DrawnRule />
      </BuildGroup>,
    );

    expect(html).not.toMatch(/clip-path|filter:|transform:/);
    expect(html).toContain('data-build-load=""');
    expect(html).toContain("--build-stagger:0.08s");
    expect(html).toMatch(/<div data-build="" data-build-variant="item"><h1>/);
    expect(html).toContain("--build-order:3");
    expect(html).toMatch(/<li data-build="" data-build-variant="row">/);
    expect(html).toMatch(/data-build-variant="rule"/);
  });

  it("differs from a view group, which is server-rendered hidden on purpose", () => {
    // The contrast is the point of the test above: without it, a Motion
    // version that stopped writing inline styles would pass both.
    const html = renderToStaticMarkup(
      <MotionProvider>
        <BuildGroup>
          <Built>
            <p>Below the fold</p>
          </Built>
        </BuildGroup>
      </MotionProvider>,
    );
    expect(html).toMatch(/clip-path/);
  });
});

describe("the keyframes are Motion's variants written out", () => {
  const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;

  it("item: the same travel, blur and clip, on the same duration and curve", () => {
    const hidden = buildItem.hidden as Hidden;
    const shown = buildItem.shown as Hidden;
    const { from, to } = keyframes("build-item");
    expect(from).toContain(`translateY(${hidden.y}px)`);
    expect(from).toContain(`filter: ${hidden.filter}`);
    expect(from).toContain(`clip-path: ${hidden.clipPath}`);
    expect(to).toContain(`filter: ${shown.filter}`);
    expect(to).toContain(`clip-path: ${shown.clipPath}`);

    expect(rule("[data-build-load] [data-build-variant]")).toContain(
      `animation: build-item ${ms(BUILD.duration!)} var(--ease-soft) backwards`,
    );
    expect(css).toContain(`--ease-soft: cubic-bezier(${EASE_SOFT.join(", ")})`);
  });

  it("row: the same travel and clip", () => {
    const hidden = buildRow.hidden as Hidden;
    const { from } = keyframes("build-row");
    expect(from).toContain(`translateY(${hidden.y}px)`);
    expect(from).toContain(`clip-path: ${hidden.clipPath}`);
    expect(from).not.toContain("filter");
  });

  it("rule: the same scale and duration", () => {
    const hidden = drawRule.hidden as Hidden;
    const duration = (drawRule.shown as { transition: { duration: number } }).transition.duration;
    expect(keyframes("build-rule").from).toContain(`scaleX(${hidden.scaleX})`);
    expect(rule('[data-build-load] [data-build-variant="rule"]')).toContain(
      `animation-duration: ${ms(duration)}`,
    );
  });

  it("paper: the same drop, and the spring sampled from Motion's own formula", () => {
    const hidden = dropPaper.hidden as Hidden;
    expect(keyframes("build-paper").from).toContain(
      `translateY(${hidden.y}px) scale(${hidden.scale})`,
    );

    // Motion turns a perceptual spring into physics like this (mass 1):
    // root = 2π / (visualDuration × 1.2), stiffness = root², and a damping
    // ratio of 1 − bounce. Sampled over the time the envelope takes to fall
    // under 0.1%, which is the curve `linear()` has to trace.
    const { bounce, visualDuration } = (
      dropPaper.shown as { transition: { bounce: number; visualDuration: number } }
    ).transition;
    const w0 = (2 * Math.PI) / (visualDuration * 1.2);
    const zeta = 1 - bounce;
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const x = (t: number) =>
      1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    let settle = 0;
    while (Math.exp(-zeta * w0 * settle) * Math.hypot(1, (zeta * w0) / wd) > 0.001) settle += 0.001;

    const paper = rule('[data-build-load] [data-build-variant="paper"]');
    const duration = Number(/animation-duration: (\d+)ms/.exec(paper)![1]);
    expect(Math.abs(duration - settle * 1000)).toBeLessThan(50);

    const points = /linear\(([\s\S]*?)\)/
      .exec(paper)![1]!
      .split(",")
      .map((value) => Number(value.trim()));
    points.forEach((value, index) => {
      const expected = index === points.length - 1 ? 1 : x((settle * index) / (points.length - 1));
      expect(Math.abs(value - expected), `linear() point ${index}`).toBeLessThan(0.003);
    });
  });
});
