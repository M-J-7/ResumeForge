/**
 * The bullet list editor.
 *
 * `Ctrl/Cmd+Enter` adds the next bullet and moves focus into it, per M0-T8.
 * That shortcut matters more than it looks: writing a resume is mostly
 * writing bullets, and forcing a reach for the mouse between every one is
 * what makes builders feel like forms instead of writing tools.
 *
 * Backspace on an empty bullet removes it and focuses the previous one,
 * which is the behaviour every list editor has trained people to expect.
 */

"use client";

import { useEffect, useRef } from "react";
import { Button, Textarea } from "@/components/ui/control";
import { cn } from "@/lib/utils";

export function BulletEditor({
  bullets,
  onChange,
  entryId,
  label = "Achievements",
  hint,
}: {
  bullets: string[];
  onChange: (next: string[], coalesceKey?: string) => void;
  /** Namespaces the coalesce keys so typing in one bullet is one undo step. */
  entryId: string;
  label?: string;
  hint?: string;
}) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  /** Index to focus after the next render, set by add/remove. */
  const focusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (focusIndex.current === null) return;
    const target = refs.current[focusIndex.current];
    focusIndex.current = null;
    target?.focus();
  });

  const setBullet = (index: number, value: string) => {
    const next = [...bullets];
    next[index] = value;
    onChange(next, `bullet:${entryId}:${index}`);
  };

  const addBulletAfter = (index: number) => {
    const next = [...bullets];
    next.splice(index + 1, 0, "");
    focusIndex.current = index + 1;
    onChange(next);
  };

  const removeBullet = (index: number) => {
    const next = bullets.filter((_, i) => i !== index);
    focusIndex.current = Math.max(0, index - 1);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          <kbd className="rounded border border-zinc-300 px-1 py-0.5 font-sans dark:border-zinc-700">
            Ctrl
          </kbd>
          {" + "}
          <kbd className="rounded border border-zinc-300 px-1 py-0.5 font-sans dark:border-zinc-700">
            Enter
          </kbd>{" "}
          for the next bullet
        </span>
      </div>
      {hint ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}

      {bullets.length === 0 ? (
        <Button onClick={() => addBulletAfter(-1)} className="self-start">
          Add a bullet
        </Button>
      ) : null}

      <ul className="flex flex-col gap-2">
        {bullets.map((bullet, index) => (
          <li key={index} className="flex items-start gap-2">
            <span aria-hidden className="pt-2.5 text-zinc-400 select-none">
              •
            </span>
            <Textarea
              ref={(el) => {
                refs.current[index] = el;
              }}
              value={bullet}
              rows={2}
              aria-label={`${label}, bullet ${index + 1}`}
              className="min-h-16"
              onChange={(e) => setBullet(index, e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  addBulletAfter(index);
                  return;
                }
                if (e.key === "Backspace" && bullet.length === 0 && bullets.length > 1) {
                  e.preventDefault();
                  removeBullet(index);
                }
              }}
            />
            <Button
              variant="ghost"
              aria-label={`Remove bullet ${index + 1}`}
              className={cn("mt-1 px-2", bullets.length === 1 && "invisible")}
              onClick={() => removeBullet(index)}
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </Button>
          </li>
        ))}
      </ul>

      {bullets.length > 0 ? (
        <Button onClick={() => addBulletAfter(bullets.length - 1)} className="self-start">
          Add a bullet
        </Button>
      ) : null}
    </div>
  );
}
