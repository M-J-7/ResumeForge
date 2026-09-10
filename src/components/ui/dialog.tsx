"use client";

/**
 * A modal, on the platform's own `<dialog>`.
 *
 * `showModal()` gives focus trapping, Escape to close, the inert background,
 * and top-layer stacking for free — all four of which are what modal
 * libraries are mostly for, and all four of which browsers have shipped for
 * years now. `CommandPalette.tsx` already proved the approach in this
 * codebase; this generalises it.
 *
 * ## What this deliberately does not replace
 *
 * The inline two-step confirms in `EntryCard`, `ResumeList`, `DeleteAccount`
 * and `BuilderShell`'s "Clear all data". `EntryCard.tsx` states the reason and
 * it still holds: a modal for "are you sure" interrupts a keyboard flow
 * badly. Use this for something the user opened on purpose and expects to
 * fill in — naming a new resume, choosing a design — not for interrupting
 * them.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./control";
import { XIcon } from "./icons";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  /**
   * The dialog's own name, from the heading it already renders.
   *
   * A `<dialog>` with no `aria-labelledby` has no accessible name at all —
   * it announces as "dialog" and nothing else, and `getByRole("dialog", {
   * name })` cannot find it. The heading was already on screen; this is only
   * the association that was missing.
   */
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // `open` as a prop would show the dialog non-modally, without the focus
    // trap or the top layer. The imperative call is the one that does the
    // work, so the React state drives it rather than the attribute.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Fires for Escape and for a programmatic close alike, which is what
      // keeps React's state in step with a dismissal it did not initiate.
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        // The backdrop is part of the dialog element, so a click that lands
        // on the element itself rather than on its content is a backdrop
        // click. Anything inside stops here.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "border-line bg-surface-0 text-text m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border p-0 shadow-lg",
        "backdrop:bg-[var(--scrim)] backdrop:backdrop-blur-[2px]",
        "anim-pop",
        className,
      )}
    >
      <div className="border-line flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id={titleId} className="text-text text-sm font-semibold">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="text-muted mt-0.5 text-xs">
              {description}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 -mr-1 shrink-0"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-4">{children}</div>

      {footer ? (
        <div className="border-line flex items-center justify-end gap-2 border-t px-4 py-3">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
