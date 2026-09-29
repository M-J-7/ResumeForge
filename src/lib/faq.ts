/**
 * The questions people actually type, answered without a sales pitch.
 *
 * ## Why a FAQ at all
 *
 * Not as a page-length filler. These are the queries this product competes for
 * — "does a two-column resume break ATS parsing", "is PDF or DOCX better for
 * applications" — and the honest answer to each of them is also the strongest
 * argument for the tool. A competitor who has promised "ATS-proof" cannot
 * write the answer to question four; we can, and that asymmetry is the whole
 * positioning.
 *
 * Emitted twice: as `<details>` elements a reader can open, and as `FAQPage`
 * JSON-LD. The two come from this one array, so the markup a crawler reads
 * cannot describe answers the page does not contain — which is both Google's
 * structured-data policy and the rule the rest of this codebase follows.
 *
 * ## The rule every answer follows
 *
 * **Say what is knowable, and say plainly what is not.** Applicant tracking
 * systems are private, differ from each other and are configured differently
 * by every employer, so no answer here claims an outcome. `faq.test.ts`
 * enforces that with the same scan `examples.test.ts` runs over the guides —
 * including its escape hatch for a sentence that names a claim in order to
 * refuse it, because refusing the claim is most of what these answers do.
 *
 * Answers are one paragraph. A FAQ entry that needs three is a guide, and
 * `/guides` is where it goes.
 */

export interface FaqItem {
  /** The question, phrased the way it is searched. */
  question: string;
  /** One paragraph. Plain text: it is rendered as prose and emitted as JSON-LD. */
  answer: string;
}

export const FAQ: readonly FaqItem[] = [
  {
    question: "Does a two-column resume break ATS parsing?",
    answer:
      "Often it degrades it, and how badly depends on the system. A parser reads a PDF as a stream of positioned text, and a two-column layout can interleave the columns — a job title from the left column followed by a skill from the right — which produces lines that belong to nothing. Single-column text in reading order is the structure that survives the widest range of parsers, which is why this tool only makes that kind. You can check any file you already have, and see what came back, without an account.",
  },
  {
    question: "Is PDF or DOCX better for job applications?",
    answer:
      "Use DOCX when the application form accepts it and says nothing about format, and PDF when you are attaching to an email or the form asks for one. DOCX reads most reliably through older application systems, because the text and the headings are already structured rather than having to be recovered from a page layout. PDF preserves exactly what you laid out, which matters once a human opens it. This builder gives you both, plus plain text, so the choice is never a re-export.",
  },
  {
    question: "Do applicant tracking systems reject resumes automatically?",
    answer:
      "Most of the time, no — not on their own. The common setup is that the system parses your file into fields, scores or filters against criteria a recruiter configured, and shows a ranked list to a person who decides. Some employers do set hard knockout questions, usually about work authorisation or a licence, and those are answered on the form rather than in the resume. The part you control is whether the file parses cleanly into the fields, which is the part this tool measures.",
  },
  {
    question: "How many keywords from the job description should I use?",
    answer:
      "Use the ones that are true of you, in the sentences where they are true. Matching the posting's own vocabulary helps, because a recruiter searching the system searches for the words in their own posting — but a list of terms pasted at the bottom of a resume is visible to the person reading it and reads exactly as it is. The match report here shows which requirements from a posting your resume already evidences and which it does not, so the gap is something you decide about rather than something you pad.",
  },
  {
    question: "Should a resume be one page?",
    answer:
      "One page if you have under about ten years of relevant experience, two if you have more and the second page earns itself. The rule people repeat as universal came from an era of paper stacks, and a strong second page is not held against you; a thin one is. What genuinely costs you is a page of filler, or cutting real evidence to force a fit. The preview here is the actual PDF, so the page count you see is the page count a recruiter gets.",
  },
  {
    question: "Do a photo, a logo, or colour on a resume cause problems?",
    answer:
      "A photo and a logo can, because an image contains no text — anything you put inside one is invisible to a parser, and in several countries a photo also creates a bias problem a recruiter may be instructed to avoid. Colour is fine as long as the text is still readable in grey: it is the contrast that matters, not the hue. The templates here use colour on headings and rules and never put information inside an image.",
  },
  {
    question: "Do I need an account to download my resume?",
    answer:
      "No. The builder works signed out, and PDF, Word, plain text and JSON Resume all download for nothing, with no watermark and no step at the end where the download stops being free. Without an account your resume is written to storage inside your own browser and stays there. An account is optional; it adds syncing between devices, and deleting it removes every resume immediately with no copy kept.",
  },
  {
    question: "What should I name the resume file?",
    answer:
      "Your name, the role, and nothing else — the way a recruiter's downloads folder wants it, because that folder is where the file ends up next to forty others called resume.pdf. It is a courtesy to the person reading it rather than something an applicant tracking system searches on. This tool names every export that way by default.",
  },
] as const;
