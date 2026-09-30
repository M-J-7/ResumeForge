/**
 * D14's claim check, for content written after `examples.test.ts`.
 *
 * The same rule that file applies to the examples and guides — no
 * "guaranteed", no "beat the ATS", no "38% more interviews" — with the same
 * allowance for a sentence that *refuses* the claim it names. It is copied
 * here rather than imported because that file is a test, and existing test
 * files are not edited to share their helpers (IMPLEMENTATION.md §2.3).
 */

/** The phrases D14 forbids, and the ones the category actually uses. */
const OUTCOME_CLAIM =
  /\b(guarantee\w*|beat\s+the\s+(bots?|ats)|ats[- ]proof|will\s+pass\s+(the\s+)?ats|\d+%\s+more\s+interviews?|land\s+you\s+(the\s+)?job|recruiters?\s+love)\b/i;

/** Wording that marks a sentence as refusing the claim it contains. */
const REFUSAL =
  /\b(will not|cannot|can't|nobody can|no one can|does not|is not|are not|never|not\b.*\btell you|guessing|anyone quoting|neither has)\b/i;

/** The first sentence that asserts a forbidden outcome, or null. */
export function forbiddenClaimIn(text: string): string | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !REFUSAL.test(sentence));
  for (const sentence of sentences) {
    const match = OUTCOME_CLAIM.exec(sentence);
    if (match) return `${match[0]} — in: ${sentence}`;
  }
  return null;
}
