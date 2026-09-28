/**
 * The two transformations a composed letter may make to a resume bullet.
 *
 * They live in their own module because `compose.ts` and `bullet-form.ts` both
 * need them and importing between those two would be a cycle: the composer
 * asks the classifier which frame to use, and the classifier asks this whether
 * a lead can be lowercased at all.
 *
 * **There are exactly two, and there will not be a third.** `compose.test.ts`
 * proves that every evidence sentence is the user's own text by *undoing* both
 * of these and searching the resume for the result. A third transformation
 * would make that proof unsound, so grammar problems are solved by choosing a
 * different frame (see `bullet-form.ts`) and never by editing the bullet.
 */

/**
 * True when the bullet's first word is an ordinary capitalised word.
 *
 * `"Led a team"` qualifies; `"AWS migration"` and `"40 services"` do not.
 * Lowercasing an acronym would corrupt it, and "At Acme, I 40 services" is
 * not a sentence — both fall through to the colon form instead.
 */
export function startsWithCapitalisedWord(bullet: string): boolean {
  const word = bullet.trim().split(/\s+/)[0] ?? "";
  if (word.length < 2) return false;
  const [first, ...rest] = word;
  if (!first || !/\p{Lu}/u.test(first)) return false;
  const tail = rest.join("");
  // An all-caps or mixed-caps word is an acronym or a product name, not a verb.
  return tail === tail.toLowerCase();
}

/** Transformation 1 — documented, reversible, and the only case change made. */
export function lowercaseLead(bullet: string): string {
  const trimmed = bullet.trim();
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/** Transformation 2 — a sentence-final period, only where there is none. */
export function terminate(sentence: string): string {
  const trimmed = sentence.trimEnd();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
