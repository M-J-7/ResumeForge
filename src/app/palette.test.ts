/**
 * The palettes, measured rather than eyeballed.
 *
 * `design.md` §3.3 computed every foreground/ground pair by hand once, put the
 * numbers in a table, and left the table to go stale. It did go stale: the
 * table lists nine pairs and the stylesheet declares three palettes of
 * twenty-odd tokens each. This computes the whole matrix from the stylesheet
 * itself, so the answer cannot drift from the values that ship.
 *
 * ## Why this and not axe
 *
 * `e2e/a11y.spec.ts` is the real net and it stays the real net — it measures
 * what a browser actually composited, which is the only thing that counts.
 * But it measures the pairs a *rendered page happens to contain*, it needs a
 * built app and a browser, and it reports a failure as a CSS selector three
 * minutes into a CI run. This measures every pair the palette *permits*, in
 * milliseconds, against the file being edited. Computing first is cheaper than
 * three rounds of axe, which is the whole reason the redesign plan asks for it
 * before Phase 1 ships.
 *
 * ## The grounds
 *
 * Four per palette: the three chrome surfaces and `--canvas`, the surface the
 * rendered page floats on. `--paper` is not a ground for chrome text — nothing
 * in the app writes token-coloured text onto the document, and the two colours
 * that do appear on paper (`--accent` in a template, the `.paper-mark` wash)
 * are fixed light-theme values checked separately by `contrast.test.ts`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseHexColor, type RgbColor } from "@/lib/resume/contrast";

const CSS = readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");

/** AA for normal-size text. */
const TEXT_FLOOR = 4.5;
/** WCAG 1.4.11, for the boundary of an interactive component. */
const BOUNDARY_FLOOR = 3;

/**
 * Every `--name: #hex;` inside the first rule whose selector starts here.
 *
 * Hex literals and the bare percentages that `color-mix()` takes as a share.
 * Anything declared as a `color-mix()` or a `var()` is skipped, and that is
 * correct: the mixes in this stylesheet are all token-into-token, so their
 * endpoints and their strengths are both literals collected here.
 */
function palette(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  expect(start, `${selector} is not in globals.css`).toBeGreaterThan(-1);
  const open = CSS.indexOf("{", start);
  const body = CSS.slice(open + 1, CSS.indexOf("\n}", open));
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8}|[\d.]+%)\s*;/g)) {
    tokens[match[1]!] = match[2]!.toLowerCase();
  }
  return tokens;
}

const LIGHT = palette(":root {");
const DARK = palette(':root[data-theme="dark"] {');
const STAGE = palette('[data-stage="dark"],');

function rgb(hex: string): RgbColor {
  const parsed = parseHexColor(hex);
  expect(parsed, `${hex} is not a hex colour`).not.toBeNull();
  return parsed!;
}

function ratio(a: string, b: string): number {
  return contrastRatio(rgb(a), rgb(b));
}

/** The chrome surfaces plus the one the page floats on. */
const GROUNDS = ["surface-0", "surface-1", "surface-2", "canvas"] as const;

/** Everything the app is allowed to set as a text colour. */
const FOREGROUNDS = [
  "text",
  "text-muted",
  "text-faint",
  "accent",
  "machine",
  "ok",
  "warn",
  "danger",
] as const;

/**
 * The grounds an input's border is ever drawn against.
 *
 * Not all four. `--canvas` is the preview well, where the only thing on it is
 * the document; `--surface-2` is a recess and a hover state. Fields live on
 * the app background and inside cards, which is what 1.4.11 is asking about —
 * and is the pair §3.3 measured when it moved `--line-strong` off the
 * inherited 1.5:1.
 */
const BOUNDARY_GROUNDS = ["surface-0", "surface-1"] as const;

describe.each([
  ["light", LIGHT],
  ["dark", DARK],
  ["dark stage", STAGE],
])("%s palette", (name, tokens) => {
  it("declares every ground and foreground it is asked for", () => {
    for (const token of [...GROUNDS, ...FOREGROUNDS, "line-strong", "on-accent"]) {
      expect(tokens[token], `--${token} is missing from the ${name} palette`).toBeDefined();
    }
  });

  it.each(FOREGROUNDS)("%s clears AA on every ground", (foreground) => {
    for (const ground of GROUNDS) {
      const measured = ratio(tokens[foreground]!, tokens[ground]!);
      expect(
        measured,
        `--${foreground} ${tokens[foreground]} on --${ground} ${tokens[ground]} is ${measured.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });

  it("keeps a button's own label readable", () => {
    // `--on-accent` is white in light and near-black in dark, which is the
    // whole reason the accent can be a mint on one theme and a pine on the
    // other without the button becoming unreadable on either.
    const measured = ratio(tokens["on-accent"]!, tokens.accent!);
    expect(measured, `--on-accent on --accent is ${measured.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      TEXT_FLOOR,
    );
  });

  it("draws a field's boundary at 3:1", () => {
    for (const ground of BOUNDARY_GROUNDS) {
      const measured = ratio(tokens["line-strong"]!, tokens[ground]!);
      expect(
        measured,
        `--line-strong on --${ground} is ${measured.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(BOUNDARY_FLOOR);
    }
  });
});

describe("the dark stage", () => {
  it("is the dark palette, value for value", () => {
    // This is the claim the whole hybrid rests on. The stage is not a third
    // palette — it is `:root[data-theme="dark"]` applied to a scope instead of
    // to the document, which is why §3.3's verification and `axe`'s dark-theme
    // pass both already cover it, and why `opengraph-image.tsx` stays in step
    // with the marketing surfaces for free.
    //
    // Drift here is the failure this file exists to catch: a stage tuned by
    // hand one shade at a time is how you end up with two dark palettes, one
    // of which nobody ever measured.
    for (const [token, value] of Object.entries(DARK)) {
      expect(STAGE[token], `--${token} differs between the dark theme and the dark stage`).toBe(
        value,
      );
    }
  });

  it("resolves identically under either user theme", () => {
    // A dark stage is dark whether the visitor picked light or dark. The
    // mechanism is that the scope declares the *complete* set rather than a
    // diff — anything it omits would resolve from `:root`, and would therefore
    // be a light-theme value sitting on a near-black ground in exactly the
    // case nobody tests.
    for (const token of [...GROUNDS, ...FOREGROUNDS, "line-strong", "on-accent"]) {
      expect(STAGE[token], `--${token} is not declared on the stage scope`).toBeDefined();
    }
  });

  it("leaves the one colour that must never invert alone", () => {
    // `--paper` is `#ffffff` everywhere. On this ground that invariance stops
    // being a technicality and becomes the entire visual idea.
    expect(LIGHT.paper).toBe("#ffffff");
    expect(DARK.paper).toBeUndefined();
    expect(STAGE.paper).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- *
 * Tinted grounds: the worst point of every gradient and every glass surface.
 *
 * The redesign permits gradients and blur in exactly one form — light falling
 * on a surface — and bans them as the *only* ground under text. That ban needs
 * a number to mean anything, and the number has to be taken at the worst point
 * of the wash rather than at its average, because the worst point is where the
 * ground comes closest to the text sitting on it.
 *
 * So these compute what a browser would actually composite: `color-mix(in
 * oklab, …)` done in OKLab, `backdrop-filter` surfaces composited over the
 * extremes they can sit on, and a gradient's strongest stop laid over the flat
 * colour beneath it. Nothing here is a hand-copied hex.
 * -------------------------------------------------------------------------- */

type Channels = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function channels(hex: string): Channels {
  const { r, g, b } = rgb(hex);
  return [r / 255, g / 255, b / 255];
}

function toColor([r, g, b]: Channels): RgbColor {
  const clamp = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255);
  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

/** sRGB → OKLab, per the published matrices. */
function oklab([r, g, b]: Channels): Channels {
  const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function unOklab([L, a, b]: Channels): Channels {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** `color-mix(in oklab, top <share>, bottom)`, both opaque. */
function mix(top: string, share: number, bottom: string): string {
  const a = oklab(channels(top));
  const b = oklab(channels(bottom));
  const blended = unOklab(a.map((value, i) => value * share + b[i]! * (1 - share)) as Channels);
  const { r, g, b: bb } = toColor(blended);
  return `#${[r, g, bb].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** `color-mix(in oklab, top <share>, transparent)` composited over `under`. */
function over(top: string, share: number, under: string): string {
  const t = channels(top);
  const u = channels(under);
  const { r, g, b } = toColor(t.map((value, i) => value * share + u[i]! * (1 - share)) as Channels);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The declarations of the first rule with this selector, comments stripped.
 *
 * Indentation-tolerant because these rules live inside `@layer components` —
 * an unlayered `.machine-panel` would beat every `border-*` utility on the
 * same element, which is a trap this stylesheet has already fallen into once.
 */
function rule(selector: string): string {
  const source = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const at = new RegExp(`^\\s*${selector.replace(/[.:]/g, "\\$&")} \\{`, "m").exec(source);
  expect(at, `${selector} is not a rule in globals.css`).not.toBeNull();
  const open = source.indexOf("{", at!.index);
  return source.slice(open + 1, source.indexOf("\n  }", open));
}

/**
 * `color-mix(in oklab, var(--x) <share>, var(--y))` → the parts, or null.
 *
 * The share may itself be a token (`var(--tint-rest)`), which is the whole
 * point of it being one: the strength differs per theme, so it is resolved
 * against the palette being measured rather than read as a literal.
 */
function parseMix(
  declaration: string,
  tokens: Record<string, string>,
): { top: string; share: number; bottom: string | null } | null {
  const match =
    /color-mix\(\s*in oklab,\s*var\(--([a-z0-9-]+)(?:,[^)]*\))?\)\s*(?:([\d.]+)%|var\(--([a-z0-9-]+)\)),\s*(?:var\(--([a-z0-9-]+)\)|transparent)/.exec(
      declaration,
    );
  if (!match) return null;
  const share = match[2] ?? tokens[match[3]!]?.replace("%", "");
  expect(share, `no share resolved for ${declaration.trim()}`).toBeDefined();
  return { top: match[1]!, share: Number(share) / 100, bottom: match[4] ?? null };
}

/**
 * Rules whose `background-color` is a mix, and are therefore grounds.
 *
 * Pinned as a list, and the count is asserted against the stylesheet. Adding a
 * tinted surface without adding it here fails this file rather than shipping a
 * ground nobody measured — which is the same tripwire `trust-signals.ts` uses
 * for the test count, for the same reason.
 */
const TINTED_RULES = [".machine-panel", ".card-tinted", ".card-tinted:hover", ".glass"] as const;

/**
 * The foregrounds a tinted surface actually carries.
 *
 * Narrower than `FOREGROUNDS`, and the difference is real rather than a way of
 * getting the numbers to pass. These four rules paint *content* surfaces —
 * cards on the marketing pages, the parser's panel, the chrome that floats over
 * a page — and what is printed on them is body text and links. The status
 * colours are a different system: `--ok`, `--warn` and `--danger` appear in the
 * builder's issue list and its validation messages, always on their own
 * `--*-weak` ground, which is measured above as an ordinary palette pair.
 *
 * Asserting `--warn` on a hovered marketing card would be measuring a
 * combination the app never renders, and the only way to satisfy it would be to
 * make a card that already works worse.
 */
const ON_TINT = ["text", "text-muted", "text-faint", "accent", "machine"] as const;

describe("tinted grounds", () => {
  it("has no tinted ground this file does not know about", () => {
    const declared = CSS.replace(/\/\*[\s\S]*?\*\//g, "").match(/background-color:\s*color-mix\(/g);
    expect(
      declared?.length ?? 0,
      "a rule paints its ground with a color-mix and is not in TINTED_RULES",
    ).toBe(TINTED_RULES.length);
  });

  describe.each([
    ["light", LIGHT],
    ["dark", DARK],
    ["dark stage", STAGE],
  ])("%s", (_name, tokens) => {
    it.each(TINTED_RULES)("%s holds AA at the worst point of its wash", (selector) => {
      const body = rule(selector);
      const base = parseMix(body.match(/background-color:[^;]+/)?.[0] ?? "", tokens);
      expect(base, `${selector} has no background-color mix`).not.toBeNull();

      /*
       * A mix into `transparent` is a *translucent* surface — `.glass`. Its
       * real ground depends on whatever scrolls beneath it, so it is measured
       * over every extreme it can meet: the four chrome surfaces and the white
       * page, which is what passes under the header on `/builder`.
       */
      const grounds = base!.bottom
        ? [mix(tokens[base!.top]!, base!.share, tokens[base!.bottom]!)]
        : [...GROUNDS.map((g) => tokens[g]!), LIGHT.paper!].map((under) =>
            over(tokens[base!.top]!, base!.share, under),
          );

      /*
       * A gradient over the flat colour lightens it, and its strongest stop is
       * the worst point of the surface. A state rule inherits the wash from
       * the rule it is a state of — `.card-tinted:hover` re-declares only the
       * flat colour, and measuring it without `.card-tinted`'s gradient would
       * report the one ground on the page that is never actually painted.
       */
      const washFrom = (from: string) =>
        parseMix(rule(from).match(/background-image:[^;]+/s)?.[0] ?? "", tokens);
      const wash = washFrom(selector) ?? washFrom(selector.replace(/:.*$/, ""));

      for (const flat of grounds) {
        const worst = wash ? over(tokens[wash.top]!, wash.share, flat) : flat;
        for (const foreground of ON_TINT) {
          const measured = ratio(tokens[foreground]!, worst);
          expect(
            measured,
            `--${foreground} on ${selector} (${worst}) is ${measured.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(TEXT_FLOOR);
        }
      }
    });
  });
});

/* -------------------------------------------------------------------------- *
 * The `--*-weak` grounds.
 *
 * `--accent-weak`, `--ok-weak`, `--warn-weak`, `--danger-weak` and
 * `--machine-weak` are not tints, they are *grounds*: a badge is
 * `bg-ok-weak text-ok`, a callout is `bg-accent-weak text-text`, the preview's
 * pagination warning is `bg-warn-weak text-warn`, and X-Ray's scorecard header
 * is `bg-machine-weak`. Five pairs the palette matrix above never looked at,
 * because they are not one of the four chrome surfaces.
 *
 * The contract each one carries is the badge pattern: **its own foreground, and
 * the two neutral text colours, all readable on it.** `--text-faint` is left
 * out deliberately — nothing in the app writes the weakest grey onto a
 * coloured ground, and requiring it would force the weak colours lighter for a
 * combination that never renders.
 * -------------------------------------------------------------------------- */

const WEAK_PAIRS = ["accent", "ok", "warn", "danger", "machine"] as const;

describe.each([
  ["light", LIGHT],
  ["dark", DARK],
  ["dark stage", STAGE],
])("%s weak grounds", (_name, tokens) => {
  it.each(WEAK_PAIRS)("--%s-weak carries its own colour and the neutrals", (name) => {
    const ground = tokens[`${name}-weak`];
    expect(ground, `--${name}-weak is missing`).toBeDefined();

    for (const foreground of [name, "text", "text-muted"]) {
      const measured = ratio(tokens[foreground]!, ground!);
      expect(
        measured,
        `--${foreground} on --${name}-weak ${ground} is ${measured.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });
});
