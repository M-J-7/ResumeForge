/**
 * The guides (P36).
 *
 * **Quality over count, and the reason is not modesty.** A thin page that
 * ranks and disappoints is worse than no page: it costs the reader a click
 * and costs us the one impression we had. So this is four guides that answer
 * a question completely, rather than forty that answer one each halfway.
 *
 * Every one is written here, by us. Nothing is scraped — republishing
 * somebody else's copy is the failure `QA.md` already refuses for job
 * postings, and it applies identically to career advice.
 *
 * ## What is allowed to be said
 *
 * D14 governs every sentence. These guides may describe what a parser does,
 * because X-Ray measures it; they may describe conventions, because those are
 * observable; they may not promise an outcome, and a test asserts the
 * absence. Where the honest answer is "nobody knows", that is the answer —
 * which is itself the differentiator, since the competing page always claims
 * to know.
 *
 * ## Structure, not markdown
 *
 * Content as data rather than as `.md` files, for one concrete reason: a
 * markdown pipeline means a parser, a sanitiser and a styling layer, and the
 * guides do not need any of the three. Sections of prose and lists render
 * without JavaScript and are what the crawler reads.
 */

export type GuideBlock =
  | { readonly kind: "prose"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "callout"; readonly text: string };

export interface GuideSection {
  readonly heading: string;
  readonly blocks: readonly GuideBlock[];
}

export interface Guide {
  readonly slug: string;
  readonly title: string;
  /** The meta description, and the line under the title. */
  readonly summary: string;
  /** Roughly how long it takes to read, so the reader can decide. */
  readonly minutes: number;
  readonly sections: readonly GuideSection[];
}

export const GUIDES: readonly Guide[] = [
  {
    slug: "what-an-ats-actually-does",
    title: "What an applicant tracking system actually does",
    summary:
      "What the software does, what it does not do, and which of the advice you have read is folklore.",
    minutes: 6,
    sections: [
      {
        heading: "It is a database before it is a filter",
        blocks: [
          {
            kind: "prose",
            text: "An applicant tracking system is, first and mostly, a place to keep applications. It receives your file, extracts text from it, tries to identify a few fields — name, contact details, employers, dates — and stores the result so a recruiter can search and sort it later. The extraction is the part that concerns you, because everything downstream reads what it produced rather than what you sent.",
          },
          {
            kind: "prose",
            text: "The popular image of a robot scoring your resume and rejecting it before a human sees it is mostly wrong, and where it is right it is configured by the employer rather than built into the software. Most systems rank; they do not reject. The ranking is usually crude, and a recruiter still opens the file.",
          },
        ],
      },
      {
        heading: "What actually goes wrong",
        blocks: [
          {
            kind: "prose",
            text: "The failures worth caring about are extraction failures, and they are boring: text that is not text, reading order that is ambiguous, and fields that are not where a parser looks.",
          },
          {
            kind: "list",
            items: [
              "A resume exported as an image, or scanned. There is no text layer, so there is nothing to extract at all.",
              "Contact details in the page header or footer. Several parsers drop those regions before reading, which loses your email.",
              "A two-column layout. A parser that reads column-wise recovers your resume correctly; one that reads line-wise interleaves the two columns into nonsense. Which one you get is not up to you.",
              "Text inside a table, a text box, or a graphic. Same problem, less obviously.",
              "Dates written only as “2019–2021” beside an employer, with no month. Recoverable, but it costs the parser a guess it may get wrong.",
            ],
          },
          {
            kind: "callout",
            text: "You can check every one of these on your own file, in your own browser, at /check. It shows the text a parser extracts and which fields it recovered — not a score, and not a prediction.",
          },
        ],
      },
      {
        heading: "What we will not tell you",
        blocks: [
          {
            kind: "prose",
            text: "We will not tell you a resume is guaranteed to pass. Those systems are private, they are configured per employer, and anyone quoting you a pass rate is guessing. We will not quote an interview-rate improvement either, because we have not run that study and neither has whoever you last read it from.",
          },
          {
            kind: "prose",
            text: "What is defensible is narrower: a single column of real text with standard section headings is the arrangement that the widest range of parsers reads correctly. That is a statement about software behaviour, and it is checkable.",
          },
        ],
      },
    ],
  },

  {
    slug: "resume-with-no-experience",
    title: "Writing a resume when you have no work experience",
    summary:
      "The evidence is almost always there. The problem is that it has not been counted as work.",
    minutes: 7,
    sections: [
      {
        heading: "You have more than you think",
        blocks: [
          {
            kind: "prose",
            text: "Almost everyone who says they have nothing to put on a resume has done several things that belong on one, and has not counted them because nobody paid for them. A resume is evidence of capability, and payment is one source of evidence among several.",
          },
          {
            kind: "list",
            items: [
              "The final-year or capstone project. It is a real project with a scope and a result; describe it as one rather than as a subject you were graded in.",
              "Hackathons, including the ones that did not place. What you built in 36 hours is evidence of what you can build.",
              "Club, society or student-government work. Organising an event for four hundred people is operations experience.",
              "Teaching assistant or tutoring work, paid or not. It has a scope, a duration and an outcome.",
              "Open-source contributions, however small. A merged pull request to something people use is public and checkable.",
              "Competitive programming placements. A rank is a number, and numbers are the thing most first resumes lack.",
              "Anything you built that somebody else ended up using — a script your lab still runs, a spreadsheet that replaced a process.",
            ],
          },
        ],
      },
      {
        heading: "Put the evidence first",
        blocks: [
          {
            kind: "prose",
            text: "Lead with Projects and Education, and leave Experience out entirely rather than including it with nothing underneath. An empty section advertises the gap; its absence does not. When you have your first internship, it moves back to the top and everything below it shifts down.",
          },
          {
            kind: "prose",
            text: "Then write each project the way you would write a job: what you made, who it was for, and what happened as a result. The shape is identical, and it is the shape a reader is scanning for.",
          },
        ],
      },
      {
        heading: "One page, and do not pad it",
        blocks: [
          {
            kind: "prose",
            text: "A short honest resume reads better than a long one stretched with “Microsoft Word” and “hard-working team player”. Padding is visible, and the reader who notices it discounts the rest of the page.",
          },
          {
            kind: "callout",
            text: "The builder asks how much experience you have on first open. Answer “no work experience yet” and it reorders the sections for you and changes the advice each one gives.",
          },
        ],
      },
    ],
  },

  {
    slug: "how-to-quantify-a-bullet",
    title: "How to put a number on a bullet when you do not have one",
    summary:
      "The advice is always “quantify your achievements”. Here is what to do when the number is not written down anywhere.",
    minutes: 5,
    sections: [
      {
        heading: "Why a number changes the sentence",
        blocks: [
          {
            kind: "prose",
            text: "“Improved the reporting process” asks the reader to take your word for it. “Cut the weekly report from six hours to twenty minutes” does not — and it invites a follow-up question in an interview, which is the whole point of a resume.",
          },
          {
            kind: "prose",
            text: "The number does not have to be impressive. It has to be specific. A small, precise figure reads as true; a large vague one reads as marketing.",
          },
        ],
      },
      {
        heading: "Four places a number is hiding",
        blocks: [
          {
            kind: "list",
            items: [
              "Time. How long did it take before, and how long after? Estimating honestly is fine — “about a day, down to about an hour” is a real claim.",
              "Count. How many customers, students, patients, tickets, stores, services, rows? Scale tells a reader what kind of job this was.",
              "Money. Budget, spend avoided, revenue, contract value. Say the currency and the period.",
              "Proportion. Out of how many? “12th of 340” is stronger than “top 5%”, and both are stronger than “highly ranked”.",
            ],
          },
        ],
      },
      {
        heading: "How to estimate honestly",
        blocks: [
          {
            kind: "prose",
            text: "Most of these numbers were never written down anywhere, and you are not expected to have kept records. What you are expected to do is estimate in a way you could defend if asked, which means three things: round down, say the basis, and pick a figure you would be comfortable being questioned on.",
          },
          {
            kind: "list",
            items: [
              "Round down, not up. “Over 200” for a figure you believe is 240 is safe; “nearly 300” is the sentence that unravels.",
              "Reconstruct from something you do remember. Four tickets a day across two years is roughly two thousand — you did not count them, and you do not need to have.",
              "Use the unit the reader thinks in. A recruiter for a hospital thinks in beds and ratios; one for a warehouse thinks in pallets and shifts.",
              "If two numbers are available, prefer the one nobody has to take on trust. A public repository star count is checkable; an internal satisfaction score is not.",
            ],
          },
          {
            kind: "prose",
            text: "Estimating is not exaggerating. The difference is whether you can say where the figure came from, and a sentence you can explain in an interview is doing its job whether or not it came out of a report.",
          },
        ],
      },
      {
        heading: "When there genuinely is no number",
        blocks: [
          {
            kind: "prose",
            text: "Some real work does not have one. In that case name the before and after in words — “ended the weekly reconciliation meeting entirely” — or name the thing that became possible. A stated change with no figure still beats a duty with no change.",
          },
          {
            kind: "prose",
            text: "This happens most often in work that prevents things: security, compliance, safety, maintenance. Nothing going wrong is the outcome, and it is genuinely hard to quantify. Name what was at risk and what you removed instead — “closed the access-review gap that had gone unaudited for three years” says what happened without pretending to a figure nobody has.",
          },
          {
            kind: "callout",
            text: "Do not invent one. A number you cannot explain in an interview is worse than no number, and it is the single easiest thing to be caught on.",
          },
        ],
      },
      {
        heading: "What the builder does about this",
        blocks: [
          {
            kind: "prose",
            text: "Each bullet you write gets a line underneath saying how many things are worth thinking about in it, and opening that line shows you which part is missing — the action, what you did it to, how, or the result. It asks questions and never writes the sentence for you, because a number invented on your behalf is one you cannot defend.",
          },
        ],
      },
    ],
  },

  {
    slug: "resume-file-format",
    title: "PDF, Word, or plain text: which file to send",
    summary: "Three formats, three different situations, and one rule that covers most of them.",
    minutes: 4,
    sections: [
      {
        heading: "The short answer",
        blocks: [
          {
            kind: "prose",
            text: "Send a PDF unless you have been asked for something else. It renders the same everywhere, it cannot be edited by accident, and every modern parser reads one that contains real text.",
          },
          {
            kind: "prose",
            text: "Send a Word .docx when the posting or the recruiter asks for one. Agency recruiters often do, because they add their own branding before passing it on. A .docx built from real named styles parses at least as well as a PDF and sometimes better, because the file states which paragraph is a heading rather than leaving it to be inferred.",
          },
          {
            kind: "prose",
            text: "Use plain text when you are pasting into a form field. It is the only format that survives a textarea intact, and it is what the “paste your resume” box on an application portal actually wants.",
          },
        ],
      },
      {
        heading: "What matters more than the format",
        blocks: [
          {
            kind: "prose",
            text: "The format argument gets far more attention than it deserves. A PDF and a .docx of the same single-column resume parse about equally well, and both parse badly if the document underneath them is badly built. These four things decide the outcome, and none of them is the file extension.",
          },
          {
            kind: "list",
            items: [
              "That the file contains real text. A PDF exported as an image is unreadable to every parser, whatever its extension.",
              "That the layout is one column. Both formats parse well single-column and both can be mangled in two.",
              "That the contact details are in the body, not in a page header or footer.",
              "That the filename is legible to a human. It is for the recruiter's downloads folder — no applicant tracking system searches on it.",
            ],
          },
          {
            kind: "callout",
            text: "You can see the difference for yourself: /check extracts the text from any PDF or .docx and shows what came back.",
          },
        ],
      },
      {
        heading: "The advice you can ignore",
        blocks: [
          {
            kind: "list",
            items: [
              "“Never send a PDF, they cannot be read.” This was true in the early 2000s and has not been true for a long time. Every current parser reads a text-bearing PDF.",
              "“Always send .docx, it is what recruiters want.” Some do, and they will say so. Sending an editable file to an employer who did not ask means your resume can be altered before a hiring manager sees it.",
              "“Use .rtf for maximum compatibility.” It solves a problem nobody has had since Word 2007, and it loses formatting on the way.",
              "“Name the file with keywords so the ATS finds it.” No system searches on the filename. It is read by a person deciding which of forty downloads to open.",
            ],
          },
          {
            kind: "prose",
            text: "The one situation where the format genuinely matters is an older or heavily customised portal that accepts only one type. When that happens the form says so, and it is the only instruction worth following over your own judgement.",
          },
        ],
      },
      {
        heading: "Sending more than one",
        blocks: [
          {
            kind: "prose",
            text: "Applying by email to a person, rather than through a portal, is the one case for attaching two files: the PDF for reading, and the .docx in case they are an agency recruiter who will reformat it. Say which is which in one line. Beyond that, one file is one decision fewer for the person receiving it.",
          },
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}

export const GUIDE_SLUGS: readonly string[] = GUIDES.map((guide) => guide.slug);
