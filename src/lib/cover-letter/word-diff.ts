/**
 * A word-level diff, for showing what an enhancement actually changed.
 *
 * ## Why the review needs one at all
 *
 * The proposal UI used to show the original and the suggestion side by side
 * and leave the reader to spot the difference. For a rewrite that changes six
 * words in a hundred that is not a review, it is a spot-the-difference
 * puzzle — and the one thing the user must not do with an AI suggestion is
 * skim it. Marking the changed words is what makes "review before you accept"
 * a realistic instruction rather than a disclaimer.
 *
 * ## Words, not characters
 *
 * A character diff on prose produces shredded fragments — `deploy` against
 * `deployment` becomes `deploy` + `ment` — which reads as noise and hides the
 * one substitution that mattered. Words are the unit a person proofreads in.
 *
 * ## Pure, and therefore testable
 *
 * No React, no DOM. The renderer decides how a segment looks; this decides
 * only what changed. That is what lets the interesting cases — a pure
 * reordering, an insertion at the very start, identical text — be pinned in a
 * node test.
 */

export type DiffKind = "same" | "added" | "removed";

export interface DiffSegment {
  kind: DiffKind;
  /** One or more whole words, with the spacing between them preserved. */
  text: string;
}

/**
 * Splits into words *and* the whitespace between them.
 *
 * Whitespace is kept as part of the token stream rather than thrown away and
 * re-inserted, so reassembling the segments reproduces the input exactly —
 * including double spaces and line breaks the user typed. A diff that
 * silently normalises spacing would show changes nobody made.
 */
function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

/**
 * Longest common subsequence over tokens, as a table of lengths.
 *
 * Quadratic in the token count, which is the right trade here: a cover-letter
 * paragraph is capped at 4,000 characters — a few hundred tokens — so the
 * table is at worst a few hundred squared, computed once when a proposal
 * arrives. Reaching for a linear-space diff algorithm would be more code to
 * be wrong in for a cost nobody can perceive.
 */
function lcsLengths(before: readonly string[], after: readonly string[]): Uint32Array[] {
  const table: Uint32Array[] = Array.from(
    { length: before.length + 1 },
    () => new Uint32Array(after.length + 1),
  );

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        before[i] === after[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  return table;
}

/** Merges neighbouring segments of the same kind, so the output is readable. */
function coalesce(segments: readonly DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const last = merged.at(-1);
    if (last && last.kind === segment.kind) last.text += segment.text;
    else merged.push({ ...segment });
  }
  return merged;
}

/**
 * What changed between two paragraphs.
 *
 * Returns every token exactly once as `same`, `removed` (present only in
 * `before`) or `added` (present only in `after`), in an order that reads as
 * prose. Concatenating the `same` and `removed` segments reproduces `before`;
 * concatenating `same` and `added` reproduces `after` — asserted in the test,
 * because a diff that loses a word is worse than no diff at all.
 */
export function diffWords(before: string, after: string): DiffSegment[] {
  if (before === after) return before ? [{ kind: "same", text: before }] : [];

  const left = tokenize(before);
  const right = tokenize(after);
  const table = lcsLengths(left, right);

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      segments.push({ kind: "same", text: left[i]! });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      segments.push({ kind: "removed", text: left[i]! });
      i += 1;
    } else {
      segments.push({ kind: "added", text: right[j]! });
      j += 1;
    }
  }

  while (i < left.length) segments.push({ kind: "removed", text: left[i++]! });
  while (j < right.length) segments.push({ kind: "added", text: right[j++]! });

  return coalesce(segments);
}

/**
 * A one-line summary of the size of the change.
 *
 * Shown above the diff so somebody can tell at a glance whether this is a
 * comma or a rewrite, before they read a word of it. Whitespace-only segments
 * are not counted — "two words changed" must not include the spaces around
 * them.
 */
export function summarizeDiff(segments: readonly DiffSegment[]): string {
  const words = (kind: DiffKind) =>
    segments
      .filter((segment) => segment.kind === kind)
      .reduce((total, segment) => total + (segment.text.match(/[^\s]+/g)?.length ?? 0), 0);

  const added = words("added");
  const removed = words("removed");
  if (added === 0 && removed === 0) return "No wording changed.";

  const parts: string[] = [];
  if (removed > 0) parts.push(`${removed} word${removed === 1 ? "" : "s"} removed`);
  if (added > 0) parts.push(`${added} word${added === 1 ? "" : "s"} added`);
  return `${parts.join(", ")}.`;
}
