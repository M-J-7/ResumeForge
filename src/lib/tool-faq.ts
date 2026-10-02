/**
 * The questions on the two text tools — the keyword scanner and the bullet
 * point checker — answered on their pages and as `FAQPage` markup.
 *
 * The same reasoning as `check-page.ts`: a tool page is found by what it
 * says about the tool, and these are the questions people type before
 * pasting their resume into a stranger's text box. Every fact here is read
 * from the code that does the work where it can be — the section weights
 * from `SECTION_WEIGHTS`, the vocabulary size from `MEASURED` — so the page
 * cannot describe an engine the site does not run. Held to D14 by
 * `tool-faq.test.ts`.
 */

import type { FaqItem } from "@/lib/faq";
import { SECTION_WEIGHTS } from "@/lib/jd/parse";
import { MEASURED } from "@/lib/trust-signals";

/** "7,400" — the vocabulary, rounded down so the claim stays true as it grows. */
const VOCABULARY = (Math.floor(MEASURED.skillTerms / 100) * 100).toLocaleString("en-US");

export const SCANNER_FAQ: readonly FaqItem[] = [
  {
    question: "How do I compare my resume to a job description?",
    answer: `Paste the job description into the first box and your resume, as text, into the second, then press Compare. The posting is split at its headings and each requirement is weighted by where it came from — a line under Requirements counts ${SECTION_WEIGHTS.required} times, under Responsibilities ${SECTION_WEIGHTS.responsibilities}, under Nice to have ${SECTION_WEIGHTS.preferred}, and the benefits and the company blurb not at all. Each requirement then comes back as demonstrated, listed only, or missing. From Word or Google Docs, select all and copy; from a PDF, the ATS checker shows you the text first.`,
  },
  {
    question: "Is this resume keyword scanner free, and is my resume uploaded?",
    answer: `It is free, with no account and no limit, and nothing is uploaded. The comparison runs in your browser: the skill vocabulary of ${VOCABULARY} terms loads from this site like the rest of the page, and the posting and your resume stay in the tab. When you close it, both are gone. If you continue in the builder, the resume is handed over through the tab's own session storage rather than a link or the server, so it never appears in an address, a history entry or a log.`,
  },
  {
    question: "Why doesn't the scanner give me a match percentage?",
    answer:
      "Because a percentage is a number you end up writing towards, and the way to raise it is to paste the posting's words into your resume until it reads like the posting. Nobody outside an employer knows how its system ranks candidates, so a figure from a website measures that website's rules. What is useful is the list underneath any figure: which requirements your resume shows in its work, which it only claims in a skills line, and which it never mentions — so the gap is something you decide about.",
  },
  {
    question: "Should I add every missing keyword to my resume?",
    answer:
      "Only the ones that are true, and in the place where they are true. A skill named in the bullet where you used it counts as demonstrated here; the same word added to a skills list counts as listed only, because that is a claim rather than evidence. Repeating a keyword far more often than writing needs makes the result worse here rather than better, and a person reading the resume notices it sooner than any software does. A requirement you genuinely lack is better left missing than invented.",
  },
  {
    question: "What kinds of jobs does the keyword scanner understand?",
    answer: `Software and engineering tools, and the working vocabulary of healthcare, teaching, office and administration, finance, retail, HR and sales — ${VOCABULARY} terms in all, matched with their common spellings and abbreviations. It is not exhaustive. Where a posting names nothing the vocabulary knows, the scanner says so rather than inventing a result — which is your cue to read the posting's requirements against your resume yourself, line by line, the way a recruiter would.`,
  },
];

export const BULLETS_FAQ: readonly FaqItem[] = [
  {
    question: "What makes a good resume bullet point?",
    answer:
      "Four parts: an action verb that names what you did, the thing you did it to, how you did it, and what changed because of it. A bullet with all four reads as evidence — “Cut first-response time from 9 hours to 2 by routing tickets with triage rules”. One with only the first two reads as a job description. Not every bullet will have a number, but every bullet can say what happened next, and that is the part readers look for first and writers leave out most.",
  },
  {
    question: "Will the bullet point checker rewrite my bullets for me?",
    answer:
      "No, deliberately. It names the part a bullet is missing and asks the question whose answer would fill it, and the words stay yours. A rewritten bullet is a claim somebody else made about your work: it may say more than you did, and it is you who will be asked about it in an interview. Most tools like this elsewhere are a rewrite button. This one is a checklist, and it is the same one the builder uses as you write.",
  },
  {
    question: "Why does the checker flag “responsible for” and “helped”?",
    answer:
      "Because each describes the job rather than what you did in it. “Responsible for” says the task existed, not that you did it or how well; “helped” and “assisted” hide your share of the result behind somebody else's; “worked on” puts you near the work rather than in it. The checker asks you to lead with a verb that names what changed instead, and leaves the choice of verb to you, because only you know which one is true.",
    link: { href: "/resume-action-verbs", label: "Verbs that say which part was yours" },
  },
  {
    question: "How do I add numbers to a bullet when I don't have any?",
    answer:
      "Count something you can stand behind: how many, how often, how large, how long it took before and after. A ticket queue, a class size, a shift's patient load, a monthly report's deadline — most work has a scale even when nobody measured the result. Ranges and approximations are fine if they are honest. What does not work is a number made up to fill the space, because it is the first thing an interviewer asks about.",
    link: {
      href: "/guides/how-to-quantify-a-bullet",
      label: "How to quantify a bullet without hard numbers",
    },
  },
  {
    question: "Is anything I paste into the bullet checker stored or sent?",
    answer:
      "No. Each line is checked as you type, in this tab, by code that has already loaded — there is no request to any server, and nothing is written to storage. When you close the tab, what you pasted is gone. That is the same promise the ATS checker makes about a file, and the site's tests hold both to it by watching the network while they run, so it is a property of the code rather than a line in a policy.",
    link: { href: "/privacy", label: "What this site stores, and what it never sees" },
  },
];
