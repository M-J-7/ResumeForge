/**
 * The document, as the landing page's hero object.
 *
 * ## Why this is not the real PDF
 *
 * The obvious move is to render an actual fixture through `renderPdf` and show
 * the blob — the product's whole D2 argument is that the preview *is* the
 * artifact. But that pulls the react-pdf bundle, the Yoga WASM module and the
 * pdfjs worker onto the landing page, and §9 budgets the *builder* at three
 * seconds on throttled 4G. Spending that on a marketing page, for a picture,
 * would be the wrong trade twice: slower for everyone, and slowest for exactly
 * the low-end mobile users the honest positioning is aimed at.
 *
 * So this is markup. It is an illustration and it is described as one.
 *
 * ## What keeps it honest
 *
 * `SAMPLE` below is the single source for both panes of the X-Ray teaser: the
 * rendered page and the "what a machine reads" column are derived from the
 * same object, so they cannot drift into claiming a recovery the structure
 * would not actually produce. The layout mirrors what the emitters really do —
 * one column, real text, standard section headings, dates on the right — which
 * is the same structure D14 permits us to describe as most reliably readable.
 *
 * ## Block ids
 *
 * Every element on the page carries the id of the block it came from, and
 * `sampleLines()` stamps the same id onto each recovered line. That is what
 * lets the hero light both halves of a pair at once when a pointer lands on
 * either of them: hovering a line of recovered text is hovering the block it
 * was recovered *from*. The pairing is the entire argument of the section, and
 * making it something the visitor can point at says it better than the caption
 * does.
 */

"use client";

import { cn } from "@/lib/utils";

export const SAMPLE = {
  name: "Priya Raghunathan",
  contact: "priya@example.com · +1 415 555 0134 · Oakland, CA",
  summary:
    "Platform engineer, six years, mostly deployment pipelines and zero-downtime data migrations.",
  sections: [
    {
      id: "experience",
      heading: "Experience",
      entries: [
        {
          id: "meridian",
          title: "Senior Platform Engineer",
          org: "Meridian Health",
          dates: "Mar 2022 – Present",
          bullets: [
            "Cut median deploy time from 38 minutes to 6 by moving 40 services onto a shared Kubernetes pipeline.",
            "Led the migration of the billing datastore with zero downtime and no data loss across 2.1M records.",
          ],
        },
        {
          id: "corvid",
          title: "Backend Engineer",
          org: "Corvid Labs",
          dates: "Jul 2019 – Feb 2022",
          bullets: [
            "Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.",
          ],
        },
      ],
    },
    {
      id: "education",
      heading: "Education",
      entries: [
        {
          id: "anna",
          title: "BE, Computer Science",
          org: "Anna University",
          dates: "2015 – 2019",
          bullets: [],
        },
      ],
    },
  ],
} as const;

/** The block a rendered element and a recovered line have in common. */
export type BlockId = string;

const HEAD: BlockId = "head";
const SUMMARY: BlockId = "summary";
const sectionBlock = (sectionId: string): BlockId => `section:${sectionId}`;
const entryBlock = (entryId: string): BlockId => `entry:${entryId}`;
const bulletBlock = (entryId: string, index: number): BlockId => `bullet:${entryId}:${index}`;

export interface RecoveredLine {
  /** The block this line came out of, or `null` for the blank lines between. */
  id: BlockId | null;
  text: string;
}

/**
 * The plain text a parser recovers from the structure above, one line at a
 * time, each still carrying the block it came from.
 */
export function sampleLines(): RecoveredLine[] {
  const lines: RecoveredLine[] = [
    { id: HEAD, text: SAMPLE.name },
    { id: HEAD, text: SAMPLE.contact },
    { id: null, text: "" },
    { id: SUMMARY, text: SAMPLE.summary },
    { id: null, text: "" },
  ];

  for (const section of SAMPLE.sections) {
    lines.push({ id: sectionBlock(section.id), text: section.heading.toUpperCase() });
    lines.push({ id: null, text: "" });

    for (const entry of section.entries) {
      lines.push({ id: entryBlock(entry.id), text: `${entry.title}, ${entry.org}` });
      lines.push({ id: entryBlock(entry.id), text: entry.dates });
      entry.bullets.forEach((bullet, index) => {
        lines.push({ id: bulletBlock(entry.id, index), text: `- ${bullet}` });
      });
      lines.push({ id: null, text: "" });
    }
  }

  // Trailing blanks are an artifact of the loop, not something a parser would
  // report. Drop them rather than rendering empty rows at the end of the pane.
  while (lines.length > 0 && lines[lines.length - 1]!.text === "") lines.pop();
  return lines;
}

/** The same recovery as one string. */
export function sampleAsPlainText(): string {
  return sampleLines()
    .map((line) => line.text)
    .join("\n");
}

export interface PaperSampleProps {
  className?: string;
  /** The block currently under a pointer, on either side of the pair. */
  activeId?: BlockId | null;
  /** Called with the block under the pointer, and with `null` on the way out. */
  onBlockChange?: (id: BlockId | null) => void;
}

export function PaperSample({ className, activeId, onBlockChange }: PaperSampleProps) {
  // Pointer-only, and only ever a highlight: the pairing it demonstrates is
  // already stated in the figure's caption, so nothing is conveyed by hover
  // alone. Keyboard and screen-reader users lose an ornament, not a claim.
  const marks = (id: BlockId, className?: string) => ({
    "data-block": id,
    onPointerEnter: onBlockChange ? () => onBlockChange(id) : undefined,
    className: cn("rounded-[2px]", className, activeId === id && "paper-mark"),
  });

  return (
    <div
      // Decorative in the accessibility tree: the surrounding copy already
      // says what this is, and reading a fictional person's fictional resume
      // aloud tells a screen reader user nothing about the product.
      aria-hidden="true"
      onPointerLeave={onBlockChange ? () => onBlockChange(null) : undefined}
      className={cn(
        // `@container` so the `cqw` type sizes below resolve against this
        // page rather than the viewport. Without a container they fall back
        // to viewport units, and the sample's type scale stops tracking its
        // own width — text that fits at one breakpoint overflows at the next.
        "bg-paper ring-paper-edge @container w-full origin-top rounded-sm shadow-[var(--shadow-page)] ring-1",
        // A4 proportions. The page is the point; letting it be an arbitrary
        // rectangle would undercut the one thing this element is here to say.
        "aspect-[210/297] overflow-hidden",
        className,
      )}
    >
      {/* Fixed dark ink regardless of theme — `--paper` does not flip, so its
          text must not either, or the sample goes white-on-white in dark. */}
      <div className="flex h-full flex-col gap-[2.9%] px-[8%] py-[7%] text-[#18181b]">
        <div {...marks(HEAD, "text-center")}>
          <p className="text-[clamp(0.9rem,3.6cqw,1.5rem)] font-semibold tracking-tight">
            {SAMPLE.name}
          </p>
          <p className="mt-[1.4%] text-[clamp(0.46rem,1.85cqw,0.76rem)] text-[#52525b]">
            {SAMPLE.contact}
          </p>
        </div>

        <p {...marks(SUMMARY, "text-[clamp(0.44rem,1.78cqw,0.74rem)] leading-snug text-[#3f3f46]")}>
          {SAMPLE.summary}
        </p>

        {SAMPLE.sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-[1.8%]">
            <p
              {...marks(
                sectionBlock(section.id),
                "border-b border-[#d4d4d8] pb-[0.8%] text-[clamp(0.54rem,2.05cqw,0.85rem)] font-semibold tracking-[0.08em] uppercase",
              )}
            >
              {section.heading}
            </p>
            {section.entries.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-[0.9%]">
                <div {...marks(entryBlock(entry.id), "flex items-baseline justify-between gap-2")}>
                  <p className="text-[clamp(0.54rem,2.05cqw,0.85rem)] font-semibold">
                    {entry.title}
                    <span className="font-normal text-[#3f3f46]">, {entry.org}</span>
                  </p>
                  <p className="shrink-0 text-[clamp(0.44rem,1.7cqw,0.7rem)] text-[#52525b]">
                    {entry.dates}
                  </p>
                </div>
                {entry.bullets.map((bullet, index) => (
                  <p
                    key={bullet}
                    {...marks(
                      bulletBlock(entry.id, index),
                      "pl-[3%] text-[clamp(0.44rem,1.78cqw,0.74rem)] leading-snug text-[#3f3f46]",
                    )}
                  >
                    • {bullet}
                  </p>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
