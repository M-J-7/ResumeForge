/**
 * Form control primitives.
 *
 * Written directly rather than pulled through the shadcn/ui CLI. shadcn's
 * model is "copy the component into your project and own it", so the
 * generator is a convenience, not the library — and running it would rewrite
 * `globals.css`, the Tailwind config, and add a `components.json` we would
 * then have to reconcile with the Tailwind 4 setup already here. These
 * follow the same conventions (Tailwind classes, a `cn` merge helper, native
 * elements with forwarded props) so any shadcn component can be dropped in
 * beside them later.
 *
 * Accessibility is not decoration here: §9 requires the builder to be
 * keyboard-navigable end to end and WCAG AA. Every control below is a real
 * native element with a real label association and a visible focus ring.
 */

"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950";

const fieldBase = cn(
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition",
  "placeholder:text-zinc-400",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500",
  focusRing,
);

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "pr-8", className)} {...props} />;
}

const buttonVariants = {
  primary:
    "bg-sky-700 text-white hover:bg-sky-800 disabled:hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  danger:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function Button({
  className,
  variant = "secondary",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export interface FieldProps {
  label: string;
  /** Shown beneath the label; use for guidance, not for restating the label. */
  hint?: string;
  error?: string;
  /** Renders the control. Receives the ids to wire up label and error. */
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
  className?: string;
}

/**
 * Label + control + error message, wired together by id.
 *
 * The error is `role="alert"` and referenced by `aria-describedby` so a
 * screen reader announces it when it appears, rather than leaving the user
 * to discover that a field went red.
 */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A labelled on/off switch built on a real checkbox. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "h-4 w-4 rounded border-zinc-300 text-sky-700 dark:border-zinc-600",
          focusRing,
        )}
      />
      {label}
    </label>
  );
}
