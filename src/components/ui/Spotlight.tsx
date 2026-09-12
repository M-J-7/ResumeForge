"use client";

/**
 * Cards that are lit by the pointer.
 *
 * Two components, and the difference between them is the whole design idea.
 *
 * `Spotlight` is one card that lights when a pointer is over it.
 *
 * `SpotlightGroup` wraps a grid and lights **every** card in it from a single
 * moving source: the card under the pointer is at full strength, its
 * neighbours are lit in proportion to how close the pointer is to their edge,
 * and the rest are dark. Twelve independent hover states read as twelve
 * buttons; one light moving across twelve cards reads as a surface. That is
 * the effect worth having, and it is the one that costs a little thought.
 *
 * ## What is actually written
 *
 * Three custom properties per card — `--mx`, `--my` and `--spot-o` — and
 * nothing else. `globals.css` turns them into a wash under the content and a
 * one-pixel border lit near the pointer. No React state, no motion value and
 * no re-render is involved in moving a mouse across a grid; the handler
 * writes styles straight onto the elements.
 *
 * ## Why the rectangles are cached
 *
 * Measuring every card on every pointer move is the textbook layout thrash:
 * the previous frame's custom-property writes dirty style, and the next
 * frame's `getBoundingClientRect` forces the recalculation back. So the group
 * measures once when the pointer arrives, and again only when something can
 * actually have moved the cards — a scroll or a resize. Between those, a
 * pointer move is arithmetic and a style write.
 *
 * ## What it is not
 *
 * It never touches a text colour, a size or a position, so a contrast check
 * has nothing to see and the layout cannot move under a click. Touch and pen
 * are ignored: a finger is already on the card, and a light chasing a thumb
 * it is hidden under is an effect nobody sees. Under
 * `prefers-reduced-motion` the light still responds — it is an answer to the
 * pointer rather than motion of its own — but `globals.css` collapses the
 * fade that carries it.
 */

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** How far from a card's edge the light still reaches, in pixels. */
const REACH = 260;

interface SpotlightProps {
  children: ReactNode;
  className?: string;
  /**
   * `machine` lights in slate rather than pine. For the parser's own
   * surfaces, where the accent would be claiming the wrong voice.
   */
  tint?: "accent" | "machine";
}

/** Writes the pointer's position, in the element's own coordinates. */
function paint(element: HTMLElement, clientX: number, clientY: number, box: DOMRect): void {
  element.style.setProperty("--mx", `${clientX - box.left}px`);
  element.style.setProperty("--my", `${clientY - box.top}px`);
}

export function Spotlight({ children, className, tint = "accent" }: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const element = ref.current;
    if (!element) return;
    // One card, one measurement per frame at most: cheap enough to skip the
    // caching the group needs, and always correct after a scroll.
    paint(element, event.clientX, event.clientY, element.getBoundingClientRect());
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      className={cn("spot", tint === "machine" && "spot-machine", className)}
    >
      {children}
    </div>
  );
}

export function SpotlightGroup({ children, className, tint = "accent" }: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);
  /** Every `.spot` inside, with the rectangle it occupied when last measured. */
  const cards = useRef<{ element: HTMLElement; box: DOMRect }[]>([]);

  const measure = () => {
    const root = ref.current;
    if (!root) return;
    cards.current = [...root.querySelectorAll<HTMLElement>(".spot")].map((element) => ({
      element,
      box: element.getBoundingClientRect(),
    }));
  };

  // A scroll or a resize is the only thing that can move a card while the
  // pointer is inside the group, so those are the only times a re-measure is
  // owed. Bound for the group's lifetime rather than only while hovered: two
  // passive listeners cost nothing, and hover state would cost a render.
  useEffect(() => {
    const onChange = () => {
      if (cards.current.length > 0) measure();
    };
    window.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange, { passive: true });
    return () => {
      window.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    if (cards.current.length === 0) measure();

    for (const { element, box } of cards.current) {
      paint(element, event.clientX, event.clientY, box);

      // Distance from the pointer to the nearest point of the card — zero
      // while it is inside, so the card under the pointer is always at full
      // strength and the falloff starts at its edge.
      const dx = Math.max(box.left - event.clientX, 0, event.clientX - box.right);
      const dy = Math.max(box.top - event.clientY, 0, event.clientY - box.bottom);
      const distance = Math.sqrt(dx * dx + dy * dy);
      element.style.setProperty("--spot-o", String(Math.max(0, 1 - distance / REACH)));
    }
  };

  const onPointerLeave = () => {
    for (const { element } of cards.current) element.style.removeProperty("--spot-o");
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn(tint === "machine" && "spot-machine", className)}
    >
      {children}
    </div>
  );
}
