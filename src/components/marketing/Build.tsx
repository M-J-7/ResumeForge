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
 */

import { m, useInView, useReducedMotion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IN_VIEW, buildGroup, buildItem, buildRow, dropPaper, drawRule } from "./motion-tokens";

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
   * frame. `view` for everything below it.
   */
  trigger?: "load" | "view";
}

export function BuildGroup({
  children,
  className,
  stagger = 0.07,
  delay = 0,
  trigger = "view",
}: BuildGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, IN_VIEW);
  const shown = reduced || trigger === "load" || inView;

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
}

/** One thing that arrives. Must be inside a `BuildGroup`. */
export function Built({ children, className, variant = "item" }: BuiltProps) {
  return (
    <m.div data-build="" className={className} variants={VARIANTS[variant]}>
      {children}
    </m.div>
  );
}

/** The same, as a list item, for lists that must stay lists. */
export function BuiltListItem({ children, className, variant = "row" }: BuiltProps) {
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
export function DrawnRule({ className }: { className?: string }) {
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
