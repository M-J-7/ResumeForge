"use client";

/**
 * The claims we will not make, struck through as they arrive.
 *
 * The list is the most distinctive copy on the site and it was the quietest
 * thing on the page: four grey lines in a box. It reads better performed —
 * each clause arrives intact and is then struck out, which is the visual form
 * of something removed rather than a description of one.
 *
 * `text-decoration-color` is animatable, which is what makes this possible
 * across text that wraps to two lines; an absolutely-positioned rule would
 * only ever strike the first. The strike is CSS (see `.strike-in` in
 * `globals.css`) and this component only decides *when* — no Motion involved
 * for four transitions on a colour.
 *
 * The strike is decorative and stays decorative: a line through a word is not
 * something a screen reader conveys, so the sentence introducing the list is
 * what carries the meaning, exactly as it did before.
 */

import { useInView } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { IN_VIEW } from "./motion-tokens";

export interface RefusalListProps {
  claims: readonly string[];
  className?: string;
  /**
   * The size these are set at.
   *
   * This list is the most distinctive copy on the site and no competitor has
   * anything like it, so the landing page sets it as a statement rather than
   * as the fine print of a card. Small stays for anywhere it is supporting
   * material.
   */
  itemClassName?: string;
}

export function RefusalList({ claims, className, itemClassName }: RefusalListProps) {
  const ref = useRef<HTMLUListElement>(null);
  const struck = useInView(ref, IN_VIEW);

  return (
    <ul ref={ref} className={cn("mt-4 flex flex-col gap-3", className)}>
      {claims.map((claim, index) => (
        <li
          key={claim}
          data-struck={struck ? "" : undefined}
          // Struck one after another rather than all at once — the list reads
          // as four decisions, and taken together they take about as long as
          // the sentence above them.
          style={{ transitionDelay: `${index * 140}ms` }}
          /* Struck in `--line-strong`, not in the danger colour. Red reads as
             "something went wrong"; these are things we chose not to say,
             which is a calm statement rather than an error. */
          className={cn("strike-in text-muted text-small leading-relaxed", itemClassName)}
        >
          {claim}
        </li>
      ))}
    </ul>
  );
}
