"use client";

/**
 * The Interview tab (ROADMAP F9, "Defend every number").
 *
 * Every figure and strong claim on the page, grouped by the role it sits in,
 * each with the question an interviewer is most likely to ask about it — and
 * a tick for when you could answer that question without notes. The finding
 * is `lib/defend/claims.ts`; this draws it.
 *
 * It works from the document, not the PDF, so it needs no render and costs a
 * few regular expressions — but only while the tab is open. Hidden, it
 * computes nothing, because the typing path is the one place in the builder
 * that must never pay for a panel nobody is looking at.
 */

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  claimsAsText,
  collectClaims,
  type ClaimLine,
  type ClaimReport,
} from "@/lib/defend/claims";
import {
  lineKey,
  parseReady,
  readReadyRaw,
  serverReadyRaw,
  setReady,
  subscribeToReady,
} from "@/lib/defend/ready";
import { useResumeStore } from "@/store/resume";
import { Button } from "@/components/ui/control";

export function InterviewPanel({ active }: { active: boolean }) {
  const resume = useResumeStore((s) => s.history.present);
  const report = useMemo(() => (active ? collectClaims(resume) : null), [active, resume]);
  const raw = useSyncExternalStore(subscribeToReady, readReadyRaw, serverReadyRaw);
  const ready = useMemo(() => parseReady(raw), [raw]);
  const [copied, setCopied] = useState(false);

  if (!report) return null;

  const lines = report.groups.flatMap((group) => group.lines);
  const readyCount = lines.filter((line) => ready.has(lineKey(line.text))).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(claimsAsText(report));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-text text-title font-semibold">What an interviewer will ask about</h2>
          <p className="text-muted text-small mt-1 leading-relaxed">{lead(report)}</p>
        </div>

        {lines.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-machine text-micro font-mono tabular-nums">
              {readyCount} of {lines.length} ready
            </p>
            <Button size="sm" onClick={() => void copy()}>
              Copy as a checklist
            </Button>
            <span aria-live="polite" className="text-muted text-xs">
              {copied ? "Copied" : ""}
            </span>
          </div>
        ) : null}

        {report.groups.map((group) => (
          <section key={group.id} aria-label={group.title} className="flex flex-col gap-2">
            <h3 className="text-text text-sm font-semibold">{group.title}</h3>
            <ul className="flex flex-col gap-2">
              {group.lines.map((line) => (
                <Line key={line.id} line={line} ready={ready.has(lineKey(line.text))} />
              ))}
            </ul>
          </section>
        ))}

        <p className="text-faint text-xs leading-relaxed">
          Found on your page by pattern, not judged: a figure here is not wrong, it is just
          something you may be asked to explain. Nothing is sent anywhere, and nothing here is
          written for you — the questions are for you to answer out loud.
        </p>
      </div>
    </div>
  );
}

function lead(report: ClaimReport): string {
  const { figures, claims } = report;
  if (figures + claims === 0) {
    return (
      "No figures or strong claims on the page yet. A bullet with a number in it is easier to " +
      "believe — and every one you add turns up here, with the question it invites."
    );
  }
  const parts = [
    figures > 0 ? `${figures} ${figures === 1 ? "figure" : "figures"}` : null,
    claims > 0 ? `${claims} ${claims === 1 ? "claim" : "claims"}` : null,
  ].filter(Boolean);
  return (
    `${parts.join(" and ")} on your page. Each is something an interviewer can ask you to ` +
    "explain; tick one off when you could answer its question without notes."
  );
}

function Line({ line, ready }: { line: ClaimLine; ready: boolean }) {
  return (
    <li className="border-line bg-surface-0 rounded-lg border p-3">
      <label className="flex cursor-pointer gap-3">
        <input
          type="checkbox"
          checked={ready}
          onChange={(event) => setReady(line.text, event.target.checked)}
          className="control-check focus-visible:ring-accent focus-visible:ring-offset-surface-0 mt-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        />
        <span className="text-text text-sm leading-relaxed">
          <Marked line={line} />
        </span>
      </label>
      <ul className="mt-2 flex flex-col gap-1 pl-7">
        {line.questions.map((question) => (
          <li key={question} className="text-muted text-xs leading-relaxed">
            {question}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The line as written, with each figure and claim marked in place. */
function Marked({ line }: { line: ClaimLine }) {
  const pieces: ReactNode[] = [];
  let at = 0;
  for (const span of line.spans) {
    if (span.start > at) pieces.push(line.text.slice(at, span.start));
    pieces.push(
      <mark key={span.start} className="bg-accent-weak text-text rounded-sm px-0.5">
        {span.text}
      </mark>,
    );
    at = span.end;
  }
  if (at < line.text.length) pieces.push(line.text.slice(at));
  return <>{pieces}</>;
}
