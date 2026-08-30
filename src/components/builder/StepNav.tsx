"use client";

import { STEPS } from "./steps-config";
import { stepProgress, completedCount, type StepStatus } from "./progress";
import { useResumeStore } from "@/store/resume";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<StepStatus, string> = {
  complete: "bg-emerald-500",
  started: "bg-amber-400",
  empty: "bg-zinc-300 dark:bg-zinc-700",
};

const STATUS_LABEL: Record<StepStatus, string> = {
  complete: "complete",
  started: "in progress",
  empty: "empty",
};

export function StepNav({
  activeStep,
  onSelect,
}: {
  activeStep: string;
  onSelect: (stepId: string) => void;
}) {
  const doc = useResumeStore((s) => s.history.present);
  const progress = stepProgress(doc);
  const { done, total } = completedCount(doc);

  return (
    <nav aria-label="Resume sections" className="flex flex-col gap-3">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Sections
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {done} of {total}
          </span>
        </div>
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Sections complete"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
          />
        </div>
      </div>

      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {STEPS.map((step) => {
          const status = progress[step.id]?.status ?? "empty";
          const isActive = step.id === activeStep;
          return (
            <li key={step.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                  "focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:outline-none",
                  isActive
                    ? "bg-sky-50 font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
                )}
              >
                <span
                  aria-hidden
                  className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[status])}
                />
                <span className="whitespace-nowrap">{step.label}</span>
                <span className="sr-only">, {STATUS_LABEL[status]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
