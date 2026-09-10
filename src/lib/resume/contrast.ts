/**
 * WCAG contrast, for the accent colour picker (§9, P23-F3).
 *
 * §9 requires the picker to "reject combinations failing contrast against
 * white." That check has to happen here rather than by eyeballing the
 * palette, because the accent is user-chosen and free-form — there is no
 * fixed set of swatches to pre-vet by hand.
 *
 * The relevant white is `--paper`, not the app's own background: the accent
 * only ever appears *inside the rendered document*, coloured on top of the
 * white page every export produces, in both themes. Checking against the
 * app's dark-mode surface would pass colours that are unreadable on the one
 * surface that actually matters — the resume itself.
 */

/** WCAG 2.x's AA threshold for normal-size text. */
export const AA_CONTRAST_MINIMUM = 4.5;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** Accepts `#RGB` or `#RRGGBB`; returns null for anything else rather than throwing. */
export function parseHexColor(hex: string): RgbColor | null {
  const trimmed = hex.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1]!.split("");
    return { r: parseInt(r! + r, 16), g: parseInt(g! + g, 16), b: parseInt(b! + b, 16) };
  }
  const long = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (!long) return null;
  const value = long[1]!;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

/** WCAG's own gamma correction — not a linear average of the channels. */
function linearize(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance per WCAG 2.x §1.4.3, in [0, 1]. */
export function relativeLuminance({ r, g, b }: RgbColor): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * The WCAG contrast ratio between two colours, in [1, 21].
 *
 * Symmetric by construction — `contrastRatio(a, b) === contrastRatio(b, a)` —
 * because the formula always divides the lighter luminance by the darker one.
 */
export function contrastRatio(a: RgbColor, b: RgbColor): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Contrast of a hex colour against white, i.e. against `--paper`.
 *
 * Returns `null` for a string that is not a valid hex colour — the schema's
 * own `hexColor` regex already rejects those before they reach the store, so
 * a caller only sees `null` from a value that has not gone through it yet,
 * such as free-form input while the user is still typing.
 */
export function contrastAgainstWhite(hex: string): number | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  return contrastRatio(rgb, { r: 255, g: 255, b: 255 });
}

/** Whether `hex` clears the AA floor against white. Used to disable a swatch. */
export function meetsAccentContrast(hex: string): boolean {
  const ratio = contrastAgainstWhite(hex);
  return ratio !== null && ratio >= AA_CONTRAST_MINIMUM;
}
