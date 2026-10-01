/**
 * The guides (P36).
 *
 * **Quality over count, and the reason is not modesty.** A thin page that
 * ranks and disappoints is worse than no page: it costs the reader a click
 * and costs us the one impression we had. So every guide here answers its
 * question completely, and the list grows only as fast as that can be done —
 * never forty that answer one each halfway. `examples.test.ts` holds the
 * floor on length; nothing can hold the floor on usefulness but reading.
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

import COLUMNS from "@/lib/measured/columns.json";

/* -------------------------------------------------------------------------- */
/* The two-column measurement, as the guide prints it                         */
/* -------------------------------------------------------------------------- */

type ColumnResult = (typeof COLUMNS.results)[number];

/** One row of `columns.json`: a layout read one way. */
function measured(layout: string, strategy: string): ColumnResult {
  const row = COLUMNS.results.find((r) => r.layout === layout && r.strategy === strategy);
  if (!row) throw new Error(`columns.json has no ${layout} / ${strategy} row`);
  return row;
}

const COL = {
  oneStream: measured("one-column", "pdf-stream-order"),
  leftStream: measured("sidebar-left", "pdf-stream-order"),
  leftLines: measured("sidebar-left", "pdf-geometric"),
  rightLines: measured("sidebar-right", "pdf-geometric"),
};

/** A count of lost fields by kind; absent kinds were never lost. */
function lost(row: ColumnResult, field: string): number {
  return (row.lostByField as Record<string, number | undefined>)[field] ?? 0;
}

const LAYOUT_NAME: Record<string, string> = {
  "one-column": "One column",
  "sidebar-left": "Sidebar on the left",
  "sidebar-right": "Sidebar on the right",
};
const READER_NAME: Record<string, string> = {
  "pdf-stream-order": "In stored order",
  "pdf-geometric": "Line by line",
};

const of = (n: number, total: number) => `${n} of ${total}`;

export type GuideBlock =
  | { readonly kind: "prose"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "callout"; readonly text: string }
  | {
      readonly kind: "table";
      /**
       * The caption, as a sentence. Named `text` like the other prose kinds
       * so anything that reads a guide's words — the reading time, the D14
       * scan — gets the table's sentence without knowing tables exist.
       */
      readonly text: string;
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
    };

export interface GuideSection {
  readonly heading: string;
  readonly blocks: readonly GuideBlock[];
}

export interface Guide {
  readonly slug: string;
  readonly title: string;
  /**
   * The page's `<title>`: what somebody types, first, in under sixty
   * characters, because a results page cuts the rest. `title` stays the
   * heading — written for the reader who has already arrived.
   */
  readonly searchTitle: string;
  /** The meta description, and the line under the title. */
  readonly summary: string;
  /**
   * Roughly how long it takes to read, so the reader can decide. Counted
   * from the words by `readingMinutes`, never written by hand.
   */
  readonly minutes: number;
  /**
   * The market it is written for, when it is written for one — the same
   * field, for the same reason, as on an example. Usually that market's
   * conventions; for a guide about moving between markets, its readers, so
   * the guide to applying in the US from India is `IN`. Absent for a guide
   * that holds wherever the resume is sent.
   */
  readonly market?: "IN" | "US";
  /**
   * A guide built on a measurement of ours describes it here, and the page
   * publishes it as a schema.org `Dataset` beside the `Article`: the table
   * is data somebody can cite, and saying so is what lets it be found as data.
   */
  readonly dataset?: {
    readonly name: string;
    readonly description: string;
    readonly variables: readonly string[];
  };
  readonly sections: readonly GuideSection[];
  /**
   * When what this page says last changed, as YYYY-MM-DD. It is the sitemap's
   * `lastmod`, the Article's `dateModified` and the "Updated" line on the
   * page. `content-dates.test.ts` pins a hash of the content beside it, so the
   * content cannot change without somebody deciding what this should say.
   */
  readonly updated: string;
}

/** A guide as written: everything but the reading time, which is counted. */
type GuideSource = Omit<Guide, "minutes">;

const GUIDE_SOURCES: readonly GuideSource[] = [
  {
    slug: "what-an-ats-actually-does",
    searchTitle: "What an applicant tracking system (ATS) actually does",
    updated: "2026-09-30",
    title: "What an applicant tracking system actually does",
    summary:
      "What the software does, what it does not do, and which of the advice you have read is folklore.",
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
    searchTitle: "How to write a resume with no work experience",
    updated: "2026-09-30",
    title: "Writing a resume when you have no work experience",
    summary:
      "The evidence is almost always there. The problem is that it has not been counted as work.",
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
    searchTitle: "How to quantify resume bullets without hard numbers",
    updated: "2026-09-30",
    title: "How to put a number on a bullet when you do not have one",
    summary:
      "The advice is always “quantify your achievements”. Here is what to do when the number is not written down anywhere.",
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
    searchTitle: "Resume file format: PDF, Word or plain text?",
    updated: "2026-09-30",
    title: "PDF, Word, or plain text: which file to send",
    summary: "Three formats, three different situations, and one rule that covers most of them.",
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

  {
    slug: "resume-format-for-freshers",
    searchTitle: "Resume format for freshers in India: what goes where",
    updated: "2026-09-30",
    market: "IN",
    title: "Resume format for freshers: what goes where, and what to leave off",
    summary:
      "The order of the sections, how to write CGPA and school marks, and the personal details an Indian fresher resume no longer needs.",
    sections: [
      {
        heading: "The order, top to bottom",
        blocks: [
          {
            kind: "prose",
            text: "A fresher's resume has one job: to put the strongest evidence you have where the reader looks first. For most freshers in India that means the order below. The reason for each position matters more than the order itself, because the reason is what tells you when to break it.",
          },
          {
            kind: "list",
            items: [
              "Name and contact details: a phone number with +91, an email address that is your name rather than a nickname, your city, and a LinkedIn or GitHub link if there is something on it. A city is all an employer needs to know about where you live until they send an offer letter.",
              "A summary of one or two lines, if you want one. It says what you are and what you are looking for — “Final-year B.Tech (ECE) student looking for an embedded software role” — and nothing about being hard-working.",
              "Education: degree, college, university, years and result. At this stage it is the most recent and most checkable fact about you.",
              "Internships, written like jobs: what you did, for whom, and what came of it.",
              "Projects: the final-year project first, then anything else you built that somebody used.",
              "Skills, grouped by kind and limited to what you could be interviewed on.",
              "Certifications, achievements and positions of responsibility: NPTEL courses, hackathons, a placement-cell or class-representative role, a fest you helped run.",
            ],
          },
          {
            kind: "prose",
            text: "Break the order when something lower down answers “can this person do the job” better than your degree does. An internship in the field you are applying to goes above Education, because it is the closest thing to the job you have done. For a technical role, strong projects can go above it too. The section that best answers the reader's question goes first, and the rest follow in the order above.",
          },
        ],
      },
      {
        heading: "How to write CGPA, percentages and school marks",
        blocks: [
          {
            kind: "prose",
            text: "Write the result your university issues, in the form it issues it: “8.4 CGPA” if you have a CGPA, “76%” if you have a percentage. It goes on the degree line, once. Converting a CGPA into a percentage yourself invites a question you do not need, and universities publish different conversion formulas — when an application form insists on a percentage, use the formula your own university publishes, and use it on the form.",
          },
          {
            kind: "prose",
            text: "Many campus recruiters screen on 10th and 12th marks as well as the degree, and some state a cut-off such as 60% throughout. If you are applying through campus placement, or the company asks, add them below the degree: board, year and result, one line each. If you are applying off campus to a company that does not ask, the degree line is enough, and school marks would spend two lines on the oldest thing on the page.",
          },
          {
            kind: "list",
            items: [
              "B.Tech, Computer Science and Engineering — Nandi Institute of Technology · 2022–2026 · 8.4 CGPA",
              "Class XII, CBSE — Kendriya Vidyalaya, Bengaluru · 2022 · 91.2%",
              "Class X, CBSE — Kendriya Vidyalaya, Bengaluru · 2020 · 94%",
            ],
          },
          {
            kind: "prose",
            text: "Backlogs are a question the application form asks directly, and that is the place to answer it, truthfully. A resume does not need a line about them either way. If your final result is not out yet, write the result so far and say so — “8.1 CGPA (up to 7th semester)” — rather than leaving the reader to wonder why the line is empty.",
          },
        ],
      },
      {
        heading: "Projects are your experience",
        blocks: [
          {
            kind: "prose",
            text: "For most freshers the final-year project is the largest piece of work they have done, and it is usually written as a subject they were graded in rather than as work. Write it the way you would write a job: what you built, what you built it with, who used it, and what changed as a result.",
          },
          {
            kind: "list",
            items: [
              "Not “Final year project on IoT-based smart irrigation”, but “Built a soil-moisture controller on an ESP32 that cut water use on the college's test plot by about a third over one season”. The second one has a result an interviewer can ask about.",
              "Name the tools inside the sentence — “with Spring Boot and PostgreSQL” — and not only in the skills list. A skills line is a claim; a project that used the skill is the evidence behind it.",
              "Say how many people were on the team and what your part was. “Team of four; I wrote the data pipeline” answers the question an interviewer would otherwise ask first.",
              "Link the repository or a demo if it is public. It costs one line, and an interviewer who opens it has something specific to ask you about.",
            ],
          },
        ],
      },
      {
        heading: "Skills: fewer, grouped, and true",
        blocks: [
          {
            kind: "prose",
            text: "Group skills by kind — Languages, Frameworks, Tools — and list only what you could answer questions on. Interviewers pick something from the list and ask about it, and they will not always pick the thing you know best.",
          },
          {
            kind: "list",
            items: [
              "No rating bars, stars or percentages. “Python 80%” means nothing to a reader, and a parser reads a bar graphic as nothing at all.",
              "No MS Office unless the job is office work — in which case say what you did with it: “Excel: pivot tables and lookups for the society's monthly accounts”.",
              "Soft skills do not go in a list. “Leadership” on its own is a claim; “led a team of six volunteers for the college tech fest” is evidence, and it belongs under achievements or positions of responsibility.",
            ],
          },
        ],
      },
      {
        heading: "What to leave off",
        blocks: [
          {
            kind: "prose",
            text: "Many Indian resume templates still carry fields that most private employers no longer expect, and every one of them costs a line a fresher needs for evidence.",
          },
          {
            kind: "list",
            items: [
              "Date of birth, father's name, marital status, religion and nationality. None of them says anything about the work, and several are things an employer should not be deciding on. Government and PSU applications that need them ask on their own form.",
              "A photo. Most private employers no longer expect one, and a parser cannot read it. An application that wants a photo asks for it separately.",
              "The declaration — “I hereby declare that the above information is true to the best of my knowledge.” It is a convention of government forms, and on a private-sector resume it spends two lines saying something the reader already assumes.",
              "A career objective about a “challenging environment” and “organisational growth”. If you keep a summary, it should say what you are and which role you want.",
              "Hobbies, unless they are evidence. “Reading and music” is filler; running the college astronomy club's telescope nights for two years is a position of responsibility, and belongs there.",
              "Aadhaar, PAN, passport number or a full postal address. Nobody needs them before an offer letter, and a resume travels further than you will ever know.",
            ],
          },
        ],
      },
      {
        heading: "One page, and the file you send",
        blocks: [
          {
            kind: "prose",
            text: "One page is the norm for a fresher, and filling it honestly is the whole exercise. If yours runs over, the cause is usually a long skills list or school-level detail rather than too much real work — cut those before you cut a project.",
          },
          {
            kind: "prose",
            text: "Send a PDF unless the portal asks for a Word file, and name it after yourself — Ananya-Iyer-Resume.pdf — for the person who downloads forty of them. If your college's placement cell has its own template, use it for campus applications: it exists so the placement officer can compare candidates line by line, and a resume that departs from it makes that harder for the one person whose job is to help you.",
          },
          {
            kind: "callout",
            text: "The builder asks how much experience you have when you first open it. Answer “No work experience yet” and Projects and Education lead the steps, with advice in each empty section written for someone at the start. New resumes start on A4, and the software engineer fresher example shows the whole format on one page.",
          },
        ],
      },
    ],
  },

  {
    slug: "how-to-write-a-resume-summary",
    searchTitle: "How to write a resume summary, with examples",
    updated: "2026-09-30",
    title: "How to write a resume summary that says something",
    summary:
      "Three lines at the top of the page: what goes in them, what to cut, and when to leave the section out.",
    sections: [
      {
        heading: "What the summary is for",
        blocks: [
          {
            kind: "prose",
            text: "The summary sits directly under your name, so it is read in the first few seconds, while the reader is deciding whether the rest of the page is worth their time. It has one job: to say what you are, at what level, and what sets you apart, before the reader has to work it out from your job titles.",
          },
          {
            kind: "prose",
            text: "That is also why so many summaries are skipped. A paragraph of adjectives — motivated, detail-oriented, results-driven — tells the reader nothing they can check. A summary earns its three lines only if it says something the rest of the page would take longer to say.",
          },
        ],
      },
      {
        heading: "Four parts, in this order",
        blocks: [
          {
            kind: "prose",
            text: "Most summaries that work have the same four parts. Not every summary needs all four, but you should know which one you left out and why.",
          },
          {
            kind: "list",
            items: [
              "What you are: the job title you hold, or the one you are applying for if you have done that work. “Registered nurse”, not “healthcare professional”.",
              "How much: years, or a level. “Six years”, “senior”, “new graduate”.",
              "What kind: the specialty, setting or domain that separates you from everyone else with the same title. “Cardiac step-down”, “B2B payments”, “high-volume retail”.",
              "One piece of proof: a number, a scale or a result, taken from the page below. It tells the reader the rest of the page has more like it.",
            ],
          },
          {
            kind: "prose",
            text: "Put together, that reads like the three below. The numbers are illustrations; the ones in yours come from your own bullets.",
          },
          {
            kind: "list",
            items: [
              "“Registered nurse with six years on a 32-bed cardiac step-down unit, the last two as night charge nurse. Precepted nine new graduates and led the unit's move to bedside shift report.”",
              "“Backend engineer with five years in payments. Designed the reconciliation service that settles about $40M a month at a Series C fintech, and carries its pager.”",
              "“Customer service representative with three years in a 200-seat contact center, handling billing disputes and escalations for a regional utility, with a 94% quality score across 2025.”",
            ],
          },
        ],
      },
      {
        heading: "What to cut",
        blocks: [
          {
            kind: "list",
            items: [
              "Adjectives about yourself: hard-working, passionate, detail-oriented, results-driven, team player. Every applicant uses them, which is exactly why a reader's eye passes over them.",
              "What you want. “Seeking a challenging role where I can grow” is about you, and the reader is deciding what you would do for them.",
              "“I” and “my”. The convention on a resume is to drop the pronoun — “Led a team of six”, not “I led a team of six” — and a summary in the first person reads longer than it is.",
              "Claims the page does not back up. If the summary says “expert in SQL” and SQL appears nowhere below it, the reader notices the gap rather than the claim.",
              "A fifth line. A summary that needs one is usually two summaries; keep the one for this job.",
            ],
          },
        ],
      },
      {
        heading: "Should I write a summary or an objective?",
        blocks: [
          {
            kind: "prose",
            text: "A summary, almost always. An objective states what you want and a summary states what you offer, and the second is what the reader is looking for. The objective survives in one useful form: when you are changing careers, one line naming the move — “Retail store manager of eight years moving into HR, SHRM-CP certified in 2026” — explains why your history does not match the job title, which the reader would otherwise have to guess.",
          },
        ],
      },
      {
        heading: "Does every resume need a summary?",
        blocks: [
          {
            kind: "prose",
            text: "No. A summary is worth its space when your job titles do not say what you are on their own: a career change, a generalist role, a long career that needs framing, or a title your industry uses differently. It is optional when your latest title is the job you are applying for and the page is already full. A new graduate with a thin page can skip it or keep it to one line — an empty summary is worse than none, and so is one that restates the latest job title in more words.",
          },
          {
            kind: "prose",
            text: "Leaving it out does not change how a parser reads the rest of the page. The summary is written for the person reading, and whether to include one is a decision about them.",
          },
        ],
      },
      {
        heading: "Tailoring it to a posting",
        blocks: [
          {
            kind: "prose",
            text: "The summary is the cheapest part of the page to tailor, and the part where tailoring shows most. Two changes cover most of it: use the posting's name for the job if it honestly describes work you have done, and name the two or three things the posting leads with, if you have them, in the posting's words rather than a synonym.",
          },
          {
            kind: "prose",
            text: "Do not add a skill because the posting asks for it. The summary makes claims an interview will test, and a keyword you cannot talk about is a question you cannot answer.",
          },
          {
            kind: "callout",
            text: "The Match tab in the builder compares your page with a posting you paste and shows which of its terms you demonstrate in a bullet, which you only list, and which are missing. It never adds a term for you.",
          },
        ],
      },
    ],
  },

  {
    slug: "resume-for-campus-placement",
    searchTitle: "Resume for campus placement: how to write it",
    updated: "2026-09-30",
    market: "IN",
    title: "Resume for campus placement: what the drive does with it",
    summary:
      "Eligibility is checked before anyone reads it, and the interviewer reads it across the table. Both change how it should be written.",
    sections: [
      {
        heading: "How a campus drive uses your resume",
        blocks: [
          {
            kind: "prose",
            text: "In a campus drive the resume does a different job from the one it does off campus. The placement cell collects everyone's resume, usually in its own template, and passes the eligible students' files to each company. Most companies then hold an online test, and the students who clear it are interviewed — technical rounds, then HR — by someone with your resume on the table in front of them.",
          },
          {
            kind: "prose",
            text: "So on campus the resume is less a filter than an interview script. The interviewer has thirty or forty minutes and your page is what they ask from. Every line on it is a question you may be asked, and a line you can talk about for ten minutes is worth more than one that merely looks impressive.",
          },
        ],
      },
      {
        heading: "Eligibility is decided before anyone reads it",
        blocks: [
          {
            kind: "prose",
            text: "Companies set eligibility criteria for a drive — branches, a CGPA cut-off, 10th and 12th marks, no active backlogs — and the placement cell usually applies them from the data you registered with it, not from your resume. No wording on the page moves you past a cut-off, and none needs to.",
          },
          {
            kind: "prose",
            text: "What the page must do is agree with that data exactly. The CGPA, the percentages and the years on your resume should match your registration and your marksheets to the decimal. Companies verify documents before you join, and a figure that was rounded up is the kind of discrepancy that surfaces there, at the worst possible time.",
          },
        ],
      },
      {
        heading: "Write it as the interview you want",
        blocks: [
          {
            kind: "list",
            items: [
              "Choose the two or three projects you could discuss for ten minutes each, and put the one you know best first. Interviewers tend to start at the top.",
              "For team projects, say what your part was. “Team of four; I built the recommendation service” tells the interviewer where to aim, and saves you correcting their assumption.",
              "Keep only the numbers you can explain. If a project says “92% accuracy”, expect to be asked on what data, against what baseline, and why not higher.",
              "Cut every skill you used once in a lab. The skills section is a menu the interviewer orders from, and a language you touched for one assignment is the one they will pick.",
              "Put internships and training with real output above the rest — even a four-week one — because it is the part of the page closest to a job.",
            ],
          },
        ],
      },
      {
        heading: "The placement cell's template",
        blocks: [
          {
            kind: "prose",
            text: "Many colleges require their own template: one page, education in a table with 10th, 12th and the degree, and fixed sections for projects, internships, positions of responsibility and achievements. Use it without fighting it. It exists so the placement officer and the companies can compare students line by line, and a resume that departs from it only makes that harder.",
          },
          {
            kind: "prose",
            text: "Inside the template the usual rules still hold. Bullets start with what you did, carry a number where one exists, and name the tools in the sentence. A position of responsibility is real evidence of organising work when it says what you organised — “Ran registrations for a 3,000-person tech fest” rather than “Member, organising committee”.",
          },
        ],
      },
      {
        heading: "One resume, or one for each kind of role",
        blocks: [
          {
            kind: "prose",
            text: "If your placement cell lets you keep more than one version, keep one per kind of role rather than one per company. A mechanical engineer applying both to core manufacturing roles and to IT services should lead with the core projects and internship for the first, and with the coding work for the second. The facts are the same; the order is the argument.",
          },
          {
            kind: "prose",
            text: "Off campus, none of the template applies. Applying directly or through a job portal, you are back to a standard one-page resume, where school marks are optional and the reader has not seen your registration data — the guide to the fresher format covers that version.",
          },
          {
            kind: "callout",
            text: "Signed in, the builder keeps several resumes side by side, so a core version and a software version can sit next to each other. Without an account, a backup file of each does the same job.",
          },
        ],
      },
    ],
  },

  {
    slug: "how-long-should-a-resume-be",
    searchTitle: "How long should a resume be? One page or two",
    updated: "2026-09-30",
    title: "How long should a resume be? One page, two, and when the limit is a rule",
    summary:
      "The conventions in the US, India and the UK, the places where a page limit is enforced rather than advised, and what to cut first.",
    sections: [
      {
        heading: "How long should a resume be?",
        blocks: [
          {
            kind: "prose",
            text: "One page if you are a student, a fresher, or have less than about ten years of relevant experience; two pages beyond that, or earlier when the work genuinely fills them. That is the convention in the US and for most private-sector jobs in India. In the UK and Ireland a CV of two pages is normal at almost every level. Longer documents are for academic and medical CVs, which list publications, grants and teaching, and run as long as the record does.",
          },
          {
            kind: "prose",
            text: "Those are conventions, not rules, and a strong two-page resume is not discarded for being two pages. What a reader notices is not the length but the padding — a second page that exists because the first was set in large type with wide margins, or because every role has eight bullets saying three things.",
          },
        ],
      },
      {
        heading: "Where a page limit is a rule",
        blocks: [
          {
            kind: "prose",
            text: "A few places enforce a length rather than suggest one, and there the rule beats every convention above.",
          },
          {
            kind: "list",
            items: [
              "US federal jobs. Since 27 September 2025, USAJOBS accepts resumes of two pages or fewer for competitive and excepted service jobs under Title 5, and OPM's guidance to agencies is that an applicant whose only resume is longer is not considered. The guide to federal resumes covers what has to fit in those two pages.",
              "Campus placement in India. A placement cell's template is usually one page, and the page belongs to the template.",
              "Application forms with a character limit. A box that takes 2,000 characters takes 2,000 characters; paste the plain-text version and cut from the oldest role first.",
            ],
          },
        ],
      },
      {
        heading: "What to cut first",
        blocks: [
          {
            kind: "prose",
            text: "When a resume runs long, the fix is almost never smaller type. It is removing what would not change a reader's mind, in roughly this order.",
          },
          {
            kind: "list",
            items: [
              "Anything the reader assumes: “References available on request”, a declaration, a list of Microsoft Office programs.",
              "School marks, once you have a degree and a job. They were the most recent evidence once; now they are the oldest.",
              "A bullet that repeats a bullet from another role. Keep the version with the number.",
              "Duties. “Responsible for weekly reports” is the job description; a bullet with no result is usually the first to go.",
              "Roles older than about fifteen years, or unrelated to the job. Collapse them into one line — “Earlier roles in retail operations, 2006–2011” — rather than dropping the years silently.",
              "A skills list longer than the list of skills you would be happy to be asked about.",
            ],
          },
          {
            kind: "prose",
            text: "Shrinking the type or the margins is the one fix that makes the page worse. Body text much below 10 points is hard to read on paper and on a phone, and a page with no margin looks crammed before a word of it is read.",
          },
        ],
      },
      {
        heading: "Two pages, done properly",
        blocks: [
          {
            kind: "list",
            items: [
              "The top half of page one carries what matters most: the current role, the strongest results, the qualification the job requires. A reader who stops there should already have the argument.",
              "Put your name on page two. Printed pages get separated, and a second page with no name is an orphan.",
              "Do not let page two be three lines long. Either cut to one page or use the second properly; a nearly empty page looks like an accident.",
              "Keep entries whole where you can. A role that starts at the foot of page one and finishes on page two is harder to read than one that moves over whole.",
            ],
          },
          {
            kind: "callout",
            text: "The preview in the builder counts pages as you type, and when you are only a few lines onto a new one it offers one fix at a time: margins down to 0.6 inches, compact spacing, body text down to 10 points and no further — and then it points at the longest bullet and leaves the rewrite to you.",
          },
        ],
      },
    ],
  },

  {
    slug: "cv-vs-resume-vs-biodata",
    searchTitle: "CV vs resume vs biodata: the difference in India",
    updated: "2026-09-30",
    market: "IN",
    title: "CV, resume or biodata: which one an employer means",
    summary:
      "Three words used almost interchangeably in India, with different meanings abroad — and the one document most private employers actually want.",
    sections: [
      {
        heading: "What is the difference between a CV, a resume and a biodata?",
        blocks: [
          {
            kind: "prose",
            text: "In India, most private employers who ask for a CV or a resume mean the same thing: one or two pages about your work, your education and your skills. A biodata is a different document — a sheet of personal particulars such as date of birth, parents' names, religion and marital status, with education listed briefly — and it belongs to older government forms and to marriage proposals more than to hiring today. Abroad, the first two words separate: in the US and Canada a CV is a long academic record and a resume is the short job document, while in the UK, Ireland and most of Europe a CV is simply what a resume is called.",
          },
        ],
      },
      {
        heading: "Which one to send",
        blocks: [
          {
            kind: "list",
            items: [
              "A private company in India, whatever the posting calls it: a resume of one page as a fresher, and two when your experience fills them.",
              "A government or PSU job: the recruitment's own application form. The personal details a biodata used to carry are asked for there, in the format the form wants.",
              "A university, research or medical post, in India or abroad: an academic CV — publications, conferences, grants, teaching and supervision, as long as the record is.",
              "A company in the US or Canada: a resume on US Letter paper with no personal details. The guide to applying from India covers what changes.",
              "A company in the UK, Ireland or elsewhere in Europe: a CV of about two pages. In the UK and Ireland it carries no photo and no date of birth; conventions on photos differ across the rest of Europe.",
              "An employer in the Gulf: a CV as for the UK, with nationality and visa status added when the posting asks for them, which it often does.",
            ],
          },
        ],
      },
      {
        heading: "What an academic CV adds",
        blocks: [
          {
            kind: "prose",
            text: "An academic CV is a complete record rather than a selection. It keeps everything a resume would cut — every publication, every conference talk, every course taught — because in academic hiring the record is the evidence, and a committee wants all of it. It still leads with the section that matters most for the post: publications for a research role, teaching for a teaching one.",
          },
          {
            kind: "list",
            items: [
              "Publications, in one consistent citation style, with your name marked in each author list.",
              "Conference presentations and invited talks.",
              "Grants, fellowships and scholarships, with amounts where they are public.",
              "Teaching: the courses, their level, and whether you designed or delivered them.",
              "Supervision and service: students guided, committees served on, reviewing for journals.",
            ],
          },
        ],
      },
      {
        heading: "Why the personal details went",
        blocks: [
          {
            kind: "prose",
            text: "The biodata's fields — date of birth, religion, caste, marital status, father's name, height — describe the person rather than the work, and hiring has moved away from them for three reasons.",
          },
          {
            kind: "list",
            items: [
              "They invite the wrong decision. None of them says how someone will do a job, and several are exactly the grounds an employer should not decide on.",
              "They cost space. Every line of particulars is a line not spent on something you did.",
              "They travel. A resume is forwarded, printed, uploaded to job portals and kept in databases for years, and a date of birth, a father's name and an address together are most of what someone needs to impersonate you.",
            ],
          },
          {
            kind: "callout",
            text: "The builder has no fields for a photo, date of birth, religion or marital status, on purpose. Anything an employer genuinely needs from that list, its own form will ask for.",
          },
        ],
      },
    ],
  },

  {
    slug: "employment-gap-on-resume",
    searchTitle: "How to explain an employment gap on your resume",
    updated: "2026-09-30",
    title: "A gap in your resume: what to write, and where",
    summary:
      "Months or years out of work — a layoff, caregiving, illness, study, a search that took a while — and how to account for it in one honest line.",
    sections: [
      {
        heading: "How do I explain a gap in my resume?",
        blocks: [
          {
            kind: "prose",
            text: "Briefly, once, and in the place it happened. A gap of a few months needs no explanation on the page at all: job searches take that long, and dates in months show it without making it a question. A longer gap gets one plain line where it sits in the timeline — “Career break: full-time care for a family member, 2023–2024” — and nothing more. The reader wants to know two things: that you are not hiding a job that went badly, and that you are ready to work now. One true line answers the first, and the rest of the page answers the second.",
          },
        ],
      },
      {
        heading: "What the line can say",
        blocks: [
          {
            kind: "list",
            items: [
              "“Career break: caregiving for a parent, 03/2023 – 08/2024.”",
              "“Parental leave and career break, 2022–2024.”",
              "“Relocated from Pune to Toronto: permanent residence and job search, 2024.”",
              "“Full-time study: Postgraduate Diploma in Data Science, 2023–2024” — better still as an Education entry, with what you built in it.",
              "“Health: recovered and returned to work, 2023.” You owe nobody a diagnosis, and a resume is the last place to give one.",
            ],
          },
          {
            kind: "prose",
            text: "LinkedIn lets a profile show a career break as an entry of its own, so the resume and the profile can say the same thing. A reader who checks one against the other then finds them agreeing.",
          },
        ],
      },
      {
        heading: "What belongs in the gap",
        blocks: [
          {
            kind: "prose",
            text: "Much of what people do between jobs is evidence, and it belongs on the page as the thing it was rather than folded into the gap line.",
          },
          {
            kind: "list",
            items: [
              "Freelance or contract work, however small, as an Experience entry with its dates and what it delivered.",
              "Courses with an output — a project, a certification exam passed — under Education or Certifications. A course you started and did not finish is better left off.",
              "Volunteering with a scope: treasurer of a residents' association, coaching a youth team, running a food bank's rota.",
              "A project you built or ran: an app, a small business, a piece of published research.",
            ],
          },
          {
            kind: "callout",
            text: "Do not inflate any of it. A course is a course, and a line that calls two weeks of online lessons “consulting” is the one an interviewer asks about first.",
          },
        ],
      },
      {
        heading: "Do not hide it with formatting",
        blocks: [
          {
            kind: "prose",
            text: "Two tricks circulate for making a gap disappear, and both cost more than the gap does.",
          },
          {
            kind: "list",
            items: [
              "Years without months. “2021–2023” followed by “2023–2024” can hide most of a year between them, and experienced readers know it. When they notice, the question changes from “what happened in 2023” to “what else is hidden”.",
              "The skills-first, or functional, resume, with the jobs pushed to the bottom or left out. Many recruiters read it as a sign that something is being concealed — the opposite of its purpose — and a parser needs dated roles to build a work history at all.",
            ],
          },
          {
            kind: "prose",
            text: "A chronological resume with months and one honest line is shorter, reads as confident, and gives an interviewer nothing to dig for.",
          },
        ],
      },
      {
        heading: "After a layoff",
        blocks: [
          {
            kind: "prose",
            text: "Layoffs take whole teams, and readers know it. Where it helps, say it once, in the role itself — “Role eliminated in a company-wide restructuring, 03/2024” — and let the next entry or the gap line cover the months after. In an interview, a short answer that ends in the present is all anyone needs: the team was cut; since then you finished the certification; now you are looking for this role.",
          },
        ],
      },
    ],
  },

  {
    slug: "resume-for-naukri",
    searchTitle: "Resume for Naukri: the profile fields and the file",
    updated: "2026-09-30",
    market: "IN",
    title: "Resume for Naukri and other job portals: the profile is searched, the file is read",
    summary:
      "How recruiters find candidates on a job portal, which profile fields their filters use, and what the resume you attach still has to do.",
    sections: [
      {
        heading: "Two things, not one",
        blocks: [
          {
            kind: "prose",
            text: "On Naukri, and on portals such as foundit and LinkedIn, you give the site two things: a profile made of fields, and a resume file. They do different jobs. Recruiters search the portal's candidate database — Naukri's is called Resdex — with keywords and filters, and a filter can only use a field: total experience, current location, notice period, current salary. A notice period written only inside your resume file cannot be filtered on. The file is what the recruiter opens once your profile has come up, and from then on it is read by a person like any other resume.",
          },
        ],
      },
      {
        heading: "The fields worth getting right",
        blocks: [
          {
            kind: "list",
            items: [
              "Resume headline: the one line that sums you up at the top of your profile. Make it the job you do, for how long, and the specialty — “Java backend developer, 4 years, Spring Boot and microservices, payments” — rather than “Seeking a challenging opportunity”.",
              "Key skills: the names tools actually go by, because that is what a recruiter types. “Spring Boot”, not “Spring framework knowledge”; “Tally Prime” and “GST returns”, not “accounting software”.",
              "Employment and education: every field, with the same titles and dates as the resume. A profile and a file that disagree look careless at best.",
              "Notice period, current and expected salary, and preferred locations: accurate, because they are filtered on. A short notice period is worth stating wherever the portal lets you.",
              "Profile summary: a short version of your resume's summary, in the same words.",
            ],
          },
          {
            kind: "prose",
            text: "Keep salary on the portal and off the resume itself. The portal shows it to recruiters searching it; the resume file is forwarded to hiring managers, other agencies and inboxes you will never see, and a figure you gave once keeps travelling with it.",
          },
        ],
      },
      {
        heading: "The file you attach",
        blocks: [
          {
            kind: "prose",
            text: "Naukri takes a Word file or a PDF. Either works if the file contains real text in a single column — a PDF exported as an image, or a two-column design, reaches the recruiter's software as something harder to read than it looked when you made it. Name the file after yourself; it will be downloaded and forwarded under that name.",
          },
          {
            kind: "prose",
            text: "Everything that makes a resume good anywhere applies to this one, because once your profile has come up in a search, a person decides from the file: the most recent role first, bullets that start with what you did and end with what changed, and a number wherever an honest one exists.",
          },
        ],
      },
      {
        heading: "Keeping it current",
        blocks: [
          {
            kind: "prose",
            text: "Recruiters can narrow a search to candidates who have been active recently, so a profile untouched for a year drifts out of the searches that matter. Revisit it when you change jobs, finish a certification or your notice period changes — and upload the resume again when you do, so the two keep saying the same thing.",
          },
        ],
      },
      {
        heading: "What not to do",
        blocks: [
          {
            kind: "list",
            items: [
              "Hidden keywords — skills typed in white, or in tiny type at the foot of the page. They are invisible only on screen: any text extraction shows them, including the one a recruiter's software does, and a recruiter who sees them stops reading.",
              "Every skill you have heard of in Key skills. A search that brings up your profile for something you cannot do produces a phone call that ends badly.",
              "Two profiles. Duplicates confuse the recruiter who finds both, and the older one is always the one with the wrong notice period.",
              "Anything you could not show a document for. Indian employers routinely run background verification — previous employers, dates, degrees — before or after joining, and a mismatch there can cost an offer.",
            ],
          },
          {
            kind: "callout",
            text: "You can see what a portal's software gets from your file: /check extracts the text from a PDF or Word file in your browser and shows which fields came back — hidden text included.",
          },
        ],
      },
    ],
  },

  {
    slug: "career-change-resume",
    searchTitle: "Career change resume: how to write one honestly",
    updated: "2026-09-30",
    title: "A resume for a career change, without pretending",
    summary:
      "How to make a history in one field read as evidence for another: say the move, find the overlap, build the missing proof — and keep the real job titles.",
    sections: [
      {
        heading: "The two questions a reader has",
        blocks: [
          {
            kind: "prose",
            text: "Someone reading a career changer's resume has two questions, and a resume that answers only one of them fails: why is this person applying for this job, and can they do it? The first is answered in one line at the top. The second is answered by everything else, and most of the work is there.",
          },
        ],
      },
      {
        heading: "Say the move in the first line",
        blocks: [
          {
            kind: "prose",
            text: "Without a summary, a reader sees eight years of teaching on an application for instructional design and has to guess why. Guessing is where applications stop. One line settles it: what you have been, what you are moving into, and the strongest evidence that the move is real.",
          },
          {
            kind: "list",
            items: [
              "“Secondary-school mathematics teacher of eight years moving into instructional design, with four e-learning courses built in Articulate Storyline for the district's online programme.”",
              "“Retail store manager of six years moving into HR, SHRM-CP certified in 2026, with the hiring and onboarding for a 26-person store behind it.”",
              "“Mechanical engineer moving into data analysis; built the plant's downtime dashboard in Python and Power BI, now used in the weekly operations review.”",
            ],
          },
        ],
      },
      {
        heading: "Find the overlap in what you already did",
        blocks: [
          {
            kind: "prose",
            text: "Most careers share more with the next one than their titles suggest. The work is to find the parts of the old job that are the new job's work, and to write those bullets in terms the new field would recognise — wherever the term is honest.",
          },
          {
            kind: "list",
            items: [
              "A teacher designed a 12-week curriculum, assessed 150 students against it and revised it from the results. That is instructional design, and it should read like it.",
              "A store manager hired, trained and scheduled 26 people and cut first-year turnover. That is recruitment and retention, measured.",
              "An engineer who automated a reporting spreadsheet wrote a data pipeline, whatever it was called at the time.",
            ],
          },
          {
            kind: "prose",
            text: "Keep your real job titles. Retitling “Teacher” as “Learning Experience Designer” is the line a reference or a background check contradicts, and the bullets underneath can make the argument without it.",
          },
        ],
      },
      {
        heading: "Build the evidence that is missing",
        blocks: [
          {
            kind: "prose",
            text: "If nothing in your history shows the core skill of the new job, no wording will create it. It has to be built, and it can be: a project, a course with an output, volunteer work, a freelance engagement. Put that section above Experience while it is the strongest evidence you have for this job — the builder lets you reorder sections freely — and move it back down once the new job exists.",
          },
          {
            kind: "list",
            items: [
              "Projects that did something real outweigh certificates on their own. A dashboard the plant uses is evidence; a completion badge is a claim.",
              "Name the new field's tools in the bullet where you used them.",
              "Link the portfolio, repository or published work. For a career changer it is often the most persuasive thing on the page.",
            ],
          },
        ],
      },
      {
        heading: "Chronological, not functional",
        blocks: [
          {
            kind: "prose",
            text: "The usual advice to career changers is a skills-first, or functional, resume that groups abilities and pushes the job history to the bottom. It reads as hiding something, and parsers need dated roles to build a work history at all. A chronological resume with a clear summary and a projects section above it does the same job honestly.",
          },
          {
            kind: "prose",
            text: "Cut what does not travel: the old field's jargon, its internal awards, the tools nobody in the new field uses. Older roles can shrink to a line each. The page should read as the history of someone heading somewhere.",
          },
          {
            kind: "callout",
            text: "Paste a posting from the new field into the builder's Match tab. What it lists as missing is not a set of words to add — it is the evidence to build next.",
          },
        ],
      },
    ],
  },

  {
    slug: "resume-for-us-jobs-from-india",
    searchTitle: "Resume for US jobs from India: what to change",
    updated: "2026-09-30",
    market: "IN",
    title: "Applying to US jobs from India: what to change on your resume",
    summary:
      "Paper size, personal details, degrees and CGPA, lakh and crore, and work authorisation — every convention that differs, and what to write instead.",
    sections: [
      {
        heading: "Change the page itself",
        blocks: [
          {
            kind: "list",
            items: [
              "US Letter, not A4. Letter is wider and shorter, and it is the paper a US reader's printer holds. Many resumes are never printed, but the setting is one click and the convention there is universal.",
              "Dates as month and year — “Aug 2023 – Present” — with the month written as a word. “03/08/2023” is the third of August in India and the eighth of March in the US; a written month reads the same everywhere.",
              "American spelling, applied consistently: organization, program, center, analyze. A mix of the two looks careless; either one alone does not.",
              "One page under about ten years of experience, two beyond that. The habit of listing every school and every training programme costs more on a US page, not less.",
            ],
          },
        ],
      },
      {
        heading: "Take off what a US employer avoids",
        blocks: [
          {
            kind: "prose",
            text: "A US resume carries no photo, no date of birth or age, no marital status, no religion, no father's name, no nationality and no declaration. US employment law bars employers from basing hiring decisions on race, colour, religion, sex, national origin, age or disability, and a resume that states them hands the employer information it must not use. Many employers disregard it, some set aside resumes with a photo altogether, and the space is better spent on anything else.",
          },
          {
            kind: "prose",
            text: "Your address shrinks to a city and country. Your phone number keeps its country code, written in full — “+91 98450 12345” — so a US recruiter can dial it without guessing.",
          },
        ],
      },
      {
        heading: "Say where you can work",
        blocks: [
          {
            kind: "prose",
            text: "The first question a US recruiter has about an applicant in India is whether they can work in the US. If you are already authorised — a green card, or an employment authorisation document — say so in one line under your contact details: “Authorized to work in the US (permanent resident).” If you will need sponsorship, as most people applying from India do, the application form will ask; answer it truthfully there. The resume does not need to volunteer it.",
          },
          {
            kind: "prose",
            text: "Read the posting for the line about sponsorship before you apply. Many US postings say plainly that they do not sponsor visas, and that is a filter no resume changes. Location works the same way: “Bengaluru, India — relocating to Austin, TX in March 2027” is worth writing only when the plan is real.",
          },
        ],
      },
      {
        heading: "Translate the Indian parts",
        blocks: [
          {
            kind: "list",
            items: [
              "Degrees: write them out once — “Bachelor of Technology (B.Tech), Computer Science” — because a US reader outside tech may not know the abbreviation. B.Com becomes Bachelor of Commerce; an MBA needs no help.",
              "Professional qualifications: name the awarding body — “Chartered Accountant, ICAI (India)” — and let the reader look it up. Do not claim an equivalence, such as CPA, that nobody has granted you.",
              "Marks: keep the CGPA with its scale — “8.4/10” — and do not convert it to a 4.0 GPA yourself. There is no official formula, and a figure you made up is one you cannot defend. If a posting asks for a US-equivalent GPA, a credential evaluation service such as WES produces one formally. Class 10 and 12 marks come off entirely.",
              "Money: lakh and crore mean nothing to most US readers. Convert to US dollars at the rate of the time and mark it approximate — “about $280,000” rather than “₹2.4 crore” — or use a proportion instead: “cut vendor spend by 18%”.",
              "Employers: a US recruiter in tech knows Infosys and TCS, but not most Indian companies. Add a few words of context after the name — “(card-payments platform, 1,500 employees)” — and name the US client when you worked for one and are allowed to say so.",
            ],
          },
        ],
      },
      {
        heading: "What stays the same",
        blocks: [
          {
            kind: "prose",
            text: "Everything that makes a resume good anywhere: bullets that start with what you did and end with what changed, a number wherever an honest one exists, a summary that says what you are, and a single column of real text. A US reader is looking for the same evidence as an Indian one; the conventions above only make sure nothing gets in the way of it.",
          },
          {
            kind: "callout",
            text: "In the builder, the Design panel switches the page to US Letter. Every example on this site is marked with the market it follows, and the notes on the Indian ones say what to change for an application abroad.",
          },
        ],
      },
    ],
  },

  {
    slug: "federal-resume-vs-private-resume",
    searchTitle: "Federal resume vs private resume: the USAJOBS rules",
    updated: "2026-09-30",
    market: "US",
    title: "Federal resume vs private-sector resume: what USAJOBS needs now",
    summary:
      "Since September 2025 a USAJOBS resume is capped at two pages, but it still carries details a private-sector resume leaves out. What goes in, and what changed.",
    sections: [
      {
        heading: "What changed in 2025",
        blocks: [
          {
            kind: "prose",
            text: "For years a federal resume was a long document — three to five pages was ordinary — because it had to describe every duty that might match a job's qualifications. OPM's Merit Hiring Plan ended that. Since 27 September 2025, USAJOBS accepts resumes of two pages or fewer for every competitive and excepted service job under Title 5, and the limit covers every resume USAJOBS holds: the one saved in your profile, anything you upload, and anything made in its resume builder.",
          },
          {
            kind: "prose",
            text: "The limit is enforced, not advised. OPM's guidance to agencies is that an applicant whose only resume is longer than two pages is ineligible for further consideration. Agencies outside Title 5, and the judicial and legislative branches, may accept longer resumes, and positions that call for a CV — typically medical and research ones — may ask for it separately; the job announcement says so when either applies.",
          },
        ],
      },
      {
        heading: "What a federal resume must still include",
        blocks: [
          {
            kind: "prose",
            text: "Two pages is private-sector length, but a federal resume is not a private-sector resume cut short. OPM's applicant guidance lists what each relevant job on it needs, and HR uses those details to decide whether you meet the announcement's minimum qualifications before anyone reads for quality.",
          },
          {
            kind: "list",
            items: [
              "Job title and employer — with the series and grade for any federal position, such as GS-0343-11.",
              "Start and end dates with month and year: 05/2019 – 08/2022. A year alone does not let HR count your months of experience.",
              "Hours worked per week. Specialized experience is counted in full-time equivalent, so part-time work is credited in proportion to its hours.",
              "A description of the work that addresses the qualifications in the announcement, at the level it asks for.",
              "Education, when the job requires it or it is relevant: the school, the degree type, the completion date and your cumulative GPA.",
              "When relevant: a current security clearance, job-related training, languages, professional memberships and publications, and eligibility for special hiring programs such as those for military spouses or people with disabilities.",
            ],
          },
        ],
      },
      {
        heading: "Writing for the specialized experience",
        blocks: [
          {
            kind: "prose",
            text: "Every announcement states the specialized experience a grade requires, usually in one or two long sentences. The reviewer reads your resume against those sentences, so their words are the words to use — where they honestly describe your work. OPM's own advice is to align the language of your resume with the announcement's.",
          },
          {
            kind: "list",
            items: [
              "Copy the specialized-experience paragraph out of the announcement and mark each distinct duty in it.",
              "For each one, find the job where you did it and write a bullet that says so, at the level stated: “led”, “developed” and “advised” are different grades of the same work.",
              "Cut whatever does not bear on those duties or on the job's other stated requirements. With two pages, older and unrelated jobs are the first to go.",
              "Tailor for each announcement. Two jobs with the same title can ask for different specialized experience.",
            ],
          },
        ],
      },
      {
        heading: "Formatting that fits two pages",
        blocks: [
          {
            kind: "prose",
            text: "USAJOBS recommends a sans-serif font such as Lato, Calibri or Arial, 10-point body text, 14-point headings and half-inch margins, saved as a PDF so the page count cannot change on upload. Treat those numbers as the floor: shrinking the type further to fit three pages' worth onto two produces a resume the reviewer cannot comfortably read, and OPM requires resumes to be legible as well as short.",
          },
          {
            kind: "prose",
            text: "The resume builder on USAJOBS applies the same recommendations. Any other tool works if the result is a two-page PDF of real text — which is what this one produces, on US Letter, with the page count shown as you write.",
          },
        ],
      },
      {
        heading: "What a private-sector resume does differently",
        blocks: [
          {
            kind: "list",
            items: [
              "No hours per week and no series or grade; months on the dates are a convention rather than a requirement.",
              "One page is normal early in a career; the federal limit is two pages for everyone.",
              "A private employer reads for the strongest evidence. A federal reviewer first checks each stated qualification, then reads for quality — and may be unable to credit a job that is missing its dates or hours.",
              "A private-sector resume says nothing about citizenship. Many federal jobs require US citizenship, and the announcement says so.",
            ],
          },
          {
            kind: "callout",
            text: "Keep one master resume with everything on it, and cut a two-page federal version from it for each announcement. Signed in, the builder keeps several resumes side by side.",
          },
        ],
      },
    ],
  },

  {
    slug: "two-column-resume-ats",
    searchTitle: "Can an ATS read a two-column resume? We measured it",
    updated: "2026-09-30",
    title: "Does a two-column resume break parsing? We measured it",
    summary: `The same ${COLUMNS.resumes} resumes in one column and in two, read back the two ways parsers read a page — what came through, what broke, and why.`,
    dataset: {
      name: "Two-column resume parsing measurement",
      description: `Field recovery and bullet integrity for ${COLUMNS.resumes} example resumes rendered in one-column, sidebar-left and sidebar-right layouts, each read back by stream-order and position-aware PDF text extraction.`,
      variables: ["Fields recovered", "Bullets in one piece", "Resumes fully intact"],
    },
    sections: [
      {
        heading: "Can an ATS read a two-column resume?",
        blocks: [
          {
            kind: "prose",
            text: `Sometimes, and you cannot tell which time yours will be. We laid out the same ${COLUMNS.resumes} resumes in one column and in two, and read every PDF back the two ways parsers read a page: in the order the file stores its text, and line by line across the page. One column came through both readers intact — all ${COL.oneStream.fieldsTotal} fields and all ${COL.oneStream.bulletsTotal} bullets. With a sidebar, each reader broke something different, and which one an employer's software uses is not something it tells you.`,
          },
        ],
      },
      {
        heading: "The results",
        blocks: [
          {
            kind: "table",
            text: `Fields recovered and bullets left in one piece, by layout and by reader, across ${COLUMNS.resumes} example resumes.`,
            head: ["Layout", "Reader", "Fields recovered", "Bullets in one piece", "Resumes fully intact"],
            rows: COLUMNS.results.map((r) => [
              LAYOUT_NAME[r.layout] ?? r.layout,
              READER_NAME[r.strategy] ?? r.strategy,
              of(r.fieldsRecovered, r.fieldsTotal),
              of(r.bulletsIntact, r.bulletsTotal),
              of(r.resumesClean, COLUMNS.resumes),
            ]),
          },
          {
            kind: "prose",
            text: "The fields are the ones a recruiter needs to reach you and read your history: name, email, phone, and each role's title, employer and dates, graded by the same scorecard the builder's X-Ray tab uses. A bullet counts as in one piece when its whole sentence appears unbroken in the extracted text. The words, the font and the page size were identical across the three layouts; only the arrangement changed.",
          },
        ],
      },
      {
        heading: "What broke, and why",
        blocks: [
          {
            kind: "list",
            items: [
              `Read line by line, both sidebar layouts broke about half the bullets — ${of(COL.leftLines.bulletsIntact, COL.leftLines.bulletsTotal)} and ${of(COL.rightLines.bulletsIntact, COL.rightLines.bulletsTotal)} survived. The reader goes straight across the page, so each line of the sidebar is glued to the line of the main column beside it, and a bullet that wraps comes out in two pieces with sidebar text in between. The same thing misread ${lost(COL.leftLines, "role.organization")} employer names.`,
              `Read in stored order with the sidebar on the left, every bullet survived but the name did not. The file holds the whole sidebar first, so the name was no longer the first thing read, and it was misread on ${lost(COL.leftStream, "name")} of the ${COLUMNS.resumes} resumes.`,
              "Read in stored order with the sidebar on the right, the result was identical to one column — because these PDFs happen to store the main column first. A different design tool can store the two columns in either order, and nothing on the page shows which.",
            ],
          },
        ],
      },
      {
        heading: "What the mix looks like",
        blocks: [
          {
            kind: "prose",
            text: "These are the first lines of the customer service example, with the sidebar on the left, exactly as the line-by-line reader returned them.",
          },
          { kind: "list", items: COLUMNS.sample.lines },
          {
            kind: "prose",
            text: "The phone number and the word “Summary” share a line, the city runs straight into the first sentence of the summary, and “Education” lands in the middle of a sentence about contacts a day. A person looking at the PDF sees none of it, which is why the problem survives so many proofreads.",
          },
        ],
      },
      {
        heading: "What this measurement does not tell you",
        blocks: [
          {
            kind: "list",
            items: [
              "It tests two reading strategies, not any vendor's applicant tracking system. Those are private and configured per employer, and nobody outside them can run this test on them.",
              "Every PDF came from one PDF library. A file from Word, Google Docs or a design tool can store its text in a different order, and the stored-order results would change with it.",
              "Some parsers detect columns and read each one separately. Where one does, a sidebar costs nothing — but you do not get to choose which parser reads your file.",
              "It did not test headers and footers, tables, text boxes or images, each of which some parsers handle differently again.",
            ],
          },
        ],
      },
      {
        heading: "What to do with it",
        blocks: [
          {
            kind: "prose",
            text: `If you want the result that holds across every reader, use one column: it was the only layout that came through both readers intact on all ${COLUMNS.resumes} resumes. If you prefer a two-column design, check the exact file you are going to send rather than trusting the template's description of itself.`,
          },
          {
            kind: "callout",
            text: "/check reads your PDF both ways, in your browser with nothing uploaded, and shows the lines where the two readings disagree. Every template in the builder is one column, for the reason above.",
          },
        ],
      },
    ],
  },
];

/** A careful reading pace for advice somebody means to act on. */
const WORDS_PER_MINUTE = 200;

/**
 * Reading time, counted rather than claimed.
 *
 * It used to be written by hand, and on 2026-09-30 the four original guides
 * said four to seven minutes for 345 to 569 words — two or three minutes at an
 * ordinary pace. A reading time is there so the reader can decide whether to
 * start, and an inflated one makes that decision for them.
 */
export function readingMinutes(sections: readonly GuideSection[]): number {
  const words = sections
    .flatMap((section) => [
      section.heading,
      ...section.blocks.map((block) =>
        block.kind === "list"
          ? block.items.join(" ")
          : block.kind === "table"
            ? [block.text, ...block.head, ...block.rows.flat()].join(" ")
            : block.text,
      ),
    ])
    .join(" ")
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export const GUIDES: readonly Guide[] = GUIDE_SOURCES.map((guide) => ({
  ...guide,
  minutes: readingMinutes(guide.sections),
}));

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}

export const GUIDE_SLUGS: readonly string[] = GUIDES.map((guide) => guide.slug);
