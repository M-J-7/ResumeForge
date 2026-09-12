/**
 * A resume drawn as markup, from the same block list the emitters use.
 *
 * ## Why not render the real PDF
 *
 * `PaperSample.tsx` states the trade for the landing page and it applies here
 * at more pages: rendering a resume through `renderPdf` pulls react-pdf, the
 * Yoga WASM module and the pdfjs worker onto a marketing page, for a picture.
 * §2.2 budgets the *builder* at three seconds on throttled 4G; spending that
 * on a page whose job is to be read by a crawler and skimmed by a visitor
 * would be the wrong trade twice.
 *
 * ## Why it is not hand-written markup either
 *
 * `PaperSample` is hand-written, and that is right for one illustration on
 * the landing page. For a growing set of example pages it would be a second
 * definition of what a resume looks like, drifting from the emitters one
 * commit at a time — and an example resume that does not match what the
 * product produces is worse than no example.
 *
 * So this takes `buildDocument(resume)` — the *same* flat block list the PDF,
 * DOCX and TXT emitters consume — and maps it to HTML. There is one source of
 * composition and one source of order. The page's plain-text body comes from
 * `renderText` on the same document, so the picture and the text a crawler
 * reads cannot disagree either.
 *
 * A server component: nothing here is interactive, and the whole point is
 * that the content exists without JavaScript.
 */

import { buildDocument, type DocumentBlock } from "@/lib/layout/document";
import { entryLines, contactLine, skillGroupLine } from "@/lib/emit/shared/entry-lines";
import type { ResumeDocument } from "@/lib/resume/schema";
import { cn } from "@/lib/utils";

export function ResumePaper({ resume, className }: { resume: ResumeDocument; className?: string }) {
  const blocks = buildDocument(resume);

  return (
    <div
      className={cn(
        // `--paper` does not flip with the theme, so the ink must not either.
        "bg-paper border-line rounded-lg border p-8 text-[#18181b] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: DocumentBlock }) {
  const entry = entryLines(block);
  if (entry) {
    return (
      <div className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{entry.heading}</p>
          {entry.dateLabel ? (
            <p className="shrink-0 text-xs text-[#52525b]">{entry.dateLabel}</p>
          ) : null}
        </div>
        {entry.meta ? <p className="text-xs text-[#3f3f46] italic">{entry.meta}</p> : null}
        {entry.firstBullet ? <Bullet text={entry.firstBullet} /> : null}
      </div>
    );
  }

  switch (block.type) {
    case "contact":
      return (
        <header className="mb-4">
          <p className="text-xl font-semibold tracking-tight">{block.fullName}</p>
          <p className="mt-1 text-xs text-[#52525b]">{contactLine(block)}</p>
        </header>
      );

    case "sectionHeading":
      return (
        // A real heading element, uppercase, in the flow — the same three
        // properties the emitters give it, for the same reason.
        <h3 className="mt-5 border-b border-[#d4d4d8] pb-1 text-xs font-semibold tracking-[0.08em] uppercase">
          {block.label}
        </h3>
      );

    case "summary":
      return <p className="mt-2 text-sm leading-relaxed text-[#3f3f46]">{block.text}</p>;

    case "skillGroup":
      return <p className="mt-1.5 text-sm text-[#3f3f46]">{skillGroupLine(block)}</p>;

    case "bullet":
      return <Bullet text={block.text} />;

    default:
      // Letter blocks. A resume never produces them, and rendering nothing is
      // the correct handling rather than an oversight.
      return null;
  }
}

function Bullet({ text }: { text: string }) {
  return (
    <p className="mt-1 flex gap-2 pl-1 text-sm leading-snug text-[#3f3f46]">
      <span aria-hidden className="text-[#a1a1aa]">
        •
      </span>
      <span>{text}</span>
    </p>
  );
}
