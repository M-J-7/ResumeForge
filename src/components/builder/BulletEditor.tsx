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
 *
 * ## The phrase library (P33-C3)
 *
 * Opened from here because this is where the problem is felt: the blank
 * textarea is the moment somebody does not know what to write. Inserting
 * from it appends a **new** bullet rather than overwriting the one in focus
 * — a library that could silently replace something already typed would
 * make people afraid to open it.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Textarea } from "@/components/ui/control";
import { XIcon } from "@/components/ui/icons";
import { PhraseLibrary, PhraseLibraryButton } from "./PhraseLibrary";
import { BulletCoach } from "./BulletCoach";
import { cn } from "@/lib/utils";

export function BulletEditor({
  bullets,
  onChange,
  entryId,
  label = "Achievements",
  hint,
  jobTitle = "",
}: {
  bullets: string[];
  onChange: (next: string[], coalesceKey?: string) => void;
  /** Namespaces the coalesce keys so typing in one bullet is one undo step. */
  entryId: string;
  label?: string;
  hint?: string;
  /** The entry's own title, so the phrase library opens on relevant topics. */
  jobTitle?: string;
}) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  /** Index to focus after the next render, set by add/remove. */
  const focusIndex = useRef<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

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

  /**
   * Appends a scaffold as a new bullet and puts the caret in it.
   *
   * Appends rather than replaces: the user may have opened the library while
   * a half-written bullet was in focus, and losing it would be the one
   * outcome that stops them opening it again. Focusing the new bullet is
   * what makes the blanks immediately fillable.
   */
  const insertScaffold = (scaffold: string) => {
    const next = [...bullets];
    // A single empty bullet is the "nothing here yet" state, not content —
    // filling it beats leaving an empty line above the scaffold.
    const emptyIndex = next.findIndex((bullet) => bullet.trim().length === 0);
    if (emptyIndex !== -1) {
      next[emptyIndex] = scaffold;
      focusIndex.current = emptyIndex;
    } else {
      next.push(scaffold);
      focusIndex.current = next.length - 1;
    }
    onChange(next);
    setLibraryOpen(false);
  };

  const removeBullet = (index: number) => {
    const next = bullets.filter((_, i) => i !== index);
    focusIndex.current = Math.max(0, index - 1);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-text text-sm font-medium">{label}</span>
        <span className="text-muted text-xs">
          <kbd className="border-line-strong rounded border px-1 py-0.5 font-sans">Ctrl</kbd>
          {" + "}
          <kbd className="border-line-strong rounded border px-1 py-0.5 font-sans">Enter</kbd> for
          the next bullet
        </span>
      </div>
      {hint ? <p className="text-muted text-xs">{hint}</p> : null}

      {bullets.length === 0 ? (
        <Button onClick={() => addBulletAfter(-1)} className="self-start">
          Add a bullet
        </Button>
      ) : null}

      <ul className="flex flex-col gap-2">
        {bullets.map((bullet, index) => (
          <li key={index} className="flex items-start gap-2">
            <span aria-hidden className="text-faint pt-2.5 select-none">
              •
            </span>
            <div className="flex-1">
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
              {/* P34. Under the bullet it is about, collapsed until asked. */}
              <BulletCoach text={bullet} label={`${label}, bullet ${index + 1}`} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove bullet ${index + 1}`}
              className={cn("mt-1", bullets.length === 1 && "invisible")}
              onClick={() => removeBullet(index)}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {bullets.length > 0 ? (
          <Button onClick={() => addBulletAfter(bullets.length - 1)}>Add a bullet</Button>
        ) : null}
        <PhraseLibraryButton onClick={() => setLibraryOpen(true)} />
      </div>

      {/*
        Mounted only while open. The library loads a ~0.4 MB occupation index
        on first render, and there is one `BulletEditor` per entry — a resume
        with five roles would otherwise pay for it five times over, on a page
        that budgets three seconds to interactive.
      */}
      {libraryOpen ? (
        <PhraseLibrary
          open
          onClose={() => setLibraryOpen(false)}
          jobTitle={jobTitle}
          onInsert={insertScaffold}
        />
      ) : null}
    </div>
  );
}
