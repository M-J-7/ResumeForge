"use client";

/**
 * The landing hero: the document, and what a machine recovered from it.
 *
 * ## Why this is the hero
 *
 * Every builder in this category claims ATS readability and none shows the
 * evidence. This is the evidence, and it was previously the fourth of six
 * identical card sections, rendered about 240px wide. Putting it at the top is
 * the whole point of the redesign — the page opens with the claim being
 * performed rather than asserted.
 *
 * Both panes derive from `SAMPLE` in `PaperSample`: the page is rendered from
 * it and `sampleLines()` is computed from it. They cannot drift into promising
 * a recovery the structure would not actually produce, which is the only
 * reason a marketing animation is allowed to make a parsing claim at all.
 *
 * ## Three things move here, and each one is the argument
 *
 * **The read.** A line sweeps the page once and the recovered text prints in
 * behind it. Not decoration: it is the product's claim, performed, and it is
 * the only reason this pair is at the top of the page instead of a stock
 * photograph.
 *
 * **The pairing.** Point at a line of recovered text and the block it came out
 * of lights up on the page; point at the page and its lines light up. The two
 * panes are one object seen twice, and hovering is the cheapest possible way
 * to say so — cheaper than the caption, which still says it for everyone who
 * is not holding a mouse.
 *
 * **The page itself.** It tilts a few degrees under the pointer, on a spring.
 * That is what makes it read as an object on a workbench rather than a picture
 * of one, and it is the only place in the app with a perspective transform.
 *
 * ## What is not allowed to move
 *
 * Nothing here animates opacity on text. `e2e/a11y.spec.ts` runs axe over this
 * route in both themes and scores contrast against whatever it catches
 * mid-flight; a line at 40% opacity measures as a failure. Every reveal is a
 * clip, a translate or a blur — none of which a contrast check can see, all of
 * which run on the compositor.
 *
 * Under `prefers-reduced-motion` there is no sweep, no print, no tilt and no
 * replay control: both panes render finished. That is the correct behaviour
 * rather than a degraded one — the comparison is the content, and the motion
 * was only ever the delivery.
 */

import { m, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { PaperSample, sampleLines, type BlockId } from "./PaperSample";
import { GLIDE, dropPaper } from "./motion-tokens";

const SWEEP_SECONDS = 0.9;
/** How long the page takes to land before the read starts, on first load. */
const LEAD_SECONDS = 0.55;
/** Degrees of tilt at the far edge of the page. Small: this is a document. */
const TILT = 5;

export function HeroDocument({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const lines = sampleLines();

  /** Bumped by the replay control; remounts the sweep and the print. */
  const [run, setRun] = useState(0);
  const [active, setActive] = useState<BlockId | null>(null);

  // Pointer position as a pair of motion values, so a mouse crossing the page
  // never causes a React render. The springs are what stop the tilt from
  // snapping to the cursor — it follows, and settles.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(px, [0, 1], [-TILT, TILT]), GLIDE);
  const rotateX = useSpring(useTransform(py, [0, 1], [TILT, -TILT]), GLIDE);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    // Touch and pen never tilt. A finger is already on the object, and a
    // page that leans away from the thumb holding it is a strange thing.
    if (reduced || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - box.left) / box.width);
    py.set((event.clientY - box.top) / box.height);
  };

  const rest = () => {
    px.set(0.5);
    py.set(0.5);
  };

  // First run waits for the page to land; a replay starts immediately, because
  // the page is already there and re-dropping it would look like a reload.
  const lead = run === 0 ? LEAD_SECONDS : 0;

  return (
    <figure className={cn("relative", className)}>
      {/*
        `items-stretch` above `sm`, so the crop takes its height from the
        recovered pane rather than from the page's own proportions. The two
        panes are one object seen twice and they should end on the same line;
        letting the page stop short of the column beside it was the one thing
        that made the pair read as a picture and a caption.
      */}
      <div className="flex flex-col items-center gap-5 sm:grid sm:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] sm:items-stretch sm:gap-6">
        <m.div
          data-build=""
          variants={dropPaper}
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            rest();
            setActive(null);
          }}
          style={{ rotateX, rotateY, transformPerspective: 1400 }}
          className="relative mx-auto w-full max-w-[17rem] sm:mx-0 sm:max-w-none"
        >
          {/*
            The light the page is lit by. The ambient field behind the site
            drifts on its own clock and cannot be relied on to be *here*; this
            one is anchored to the document, which is the object the whole
            composition is about.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 -z-20 rounded-full opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 22%, transparent), transparent)",
            }}
          />
          {/*
            The second sheet. A resume is rarely one page and a stack has a
            depth a single rectangle does not — it is also the cheapest way to
            make the shadow legible, because there is now something for the
            page to cast one onto.
          */}
          <div
            aria-hidden
            className="bg-paper ring-paper-edge pointer-events-none absolute inset-0 -z-10 translate-x-2 translate-y-3 rotate-[1.2deg] rounded-sm shadow-[var(--shadow-page)] ring-1"
          />

          {/*
            Cropped at every width, not scaled down.

            A4 at this width is over 500px tall and the sample fills the top
            half of it, so the honest full page renders as a short resume
            above a large empty rectangle — which reads as a broken image
            rather than as a document with room to spare. Clipping it to about
            the height of the recovered-text panel pairs the two panes and
            lets the fade say "the page continues" instead. The crop used to
            stop at `sm`, which left the phone showing the blank half.
          */}
          <div className="relative max-h-[19rem] overflow-hidden rounded-sm sm:absolute sm:inset-0 sm:max-h-none">
            <PaperSample activeId={active} onBlockChange={setActive} />

            {reduced ? null : (
              <m.div
                key={run}
                aria-hidden
                initial={{ y: "-100%", opacity: 1 }}
                animate={{ y: "0%", opacity: 0 }}
                transition={{
                  y: { duration: SWEEP_SECONDS, ease: [0.32, 0.72, 0, 1], delay: lead },
                  // Fades out as it arrives, so the read-line does not park on
                  // the bottom edge of the page and read as a rule.
                  opacity: { duration: 0.3, delay: lead + SWEEP_SECONDS - 0.12 },
                }}
                className="pointer-events-none absolute inset-0 flex flex-col justify-end"
                style={{ willChange: "transform" }}
              >
                <div className="from-accent/0 to-accent/12 h-1/4 bg-gradient-to-b" />
                <div className="bg-accent/70 h-px w-full" />
              </m.div>
            )}

            {/* The crop's bottom edge. `--paper` rather than a chrome token:
                it is fading the page into itself, and paper does not follow
                the theme. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--paper)]"
            />
          </div>

          {/*
            The three structural facts, pinned to the page they are facts
            about. D14 allows exactly this claim and no more: it describes the
            document's structure, never what an employer's software will do
            with it. It sits outside the crop, so it tilts with the page
            rather than being clipped by it — and it fills the lower half of a
            one-page resume, which is otherwise the emptiest rectangle in the
            hero.
          */}
          <p className="border-line bg-surface-0/92 text-muted absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-pop)] backdrop-blur-sm">
            <span aria-hidden className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
            One column, real text, no images
          </p>
        </m.div>

        {/* What the parser got back. Mono, because in this app monospace
            means "a machine recovered this" and never anything else. */}
        <m.div
          data-build=""
          variants={dropPaper}
          className="border-line bg-surface-0 w-full rounded-lg border"
        >
          <div className="border-line flex items-center justify-between gap-3 border-b px-3.5 py-2">
            <span className="text-machine font-mono text-[11px] tracking-wide">recovered text</span>
            {reduced ? null : (
              <button
                type="button"
                onClick={() => setRun((value) => value + 1)}
                className="text-faint hover:text-text hover:border-line-strong focus-visible:ring-accent rounded-sm border border-transparent px-2 py-0.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
              >
                Read it again
              </button>
            )}
          </div>

          <pre
            onPointerLeave={() => setActive(null)}
            className="text-muted overflow-hidden px-3.5 py-3 font-mono text-[10.5px] leading-[1.55] whitespace-pre-wrap"
          >
            {lines.map((line, index) => (
              <m.span
                key={`${run}-${index}`}
                onPointerEnter={() => setActive(line.id)}
                className={cn(
                  "block min-h-[1em] rounded-[2px]",
                  line.id && active === line.id && "machine-mark",
                )}
                /*
                 * A wipe from the left, not a fade: this is a machine printing
                 * a line, and it keeps the text at full contrast for the whole
                 * reveal — which is what keeps axe out of it.
                 */
                initial={reduced ? false : { clipPath: "inset(0% 100% 0% 0%)" }}
                animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                transition={{
                  duration: 0.22,
                  // Tracks the read-line down the page: a line prints as the
                  // sweep reaches roughly where it sits on the page.
                  delay: reduced ? 0 : lead + 0.1 + (index / lines.length) * SWEEP_SECONDS * 0.9,
                }}
              >
                {line.text || " "}
              </m.span>
            ))}
          </pre>
        </m.div>
      </div>

      <figcaption className="text-faint mt-4 text-sm leading-relaxed">
        The same resume twice: the page a person reads, and the plain text a parser recovers from
        it. Point at either side to see which part of one became which part of the other. An
        illustration of the structure, not a claim about any particular employer&rsquo;s software.
      </figcaption>
    </figure>
  );
}
