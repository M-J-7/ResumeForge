/**
 * Maps `DocumentBlock`s (lib/layout/document.ts) onto react-pdf primitives.
 *
 * Hint mapping, per M0-T4 — the only place this translation happens:
 *   - `keepTogether`               -> `<View wrap={false}>`
 *   - `keepWithNext` / `minPresenceAhead` -> `minPresenceAhead` on the block's
 *     own View. `keepWithNext` carries no numeric value in the document
 *     model (it is emitter-agnostic on purpose — DOCX maps it straight to
 *     `keepNext: true` with no points involved), so the PDF emitter picks
 *     its own guard band from the resume's text metrics.
 *
 * Hard constraints (M0-T4): single column, no `<Image>`, no fixed
 * headers/footers, no absolute positioning, real text only. Nothing below
 * uses any of those.
 */

import { Fragment } from "react";
import { Link, Text, View } from "@react-pdf/renderer";
import type { DocumentBlock } from "@/lib/layout/document";
import type { Settings } from "@/lib/resume/schema";
import type { ResumeStyles } from "./styles";

const BULLET_MARKER = "•";

/** Reserved space for a section heading's own line plus a bit of what follows it. */
function sectionHeadingGuardPoints(settings: Settings): number {
  return settings.fontSizePt * settings.lineHeight * 2;
}

interface Hints {
  keepWithNext?: boolean;
  keepTogether?: boolean;
  minPresenceAhead?: number;
}

function hintProps(
  block: Hints,
  settings: Settings,
): { wrap?: boolean; minPresenceAhead?: number } {
  return {
    wrap: block.keepTogether ? false : undefined,
    minPresenceAhead:
      block.minPresenceAhead ??
      (block.keepWithNext ? sectionHeadingGuardPoints(settings) : undefined),
  };
}

function joinNonEmpty(parts: ReadonlyArray<string | null | undefined>, sep: string): string {
  return parts.filter((p): p is string => Boolean(p && p.trim().length > 0)).join(sep);
}

function BulletLine({ text, styles }: { text: string; styles: ResumeStyles }) {
  return (
    <View style={styles.bulletRow} wrap={false}>
      <Text style={styles.bulletMarker}>{BULLET_MARKER}</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function EntryHeader({
  styles,
  primary,
  secondary,
  dateLabel,
  meta,
}: {
  styles: ResumeStyles;
  primary: string;
  secondary?: string | null;
  dateLabel?: string | null;
  meta?: string | null;
}) {
  const hasRight = Boolean(dateLabel || meta);
  return (
    <View style={styles.entryHeaderRow}>
      <View style={styles.entryHeaderLeft}>
        <Text style={styles.entryTitle}>{primary}</Text>
        {secondary ? <Text style={styles.entrySubtitle}>{secondary}</Text> : null}
      </View>
      {hasRight ? (
        <View style={styles.entryHeaderRight}>
          {dateLabel ? <Text style={styles.entryMeta}>{dateLabel}</Text> : null}
          {meta ? <Text style={styles.entryMeta}>{meta}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

export function renderBlock(
  block: DocumentBlock,
  styles: ResumeStyles,
  settings: Settings,
  key: number,
) {
  const hints = hintProps(block, settings);

  switch (block.type) {
    case "contact": {
      const segments = joinNonEmpty([block.phone, block.location], "  ·  ");
      return (
        <Fragment key={key}>
          <Text style={styles.name}>{block.fullName}</Text>
          <View style={styles.contactRow}>
            {block.email ? <Text>{block.email}</Text> : null}
            {segments ? <Text>{segments}</Text> : null}
            {block.links.map((link, i) => (
              <Link key={`${link.url}-${i}`} src={link.url}>
                {link.label || link.url}
              </Link>
            ))}
          </View>
        </Fragment>
      );
    }

    case "sectionHeading":
      return (
        <Text key={key} style={styles.sectionHeading} minPresenceAhead={hints.minPresenceAhead}>
          {block.label}
        </Text>
      );

    case "summary":
      return (
        <Text key={key} style={styles.summaryText}>
          {block.text}
        </Text>
      );

    case "experienceEntry":
      return (
        <View
          key={key}
          style={styles.entryBlock}
          wrap={hints.wrap}
          minPresenceAhead={hints.minPresenceAhead}
        >
          <EntryHeader
            styles={styles}
            primary={block.title}
            secondary={block.organization}
            dateLabel={block.dateLabel}
            meta={block.location}
          />
          {block.firstBullet ? <BulletLine text={block.firstBullet} styles={styles} /> : null}
        </View>
      );

    case "educationEntry":
      return (
        <View
          key={key}
          style={styles.entryBlock}
          wrap={hints.wrap}
          minPresenceAhead={hints.minPresenceAhead}
        >
          <EntryHeader
            styles={styles}
            primary={block.institution}
            secondary={joinNonEmpty([block.credential, block.field], ", ")}
            dateLabel={block.dateLabel}
            meta={joinNonEmpty([block.location, block.result], "  ·  ")}
          />
          {block.firstBullet ? <BulletLine text={block.firstBullet} styles={styles} /> : null}
        </View>
      );

    case "projectEntry":
      return (
        <View
          key={key}
          style={styles.entryBlock}
          wrap={hints.wrap}
          minPresenceAhead={hints.minPresenceAhead}
        >
          <EntryHeader
            styles={styles}
            primary={block.name}
            secondary={block.role}
            dateLabel={block.dateLabel}
          />
          {block.url ? (
            <Link src={block.url} style={styles.entryMeta}>
              {block.url}
            </Link>
          ) : null}
          {block.firstBullet ? <BulletLine text={block.firstBullet} styles={styles} /> : null}
        </View>
      );

    case "certificationEntry":
      return (
        <View key={key} style={styles.entryBlock} wrap={false}>
          <EntryHeader
            styles={styles}
            primary={block.name}
            secondary={block.issuer}
            dateLabel={block.dateLabel}
            meta={block.credentialId ? `ID: ${block.credentialId}` : null}
          />
        </View>
      );

    case "customEntry":
      return (
        <View
          key={key}
          style={styles.entryBlock}
          wrap={hints.wrap}
          minPresenceAhead={hints.minPresenceAhead}
        >
          <EntryHeader
            styles={styles}
            primary={block.title}
            secondary={block.subtitle}
            dateLabel={block.dateLabel}
          />
          {block.firstBullet ? <BulletLine text={block.firstBullet} styles={styles} /> : null}
        </View>
      );

    case "skillGroup":
      // Label and skills share one flowing Text rather than sitting in two
      // fixed-width columns: a column narrow enough to look right also wraps
      // longer labels, which strands the label on its own line and separates
      // it from the skills it introduces — exactly the association an ATS
      // needs to keep.
      return (
        <View key={key} style={styles.skillGroupRow} wrap={false}>
          <Text style={styles.skillList}>
            {block.label ? <Text style={styles.skillLabel}>{block.label}: </Text> : null}
            {block.skills.join(", ")}
          </Text>
        </View>
      );

    case "bullet":
      return (
        <View
          key={key}
          style={styles.bulletRow}
          wrap={false}
          minPresenceAhead={hints.minPresenceAhead}
        >
          <Text style={styles.bulletMarker}>{BULLET_MARKER}</Text>
          <Text style={styles.bulletText}>{block.text}</Text>
        </View>
      );
  }
}
