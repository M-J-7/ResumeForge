/**
 * The character repertoire our vendored fonts must cover.
 *
 * The ranges live in `charset.json` because two very different consumers need
 * them: the fetch script (plain ESM, applies the subset) and the glyph
 * coverage test (TypeScript, verifies it). A single JSON source keeps the
 * subsetter and its test from drifting apart — which would defeat the point of
 * the test.
 */

import charsetData from "./charset.json";

export interface CharsetRange {
  name: string;
  start: number;
  end: number;
  why: string;
}

export const CHARSET_RANGES: readonly CharsetRange[] = charsetData.ranges;

export const CHARSET_EXTRAS: readonly number[] = charsetData.extras.map((e) => e.codePoint);

/** Every code point the subset must retain. */
export function charsetCodePoints(): number[] {
  const points: number[] = [];
  for (const range of CHARSET_RANGES) {
    for (let cp = range.start; cp <= range.end; cp += 1) points.push(cp);
  }
  points.push(...CHARSET_EXTRAS);
  return points;
}

/**
 * Characters that must render in every font pair, checked individually so a
 * failure names the exact character rather than a range.
 *
 * The accented set is the one M0-T2 specifies. The punctuation is here because
 * we *emit* it: the en dash separates every date range and the bullet leads
 * every achievement line. A font missing those breaks output that contains no
 * unusual user input at all.
 */
export const REQUIRED_GLYPHS: ReadonlyArray<{ char: string; note: string }> = [
  { char: "é", note: "French, Spanish, Portuguese" },
  { char: "ñ", note: "Spanish" },
  { char: "ü", note: "German, Turkish" },
  { char: "ł", note: "Polish" },
  { char: "ş", note: "Turkish, Romanian" },
  { char: "ā", note: "Latvian, transliterated Sanskrit" },
  { char: "ç", note: "French, Portuguese, Turkish" },
  { char: "ø", note: "Danish, Norwegian" },
  { char: "đ", note: "Croatian, Vietnamese" },
  { char: "å", note: "Swedish, Norwegian, Danish" },
  { char: "ö", note: "German, Swedish, Turkish" },
  { char: "ß", note: "German" },
  { char: "ı", note: "Turkish dotless i" },
  { char: "ğ", note: "Turkish" },
  { char: "–", note: "en dash — separates every date range we emit" },
  { char: "•", note: "bullet — leads every achievement line" },
  { char: "’", note: "curly apostrophe in company names" },
  { char: "€", note: "currency in quantified results" },
  { char: "₹", note: "currency in quantified results" },
  { char: "Δ", note: "Greek — claimed as supported" },
  { char: "Я", note: "Cyrillic — claimed as supported" },
];

/**
 * Scripts these fonts do NOT cover. Names in these scripts render as .notdef
 * boxes, which is the trust failure M0-T2 exists to prevent — so the gap is
 * recorded explicitly rather than left to be discovered by a user.
 *
 * See docs/ATTRIBUTION.md for the mitigation path (a Noto fallback chain).
 */
export const UNSUPPORTED_SCRIPTS = [
  "Devanagari",
  "Bengali",
  "Tamil",
  "Han (Chinese)",
  "Hangul (Korean)",
  "Kana (Japanese)",
  "Arabic",
  "Hebrew",
  "Thai",
] as const;
