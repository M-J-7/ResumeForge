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
import { SearchIcon } from "@/components/ui/icons";
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
        "border-line bg-surface-0 m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border p-0 shadow-2xl",
        "backdrop:bg-[var(--scrim)] backdrop:backdrop-blur-[2px]",
      )}
      aria-label="Command palette"
    >
      <div className="flex flex-col">
        <div className="border-line flex items-center gap-2 border-b px-4">
          <SearchIcon className="text-faint h-4 w-4 shrink-0" />
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
            className="text-text w-full bg-transparent py-3 text-sm outline-none"
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
        </div>
        <ul id="command-results" className="max-h-72 overflow-y-auto p-1">
          {results.length === 0 ? (
            <li className="text-muted px-3 py-6 text-center text-sm">No matching command.</li>
          ) : (
            results.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => select(command)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left",
                    index === highlighted ? "bg-accent-weak" : "hover:bg-surface-2",
                  )}
                >
                  <span className="text-text text-sm">{command.label}</span>
                  {command.hint ? (
                    <span className="text-muted line-clamp-1 text-xs">{command.hint}</span>
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
