"use client";

/**
 * The bullet checker's interactive half: a text box, and what the builder's
 * coach and checker say about each line in it (`lib/coach/check-bullets.ts`).
 *
 * Checked as you type, in this tab, with no request anywhere — the same
 * promise `/check` makes about a file, and `e2e/bullet-checker.spec.ts`
 * holds it to it the same way. Nothing is stored either: a bullet pasted here
 * is gone when the tab is.
 *
 * The four parts are shown as a count and four labels, never as a
 * percentage or a grade (D12): "2 of 4" says what is left; "50%" invites
 * somebody to optimise a number.
 */

import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, Field, Textarea } from "@/components/ui/control";
import { CheckIcon, InfoIcon } from "@/components/ui/icons";
import { checkBullets, MAX_BULLETS } from "@/lib/coach/check-bullets";
import { BULLET_PARTS, PART_LABELS } from "@/lib/coach/parse-bullet";
import { track } from "@/lib/track";

/**
 * Three bullets that show the three things the checker does: one it is
 * quiet about, one missing its result, one that describes the job. Invented,
 * like every example on this site.
 */
const SAMPLE = [
  "Responsible for the customer support inbox",
  "Rebuilt the onboarding emails for new accounts",
  "Cut first-response time from 9 hours to 2 by routing tickets with triage rules",
].join("\n");

export function BulletChecker() {
  const [text, setText] = useState("");
  // Checking is cheap, but a pasted page of bullets should never make the
  // text box itself lag. The deferred value lets typing win.
  const deferred = useDeferredValue(text);
  const results = checkBullets(deferred);
  const statusId = useId();

  // Counted once per visit, the first time there is anything to show — it
  // checks as you type, so there is no button press to count instead, and a
  // count per keystroke would measure typing speed. The name only; never the
  // text (`lib/track.ts`).
  const counted = useRef(false);
  useEffect(() => {
    if (results.length === 0 || counted.current) return;
    counted.current = true;
    track("bullets:check");
  }, [results.length]);

  return (
    <div className="flex flex-col gap-6">
      <Field
        label="Your bullets, one per line"
        hint={`Paste up to ${MAX_BULLETS}. Bullet markers are ignored. Nothing you type leaves this tab or is saved anywhere.`}
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            spellCheck
            placeholder="Paste a bullet from your resume"
            className="font-sans"
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setText(SAMPLE)}>
          Try three examples
        </Button>
        {text ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setText("")}>
            Clear
          </Button>
        ) : null}
        {/* Announces the count, not the content: reading every note aloud on
            every keystroke would make the box unusable with a screen reader. */}
        <p id={statusId} aria-live="polite" className="text-faint text-small">
          {results.length === 0
            ? "Nothing checked yet."
            : `${results.length} ${results.length === 1 ? "bullet" : "bullets"} checked.`}
        </p>
      </div>

      {results.length > 0 ? (
        <ol className="flex flex-col gap-4" aria-label="Results">
          {results.map((result, index) => {
            const have = BULLET_PARTS.filter((part) => result.present[part]).length;
            const quiet = result.notes.length === 0 && result.findings.length === 0;
            return (
              <li key={`${index}-${result.text}`}>
                <Card className="lift flex flex-col gap-3 p-5">
                  <p className="text-text text-body leading-relaxed">{result.text}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted text-small">
                      {have} of {BULLET_PARTS.length} parts:
                    </span>
                    {BULLET_PARTS.map((part) => (
                      <Badge key={part} tone={result.present[part] ? "ok" : "neutral"}>
                        {result.present[part] ? (
                          <CheckIcon aria-hidden className="h-3.5 w-3.5" />
                        ) : null}
                        {/* The word carries the state for anyone who cannot
                            see the colour or the tick. */}
                        {result.present[part] ? "Has" : "No"} {PART_LABELS[part].toLowerCase()}
                      </Badge>
                    ))}
                  </div>

                  {quiet ? (
                    <p className="text-ok text-small font-medium">
                      Nothing to ask about this one. It says what you did, to what, how, and what
                      changed.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {result.notes.map((note) => (
                        <li key={`${note.part}-${note.gap}`} className="flex gap-2.5">
                          <InfoIcon aria-hidden className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="text-text text-small font-medium">{note.question}</p>
                            <p className="text-muted text-small leading-relaxed">
                              {note.gap} {note.hint}
                            </p>
                          </div>
                        </li>
                      ))}
                      {result.findings.map((finding) => (
                        <li key={finding.ruleId} className="flex gap-2.5">
                          <InfoIcon aria-hidden className="text-warn mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="text-text text-small font-medium">{finding.message}</p>
                            <p className="text-muted text-small leading-relaxed">{finding.why}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
