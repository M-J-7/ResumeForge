/**
 * A band, and the rhythm between bands.
 *
 * The landing page was eleven `<section className="px-6 py-16 sm:py-24">`
 * elements with slightly different container widths, and every new page copied
 * the nearest one. That is how a site ends up with four vertical rhythms and
 * no way to change any of them — the spacing was a decision nobody had made,
 * repeated.
 *
 * Two rhythms, from the tokens in `globals.css`: `band` opens or closes an
 * argument, `tight` continues one. Anything that wants a third is a band that
 * has not decided which it is.
 *
 * ## `lit`
 *
 * The one form a gradient takes on this site: light falling on the band from
 * its own top edge. `accent` is our voice, `machine` is the parser's, which is
 * the same two-voice rule the palette follows everywhere else. It always sits
 * over a solid token ground — a dark stage paints `--surface-1` under it, and
 * a band on a stage page inherits the same solid from `<body>` — so the wash
 * is never the only ground under text. `palette.test.ts` measures the lit
 * ground rather than the flat one.
 *
 * A server component on purpose. It renders no motion and holds no state, so
 * a page that uses it for structure pays nothing for the layout.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionProps {
  children: ReactNode;
  /** `tight` for a band that continues the argument above it. */
  rhythm?: "band" | "tight";
  /** Draws the band's own top-edge light, in the named voice. */
  lit?: "accent" | "machine";
  /** Makes this band a dark stage of its own. Omit on a page that is already one. */
  stage?: boolean;
  /** A hairline above the band, where two grounds meet. */
  ruled?: boolean;
  className?: string;
  /** The content column. Defaults to the page's widest measure. */
  containerClassName?: string;
  id?: string;
  /** The id of the heading this band is named by, for the landmark. */
  labelledBy?: string;
}

export function Section({
  children,
  rhythm = "band",
  lit,
  stage,
  ruled,
  className,
  containerClassName,
  id,
  labelledBy,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-stage={stage ? "dark" : undefined}
      className={cn(
        "relative px-6",
        rhythm === "band" ? "py-band" : "py-band-tight",
        lit && "band-lit",
        ruled && "border-line border-t",
        className,
      )}
      style={lit === "machine" ? { ["--band-tint" as string]: "var(--machine)" } : undefined}
    >
      <div className={cn("mx-auto w-full max-w-6xl", containerClassName)}>{children}</div>
    </section>
  );
}
