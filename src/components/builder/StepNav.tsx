"use client";

/**
 * The step rail, as a progress spine.
 *
 * It used to be eight rows each carrying a coloured dot, and a dot beside a
 * label says "this one is green" without saying where you are in the work. A
 * continuous rule down the rail, filled to the point you have reached, says
 * both — the same information, in the shape the information actually has.
 *
 * ## What must not change
 *
 * `e2e/builder.spec.ts` matches a step with
 * `getByRole("button", { name: /^Experience/ })`, **anchored at the start of
 * the accessible name.** The name is "Experience, empty": the marker is
 * `aria-hidden` so it contributes nothing, and the status text is an
 * `sr-only` span *after* the label. Anything that prefixes the label — an
 * icon with a name of its own, moving the status text in front of it —
 * breaks that selector in a way that reads like a routing bug three files
 * away.
 *
 * The `role="progressbar"` with `aria-label="Sections complete"` and a live
 * `aria-valuenow` is also matched by name, and stays. It is the accessible
 * readout; the spine is its visual twin and is `aria-hidden` throughout.
 *
 * ## Why the active marker is CSS
 *
 * `design.md` §5.1 suggested Motion's `layoutId` for it. That would put the
 * Motion runtime into the builder's bundle for one moving dot, on the screen
 * whose budget is the strictest in the app (§2.2: typing never drops a
 * frame). A transition on the marker's own ring reads the same and costs
 * nothing.
 */

import { orderedSteps } from "./steps-config";
import { stepProgress, completedCount, type StepStatus } from "./progress";
import { useResumeStore } from "@/store/resume";
import { cn } from "@/lib/utils";

/** The marker on the spine. Filled once there is something in the step. */
const STATUS_MARKER: Record<StepStatus, string> = {
  complete: "bg-ok border-ok",
  started: "bg-warn border-warn",
  empty: "bg-surface-0 border-line-strong",
};

const STATUS_LABEL: Record<StepStatus, string> = {
  complete: "complete",
  started: "in progress",
  empty: "empty",
};

export function StepNav({
  activeStep,
  onSelect,
  order,
  footer,
}: {
  activeStep: string;
  onSelect: (stepId: string) => void;
  /** Step ids in the order to show them (P35). Defaults to `STEPS` order. */
  order?: readonly string[] | null;
  /** Rendered under the rail — undo/redo and the experience-level control. */
  footer?: React.ReactNode;
}) {
  const doc = useResumeStore((s) => s.history.present);
  const progress = stepProgress(doc);
  const { done, total } = completedCount(doc);
  const filled = total === 0 ? 0 : (done / total) * 100;

  return (
    <nav aria-label="Resume sections" className="flex flex-col gap-3">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-faint text-xs font-semibold tracking-wide uppercase">Sections</h2>
          <span className="text-muted text-xs tabular-nums">
            {done} of {total}
          </span>
        </div>
        <div
          className="bg-surface-1 mt-2 h-1 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Sections complete"
        >
          <div
            className="bg-ok h-full rounded-full transition-[width] duration-[var(--dur)] ease-[var(--ease)]"
            style={{ width: `${filled}%` }}
          />
        </div>
      </div>

      {/*
        `relative` is what the spine is positioned against. It is drawn only
        from `lg`, because below that the rail is a horizontal scroller and a
        vertical rule down a row of tabs would be nonsense.
      */}
      <ul className="relative flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        <span
          aria-hidden
          className="bg-line absolute top-3 bottom-3 left-[15px] hidden w-px lg:block"
        />
        <span
          aria-hidden
          style={{ height: `calc((100% - 1.5rem) * ${filled / 100})` }}
          className="bg-ok absolute top-3 left-[15px] hidden w-px transition-[height] duration-[var(--dur)] ease-[var(--ease)] lg:block"
        />

        {orderedSteps(order).map((step) => {
          const status = progress[step.id]?.status ?? "empty";
          const isActive = step.id === activeStep;
          return (
            <li key={step.id} className="relative shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm",
                  "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                  "focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none",
                  isActive
                    ? "bg-surface-0 text-text font-medium shadow-[var(--shadow-lift)]"
                    : "text-muted hover:bg-surface-1 hover:text-text",
                )}
              >
                {/* On the spine, and `aria-hidden` — see the header. The
                    active step's marker gets a ring rather than a different
                    fill, so "where I am" and "how far I got" stay two
                    separate readings of the same rail. */}
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 h-2.5 w-2.5 shrink-0 rounded-full border",
                    "transition-[box-shadow,background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease)]",
                    STATUS_MARKER[status],
                    isActive && "ring-accent/35 ring-4",
                  )}
                />
                <span className="whitespace-nowrap">{step.label}</span>
                <span className="sr-only">, {STATUS_LABEL[status]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {footer}
    </nav>
  );
}
