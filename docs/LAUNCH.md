# Launch and link drafts

Paste-ready posts for the places that can give a new domain its first links and
its first readers (ROADMAP Phase 5). **Search Console first** — item 1 in
`OWNER-ACTIONS.md` — so the visits these bring are counted and the pages they
link to get crawled.

Rules every draft follows, because the product's credibility is the pitch:

- **No outcome claims (D14).** Never "beat the ATS", "guaranteed interviews",
  "x% more callbacks". Say what the tool *shows*, not what it will get anyone.
- **Lead with the thing nobody else shows**: the X-Ray (what a parser reads from
  your file), the Six-Second View, the Interview tab — and that it is free with
  no account, nothing uploaded, and no AI writing for you.
- **Post as yourself, answer every comment for the first two hours**, and do
  not ask friends to upvote: Hacker News and Reddit both detect vote rings and
  bury the post.
- The repository is public but has **no licence file**, so do not call it open
  source. "The code is on GitHub" is accurate.

Facts you can quote (true on 2026-09-30): free PDF, Word and plain-text
downloads with no watermark; no sign-up needed; the builder runs in the
browser and the resume is not uploaded unless you choose to save it to an
account; 24 example resumes and 14 guides for India and the US; 2,294 unit
tests and 114 end-to-end tests.

---

## 1. Show HN

**Title** (80 characters max):

> Show HN: A resume builder that shows what a parser actually reads from your file

**Text:**

> I built a free resume builder that runs entirely in the browser and, next to
> the preview, shows you what a resume parser extracts from the exact PDF you
> are about to send — the text, the reading order, and which fields it
> recovered (name, email, employers, dates).
>
> Most "ATS checkers" give you a score out of 100. I don't think anyone outside
> those vendors can honestly compute one, so this shows the extraction instead
> and lets you judge it. It reads your PDF two ways (stream order and
> geometric), and flags lines where they disagree — usually a two-column layout
> or a table.
>
> Other things it does: a "six seconds" view that marks where your name and
> current role landed on page one; an Interview tab that lists every number and
> claim on your resume with the question an interviewer will ask about it; a
> keyword match against a posting you paste, which tells "demonstrated in a
> bullet" apart from "only listed in skills".
>
> There is no AI writing anything. The bullet coach asks questions ("what
> changed — a percentage, time saved, a count?") and never writes the sentence
> for you, because a number invented on your behalf is one you can't defend in
> an interview.
>
> Downloads (PDF, DOCX, TXT) are free and need no account. The PDF is rendered
> by react-pdf in a Web Worker, the DOCX uses real heading styles, and the X-Ray
> uses pdf.js. Self-hosted on an Oracle free-tier VM with SQLite + Litestream.
>
> https://sixseconds.tech — I'd especially like to hear where the X-Ray reads
> your own resume differently from what you expected.

---

## 2. Reddit

Read each subreddit's rules first; several remove self-promotion outright. The
posts below lead with something useful and mention the tool once.

### r/resumes (US-leaning)

**Title:** I measured what two-column layouts do to resume parsing (24 resumes, two ways of reading a PDF)

> A lot of advice here is "never use two columns, the ATS can't read it". I
> wanted a number, so I laid out the same 24 resumes in one column and with a
> sidebar on either side, and read every PDF back the two ways parsers read a
> page: in the order the file stores its text, and line by line across it.
>
> - One column: every name, email, phone, title, employer and date, and all
>   124 bullets, came through both ways.
> - Sidebar, read line by line: about half the bullets came out in two pieces,
>   with sidebar text glued into the middle.
> - Sidebar on the left, read in stored order: bullets fine, but the name was
>   misread on all 24, because the sidebar is read first.
>
> It's two reading strategies, not any vendor's ATS (those are private); the
> method and the limits are on the page:
> https://sixseconds.tech/guides/two-column-resume-ats
>
> The failures I'd actually worry about, in order:
> 1. A PDF that is an image (exported from a design tool as a picture). No text
>    at all.
> 2. Contact details in the page header/footer — some parsers drop those regions.
> 3. Two columns or tables — reading order becomes a coin flip.
> 4. Dates with no month.
>
> If you want to see your own file the way a parser does, I made a free checker
> that runs in your browser (nothing is uploaded): https://sixseconds.tech/check
> — it shows the extracted text and which fields came back. No score, because
> nobody outside those vendors can honestly compute one.

### r/developersIndia, r/cscareerquestionsIN, r/Indian_Academia (India)

**Title:** Made a free resume builder for Indian freshers — A4, CGPA, no photo/DOB fields, and it shows what a parser reads from your PDF

> Most resume builders are built for the US and charge to download. This one
> is free (PDF/Word/TXT, no watermark, no signup) and was written with Indian
> campus and off-campus applications in mind:
>
> - A4 by default, CGPA or percentage on the degree line, examples for a
>   B.Tech software engineer fresher, a B.Com fresher, an MBA fresher and BPO support.
> - Guides on the fresher format, campus placement resumes, CV vs resume vs
>   biodata, and what to change when applying to US jobs.
> - An X-Ray tab that shows the text a parser extracts from your PDF, and an
>   Interview tab that lists every number you'll be asked to explain.
>
> It runs in your browser and nothing is uploaded unless you make an account.
> https://sixseconds.tech/guides/resume-format-for-freshers
>
> Feedback welcome, especially from anyone who's been through a placement
> drive recently.

---

## 3. Product Hunt

- **Name:** Six Seconds Resume
- **Tagline** (60 max): `Free resume builder that shows what parsers read`
- **Topics:** Productivity, Career, Hiring, Privacy
- **Description:**
  > Build a one-column resume and download it free as PDF, Word or plain text —
  > no account, nothing uploaded. Beside the preview: an X-Ray of what a resume
  > parser extracts from your file, a six-second view of where your key facts
  > landed on page one, a keyword match against any posting, and an Interview
  > tab listing every number you'll be asked to defend. No AI writes anything.
- **First comment:** the Show HN text, shortened to its first three paragraphs.
- **Gallery:** (1) the builder with the X-Ray tab open; (2) the Six-Second View
  overlay; (3) the Interview tab; (4) `/check` with an uploaded PDF;
  (5) the templates page.

## 4. AlternativeTo

Add the app at <https://alternativeto.net/software/new/>, then on each of these
pages choose **Suggest alternative**: Zety, Resume.io, Novoresume, Kickresume,
Enhancv, Canva (resume), Resume Genius, Jobscan (for the keyword scanner).

- **Description:** first two sentences of the Product Hunt description.
- **Tags:** resume-builder, cv-maker, privacy-focused, no-registration, free.
- **Platforms:** Online.
- **License:** Free.

## 5. Directories worth one submission each

Each is a crawled page that links to the site. Use the Product Hunt
description.

- **Peerlist Launchpad** (large Indian developer audience): <https://peerlist.io>
- **SaaSHub**: <https://www.saashub.com/submit>
- **Indie Hackers** product page: <https://www.indiehackers.com/products>
- **Uneed**: <https://www.uneed.best>
- **Microlaunch**: <https://microlaunch.net>
- **GitHub repository "About"**: website `https://sixseconds.tech`, description
  "Free resume builder that runs in the browser — PDF/DOCX/TXT, X-Ray parse
  view, no signup", topics `resume`, `resume-builder`, `cv`, `nextjs`,
  `privacy`.

## 6. Placement cells and career offices (India) — the best links available

`.ac.in` pages linking to a free tool are worth more than any directory. Send
to a college's Training & Placement Officer:

> **Subject:** A free resume checker for your students' placement season
>
> Dear Sir/Madam,
>
> I run a free resume tool, https://sixseconds.tech, built for Indian students
> applying on and off campus. It needs no account and nothing is uploaded: a
> student can check what a recruiter's software reads from their PDF at
> https://sixseconds.tech/check, and build an A4 resume with CGPA and projects
> in the builder, downloading Word or PDF free.
>
> If it would help your students, you are welcome to link it from your
> placement page or share it before the next drive. I'd be glad to adjust
> anything for your college's resume template.
>
> Regards,
> [Your name]

## 7. LinkedIn / X post

> Recruiter software reads your resume before a recruiter does — so I built a
> free tool that shows you exactly what it reads. Paste nothing, upload
> nothing: open your PDF at https://sixseconds.tech/check and see the text and
> fields a parser pulls out. No score, no signup, no AI rewriting your
> experience.

Attach a 10-second screen recording: the preview, then the X-Ray tab.
