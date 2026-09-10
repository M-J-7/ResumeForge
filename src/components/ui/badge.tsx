/**
 * A small status pill.
 *
 * The five tones map onto the meanings the app already uses consistently:
 * emerald for complete, amber for "needs attention", red for destructive,
 * the accent for informational emphasis, neutral for a plain count.
 *
 * A badge is never the only carrier of meaning. Colour alone fails both
 * colour-blind users and WCAG AA, so every use pairs it with text — which is
 * also why this has no icon-only mode.
 */

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-line bg-surface-2 text-muted",
  accent: "border-accent/30 bg-accent-weak text-accent",
  ok: "border-ok/30 bg-ok-weak text-ok",
  warn: "border-warn/30 bg-warn-weak text-warn",
  danger: "border-danger/30 bg-danger-weak text-danger",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  className,
  tone = "neutral",
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
