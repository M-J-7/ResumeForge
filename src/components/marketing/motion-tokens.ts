/**
 * The feel of the marketing surfaces, in one place.
 *
 * `design.md` §5.2 sets the brief: this is a calm document tool, so springs
 * settle rather than bounce. The direction changed from "one orchestrated
 * moment per page" to a page that assembles itself, but the *feel* did not —
 * a page that builds itself in front of you is still allowed to be composed.
 * Nothing here overshoots by more than a hair.
 *
 * Springs are specified perceptually (`bounce` + `visualDuration`) rather
 * than by stiffness and damping, which is the form Motion documents and the
 * only one that survives being read six months later.
 */

import type { Transition, Variants } from "motion/react";

/** Larger travel, decelerating. The same curve as `--ease-soft` in CSS. */
export const EASE_SOFT: [number, number, number, number] = [0.32, 0.72, 0, 1];

/** How a block of content arrives. Long enough to read as assembly. */
export const BUILD: Transition = { duration: 0.55, ease: EASE_SOFT };

/** How something answers a pointer. Barely overshoots; matches `--ease-press`. */
export const SETTLE: Transition = { type: "spring", bounce: 0.15, visualDuration: 0.28 };

/** How a tracked value follows the pointer or the scrollbar. No overshoot. */
export const GLIDE: Transition = { type: "spring", bounce: 0, visualDuration: 0.45 };

/**
 * The container half of the build.
 *
 * Holds no visual properties of its own — it exists to sequence its
 * descendants. Variants propagate through React context rather than the DOM,
 * so plain `<ul>`s and `<div>`s between this and the items are fine.
 */
export function buildGroup(stagger = 0.07, delayChildren = 0): Variants {
  return {
    hidden: {},
    shown: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

/**
 * The item half: a wipe up from behind its own bottom edge, sharpening as it
 * lands.
 *
 * **Opacity is deliberately absent, and that is not a style choice.** axe runs
 * over both themes on every route and scores contrast on whatever it finds
 * mid-flight; text caught at 40% opacity measures as a contrast failure and
 * fails the build. `e2e/a11y.spec.ts` has already flaked once on exactly that
 * (the preview's fading "Updating…" label). Clip, translate and blur are
 * invisible to a contrast check, run on the compositor, and read better here
 * anyway — the text is uncovered rather than faded up.
 */
export const buildItem: Variants = {
  hidden: { y: 24, filter: "blur(6px)", clipPath: "inset(0% 0% 100% 0%)" },
  shown: {
    y: 0,
    filter: "blur(0px)",
    clipPath: "inset(0% 0% 0% 0%)",
    transition: BUILD,
    /*
     * Both are dropped once the element has arrived, and that is load-bearing
     * rather than tidiness. A `clip-path` clips an element's *shadow* as well
     * as its content, so a card that stayed clipped at `inset(0 0 0 0)` would
     * hover with `.lift` and grow no shadow at all — and it would cut the
     * pointer-lit border off at the edge. A resting `filter` also holds a
     * compositor layer for the life of the page for no reason.
     */
    transitionEnd: { clipPath: "none", filter: "none" },
  },
};

/** The same, without the blur — for rows that carry a border. */
export const buildRow: Variants = {
  hidden: { y: 16, clipPath: "inset(0% 0% 100% 0%)" },
  shown: {
    y: 0,
    clipPath: "inset(0% 0% 0% 0%)",
    transition: BUILD,
    transitionEnd: { clipPath: "none" },
  },
};

/**
 * A rule drawing itself from the left. `scaleX` only, so it never touches
 * layout.
 */
export const drawRule: Variants = {
  hidden: { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: 0.7, ease: EASE_SOFT } },
};

/**
 * How the document arrives.
 *
 * No clip and no opacity: the page carries the only real shadow in the app,
 * and a clip-path would cut it off square. It falls a short distance onto its
 * own shadow instead.
 */
export const dropPaper: Variants = {
  hidden: { y: 28, scale: 0.985 },
  shown: {
    y: 0,
    scale: 1,
    transition: { type: "spring", bounce: 0.12, visualDuration: 0.6 },
  },
};

/** Viewport margin shared by every on-scroll build: fires a little early. */
export const IN_VIEW = { once: true, margin: "0px 0px -12% 0px" } as const;
