/**
 * The words on `/check` around the tool: what it reads, and the questions.
 *
 * ## Why the page needed them
 *
 * "ATS resume checker" is the most contested query this site answers, and
 * the 2026-10-02 audit measured `/check` at 355 words — the thinnest page on
 * the site, against competitors' pages of a thousand and more. A tool page
 * with nothing on it but the tool tells a crawler nothing about what the tool
 * does, and tells a visitor deciding whether to trust it with a file even
 * less.
 *
 * So the page says what the check reads, field by field, taken from what the
 * parser in `lib/import/parse-resume.ts` actually reports — and answers the
 * questions people ask before handing over a resume. Held to D14 by
 * `check-page.test.ts`, with the same scan the landing FAQ runs.
 */

import type { FaqItem } from "@/lib/faq";
import COLUMNS from "@/lib/measured/columns.json";

/** What the check reports, in the order it reports it. */
export const CHECK_READS: readonly { readonly name: string; readonly body: string }[] = [
  {
    name: "Your name",
    body: "Read from the first line, which is where parsers look for it. If the top of the file is an address or a logo, the name may not come back at all.",
  },
  {
    name: "Email and phone",
    body: "The email matched exactly, and the phone checked as a real number in its country's format rather than any run of digits.",
  },
  {
    name: "Location and links",
    body: "A “City, Region” pair from the contact block, and your links. A PDF keeps the address behind a link apart from its text, so “LinkedIn” can come back as a word with no URL — the check says when that happened.",
  },
  {
    name: "Each role's title, employer and dates",
    body: "Split into the fields an applicant tracking system stores. A date written as 03/04/2023 is flagged, because its month is ambiguous and only the year can be trusted.",
  },
  {
    name: "Your sections",
    body: "Experience, education, skills, projects and the rest, found by their headings. A heading it does not recognise is kept as a section of its own rather than guessed at.",
  },
  {
    name: "Reading order",
    body: "A PDF is read two ways — in the order the file stores its text, and line by line across the page — and every line where the two disagree is listed. Columns and text boxes are the usual cause.",
  },
];

export const CHECK_FAQ: readonly FaqItem[] = [
  {
    question: "Is this ATS resume checker really free, with no sign-up?",
    answer:
      "Yes. There is no account to make, no limit on how many files you check, and no paid version of the check waiting behind it. It costs almost nothing to run, because the work happens on your computer rather than ours: the page loads the parser into your browser, and your file is read there. If you want to fix what it finds, the builder is free on the same terms, and its PDF, Word and plain-text downloads are free too.",
  },
  {
    question: "Is my resume uploaded anywhere when I check it?",
    answer:
      "No. Your browser opens the file and parses it in the same tab, and there is no route on this server that accepts a resume file at all, so there is nowhere for it to go. You can watch it not happen: open your browser's developer tools, choose the Network tab, and check a file. When you close the tab, the result is gone. If you choose to open the result in the builder, it is passed along inside the tab's own session storage, never through the server.",
    link: { href: "/privacy", label: "What this site stores, and what it never sees" },
  },
  {
    question: "Why doesn't this checker give my resume an ATS score?",
    answer:
      "Because nobody outside an employer can compute one that means anything. Applicant tracking systems are private, they differ from each other, and every employer configures its own, so a percentage from a website measures the website's own rules. What can be checked is narrower and real: whether your name, contact details, job titles, employers and dates come back out of the file as the right fields. If they do not come back here, the problem is in the file itself — and that is something you can fix.",
  },
  {
    question: "Which resume file formats can the checker read?",
    answer:
      "PDF and Word .docx, which are what application forms ask for. An older .doc file needs saving as .docx first, from Word or Google Docs. A scanned PDF or a photo of a resume is a picture of text rather than text, so very little comes back from it; export a fresh PDF from the document you wrote instead. A PDF is read two ways, in the order the file stores its text and line by line across the page, and the lines where those disagree are listed for you.",
    link: { href: "/guides/resume-file-format", label: "PDF, Word or plain text: which to send" },
  },
  {
    question: "What should I fix first when a field comes back wrong?",
    answer: `Start with your name, email and phone, because a record without them is hard to act on. Then the roles: a job title, employer or date that lands in the wrong field usually means the layout moved text around — a second column, a table or a text box. We measured the column case on ${COLUMNS.resumes} resumes. In one column every bullet came through intact; with a sidebar, reading line by line broke about half of them. Moving everything into a single column of plain text fixes most of it.`,
    link: { href: "/guides/two-column-resume-ats", label: "The two-column measurement" },
  },
  {
    question: "What should I check after the file reads cleanly?",
    answer:
      "The words. A file that parses cleanly has stopped being the problem, and what is left is whether your resume shows what a particular posting asks for. Paste the job description and your resume into the keyword scanner to see which requirements your resume demonstrates, which it only lists in a skills line, and which it never mentions. Then run your bullets through the bullet point checker, which flags a line that names a duty without saying what you did or what came of it.",
    link: { href: "/resume-keyword-scanner", label: "Free resume keyword scanner" },
  },
];
