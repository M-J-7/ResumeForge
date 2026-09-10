/**
 * One score, as an arc.
 *
 * Built for P27's match view, where **three** of these appear side by side.
 * That plurality is the point and it is a product decision, not a layout one:
 * D12 rejects a single 0–100 badge because gamifying one partly-heuristic
 * number trains people to optimise the number instead of the resume. Three
 * separate numbers, each with its own "why this matters", cannot be collapsed
 * into a single thing to maximise.
 *
 * ## Accessibility
 *
 * The arc is `aria-hidden` and the value is real text underneath it. That is
 * both simpler and better than `role="meter"`: the number is announced as
 * part of the ordinary reading order, and it stays legible when the user
 * overrides colours. It also keeps `getByRole("progressbar")` — which
 * `StepNav` owns and the test suite asserts on — meaning exactly one thing.
 */

import { cn } from "@/lib/utils";

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The arc spans 270°, leaving a gap at the bottom so the ends read as ends. */
const SWEEP = 0.75;

export type GaugeTone = "accent" | "ok" | "warn" | "danger";

const strokes: Record<GaugeTone, string> = {
  accent: "stroke-accent",
  ok: "stroke-ok",
  warn: "stroke-warn",
  danger: "stroke-danger",
};

/** Colour is a summary, never the message — every gauge is labelled in text. */
export function toneForScore(score: number): GaugeTone {
  if (score >= 75) return "ok";
  if (score >= 45) return "warn";
  return "danger";
}

export function Gauge({
  value,
  label,
  tone,
  className,
}: {
  /** 0–100. Clamped, because a scorer bug should not produce a wrapped arc. */
  value: number;
  label: string;
  tone?: GaugeTone;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const resolved = tone ?? toneForScore(clamped);
  const filled = CIRCUMFERENCE * SWEEP * (clamped / 100);

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative">
        <svg
          viewBox="0 0 64 64"
          width="64"
          height="64"
          aria-hidden="true"
          className="-rotate-[135deg]"
        >
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-surface-2"
            strokeDasharray={`${CIRCUMFERENCE * SWEEP} ${CIRCUMFERENCE}`}
          />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className={cn(strokes[resolved], "transition-[stroke-dasharray] duration-[var(--dur)]")}
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          />
        </svg>
        <span className="text-text absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">
          {clamped}
        </span>
      </div>
      <span className="text-muted text-xs font-medium">{label}</span>
    </div>
  );
}
