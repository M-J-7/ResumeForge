"use client";

/**
 * The phrase library drawer (P33-C3).
 *
 * The D8-compatible answer to a competitor's "thousands of expert-written
 * bullet points". Theirs is a database and so is ours — the difference is
 * that every entry here arrives with its blanks intact.
 *
 * ## Inserting places the scaffold unfilled, and that is the whole design
 *
 * A bullet reading `Cut ___ from ___ to ___` is unmistakably a template to
 * complete. It cannot be mistaken for a claim the user made, because it does
 * not claim anything yet: every fact in the finished line will be theirs.
 * That is what keeps this inside D8 while delivering the same ergonomic win
 * a generated library gives — and it is why nothing here is ever
 * auto-inserted, previewed into the field, or offered as a completion.
 *
 * ## It opens on the topics for the job title already typed
 *
 * `phrasesForTitle` resolves the entry's own title against the O\*NET
 * occupation index, so a Registered Nurse does not have to scroll past
 * "Shipped something" to reach anything useful. A title we do not recognise
 * falls back to four general topics rather than an empty drawer.
 *
 * The index is ~0.4 MB and lives behind a dynamic `import()`, so it is
 * fetched the first time somebody opens this and never on the critical path
 * to a first paint (§2.2's three-second budget).
 */

import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui/control";
import { Dialog } from "@/components/ui/dialog";
import { PlusIcon } from "@/components/ui/icons";
import {
  BLANK,
  phrasesForTitle,
  type OccupationEntry,
  type PhraseSuggestions,
} from "@/lib/phrases/lookup";

export function PhraseLibrary({
  open,
  onClose,
  jobTitle,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  /** The entry's own title, used to pick which topics to show first. */
  jobTitle: string;
  onInsert: (scaffold: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PhraseSuggestions | null>(null);
  const [loading, setLoading] = useState(false);

  /** What the topics are resolved from: the search box, or the entry's title. */
  const subject = query.trim() || jobTitle.trim();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // Flagged inside the async body rather than in the effect itself: the
    // work has genuinely started here, and setting it synchronously in the
    // effect triggers a second render pass for no benefit. Same arrangement
    // `components/xray/useXRay.ts` arrived at, for the same reason.
    const run = async () => {
      setLoading(true);
      const result = await phrasesForTitle(subject);
      if (cancelled) return;
      setSuggestions(result);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [open, subject]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Phrase library"
      description="Shapes to fill in, not sentences to paste. Every blank is yours to complete."
      className="w-[min(44rem,calc(100vw-2rem))]"
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text font-medium">Job title</span>
          <Input
            value={query}
            placeholder={jobTitle || "Registered Nurse, Accountant, Software Developer…"}
            onChange={(event) => setQuery(event.target.value)}
            aria-describedby="phrase-library-hint"
          />
          <span id="phrase-library-hint" className="text-muted text-xs">
            {jobTitle
              ? `Showing shapes for “${subject}”. Type another title to see different ones.`
              : "Type a job title to see the shapes that fit it."}
          </span>
        </label>

        {suggestions?.relatedTitles.length ? (
          <RelatedTitles
            occupation={suggestions.occupation}
            titles={suggestions.relatedTitles}
            onPick={setQuery}
          />
        ) : null}

        {loading && !suggestions ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : (
          <div className="flex flex-col gap-5">
            {(suggestions?.topics ?? []).map((topic) => (
              <section key={topic.id} className="flex flex-col gap-2">
                <div>
                  <h3 className="text-text text-sm font-semibold">{topic.label}</h3>
                  <p className="text-muted text-xs">{topic.hint}</p>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {topic.scaffolds.map((scaffold) => (
                    <li key={scaffold}>
                      <button
                        type="button"
                        onClick={() => onInsert(scaffold)}
                        className="border-line hover:bg-surface-2 focus-visible:ring-accent flex w-full items-start gap-2 rounded-md border p-2 text-left transition focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <PlusIcon className="text-muted mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="text-text font-mono text-xs leading-relaxed">
                          {scaffold}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="border-line text-muted border-t pt-3 text-xs">
          Each {BLANK} is a blank for you to fill. Nothing here is written about you, and nothing is
          inserted until you choose it — a shape with the blanks still in it is a note to yourself,
          never a claim.
        </p>
      </div>
    </Dialog>
  );
}

function RelatedTitles({
  occupation,
  titles,
  onPick,
}: {
  occupation: OccupationEntry | null;
  titles: readonly string[];
  onPick: (title: string) => void;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
        {occupation ? `Also called (${occupation.title})` : "Related roles"}
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {titles.slice(0, 8).map((title) => (
          <li key={title}>
            <button
              type="button"
              onClick={() => onPick(title)}
              className="border-line bg-surface-2 text-muted hover:text-text focus-visible:ring-accent rounded-full border px-2 py-0.5 text-xs transition focus-visible:ring-2 focus-visible:outline-none"
            >
              {title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The button that opens it, for `BulletEditor` to place beside "Add a bullet". */
export function PhraseLibraryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick}>
      Phrase library
    </Button>
  );
}
