"use client";

/**
 * The field every marketing page sits on.
 *
 * One fixed layer behind the whole document rather than a decoration per
 * section, which is the difference between a page that has an atmosphere and
 * a page with some gradients on it. Four things are in it:
 *
 * **The grid.** The workbench, drawn once, masked to a vignette so it is
 * dense at the top of the viewport and gone by the time it reaches body copy.
 * It parallaxes against the scrollbar — a small amount, and in the opposite
 * direction to the content, which is what stops a fixed background from
 * reading as a sticker on the screen.
 *
 * **Three lights**, drifting on three different clocks (34s, 46s, 58s). The
 * different periods are the whole trick: two lights on one duration resolve
 * into a visible pattern inside a minute, which is about how long someone
 * spends on a landing page. Two are the accent, one is `--machine`, so the
 * ground carries the same two-voice palette the content does.
 *
 * **A glow that follows the pointer**, heavily damped — it arrives about a
 * third of a second after you do. Mouse only: a finger is already on the
 * screen, and a light chasing a thumb is a different, worse effect.
 *
 * **Grain** over all of it. Large soft gradients band on 8-bit displays and
 * the banding is what makes them look cheap; noise dithers it away.
 *
 * ## Cost
 *
 * Everything animates `transform` or `opacity`. The pointer glow is driven by
 * motion values through a spring, so moving a mouse across the page causes no
 * React render at all. The whole layer is `aria-hidden`, `pointer-events:
 * none`, and mounted on marketing routes only — `/builder` never renders it.
 *
 * Under `prefers-reduced-motion` the lights hold still (see `globals.css`),
 * the parallax is not wired up and the pointer glow is not rendered.
 */

import {
  m,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect } from "react";
import { GLIDE } from "./motion-tokens";

/** How far the grid travels against a full page of scroll. */
const PARALLAX = 90;

export function AmbientBackground() {
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll();
  const gridY = useTransform(scrollYProgress, [0, 1], [0, -PARALLAX]);

  // Parked off-screen until the pointer is actually somewhere, so the glow
  // does not sit in the top-left corner on load like a stuck highlight.
  const pointerX = useMotionValue(-1000);
  const pointerY = useMotionValue(-1000);
  const glowX = useSpring(pointerX, GLIDE);
  const glowY = useSpring(pointerY, GLIDE);

  useEffect(() => {
    if (reduced) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, pointerX, pointerY]);

  return (
    <div aria-hidden className="ambient grain">
      <div className="ambient-wash" />
      <m.div className="ambient-grid" style={{ y: reduced ? 0 : gridY }} />

      <div className="ambient-light top-[-18rem] right-[-10rem] h-[42rem] w-[42rem]" />
      <div
        className="ambient-light ambient-light-b top-[18%] left-[-16rem] h-[32rem] w-[32rem]"
        style={{ ["--ambient-tint" as string]: "var(--machine)" }}
      />
      <div className="ambient-light ambient-light-c bottom-[-20rem] left-[35%] h-[36rem] w-[36rem]" />

      {reduced ? null : (
        <m.div
          className="absolute top-0 left-0"
          style={{ x: glowX, y: glowY, willChange: "transform" }}
        >
          {/*
            Centred on its own axis by a child, not by subtracting half the
            size in the handler: `x` and `translateX` are the same transform
            key in Motion, so setting both on one element silently drops one
            of them. The spring then interpolates the pointer position itself
            rather than a derived one.
          */}
          <div
            className="h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 16%, transparent), transparent)",
              filter: "blur(40px)",
            }}
          />
        </m.div>
      )}
    </div>
  );
}
