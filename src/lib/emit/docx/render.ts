/**
 * The DOCX emitter (M0-T5).
 *
 * Per D4 this is the format ATS parse most reliably, so it is primary
 * output, not a fallback. It consumes the same `DocumentBlock[]` as the PDF
 * emitter — the break rules live in `lib/layout/document.ts` and are not
 * reinterpreted here.
 *
 * Hint mapping is direct, because Word has native equivalents:
 *   - `keepWithNext`  -> `keepNext: true`   (never last paragraph on a page)
 *   - `keepTogether`  -> `keepLines: true`  (never split internally)
 *
 * `minPresenceAhead` has no Word equivalent — it is a points-of-lookahead
 * concept specific to react-pdf's wrapping algorithm. The rule it implements
 * (rule 4: don't strand a role's final bullet) is expressed in Word by
 * keeping the preceding paragraph with the next one, which is exactly
 * `keepNext`. So a block carrying `minPresenceAhead` gets `keepNext: true`.
 *
 * Hard constraints, same as the PDF emitter: no tables, no text boxes, no
 * headers or footers, no images. Nothing below can emit any of them.
 */

import {
  AlignmentType,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  type IParagraphOptions,
  type ISectionOptions,
} from "docx";
import { buildDocument, type DocumentBlock } from "@/lib/layout/document";
import { contactLine, entryLines, skillGroupParts } from "@/lib/emit/shared/entry-lines";
import type { ResumeDocument, Settings } from "@/lib/resume/schema";
import {
  BULLET_NUMBERING_REFERENCE,
  PAGE_SIZE_TWIPS,
  STYLE_IDS,
  buildMetrics,
  halfPoints,
  inchesToTwips,
  pointsToTwips,
  type DocxMetrics,
} from "./styles";

/* -------------------------------------------------------------------------- */
/* Hint mapping                                                                */
/* -------------------------------------------------------------------------- */

interface Hints {
  keepWithNext?: boolean;
  keepTogether?: boolean;
  minPresenceAhead?: number;
}

function keepOptions(block: Hints): Pick<IParagraphOptions, "keepNext" | "keepLines"> {
  return {
    keepNext: Boolean(block.keepWithNext) || block.minPresenceAhead !== undefined,
    keepLines: Boolean(block.keepTogether),
  };
}

/* -------------------------------------------------------------------------- */
/* Paragraph builders                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A heading line with its date pushed to the right margin by a real tab
 * stop. A tab stop is used rather than a two-cell table because tables are
 * among the most common causes of parse failure — a parser that reads a
 * table column-wise scrambles the whole entry.
 */
function headingWithDate(
  primary: string,
  dateLabel: string | null,
  rightTabTwips: number,
  options: IParagraphOptions,
): Paragraph {
  const children = [new TextRun({ text: primary })];
  if (dateLabel) {
    children.push(new TextRun({ text: `\t${dateLabel}` }));
  }
  return new Paragraph({
    ...options,
    tabStops: dateLabel ? [{ type: TabStopType.RIGHT, position: rightTabTwips }] : undefined,
    children,
  });
}

function bulletParagraph(text: string, block: Hints): Paragraph {
  return new Paragraph({
    style: STYLE_IDS.bullet,
    // A real numbering definition, not a literal "•" character. The bullet
    // glyph then lives in the list definition where a parser can recognize
    // and strip it, instead of being indistinguishable from body text.
    numbering: { reference: BULLET_NUMBERING_REFERENCE, level: 0 },
    ...keepOptions(block),
    children: [new TextRun({ text })],
  });
}

/**
 * The label is bold and the skills are not, so this needs two runs where TXT
 * needs one string. Both are built from `skillGroupParts`, so the separator
 * cannot drift between the formats.
 */
function skillGroupRuns(block: Extract<DocumentBlock, { type: "skillGroup" }>): TextRun[] {
  const { labelPrefix, skills } = skillGroupParts(block);
  return [
    ...(labelPrefix ? [new TextRun({ text: labelPrefix, bold: true })] : []),
    new TextRun({ text: skills }),
  ];
}

function blockParagraphs(block: DocumentBlock, rightTabTwips: number): Paragraph[] {
  const keep = keepOptions(block);

  // Every entry-shaped block renders the same three parts, composed once in
  // lib/emit/shared/entry-lines.ts so DOCX and TXT cannot drift apart.
  const entry = entryLines(block);
  if (entry) {
    const paragraphs = [
      headingWithDate(entry.heading, entry.dateLabel, rightTabTwips, {
        style: STYLE_IDS.entryHeading,
        ...keep,
        // The heading must never be the last line on a page while its own
        // meta line or first bullet follows.
        keepNext: Boolean(entry.meta || entry.firstBullet),
      }),
    ];
    if (entry.meta) {
      paragraphs.push(
        new Paragraph({
          style: STYLE_IDS.entryMeta,
          keepNext: Boolean(entry.firstBullet),
          keepLines: true,
          children: [new TextRun({ text: entry.meta })],
        }),
      );
    }
    if (entry.firstBullet) paragraphs.push(bulletParagraph(entry.firstBullet, block));
    return paragraphs;
  }

  switch (block.type) {
    case "contact": {
      const paragraphs: Paragraph[] = [];
      if (block.fullName) {
        paragraphs.push(
          new Paragraph({
            style: STYLE_IDS.name,
            children: [new TextRun({ text: block.fullName })],
            keepNext: true,
          }),
        );
      }
      const contact = contactLine(block);
      if (contact) {
        paragraphs.push(
          new Paragraph({
            style: STYLE_IDS.contact,
            children: [new TextRun({ text: contact })],
            keepNext: true,
          }),
        );
      }
      return paragraphs;
    }

    case "sectionHeading":
      return [
        new Paragraph({
          style: STYLE_IDS.sectionHeading,
          ...keep,
          children: [new TextRun({ text: block.label })],
        }),
      ];

    case "summary":
      return [
        new Paragraph({
          style: STYLE_IDS.normal,
          ...keep,
          children: [new TextRun({ text: block.text })],
        }),
      ];

    case "skillGroup":
      return [
        new Paragraph({
          style: STYLE_IDS.normal,
          ...keep,
          children: skillGroupRuns(block),
        }),
      ];

    case "bullet":
      return [bulletParagraph(block.text, block)];

    default:
      return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Document assembly                                                           */
/* -------------------------------------------------------------------------- */

function buildStyleDefinitions(settings: Settings, metrics: DocxMetrics) {
  const accent = settings.accent.replace("#", "");
  const baseRun = { font: metrics.fontName, size: metrics.bodyHalfPoints };

  return {
    default: {
      document: {
        run: baseRun,
        paragraph: { spacing: { line: metrics.lineTwips, lineRule: "auto" as const } },
      },
    },
    paragraphStyles: [
      {
        id: STYLE_IDS.normal,
        name: "Normal",
        quickFormat: true,
        run: baseRun,
        paragraph: {
          spacing: { line: metrics.lineTwips, lineRule: "auto" as const, after: metrics.gapTwips },
        },
      },
      {
        id: STYLE_IDS.name,
        name: "Title",
        basedOn: STYLE_IDS.normal,
        quickFormat: true,
        run: { ...baseRun, size: halfPoints(settings.fontSizePt * 1.9), bold: true },
        paragraph: { spacing: { after: pointsToTwips(settings.fontSizePt * 0.25) } },
      },
      {
        id: STYLE_IDS.contact,
        name: "Contact Info",
        basedOn: STYLE_IDS.normal,
        run: { ...baseRun, size: halfPoints(settings.fontSizePt * 0.92) },
        paragraph: { spacing: { after: metrics.gapTwips } },
      },
      {
        id: STYLE_IDS.sectionHeading,
        name: "Heading 1",
        basedOn: STYLE_IDS.normal,
        next: STYLE_IDS.normal,
        quickFormat: true,
        run: {
          ...baseRun,
          size: halfPoints(settings.fontSizePt * 1.12),
          bold: true,
          allCaps: true,
          color: accent,
        },
        paragraph: {
          keepNext: true,
          outlineLevel: 0,
          spacing: { before: metrics.gapTwips, after: Math.round(metrics.gapTwips * 0.6) },
          border: {
            bottom: { style: "single" as const, size: 6, color: accent, space: 1 },
          },
        },
      },
      {
        id: STYLE_IDS.entryHeading,
        name: "Heading 2",
        basedOn: STYLE_IDS.normal,
        next: STYLE_IDS.normal,
        quickFormat: true,
        run: { ...baseRun, bold: true },
        paragraph: {
          keepNext: true,
          keepLines: true,
          outlineLevel: 1,
          spacing: { before: Math.round(metrics.gapTwips * 0.75), after: 0 },
        },
      },
      {
        id: STYLE_IDS.entryMeta,
        name: "Entry Meta",
        basedOn: STYLE_IDS.normal,
        next: STYLE_IDS.normal,
        run: { ...baseRun, italics: true },
        paragraph: { spacing: { after: 0 } },
      },
      {
        id: STYLE_IDS.bullet,
        name: "Resume Bullet",
        basedOn: STYLE_IDS.normal,
        next: STYLE_IDS.bullet,
        quickFormat: true,
        run: baseRun,
        paragraph: {
          keepLines: true,
          spacing: { after: Math.round(metrics.gapTwips * 0.25) },
        },
      },
    ],
  };
}

function buildNumbering(settings: Settings) {
  const indent = pointsToTwips(settings.fontSizePt * 1.4);
  return {
    config: [
      {
        reference: BULLET_NUMBERING_REFERENCE,
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: indent, hanging: indent } },
            },
          },
        ],
      },
    ],
  };
}

export function buildDocxDocument(resume: ResumeDocument): Document {
  const metrics = buildMetrics(resume.settings);
  const page = PAGE_SIZE_TWIPS[resume.settings.pageSize];
  const marginTwips = inchesToTwips(resume.settings.margins);
  const rightTabTwips = page.width - marginTwips * 2;

  const children = buildDocument(resume).flatMap((block) => blockParagraphs(block, rightTabTwips));

  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: page.width, height: page.height },
        margin: {
          top: marginTwips,
          right: marginTwips,
          bottom: marginTwips,
          left: marginTwips,
        },
      },
    },
    children,
  };

  return new Document({
    title: resume.contact.fullName || "Resume",
    creator: resume.contact.fullName || "ATS Resume Builder",
    description: "Resume",
    styles: buildStyleDefinitions(resume.settings, metrics),
    numbering: buildNumbering(resume.settings),
    sections: [section],
  });
}

export interface RenderDocxResult {
  blob: Blob;
  bytes: Uint8Array;
}

export async function renderDocx(resume: ResumeDocument): Promise<RenderDocxResult> {
  const doc = buildDocxDocument(resume);
  const buffer = await Packer.toBuffer(doc);
  const bytes = new Uint8Array(buffer);
  return {
    bytes,
    blob: new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  };
}
