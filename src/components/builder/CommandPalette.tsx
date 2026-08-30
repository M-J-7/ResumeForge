/**
 * `Ctrl/Cmd+K` command palette (M0-T8).
 *
 * Jumping between sections is the navigation people do most while writing,
 * and the palette makes it reachable without leaving the keyboard — which is
 * what the "buildable with keyboard only" criterion actually requires in
 * practice, not just in principle.
 *
 * Built on `<dialog>` so focus trapping, Escape, and the backdrop come from
 * the platform rather than from hand-rolled focus management that would be
 * subtly wrong.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STEPS } from "./steps-config";
import { cn } from "@/lib/utils";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

export function CommandPalette({
  open,
  onClose,
  onSelectStep,
  extraCommands = [],
}: {
  open: boolean;
  onClose: () => void;
  onSelectStep: (stepId: string) => void;
  extraCommands?: Command[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const commands = useMemo<Command[]>(
    () => [
      ...STEPS.map((step) => ({
        id: `goto-${step.id}`,
        label: `Go to ${step.label}`,
        hint: step.description,
        run: () => onSelectStep(step.id),
      })),
      ...extraCommands,
    ],
    [onSelectStep, extraCommands],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setQuery("");
      setHighlighted(0);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const select = (command: Command | undefined) => {
    if (!command) return;
    command.run();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) dismisses.
        if (e.target === dialogRef.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-0 shadow-2xl",
        "backdrop:bg-zinc-900/40 dark:border-zinc-800 dark:bg-zinc-900",
      )}
      aria-label="Command palette"
    >
      <div className="flex flex-col">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // Reset alongside the query rather than in an effect: the
            // highlight is derived from this same interaction, so doing it
            // here avoids a second render pass.
            setHighlighted(0);
          }}
          placeholder="Jump to a section…"
          aria-label="Search commands"
          aria-controls="command-results"
          className="border-b border-zinc-200 bg-transparent px-4 py-3 text-sm text-zinc-900 outline-none dark:border-zinc-800 dark:text-zinc-100"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              // Clamp: the list can shrink between keystrokes.
              select(results[Math.min(highlighted, results.length - 1)]);
            }
          }}
        />
        <ul id="command-results" className="max-h-72 overflow-y-auto p-1">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-zinc-500">No matching command.</li>
          ) : (
            results.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => select(command)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left",
                    index === highlighted
                      ? "bg-sky-50 dark:bg-sky-950"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800",
                  )}
                >
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{command.label}</span>
                  {command.hint ? (
                    <span className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {command.hint}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </dialog>
  );
}
