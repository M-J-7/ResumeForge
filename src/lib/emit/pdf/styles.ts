/**
 * Style derivation for the PDF emitter.
 *
 * Every numeric value here is derived from `resume.settings`, never a
 * hardcoded constant — the same `DocumentBlock[]` renders differently under
 * compact vs comfortable density, A4 vs Letter, and every font pair, with no
 * separate per-emitter template of its own (there is no `Template` model —
 * see §7 of the execution plan).
 */

import { StyleSheet } from "@react-pdf/renderer";
import { getFontPair } from "@/lib/fonts/pairs";
import type { Settings } from "@/lib/resume/schema";

const POINTS_PER_INCH = 72;

/**
 * react-pdf resolves a unitless `lineHeight` to an absolute point value at
 * the element that declares it, and children then inherit that *absolute*
 * value — not the ratio. So a heading at 1.9x the body size inheriting the
 * page's `lineHeight: 1.2` gets a body-sized line box and collides with
 * whatever follows it.
 *
 * Every style that sets `fontSize` must therefore restate `lineHeight`, so
 * the ratio is applied against that element's own size. `noOverlap` in
 * `render.test.tsx` is the regression guard.
 */
const withLineHeight = (fontSize: number, ratio: number) => ({ fontSize, lineHeight: ratio });

export function buildStyles(settings: Settings) {
  const { family } = getFontPair(settings.fontPair);
  const body = settings.fontSizePt;
  const margin = settings.margins * POINTS_PER_INCH;
  const lh = settings.lineHeight;
  // Density widens the gap between blocks without touching text size —
  // that stays a separate, deliberate control (settings.fontSizePt).
  const gap = settings.density === "compact" ? body * 0.35 : body * 0.55;
  const centeredHeader = settings.headerStyle === "centered";
  const headingStyle = settings.headingStyle;

  return StyleSheet.create({
    page: {
      fontFamily: family,
      ...withLineHeight(body, lh),
      padding: margin,
      color: "#111827",
    },
    name: {
      ...withLineHeight(body * 1.9, lh),
      fontWeight: 700,
      marginBottom: gap * 0.5,
      // P32-B1. `textAlign` moves the glyphs on the page and nothing else:
      // the name is still one Text node in reading order, so extraction is
      // byte-identical either way. That is the whole reason this axis is
      // safe to offer — see `templates.ts`.
      textAlign: centeredHeader ? "center" : "left",
    },
    contactRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: body * 0.6,
      ...withLineHeight(body * 0.92, lh),
      marginBottom: gap,
      justifyContent: centeredHeader ? "center" : "flex-start",
    },
    sectionHeading: {
      ...withLineHeight(body * 1.12, lh),
      fontWeight: 700,
      color: settings.accent,
      // Uppercase in **every** heading style, deliberately. It is the one
      // property of a section heading an ATS argument actually rests on, and
      // a template is not allowed to trade it away for looks.
      textTransform: "uppercase",
      letterSpacing: 0.6,
      // `rule` underlines the heading; `accent-bar` puts a short bar to its
      // left; `caps` has neither. All three are borders on a Text node —
      // decoration the extracted text cannot see.
      borderBottomWidth: headingStyle === "rule" ? 0.75 : 0,
      borderBottomColor: settings.accent,
      borderLeftWidth: headingStyle === "accent-bar" ? 2.5 : 0,
      borderLeftColor: settings.accent,
      paddingLeft: headingStyle === "accent-bar" ? body * 0.45 : 0,
      paddingBottom: headingStyle === "rule" ? 2 : 0,
      marginTop: gap,
      marginBottom: gap * 0.6,
    },
    summaryText: {
      marginBottom: gap,
    },
    entryBlock: {
      marginBottom: gap * 0.75,
    },
    entryHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    entryHeaderLeft: {
      flexDirection: "column",
      flexGrow: 1,
    },
    entryHeaderRight: {
      flexDirection: "column",
      alignItems: "flex-end",
    },
    entryTitle: {
      fontWeight: 700,
    },
    entrySubtitle: {
      fontStyle: "italic",
    },
    entryMeta: {
      ...withLineHeight(body * 0.92, lh),
    },
    bulletRow: {
      flexDirection: "row",
      marginTop: gap * 0.25,
    },
    bulletMarker: {
      width: body * 1.1,
    },
    bulletText: {
      flexGrow: 1,
    },
    skillGroupRow: {
      flexDirection: "row",
      marginBottom: gap * 0.35,
    },
    skillLabel: {
      fontWeight: 700,
    },
    skillList: {
      flexGrow: 1,
    },

    /* ---- Cover letter (P28-I2) ---------------------------------------- */

    /*
     * Landmine 3, restated because it is the one that bites here too: every
     * style below that sets `fontSize` also sets `lineHeight`. react-pdf
     * resolves a unitless ratio to an absolute point value at the element
     * declaring it, and descendants inherit that absolute value — so a
     * smaller `fontSize` without its own `lineHeight` gets a body-sized line
     * box and collides with the line below.
     */
    letterMeta: {
      marginTop: gap * 1.5,
      marginBottom: gap * 1.5,
    },
    letterDate: {
      marginBottom: gap,
    },
    letterRecipientLine: {
      ...withLineHeight(body, lh),
    },
    /*
     * Letter paragraphs are spaced rather than indented. An indented first
     * line is the older convention and it is fine on paper, but a letter is
     * as likely to be read in a preview pane as printed, and block paragraphs
     * survive that better. `marginBottom` rather than `marginTop` so the last
     * paragraph does not push the sign-off further than the others.
     */
    letterParagraph: {
      marginBottom: gap * 1.2,
    },
  });
}

export type ResumeStyles = ReturnType<typeof buildStyles>;
