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
    },
    contactRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: body * 0.6,
      ...withLineHeight(body * 0.92, lh),
      marginBottom: gap,
    },
    sectionHeading: {
      ...withLineHeight(body * 1.12, lh),
      fontWeight: 700,
      color: settings.accent,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      borderBottomWidth: 0.75,
      borderBottomColor: settings.accent,
      paddingBottom: 2,
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
  });
}

export type ResumeStyles = ReturnType<typeof buildStyles>;
