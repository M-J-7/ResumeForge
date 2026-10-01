/**
 * "Does a two-column resume break parsing?" — measured (ROADMAP Phase 3,
 * measured guides).
 *
 * The folklore says two columns break an ATS. The honest answer depends on
 * *how* a parser reads a page, and that is something we can measure, because
 * the X-Ray already reads PDFs two ways (`lib/xray/extract.ts`):
 *
 * - **stream order** — text in the order the PDF's content stream holds it,
 *   which is how a simple text extractor reads;
 * - **geometric** — text grouped into visual lines by position and read left
 *   to right, which is how a position-aware parser reads.
 *
 * So every example resume on the site is laid out three ways — one column, a
 * sidebar on the left, a sidebar on the right — with the same words, the same
 * font and the same page, and each PDF is read back both ways. Two things are
 * counted: whether the scorecard recovers the fields a recruiter needs (name,
 * email, phone, each role's title, employer and dates), and whether every
 * bullet survives as one unbroken sentence.
 *
 * ## What this is, and what it is not
 *
 * It measures two reading strategies on PDFs made by one PDF library. It does
 * not measure any vendor's ATS: those are private, configured per employer,
 * and nobody outside them can run this test on them. The guide says so, and
 * says which way each strategy fails, which is the useful part — a reader can
 * check their own file at /check and see which failure it has.
 *
 * Deterministic: the same documents and the same code give the same numbers,
 * and `columns.test.ts` fails if the published results drift from a fresh run.
 */

import { Document, Page, Text, View, pdf, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { disableHyphenation, registerFontPair } from "@/lib/fonts/register";
import { FONT_PAIRS } from "@/lib/fonts/pairs";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { extractPdfGeometric, extractPdfStreamOrder, type ExtractedDocument } from "@/lib/xray/extract";
import { recoverFields, scoreRecovery } from "@/lib/xray/scorecard";
import type { ResumeDocument } from "@/lib/resume/schema";
import { formatDateRange } from "@/lib/resume/dates";

export const LAYOUTS = ["one-column", "sidebar-left", "sidebar-right"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const STRATEGIES = ["pdf-stream-order", "pdf-geometric"] as const;
export type Strategy = (typeof STRATEGIES)[number];

/* -------------------------------------------------------------------------- */
/* The three layouts                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Each resume keeps the font its published example uses, in all three
 * layouts. A built-in PDF font cannot draw "₹" or "−", and a measurement that
 * lost a rupee sign would be measuring the font, not the layout.
 */
const BOLD = { fontWeight: 700 } as const;

function sections(doc: ResumeDocument) {
  const visible = doc.sections.filter((section) => section.visible);
  return {
    summary: visible.find((section) => section.type === "summary"),
    experience: visible.find((section) => section.type === "experience"),
    education: visible.find((section) => section.type === "education"),
    skills: visible.find((section) => section.type === "skills"),
    projects: visible.find((section) => section.type === "projects"),
  };
}

function Heading({ children }: { children: string }) {
  return (
    <Text style={{ ...BOLD, fontSize: 10.5, marginTop: 10, marginBottom: 4 }}>
      {children}
    </Text>
  );
}

function Bullet({ children }: { children: string }) {
  return <Text style={{ fontSize: 9.5, marginBottom: 2, lineHeight: 1.35 }}>{`• ${children}`}</Text>;
}

/** Experience and projects: the main column in every layout. */
function MainColumn({ doc, withName }: { doc: ResumeDocument; withName: boolean }) {
  const { summary, experience, projects } = sections(doc);
  return (
    <View>
      {withName ? (
        <Text style={{ ...BOLD, fontSize: 18, marginBottom: 6 }}>{doc.contact.fullName}</Text>
      ) : null}
      {summary?.type === "summary" && summary.content.trim() ? (
        <View>
          <Heading>Summary</Heading>
          <Text style={{ fontSize: 9.5, lineHeight: 1.35 }}>{summary.content}</Text>
        </View>
      ) : null}
      {experience?.type === "experience" && experience.entries.length > 0 ? (
        <View>
          <Heading>Experience</Heading>
          {experience.entries.map((entry) => (
            <View key={entry.id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...BOLD, fontSize: 10 }}>{entry.title}</Text>
                <Text style={{ fontSize: 9.5 }}>{formatDateRange(entry.dates)}</Text>
              </View>
              <Text style={{ fontSize: 9.5, marginBottom: 2 }}>
                {[entry.organization, entry.location].filter(Boolean).join(", ")}
              </Text>
              {entry.bullets.filter((b) => b.trim()).map((bullet, index) => (
                <Bullet key={index}>{bullet}</Bullet>
              ))}
            </View>
          ))}
        </View>
      ) : null}
      {projects?.type === "projects" && projects.entries.length > 0 ? (
        <View>
          <Heading>Projects</Heading>
          {projects.entries.map((entry) => (
            <View key={entry.id} style={{ marginBottom: 6 }}>
              <Text style={{ ...BOLD, fontSize: 10 }}>
                {[entry.name, entry.role].filter(Boolean).join(", ")}
              </Text>
              {entry.bullets.filter((b) => b.trim()).map((bullet, index) => (
                <Bullet key={index}>{bullet}</Bullet>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Contact, education and skills: the sidebar, or the foot of one column. */
function SideColumn({ doc, stacked }: { doc: ResumeDocument; stacked: boolean }) {
  const { education, skills } = sections(doc);
  const contact = [doc.contact.email, doc.contact.phone, doc.contact.location].filter(Boolean);
  return (
    <View>
      {stacked ? null : (
        <View>
          <Heading>Contact</Heading>
          {contact.map((line) => (
            <Text key={line} style={{ fontSize: 9.5, marginBottom: 2 }}>
              {line}
            </Text>
          ))}
        </View>
      )}
      {education?.type === "education" && education.entries.length > 0 ? (
        <View>
          <Heading>Education</Heading>
          {education.entries.map((entry) => (
            <View key={entry.id} style={{ marginBottom: 4 }}>
              <Text style={{ ...BOLD, fontSize: 9.5 }}>
                {[entry.credential, entry.field].filter(Boolean).join(", ")}
              </Text>
              <Text style={{ fontSize: 9.5 }}>
                {[entry.institution, entry.result].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {skills?.type === "skills" && skills.groups.length > 0 ? (
        <View>
          <Heading>Skills</Heading>
          {skills.groups.map((group) => (
            <Text key={group.id} style={{ fontSize: 9.5, marginBottom: 2, lineHeight: 1.35 }}>
              {group.label ? `${group.label}: ` : ""}
              {group.skills.join(", ")}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function layoutElement(doc: ResumeDocument, layout: Layout): ReactElement<DocumentProps> {
  const family = FONT_PAIRS[doc.settings.fontPair].family;
  const page = { size: "A4" as const, style: { fontFamily: family, padding: 40 } };
  if (layout === "one-column") {
    const contact = [doc.contact.email, doc.contact.phone, doc.contact.location].filter(Boolean);
    return (
      <Document>
        <Page {...page}>
          <Text style={{ ...BOLD, fontSize: 18, marginBottom: 4 }}>{doc.contact.fullName}</Text>
          <Text style={{ fontSize: 9.5 }}>{contact.join(" · ")}</Text>
          <MainColumn doc={doc} withName={false} />
          <SideColumn doc={doc} stacked />
        </Page>
      </Document>
    );
  }

  // The usual template: a narrow column for contact, education and skills,
  // and a wide one for the name and the work. Only the side it sits on — and
  // so the order the PDF holds the two columns in — differs between the two.
  const side = (
    <View style={{ width: "31%", paddingRight: 12 }}>
      <SideColumn doc={doc} stacked={false} />
    </View>
  );
  const main = (
    <View style={{ width: "69%", paddingLeft: 12 }}>
      <MainColumn doc={doc} withName />
    </View>
  );
  return (
    <Document>
      <Page {...page}>
        <View style={{ flexDirection: "row" }}>
          {layout === "sidebar-left" ? side : main}
          {layout === "sidebar-left" ? main : side}
        </View>
      </Page>
    </Document>
  );
}

export async function renderLayout(doc: ResumeDocument, layout: Layout): Promise<Uint8Array> {
  disableHyphenation();
  registerFontPair(doc.settings.fontPair, nodeFontResolver);
  const blob = await pdf(layoutElement(doc, layout)).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/* -------------------------------------------------------------------------- */
/* Measuring                                                                  */
/* -------------------------------------------------------------------------- */

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The bullets a reader would expect to find whole, in the order written. */
function bulletsOf(doc: ResumeDocument): string[] {
  return doc.sections
    .filter((section) => section.visible)
    .flatMap((section) =>
      section.type === "experience" || section.type === "projects"
        ? section.entries.flatMap((entry) => entry.bullets)
        : [],
    )
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 0);
}

export interface Reading {
  /** Fields the scorecard recovered, of those the document has. */
  readonly fieldsRecovered: number;
  readonly fieldsTotal: number;
  /** The fields it missed or misread, by name — "name", "role 2 dates". */
  readonly fieldsLost: readonly string[];
  /** Bullets found as one unbroken sentence in the extracted text. */
  readonly bulletsIntact: number;
  readonly bulletsTotal: number;
}

export function readingOf(doc: ResumeDocument, extracted: ExtractedDocument): Reading {
  const card = scoreRecovery(doc, recoverFields(extracted), extracted.strategy);
  const applicable = card.fields.filter((field) => field.status !== "not-applicable");
  const text = normalize(extracted.lines.join(" "));
  const bullets = bulletsOf(doc);
  return {
    fieldsRecovered: applicable.filter((field) => field.status === "recovered").length,
    fieldsTotal: applicable.length,
    fieldsLost: applicable.filter((field) => field.status !== "recovered").map((field) => field.field),
    bulletsIntact: bullets.filter((bullet) => text.includes(normalize(bullet))).length,
    bulletsTotal: bullets.length,
  };
}

export interface LayoutResult {
  readonly layout: Layout;
  readonly strategy: Strategy;
  readonly fieldsRecovered: number;
  readonly fieldsTotal: number;
  readonly bulletsIntact: number;
  readonly bulletsTotal: number;
  /** Resumes, of all measured, on which every field and every bullet survived. */
  readonly resumesClean: number;
  /** How often each kind of field was lost — "name", "role.title" — across all resumes. */
  readonly lostByField: Readonly<Record<string, number>>;
}

export interface ColumnsMeasurement {
  readonly resumes: number;
  readonly results: readonly LayoutResult[];
  /** The first lines of one resume read geometrically in a sidebar layout. */
  readonly sample: { readonly slug: string; readonly lines: readonly string[] };
}

export async function measureColumns(
  documents: readonly { slug: string; resume: ResumeDocument }[],
  sampleSlug: string,
): Promise<ColumnsMeasurement> {
  const totals = new Map<string, LayoutResult>();
  let sample: ColumnsMeasurement["sample"] = { slug: sampleSlug, lines: [] };

  for (const { slug, resume } of documents) {
    for (const layout of LAYOUTS) {
      const bytes = await renderLayout(resume, layout);
      const readings = {
        "pdf-stream-order": await extractPdfStreamOrder(bytes),
        "pdf-geometric": await extractPdfGeometric(bytes),
      } as const;

      if (slug === sampleSlug && layout === "sidebar-left") {
        sample = { slug, lines: readings["pdf-geometric"].lines.slice(0, 8) };
      }

      for (const strategy of STRATEGIES) {
        const reading = readingOf(resume, readings[strategy]);
        const key = `${layout}|${strategy}`;
        const before = totals.get(key) ?? {
          layout,
          strategy,
          fieldsRecovered: 0,
          fieldsTotal: 0,
          bulletsIntact: 0,
          bulletsTotal: 0,
          resumesClean: 0,
          lostByField: {},
        };
        const clean =
          reading.fieldsRecovered === reading.fieldsTotal &&
          reading.bulletsIntact === reading.bulletsTotal;
        totals.set(key, {
          layout,
          strategy,
          fieldsRecovered: before.fieldsRecovered + reading.fieldsRecovered,
          fieldsTotal: before.fieldsTotal + reading.fieldsTotal,
          bulletsIntact: before.bulletsIntact + reading.bulletsIntact,
          bulletsTotal: before.bulletsTotal + reading.bulletsTotal,
          resumesClean: before.resumesClean + (clean ? 1 : 0),
          lostByField: reading.fieldsLost.reduce<Record<string, number>>(
            (counts, field) => {
              // "role.2.title" and "role.0.title" are the same kind of loss.
              const kind = field.replace(/\.\d+\./, ".");
              counts[kind] = (counts[kind] ?? 0) + 1;
              return counts;
            },
            { ...before.lostByField },
          ),
        });
      }
    }
  }

  return { resumes: documents.length, results: [...totals.values()], sample };
}
