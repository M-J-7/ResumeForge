# What only you can do

Everything in `ROADMAP.md` that needs an account, a device, a decision or a
signature that the code cannot supply. Each item says why it is yours, how long
it takes, and exactly what to do. Tick them off here as they land.

**Kept current by whoever changes the plan.** Last updated 2026-09-30.

---

## Do these first — they gate everything else

### 1. Google Search Console and Bing Webmaster Tools (ROADMAP Phase 1.1) — 20 minutes

The site is live and fast, and Google has still not indexed it — checked again
on 2026-09-30: a `site:sixseconds.tech` search returns nothing. No amount of
content ranks until this is done. This is the single highest-value thing on
this list.

1. <https://search.google.com/search-console> → **Add property** → **Domain** →
   `sixseconds.tech`. It shows a `TXT` record. Add it at your domain registrar
   (DNS settings for `sixseconds.tech`), wait a few minutes, press **Verify**.
   *No access to DNS right now?* Choose **URL prefix** →
   `https://sixseconds.tech/` → **HTML tag** instead, and send me the `content`
   value of the `google-site-verification` tag (it is not a secret — it is
   published in the page by design). I add it to the site's metadata, deploy,
   and you press **Verify**. Bing's `msvalidate.01` tag works the same way.
2. **Sitemaps** → submit `https://sixseconds.tech/sitemap.xml`.
3. **URL inspection** → paste each of these, then **Request indexing**:
   `/guides/two-column-resume-ats` (the measurement — the page most likely to earn links), `/`, `/check`, `/templates`, `/examples`, `/guides`, `/resume-keyword-scanner`,
   `/bullet-point-checker`, `/examples/software-engineer-fresher`,
   `/guides/resume-format-for-freshers`, `/guides/how-to-write-a-resume-summary`,
   `/guides/how-long-should-a-resume-be`, `/guides/cv-vs-resume-vs-biodata`.
   (Search Console allows roughly ten requests a day; the sitemap covers the rest.)
4. <https://www.bing.com/webmasters> → **Import from Google Search Console**
   (one click once step 1 is done). Bing also feeds ChatGPT search and Copilot.
   IndexNow already pings Bing on every deploy.

### 1b. Fill in the GitHub repository's "About" box — 1 minute

The repository is public and GitHub is crawled constantly, but it has no
website, description or topics. On <https://github.com/M-J-7/ResumeForge> →
the gear beside **About**: website `https://sixseconds.tech`; description
"Free resume builder that runs in the browser — PDF/DOCX/TXT, X-Ray parse view,
no signup"; topics `resume`, `resume-builder`, `cv`, `nextjs`, `privacy`.
(The README now links the live site.)

### 2. Move sign-in email to Resend (A4) — 15 minutes

Brevo rewrites every link in the sign-in email through its click tracker, and
corporate mail scanners "click" it first — which uses up the single-use link
before the person does. Sign-in is the only conversion the site has.

1. <https://resend.com> → sign up → **Domains** → add `sixseconds.tech`, add the
   DNS records it shows at your registrar, wait for **Verified**.
2. **API Keys** → create one with "Sending access".
3. On the server (or ask me to, and paste the key in a private message):
   ```bash
   ssh -i ~/.ssh/id_ed25519_oracle ubuntu@129.154.44.75
   cd /opt/resume-builder && sudo nano .env.production
   # replace the EMAIL_SERVER line with:
   EMAIL_SERVER=smtp://resend:<API_KEY>@smtp.resend.com:587
   sudo docker compose up -d app
   ```
   Resend does not track clicks unless you turn it on; leave it off.
4. Request a sign-in link to an Outlook or Google Workspace address and confirm
   it still works after the scanner has seen it.

### 3. An uptime monitor (A6) — 5 minutes

<https://uptimerobot.com> (free) → **New monitor** → HTTP(s) →
`https://sixseconds.tech/api/health` every 5 minutes → alert to your email.
It is also insurance: Oracle reclaims Always Free instances that sit idle.

---

## Checks that need your hardware or your accounts (QA.md)

### 4. Open a downloaded DOCX in real word processors (QA #1, #2) — 15 minutes

The product's core claim, never yet checked against Word. Build any resume in
the builder, **Download DOCX**, and open it in **Microsoft Word**, **Google
Docs** and (if you have it) **LibreOffice**. Tick each box under QA.md §1 — no
repair prompt, headings show as *Heading 1*, bullets are a real list, dates
sit at the right margin. Then compare the page count with the PDF (§2).
Tell me anything that looks wrong; each miss becomes a test.

### 5. Google's consent screen (QA #3) — 5 minutes

Sign in with a Google account you have never used on the site. The consent
screen should show "Six Seconds Resume" and your support email, ask for email
and profile only, and land you on `/dashboard`.

### 6. A resume built on your phone (QA #8) — 20 minutes

On a real phone, portrait: build a resume start to finish, switch between
Edit and Preview, download PDF, DOCX and TXT and open each on the phone, then
sign in by magic link from the phone's mail app.

### 7. Two real accounts on one computer (QA #9) — 10 minutes

The steps are in QA.md §9. The automated version passes; this confirms it with
real Google and email accounts.

### 8. The destructive restore rehearsal (QA #5, RUNBOOK) — 30 minutes, at a quiet time

The off-site replica has been restored *beside* the live database, not after
losing it. Pick a quiet hour and say so; the procedure is in RUNBOOK.md →
"Restoring". I can run it with you watching.

---

## Decisions only you can make

### 9. An `/about` page and author bylines (ROADMAP Phase 3, E-E-A-T)

Google weighs who is behind advice pages. The roadmap wants an `/about` page
("who builds it and why") and a named author on the guides. That means
publishing a real person's name and a line of background. Tell me what you are
comfortable publishing — name, city, one sentence of background, a link
(GitHub or LinkedIn) — or tell me to leave it anonymous and I will write the
page around the product instead.

### 10. Selling the Pass (MONETISATION.md Phase 2c)

The $19 one-time Pass needs a Merchant of Record account — **Paddle** or
**Lemon Squeezy** — in your name, which handles VAT/GST and sales tax for you.
Nothing is charged until you create one; the code for checkout waits on it.

---

## Distribution — no code, 4–6 hours a week (ROADMAP Phase 5)

**Paste-ready drafts of every post are in `docs/LAUNCH.md`** — Show HN, Reddit
(US and India), Product Hunt, AlternativeTo, five directories, a placement-cell
email and a LinkedIn post. Do these after item 1. A new domain ranks on links
far more than on page count, so this section is now the second most valuable
thing on this list.

- [ ] Show HN (lead with the engineering, not the product).
- [ ] Product Hunt.
- [ ] AlternativeTo: list as an alternative to Zety, Resume.io, Canva, Novoresume.
- [ ] Reddit — participate before posting: r/resumes, r/EngineeringResumes,
      r/jobs (US); r/developersIndia, r/Indian_Academia, r/cscareerquestionsIN (India).
- [ ] College placement cells / T&P offices in India: offer `/check` and the
      builder for campus drives (earns `.ac.in` links).
- [ ] Short videos: "here is your resume; here is what the machine read" — X-Ray
      and the Six-Second View — on YouTube Shorts, Reels and LinkedIn.
- [ ] Before each content batch: check Search Console queries and Google
      Keyword Planner for demand, and tell me which roles and questions to write.
