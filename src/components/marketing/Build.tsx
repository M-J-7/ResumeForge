"use client";

/**
 * The build primitives: the page assembling itself, as three components.
 *
 * ## Why the copy is not in here
 *
 * These are wrappers, and the sections they wrap stay in `app/page.tsx` as
 * ordinary server-rendered markup passed through as `children`. A client
 * component's children are rendered on the server and handed over as an
 * already-built tree, so putting motion on the landing page costs it no
 * server rendering, no SEO and no readability — the page still reads as the
 * page rather than as a pile of animation config.
 *
 * ## Why `useInView` rather than `whileInView`
 *
 * `whileInView` is part of Motion's viewport feature, and the viewport
 * feature is not in `domAnimation` — the bundle `MotionProvider` loads. With
 * `LazyMotion strict` a `whileInView` prop does not error, it simply never
 * fires, which is the worst possible failure: it type-checks, it lints, it
 * ships, and nothing ever appears. `useInView` is a hook and works under any
 * feature bundle.
 *
 * ## Variants propagate through context, not the DOM
 *
 * `BuildGroup` is the only element that watches the viewport. Its descendants
 * declare `variants` and inherit `animate` through React context, so a plain
 * `<ul>` or `<dl>` between a group and its items changes nothing — which is
 * what lets the markup keep the element it should have had anyway.
 *
 * ## Above the fold, the build is CSS
 *
 * A Motion reveal cannot start before React hydrates, and every built element
 * is server-rendered in its hidden state. Below the fold that gap is invisible
 * — nobody is looking yet. Above it, it is the page: on a mid-range phone the
 * bundle takes seconds to arrive and run, and for all of them the title and
 * the lead sat clipped to nothing over an empty band. Lighthouse measured
 * `/check`'s largest paint at 3.8s on 2026-09-30, with the text itself in the
 * HTML at 0.6s; the filmstrip showed a blank header until hydration.
 *
 * So `trigger="load"` renders plain elements and the same wipe runs as CSS
 * keyframes (`globals.css`, "The build, above the fold"), which start at first
 * paint whether or not a script ever arrives. The keyframes are Motion's
 * variants written out once more — `build-load.test.ts` holds the two to the
 * same numbers — so the page still assembles itself; it simply starts doing so
 * when it is painted rather than when it is hydrated.
 */

import { m, useInView, useReducedMotion } from "motion/react";
import { createContext, useContext, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IN_VIEW, buildGroup, buildItem, buildRow, dropPaper, drawRule } from "./motion-tokens";

/**
 * True inside a `trigger="load"` group, where arrival is CSS rather than
 * Motion. Variants propagate through context; so does this.
 */
const LoadGroupContext = createContext(false);

/** `--build-order`, for an item the `:nth-child` rules cannot place. */
function orderStyle(order: number | undefined): CSSProperties | undefined {
  return order === undefined ? undefined : ({ "--build-order": order } as CSSProperties);
}

const VARIANTS = {
  item: buildItem,
  row: buildRow,
  paper: dropPaper,
} as const;

export interface BuildGroupProps {
  children: ReactNode;
  className?: string;
  /** Seconds between each descendant's arrival. */
  stagger?: number;
  /** Seconds before the first one. */
  delay?: number;
  /**
   * `load` for anything above the fold — waiting for an intersection callback
   * on content that is already on screen shows the visitor a blank hero for a
   * frame, and waiting for hydration shows it for seconds. A `load` group
   * builds in CSS from first paint (see the note at the top). `view` for
   * everything below it.
   */
  trigger?: "load" | "view";
}

export function BuildGroup({ trigger = "view", ...props }: BuildGroupProps) {
  return trigger === "load" ? <LoadBuildGroup {...props} /> : <ViewBuildGroup {...props} />;
}

/**
 * The CSS half. No hooks and no Motion: the element and its items are in their
 * finished state in the HTML, and the keyframes carry them there from hidden
 * starting at first paint. `backwards` fill, not `both` — once an item lands it
 * holds no clip and no filter, for the same reason `transitionEnd` drops them
 * on the Motion path (a resting clip cuts off a hover shadow).
 */
function LoadBuildGroup({ children, className, stagger = 0.07, delay = 0 }: BuildGroupProps) {
  const timing = {
    "--build-stagger": `${stagger}s`,
    "--build-delay": `${delay}s`,
  } as CSSProperties;

  return (
    <LoadGroupContext.Provider value>
      <div data-build-load="" className={className} style={timing}>
        {children}
      </div>
    </LoadGroupContext.Provider>
  );
}

function ViewBuildGroup({ children, className, stagger = 0.07, delay = 0 }: BuildGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, IN_VIEW);
  const shown = reduced || inView;

  return (
    <m.div
      ref={ref}
      data-build=""
      className={className}
      /*
       * `initial={false}` under reduced motion, and it propagates: children
       * mount in their finished state with nothing to skip. That is the
       * correct behaviour rather than a degraded one — the content is the
       * point and the assembly was only ever the delivery.
       */
      initial={reduced ? false : "hidden"}
      animate={shown ? "shown" : "hidden"}
      variants={buildGroup(stagger, delay)}
    >
      {children}
    </m.div>
  );
}

interface BuiltProps {
  children: ReactNode;
  className?: string;
  /**
   * `item` wipes up and sharpens, `row` wipes without the blur (cheaper, and
   * right for anything carrying a border), `paper` falls onto its own shadow
   * without a clip — clipping a page would cut its shadow off square.
   */
  variant?: keyof typeof VARIANTS;
  /**
   * Place in a `load` group's stagger, from 0. Only needed for an item that is
   * not a direct child of its group — direct children are numbered by
   * `:nth-child` in `globals.css`. Ignored in a `view` group, where Motion
   * staggers in render order.
   */
  order?: number;
}

/** One thing that arrives. Must be inside a `BuildGroup`. */
export function Built({ children, className, variant = "item", order }: BuiltProps) {
  const load = useContext(LoadGroupContext);
  if (load) {
    return (
      <div
        data-build=""
        data-build-variant={variant}
        className={className}
        style={orderStyle(order)}
      >
        {children}
      </div>
    );
  }
  return (
    <m.div data-build="" className={className} variants={VARIANTS[variant]}>
      {children}
    </m.div>
  );
}

/** The same, as a list item, for lists that must stay lists. */
export function BuiltListItem({ children, className, variant = "row", order }: BuiltProps) {
  const load = useContext(LoadGroupContext);
  if (load) {
    return (
      <li
        data-build=""
        data-build-variant={variant}
        className={className}
        style={orderStyle(order)}
      >
        {children}
      </li>
    );
  }
  return (
    <m.li data-build="" className={className} variants={VARIANTS[variant]}>
      {children}
    </m.li>
  );
}

/**
 * A hairline that draws itself from the left.
 *
 * The section rules were the quietest thing on the old page and they are the
 * first thing to arrive on this one — a rule drawing across is what a page
 * being set looks like.
 */
export function DrawnRule({ className, order }: { className?: string; order?: number }) {
  const load = useContext(LoadGroupContext);
  if (load) {
    return (
      <div
        aria-hidden
        data-build=""
        data-build-variant="rule"
        style={orderStyle(order)}
        className={cn("bg-line h-px w-full origin-left", className)}
      />
    );
  }
  return (
    <m.div
      aria-hidden
      data-build=""
      variants={drawRule}
      style={{ transformOrigin: "left" }}
      className={cn("bg-line h-px w-full origin-left", className)}
    />
  );
}
