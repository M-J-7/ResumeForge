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
import { buttonClassName, focusRing, type ButtonSize, type ButtonVariant } from "./button-style";

/*
 * The button's styling lives in `button-style.ts`, which is **not** a client
 * module, and is re-exported here so the existing imports keep working.
 *
 * That split is not tidiness. `buttonClassName` is a pure string function, and
 * a server component that calls one exported from a client module does not get
 * a warning — React throws, and the route renders its error boundary. `/404`
 * did exactly that, showing "Something went wrong" on the page whose entire
 * job is to say calmly that a link was wrong.
 */
export { buttonClassName, focusRing, type ButtonSize, type ButtonVariant } from "./button-style";

/*
 * Field depth, from the token rather than from Tailwind's `shadow-sm`.
 *
 * `shadow-sm` is a raw grey blur from outside the palette. On the light
 * theme it read as a slightly dirty edge; on dark it did nothing at all,
 * because there is nothing for a grey blur to be darker than. `--elev-2`
 * is the inset top highlight plus a hairline, which is what a recessed
 * input actually looks like under a light — and it is defined per theme.
 */
const fieldBase = cn(
  "border-line-strong bg-surface-0 text-text text-body w-full rounded-md border px-3 py-2 shadow-[var(--elev-2)]",
  "transition-[border-color,box-shadow,background-color] duration-[var(--dur-fast)] ease-[var(--ease)]",
  // A boundary that answers the pointer before it is clicked. The border is
  // already at 3.36:1 for WCAG 1.4.11; this is the affordance on top of it.
  "hover:border-faint",
  "placeholder:text-faint",
  "disabled:cursor-not-allowed disabled:opacity-60",
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

export function Button({
  className,
  variant = "secondary",
  size = "md",
  icon,
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Rendered before the label. Decorative only — the accessible name still
   * comes from `children`, which several e2e assertions match by exact
   * string. See the header of `icons.tsx`.
   */
  icon?: ReactNode;
}) {
  return (
    <button type="button" className={buttonClassName({ variant, size, className })} {...props}>
      {icon}
      {children}
    </button>
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
      <label htmlFor={id} className="text-text text-sm font-medium">
        {label}
      </label>
      {children({ id, describedBy })}
      {/*
        Hint *below* the control, and this is the single highest-value layout
        fix in the redesign rather than a preference. It used to sit between
        the label and the input, so in a two-column row a field with a
        three-line hint pushed its input three lines lower than the field
        beside it — every contact row was visibly misaligned, and the form
        looked unfinished because it was. Below the control, every input in a
        row shares a baseline however long its hint runs.

        `aria-describedby` is unchanged: it names both ids and does not care
        about document order.
      */}
      {hint ? (
        <p id={hintId} className="text-faint text-xs leading-relaxed">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-danger text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A labelled on/off switch built on a real checkbox.
 *
 * `label` is required and must be non-empty, because the label element *is*
 * the checkbox's accessible name. `SectionManager` previously passed `""` and
 * put the text in a sibling `sr-only` span, which looks equivalent and is not:
 * a sibling is not associated with the input, so every visibility toggle in
 * the builder announced itself as an unnamed checkbox. Use `labelHidden` when
 * the text should not be seen — the name still exists, it is just not painted.
 */
export function Toggle({
  checked,
  onChange,
  label,
  labelHidden = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  labelHidden?: boolean;
}) {
  return (
    <label className="text-text inline-flex cursor-pointer items-center gap-2 text-sm">
      {/*
        `control-check` in `globals.css` replaces the browser's own box.
        `text-accent` did nothing here — a native checkbox ignores `color` —
        so every visibility toggle in the builder painted itself in the
        system's blue, on a green palette, in the one screen that is the
        product. It is still a real `<input type="checkbox">`: the appearance
        is restyled and nothing about the semantics, the label association or
        the keyboard behaviour is.
      */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn("control-check", focusRing)}
      />
      <span className={labelHidden ? "sr-only" : undefined}>{label}</span>
    </label>
  );
}
