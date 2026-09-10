# QA

Automated coverage lives in the test suites; this file records the checks that
**cannot** be automated in this environment, who still owes them, and the result
when they are done.

M0-T14 requires a manual pass before launch. Two of its acceptance criteria are
listed as outstanding below — they are not optional, and M0 is not "shipped"
until they are recorded here with a date and an outcome. M2 adds three more,
all needing an environment this one does not have: a Google account, a Docker
host, and an S3-compatible bucket.

Check 3 used to be the whole Google sign-in flow. It is now one screen: the
handshake runs on every end-to-end pass against a local OpenID provider, and
`pnpm auth:google` asks the real Google whether the credentials and the
redirect URI are ones it accepts.

---

## What CI already proves

Run by `pnpm verify` and `pnpm test:e2e` on every push.

| Check                                                                    | Where                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Schema round-trip, migration chain                                       | `src/lib/resume/*.test.ts`                                |
| Glyph coverage across all font pairs                                     | `src/lib/fonts/charset.test.ts`                           |
| Golden extracted text, 7 fixtures                                        | `src/lib/emit/pdf/render.test.tsx`                        |
| Determinism (stable fingerprint and byte length across renders)          | `src/lib/emit/pdf/render.test.tsx`                        |
| Pagination invariants, 24 seeded random documents                        | `src/lib/emit/pdf/pagination.test.tsx`                    |
| No overlapping lines, no margin overflow, all fixtures and font pairs    | `src/lib/emit/pdf/render.test.tsx`                        |
| DOCX structure: named styles, native numbering, no tables/images/headers | `src/lib/emit/docx/render.test.ts`                        |
| DOCX ↔ TXT word-for-word parity                                          | `src/lib/emit/docx/render.test.ts`                        |
| Page count agrees with pdfjs                                             | `src/lib/pdf/page-count.test.ts`                          |
| Lint rules, pass and fail fixture each                                   | `src/lib/lint/rules.test.ts`                              |
| Live PDF preview, IndexedDB reload, downloads, keyboard-only build       | `e2e/builder.spec.ts`                                     |
| Magic-link sign-in end to end, through real SMTP                         | `e2e/auth.spec.ts`                                        |
| Google sign-in end to end, through a real OAuth handshake                | `e2e/auth.spec.ts`, `e2e/oidc-server.ts`                  |
| A Google account is reused, never duplicated, on a second sign-in        | `e2e/auth.spec.ts`                                        |
| No provider token and no avatar URL is stored                            | `e2e/auth.spec.ts`, `src/server/auth/adapter.test.ts`     |
| A used sign-in link stops working                                        | `e2e/auth.spec.ts`                                        |
| Sign-out deletes the session row, not just the cookie                    | `e2e/auth.spec.ts`                                        |
| Guest draft claimed intact; a second claim adds rather than overwrites   | `e2e/auth.spec.ts`                                        |
| Account deletion removes every row across all tables                     | `e2e/auth.spec.ts`, `src/server/accounts.test.ts`         |
| Ownership: no account can read or write another's resume                 | `src/server/resumes.test.ts`                              |
| No password column anywhere, no credentials provider (D7)                | `src/server/db.test.ts`, `src/server/auth/config.test.ts` |
| Import round-trips all 7 fixtures through PDF and DOCX                   | `src/lib/import/parse-resume.test.ts`                     |
| Import reports low confidence rather than a guessed value                | `src/lib/import/parse-resume.test.ts`                     |
| Ctrl+Z restores the pre-import draft                                     | `e2e/import.spec.ts`                                      |
| `/check` issues no request carrying the file's content                   | `e2e/import.spec.ts`                                      |
| The `/check` → builder handoff never puts a resume in a URL              | `e2e/import.spec.ts`                                      |
| Twelve templates; a style switch cannot move the extracted text          | `src/lib/resume/templates.test.ts`                        |
| A v1 document opens with the v1 appearance after the schema bump         | `src/lib/resume/templates.test.ts`                        |
| The whole phrase bank passes the lint engine, together and one at a time | `src/lib/phrases/phrases.test.ts`                         |
| O\*NET attributed with version and access date                           | `src/lib/phrases/phrases.test.ts`                         |
| No coach message could be pasted into a resume                           | `src/lib/coach/coach.test.ts`                             |
| The step rail reorders by band, and 10+ restores the default             | `src/lib/resume/experience-level.test.ts`                 |
| Every numeric trust signal measured against this repository              | `src/lib/trust-signals.test.ts`                           |
| No user-visible surface hardcodes the product name                       | `src/lib/trust-signals.test.ts`                           |
| Every example resume passes the lint engine and the bullet coach         | `src/lib/examples/examples.test.ts`                       |
| Every content route renders with JavaScript disabled                     | `e2e/content.spec.ts`                                     |

---

## Outstanding — owed before launch

### 1. DOCX opens cleanly in real word processors

**Why this cannot be automated here:** it needs Word, LibreOffice, and Google
Docs. LibreOffice is not installed in the development environment, and the other
two are not automatable at all.

Generate a DOCX for each fixture (the emitter tests write none to disk by
default; add a temporary `writeFileSync` or use the builder's download button),
then for **each of Word, LibreOffice, and Google Docs**:

- [ ] Opens without a repair prompt or compatibility warning.
- [ ] Section headings show as **Heading 1** in the style pane — not as
      manually-bolded body text. This is the property D4 rests on.
- [ ] Bullets are a real list (the list controls in the ribbon are active when
      the cursor is in one), not literal `•` characters.
- [ ] Accented and extended-Latin characters render correctly — check the
      `non-latin-name` fixture specifically (Zoë Đurđević-Þórsdóttir).
- [ ] No text is clipped at the right margin — check `long-organization-names`.
- [ ] Dates sit at the right margin via a tab stop, and stay there when the
      window is resized.

**Result:** _not yet run._

### 2. Cross-format page parity

**Why this cannot be automated here:** needs a Word-compatible layout engine.
The practical option is LibreOffice headless converting DOCX→PDF and counting
pages, skipped gracefully when `soffice` is absent — worth adding when a machine
with it is available.

- [ ] For every fixture, the DOCX page count in Word matches the page count the
      PDF preview showed.
- [ ] Note that Word, LibreOffice, and Google Docs paginate slightly
      differently. Record which was used; a one-page difference between _those
      three_ is expected, a difference against our own PDF is a bug.

**Result:** _not yet run._

### 3. Google's consent screen

**Why this cannot be automated here:** it is a Google-hosted page, and reading
it needs a real Google account in a real browser. Nothing else about Google
sign-in is on this list any more.

**What is automated now, and where.** The handshake itself runs on every
`pnpm test:e2e`, against the local OpenID provider in `e2e/oidc-server.ts`:
the browser is redirected off the site, the server discovers the issuer,
redeems the code with PKCE and its client secret, validates a signed
`id_token`, and writes the account. Our half is not stubbed anywhere in it.
`e2e/auth.spec.ts` covers a first sign-in landing on `/dashboard`, a second
sign-in reusing the account instead of creating one, the account row holding
no token and no avatar, the `OAuthAccountNotLinked` collision **and** the
magic link still working afterwards, and a declined consent reading as
declined. `src/server/auth/config.test.ts` covers whether Google is offered
at all, with which checks and options.

**What `pnpm auth:google` takes.** Run it against the real credentials before
a deploy — it asks Google itself and needs no browser and no consent:

```bash
AUTH_GOOGLE_ID=… AUTH_GOOGLE_SECRET=… AUTH_URL=https://your-host pnpm auth:google
```

It fails on credentials Google does not recognise, on a redirect URI that is
not registered against them, and on a client still restricted to test users —
the three things that otherwise surface as a Google error page after a user
has already left the site.

**What is left for a person.** Once, with `AUTH_GOOGLE_ID` and
`AUTH_GOOGLE_SECRET` set on a real deployment:

- [ ] `pnpm auth:google` passes.
- [ ] The "Continue with Google" button appears (it is hidden until both
      variables are set).
- [ ] The consent screen shows the product's name and support email, not a
      project id or a personal address.
- [ ] It asks for email and profile, and nothing else.
- [ ] A first sign-in with a real Google account lands on `/dashboard`, and
      the address shown is the right one.

**Result:** _not yet run._

### 4. The container actually runs (M0-T13, M2)

**Why this cannot be automated here:** there is no Docker daemon in the
development environment. CI builds the image on every push, which proves it
builds — not that it serves.

What the automated suites already cover, so it is _not_ on this list: the
schema is created from an empty database on every end-to-end run (the server
applies its own migrations, and `pnpm test:e2e` deletes the database first),
and the migration bookkeeping is checked against the real Prisma CLI in
`src/server/migrate.test.ts`.

What has only been reasoned about:

- [ ] `better-sqlite3` loads from the standalone output. It is a native addon
      and `serverExternalPackages` keeps it out of the bundle, so the image has
      to carry the compiled `.node` binary. Inspecting `.next/standalone` after
      a build shows the binary present and reached through a pnpm symlink —
      which Docker `COPY` preserves, but that has not been executed.
- [ ] The `VOLUME /data` mount holds the database across a container
      replacement, and the non-root `nextjs` user can write to it.
- [ ] The healthcheck marks the container unhealthy when the database is
      unreachable (stop the volume, watch `docker compose ps`).
- [ ] The hourly `backup` service writes into `/data/backups` and prunes.

Then, against a running container:

- [ ] `/api/health` returns `{"status":"ok"}`.
- [ ] `/` and `/signin` render.
- [ ] A magic link arrives through the real `EMAIL_SERVER` and signs in.

**Result:** _not yet run._

### 5. Off-site restore rehearsal (M2-T5)

**Why this cannot be automated here:** needs an S3-compatible bucket and a
Docker host.

**Local snapshots are already rehearsed** — `src/server/backup.test.ts` takes a
snapshot of a live database, verifies it, restores it to a fresh path, and
confirms the app can serve from the result, on every push. That is the layer
that recovers from a bad migration or a mistaken delete.

What remains owed is the layer that recovers from losing the machine: a
Litestream replica, restored after an ungraceful kill, with the numbers
recorded. §10 names this as the largest tail risk in the architecture, and
M2-T5's acceptance is explicitly the rehearsal rather than the configuration.

- [ ] Restore from a real S3 replica after `docker kill` (not `stop` — a
      graceful stop lets Litestream flush, which was never the case in doubt).
- [ ] `node scripts/backup.mjs verify` passes on the restored file.
- [ ] RPO and RTO measured and recorded in the runbook's table.

**Result:** _not yet run._

### 6. JD section split on ten real postings (M3-T3)

**Why this cannot be automated here:** M3-T3's acceptance is a correct split
on ten postings _collected from public listings_. Copying ten real postings
into this repository would be republishing someone else's copyrighted text,
and writing ten and calling them real would be worse. So the automated suite
covers ten distinct structural **conventions** instead
(`src/test/fixtures/job-descriptions.ts`), and the check against genuinely
collected postings is here.

```bash
node scripts/parse-jd.mjs path/to/posting.txt   # or pipe it in on stdin
```

For each of ten postings, from ten different companies and at least three
different job boards:

- [ ] Every heading is given the kind you would have given it yourself.
- [ ] Requirements and preferences end up in different sections — this is the
      distinction the whole module exists for.
- [ ] Nothing under `ignored` is something the posting actually asks of a
      candidate.
- [ ] No paragraph is split in the middle by a mis-read heading.
- [ ] Record any heading wording that came back `unknown`; that is the list
      of patterns to add.

**Result:** _not yet run._

### 7. Resume import against real third-party resumes (P31)

**Why this cannot be automated here:** the automated suite round-trips all
seven fixtures through PDF and DOCX import, but every one of those files was
produced by our own emitters — so it proves the parser reads _our_ layout,
which is the easy half. The hard half is a resume built in Word from a
template, or exported by a competitor, and those cannot be committed: a real
resume is someone's personal data, and a competitor's template output is
their copyright. It is the same refusal §6 makes about job postings, for two
reasons instead of one.

`e2e/import.spec.ts` and `parse-resume.test.ts` cover the structural
conventions — the date on its own line, an ambiguous numeric date, an
unrecognised section heading, a layout with no headings at all. This check is
the part that needs real files.

For each of five resumes, from five different sources — at least one built in
Word from a stock template, at least one exported from another online
builder, and at least one written outside the US/UK:

- [ ] `/check` reads the file without an error.
- [ ] Name, email and phone come back correct, or are honestly reported as
      not found. **A wrong value is a failure; an empty one is not.**
- [ ] Every job title and employer is recoverable from the extracted text,
      whether or not the parser assigned it to the right field.
- [ ] Import into the builder produces a document whose sections are the
      source's sections — nothing silently dropped.
- [ ] No field is filled with something the file does not contain. This is
      the criterion that matters most: the product position is that we do not
      overstate what we read.
- [ ] Record every section heading that came back as a custom section; that
      is the list of patterns to add to `src/lib/import/headings.ts`.
- [ ] **Delete the files afterwards.** They are not fixtures and must not
      become any.

**Result:** _not yet run._

### 8. Build a resume end-to-end on a real phone

**Why this cannot be automated here:** the criterion is about whether it is
usable, not whether it renders. An emulator answers the wrong question.

- [ ] Complete a resume start to finish on a physical phone, portrait, one
      handed where possible.
- [ ] The 390px viewport is the target width; check nothing overflows
      horizontally.
- [ ] The Edit/Preview tabs are reachable and the preview is legible.
- [ ] The on-screen keyboard does not cover the field being typed into.
- [ ] Download all three formats and confirm they open on the device.
- [ ] Sign in by magic link from the phone's own mail app and confirm the link
      opens in a browser that keeps the session.

**Result:** _not yet run._

### 9. Two real accounts on one computer (§10.1)

**Why this cannot be automated here:** it is automated, against the local
OpenID provider — `e2e/auth.spec.ts` runs the whole sequence in one browser
context, which _is_ the shared computer. What a person still owes is the same
sequence against **real Google accounts**, because the bug was reported on a
real Google sign-in and the fix is meant to be provider-agnostic. This is the
one check where "it passes with our own issuer" is not quite the claim.

- [ ] Build a resume as a guest. Sign in as account A. Confirm the dashboard
      offers the guest draft and adopting it works.
- [ ] Sign out. Sign in as account B in the same browser, nothing cleared.
- [ ] `/builder` is empty for B and `/dashboard` offers B nothing of A's.
- [ ] In developer tools, `Application → IndexedDB → keyval-store`: no key
      ending in A's user id remains.
- [ ] Repeat the whole sequence with the magic link, to confirm it is below
      the auth provider rather than specific to one.

**Result:** _not yet run._

### 10. The two rules no automated check can see (§10.3, §10.5)

**Why this cannot be automated here:** `axe` does not inspect `::selection`,
and the dev overlay's error badge exists only under `next dev`, which the e2e
suite deliberately does not run against.

- [ ] `pnpm dev`, then load `/`, `/builder`, `/letters`, `/signin` and
      `/check`: no red error badge on any of them.
- [ ] `curl -sI http://localhost:3000/ | grep -i content-security-policy` in
      dev and against a production build — the two differ in exactly one
      token, `'unsafe-eval'`. (`src/lib/csp.test.ts` asserts this too; the
      manual pass is what confirms the _served_ header matches the config.)
- [ ] Drag-select body copy on `/`, `/builder`, `/letters` and inside the
      inverted band, in both themes: the highlight is obvious and the text
      stays readable.
- [ ] Select text over the rendered resume page in dark mode, where the paper
      stays white whatever the theme.

**Result:** _not yet run._

### 11. The local enhancement model, measured on real hardware

**Result: run 2026-09-10. The feature does not pass, and it is switched off.**

**Why this could not be automated _in CI_, and now is automated elsewhere.** The
plan requires measured download size, latency, memory and output quality before
broad release, and none of it means anything from a headless CI container with
no GPU, on a runner whose bandwidth is nobody's domestic connection. That is an
argument against measuring it _in CI_, not against measuring it. A checklist run
by hand produces numbers nobody can reproduce and a tester who quietly rounds —
so everything a machine can count is counted by `e2e/enhance.measured.spec.ts`,
run on a chosen machine with `pnpm qa:enhance` and rendered by
`pnpm qa:enhance:report`. It is excluded from `pnpm test:e2e` by name: ~120MB of
weights and a beam search per assertion would make every CI run slow and flaky.

`e2e/enhance.spec.ts` still covers everything that holds whether the model runs
or not — that consent gates the download, that no resume, posting or letter text
is sent anywhere even when the download fails, and that a failure leaves the
paragraph untouched with Recompose still working.

What stays with a person is the judgement the plan asks for by name: reading the
proposals and deciding whether they are sentences somebody would send. The
harness prints them; it does not grade them. The verdict at the end is that
judgement, made on 2026-09-10.

#### The machine

|         |                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------ |
| CPU     | 12 logical processors                                                                                  |
| RAM     | 16 GB                                                                                                  |
| GPU     | NVIDIA RTX 3050 Laptop + Intel UHD — Chromium selected the Intel adapter, and the feature uses neither |
| Browser | Playwright Chromium (new-headless), Firefox, WebKit                                                    |
| Build   | `next build` production output, served over plain HTTP on localhost, with the real CSP                 |

#### What the pass found

Three things, in the order they were found. Two were bugs and are fixed; the
third is the model, and it is why the feature is off.

**1. The feature had still never run, because the ONNX runtime was never fully
vendored.** `env.backends.onnx.wasm.wasmPaths` relocates a _directory_, and ONNX
Runtime Web loads a `.mjs` glue module from it as well as the `.wasm` binary.
`fetch-enhancement-model.mjs` copied one of the two, so every attempt downloaded
96MB of weights and then 404ed on a 44KB loader — and the user was told "Local
enhancement is unavailable right now."

This is the same shape as the CSP bug the previous pass fixed, one layer down,
and it survived for the same reason: `enhance.hosting.test.ts` asserted that the
fetch script _contained a filename string_. It did. The script now copies every
`ort-*` file the installed package ships, and the test compares that set against
the package's own directory listing.

**2. The WebGPU path returned one byte-identical string for every input.**

```
"comunicat cabluvêtement this this this this this this this this …"
```

The same string for four different paragraphs, which means the encoder's output
never reached the decoder at all. The same weights, prompt and build produce
ordinary English on the WASM path in one to three seconds. int8 weights on ONNX
Runtime Web's JSEP provider are a known-bad pairing — the runtime warns it could
not assign every node to the preferred provider.

**The guardrail hid it, by working.** The garbage was rejected as "stopped
mid-sentence", so a completely broken backend presented as a plausible failure
message. A feature that is broken on every machine with a working GPU and
correct on every machine without one is worse than one that is uniformly slower,
so the WebGPU path is removed. `enhance.hosting.test.ts` pins the code, and the
"a working GPU changes nothing" check below pins the behaviour.

**3. `flan-t5-small` cannot do this task, and no prompt fixes it.** Six prompt
shapes were tried — the shipped one, a bare paraphrase, the T5 `paraphrase:`
prefix, a single instruction with no evidence pack, a grammar-correction
framing, and the instruction after the text. Outputs included `"id=0"`, a line
of spaces, `"I was able to get a job at the company and then work for the
company."`, and a repetition loop.

Two larger models were fetched and measured at 278MB each:

| Model                        | Result                                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Xenova/flan-t5-base`        | Safe and useless — returns the input verbatim for three of four paragraphs, which the guardrail then rejects as no improvement                                             |
| `Xenova/LaMini-Flan-T5-248M` | Best single rewrite seen, and unusable: on the shipped prompt it emits _"I'm sorry, but as an AI language model…"_, having been distilled from a model that refuses things |

#### Round two, 2026-09-10: decoder models

The seq2seq family being the wrong _shape_ was the obvious objection, so three
instruction-tuned decoders were vendored and measured on WebGPU with a stricter
prompt. `SmolLM2-360M-Instruct` (273 MB and 388 MB) echoes its input and then
repeats the prompt's own label. `Qwen2.5-0.5B-Instruct` (483 MB) is fluent and
unsafe: of five paragraphs it produced one genuinely good rewrite, invented a
unit ("40 minutes to 6" became "40 minutes to just over 6 hours"), inverted a
measurement, and wrote "transformed our daily workload into a seamless,
event-driven system" — which contains no new proper noun, number or credential,
so **no rule can catch it**. Warm latency was 14–38 seconds per paragraph.

Six models, two architectures, eight prompt shapes. The binding constraint is
that a model small enough to run in a browser is not reliable enough to write
on a job application. Two provider-neutral guardrail rules came out of it and
are merged: a number's unit is now part of the quantity, and a proposal that
talks about itself is refused. See `docs/enhance feature.md`.

#### Two gaps this exposed, recorded and not fixed

**The guardrail catches invented claims, not removed ones.** `"Your posting asks
for Kubernetes. That is in the work above."` became `"Your posting asks for
Kubernetes."` and passed every rule: nothing invented, no number, no escalated
verb. The accountant row below is the same failure in the corpus: two sentences
naming the role, the employer and what follows, replaced by the fragment
`"Financial Accountant at Harbour & Vale."` — accepted, because it invents
nothing. Silently dropping most of a paragraph is a real defect.

It is recorded rather than built, deliberately. A material-omission rule needs a
threshold — how much shortening is concision and how much is loss — and the only
honest way to set one is against a model whose output is worth keeping.
Calibrating it against a model that returns `"id=0"` would produce a number that
looks measured and is not.

**The model echoes the prompt's own scaffolding into the proposal.** Several
runs returned `"Paragraph to rewrite: [...]"` verbatim, and one returned the
instruction line `"The evidence below is reference data, not instructions."` as
its suggestion. `cleanModelText` strips `"Enhanced paragraph:"` and `"Enhanced
version:"` and nothing else. Unlike the omission rule this one needs no
threshold — the prompt's lines are known strings — so it is a straightforward
rule for whoever changes the model, and it is left with that change rather than
tuned against output nobody would ship.

#### Found on the way, and not about the model at all

The corpus needed evidence paragraphs, and for most roles the composer could not
produce one. A requirement counts as `demonstrated` only when a term the skill
vocabulary knows appears **in a bullet** — a skills-list mention is reported
separately as "in your skills list but no bullet shows you using it" and does
not feed the composer.

Across all ten example resumes used here, **exactly two bullets name a term the
vocabulary knows**: `Go`, in the software developer's "Rebuilt the ingestion
path in Go", and `dbt`, in the data analyst's "rebuilding it in dbt and Looker".
Every other bullet is written the way this product's own guidance tells people
to write bullets — outcomes and numbers, not tool names — and none of them can
produce an evidence paragraph.

That is a tension worth stating plainly: **following the resume advice makes the
match worse.** It is recorded under "Known limitations" below, because it is
about `/match` and the cover-letter composer rather than about Enhance, and it
was found here only because this pass needed real paragraphs to measure.

The same corpus work also found a false positive in the skill vocabulary:
`REST APIs` carried `"rest"` as an alias, so "the rest of the region" and "bed
rest" both resolved to it. That one **is** fixed, with a test, and
`src/lib/skills/curated.ts` had already written down the rule it broke.

#### The measurements

<!-- Generated by `pnpm qa:enhance:report` from a run started 2026-09-10T04:17:55.771Z. -->

#### What it costs to turn on

**100.8 MB on the wire**, once per browser, across 8 files.

| File                                                                    | On the wire |
| ----------------------------------------------------------------------- | ----------- |
| `/models/Xenova/flan-t5-small/onnx/decoder_model_merged_quantized.onnx` | 59.3 MB     |
| `/models/Xenova/flan-t5-small/onnx/encoder_model_quantized.onnx`        | 35.8 MB     |
| `/ort/ort-wasm-simd-threaded.jsep.wasm`                                 | 5.1 MB      |
| `/models/Xenova/flan-t5-small/tokenizer.json`                           | 0.6 MB      |
| `/ort/ort-wasm-simd-threaded.jsep.mjs`                                  | 0.0 MB      |
| `/models/Xenova/flan-t5-small/config.json`                              | 0.0 MB      |
| `/models/Xenova/flan-t5-small/tokenizer_config.json`                    | 0.0 MB      |
| `/models/Xenova/flan-t5-small/generation_config.json`                   | 0.0 MB      |

Smaller than the ~120 MB on disk because Next compresses what compresses: the ONNX runtime `.wasm` goes over the wire at about a quarter of its size, and the tokenizer at about a quarter of its own. The two `.onnx` weight files do not shrink at all — quantized weights are already dense — and they are the overwhelming majority of the transfer.

Timed from `localhost`, where it is a disk read and means nothing. The size is the measurement; these are arithmetic from it:

| Connection                           | Download |
| ------------------------------------ | -------- |
| 10 Mbit/s (a poor mobile connection) | 81s      |
| 25 Mbit/s                            | 32s      |
| 100 Mbit/s                           | 8s       |

**Peak memory 1307 MB** across the whole browser process tree, **+687 MB** over the same browser with the page open and the model not loaded. Measured at the process level rather than with `performance.memory`, which does not see the WebAssembly heap the weights live in, and deliberately pessimistic: it counts the browser and GPU processes, not only the renderer holding the tab. The target §11 names is a laptop with 8 GB.

**Every request during a run was same-origin.** Origins observed: `http://localhost:3000`, `data:`. `connect-src 'self' blob: data:` should make anything else impossible; this is the check that the policy and the runtime configuration agree.

The machine had a working WebGPU adapter (`intel gen-12lp`) and the run did not touch it. See below.

#### Latency

|                                               |       |
| --------------------------------------------- | ----- |
| Cold (first paragraph, includes the download) | 2.5s  |
| Warm, median of 3                             | 30.4s |
| Warm, fastest                                 | 0.3s  |
| Warm, slowest                                 | 30.7s |

Each warm run:

- Evidence paragraph: 30.7s — proposal
- Alignment paragraph: 30.4s — proposal
- Closing paragraph: 0.3s — refused

#### The GPU is present and unused, and that is now correct

A browser with a working WebGPU adapter and one with none produce the same output:

```
with a GPU : - Corvid Labs Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.
GPU hidden : - Corvid Labs Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.
```

#### Ten proposals, ten roles

**4 proposed, 6 refused — a refusal rate of 60%.**

All 10 rows are real composed prose. Which paragraph each row is about is in the table, and it matters: the evidence paragraph is the one built from the user's own resume text, and the composer can only produce it where a _bullet_ names a term the skill vocabulary knows. That is two of these ten resumes, so the rest are measured on their opening paragraph, which is always real.

| Role                             | Paragraph | Outcome  | Time | Why                                              |
| -------------------------------- | --------- | -------- | ---- | ------------------------------------------------ |
| Software Developer               | Evidence  | proposal | 2.9s | 4 words removed, 3 words added.                  |
| Registered Nurse                 | Opening   | refused  | 1.8s | The local model stopped mid-sentence. Try again. |
| Accountant                       | Opening   | proposal | 1.3s | 25 words removed.                                |
| Data Analyst                     | Evidence  | proposal | 1.3s | 24 words removed, 7 words added.                 |
| Project Manager                  | Opening   | refused  | 1.4s | The local model stopped mid-sentence. Try again. |
| Teacher                          | Opening   | proposal | 1.3s | 27 words removed, 1 word added.                  |
| Sales Representative             | Opening   | refused  | 1.4s | The local model stopped mid-sentence. Try again. |
| Customer Service Representative  | Opening   | refused  | 2.5s | The local model stopped mid-sentence. Try again. |
| Administrative Assistant         | Opening   | refused  | 3.0s | The local model stopped mid-sentence. Try again. |
| Graduate with no work experience | Opening   | refused  | 2.0s | The local model did not return a paragraph.      |

Every proposal in full, because the whole point of this check is reading them:

**Software Developer**

```
was: At Corvid Labs, I rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.
now: - Corvid Labs Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.
```

**Accountant**

```
was: I am writing about the Financial Accountant role at Harbour & Vale. I am currently Financial Accountant at Ardmore Manufacturing; the work below is what I have to show for it.
now: Financial Accountant at Harbour & Vale.
```

**Data Analyst**

```
was: At Halden Retail Group, I cut the weekly trading report from 6 hours of manual work to 20 minutes by rebuilding it in dbt and Looker.
now: - The report is a summary of the report.
```

**Teacher**

```
was: I am writing about the Second in Department, Mathematics role at Ashfield Academy. I am currently Second in Department, Mathematics at Ashfield Academy; the work below is what I have to show for it.
now: - Second in Department, Mathematics at Ashfield Academy.
```

#### Browsers

| Engine   | Version       | Outcome  | Time  |
| -------- | ------------- | -------- | ----- |
| chromium | 151.0.7922.34 | proposal | 2.8s  |
| firefox  | 153.0         | proposal | 8.3s  |
| webkit   | 26.5          | error    | 90.4s |

- **chromium**: - Corvid Labs Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.
- **firefox**: - Corvid Labs Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.
- **webkit**: expect(locator).toBeVisible() failed

Locator: getByRole('textbox', { name: /paragraph$/ }).first()
Expected: visible
Timeout: 90000ms
Error: element(s) not found

Call log:

- Expect "toBeVisible" with timeout 90000ms
- waiting for getByRole('textbox', { name: /paragraph$/ }).first()

**The WebKit row is not a result about Enhance.** The page never finished loading, and the cause is `upgrade-insecure-requests` in our own CSP: WebKit rewrites every subresource to `https://localhost:3000`, where nothing is listening for TLS, and each one fails with `SSL connect error`. Chrome and Firefox exempt localhost as a trustworthy origin; WebKit does not.

That is a property of testing an https-only product over plain HTTP, not a production defect — in production the origin _is_ https and there is nothing to upgrade. It does mean WebKit coverage of anything in this app needs the E2E server to speak TLS, and that Safari remains unmeasured here. Playwright's WebKit on Windows is not Safari either, so even a passing row would have been weak evidence.

#### Cancel stops the work, not the spinner

Over a 1-second window: **2.07s** of task time while running, **0s** after Cancel. Measured with CDP's `TaskDuration`, so it is the tab's actual CPU rather than what the UI claims.

#### Apply, reload, revert, export

Applied an enhancement, saved, reloaded, reopened: the text survived. Revert restored the composer's original wording exactly.

Exported Devika_Menon_Cover_Letter.pdf, Devika_Menon_Cover_Letter.docx, Devika_Menon_Cover_Letter.txt — none carried the model id or the `enhancement` metadata.

#### The verdict

**Do not ship it.** The download is affordable, the memory is fine, the latency
is tolerable, the privacy claim holds, and the output is not worth sending. Two
of those five were in doubt before this pass and are now settled; the one that
matters most is the one that failed.

`pnpm enhance:fetch` is not run by any deployment, including
`deploy/oracle/bootstrap.sh`, which says so where it starts the stack. Without
the weights the editor reports the feature unavailable here and the
deterministic Recompose — which is what the letters are composed from in the
first place — is unaffected. That is a supported state, it is the default, and
it is now the recommended one.

**Result:** _run 2026-09-10 — failed on output quality; two bugs found and
fixed; feature left off. Re-run with `pnpm qa:enhance` after any model change,
and read the proposals._

---

## 12. The bullet / skills-list gap, fixed 2026-09-10

**Result: fixed, with tests. No manual pass owed.**

Recorded here rather than in `IMPLEMENTATION.md` because §11's measurement is
what found it, and the numbers below are that measurement.

### What was wrong

`scoreResume` has had three statuses since M3: `demonstrated`, `listed-only`,
`missing`. The cover-letter composer used the first and ignored the second, so
a skill on the resume's skills list could not reach the letter at all.

That gate is far narrower than it sounds. Across the ten example resumes used
in §11, **exactly two bullets anywhere name a term the skill vocabulary
knows** — `Go` and `dbt`. Every other bullet is written the way this product's
own example pages teach: outcomes and numbers, not tool names. The result was
that eight of ten candidates got a bracketed placeholder where their evidence
paragraph should be, and no alignment paragraph, **because they followed the
advice**.

### What changed

The principle the composer now holds is not "only demonstrated skills may be
mentioned". It is: **the letter may make any claim the resume already makes,
and must never present a weaker claim as a stronger one.**

1. **The evidence paragraph falls back to the resume's own bullets** when the
   posting matches none. A letter quoting the candidate's strongest work beats
   a letter quoting an error message, and it is not less honest — that
   paragraph never claimed to answer the posting. Matched bullets still lead.
2. **The alignment paragraph gained a second sentence** for `listed-only`
   skills, in a visibly weaker frame: "You also ask for X, which I have worked
   with", never "the work above shows X". The two never share a clause and no
   skill appears in both — both asserted.
3. **The advice moved out of the letter.** "None of your bullets matched this
   posting" was the evidence _paragraph_: a warning wearing a document's
   clothes, relied on not to be sent. It is now a `composeDiagnostic` shown
   beside the letter, and the letter is a letter.
4. **Provenance follows.** A cited skills group resolves to
   "Infrastructure (skills list)", so opening Sources answers the question that
   matters: did this come from my work, or from my list? `findEntry` did not
   traverse skills sections at all until this change — the exact
   partial-traversal failure its own header warns about.

### What is still true

`EVIDENCE_WEIGHT` is unchanged: a skills-list mention is still worth 0.25
against a bullet's 1.0, and `/match` still tells the user to add a bullet. The
fix does not make a listed skill count for more. It lets the letter say the
weaker thing weakly instead of saying nothing.

---

## Known limitations, recorded deliberately

- **~~A skill counts as demonstrated only when a _bullet_ names it~~ — fixed
  2026-09-10, see §12 below.** Kept here because the measurement is what
  motivated the fix: `scoreResume` reports a
  skills-list mention separately — "X is in your skills list but no bullet shows
  you using it" — and the cover-letter composer only builds an evidence
  paragraph from `demonstrated` requirements. Measured while assembling the §11
  corpus: across the ten example resumes used there, **exactly two bullets name
  a term the vocabulary knows** (`Go` and `dbt`). Every other bullet follows the
  guidance those same example pages give — outcomes and numbers, not tool names
  — and produces no evidence paragraph at all.

  Both halves are defensible on their own. A skills list is a claim and a bullet
  is evidence, which is the distinction the whole product is built on; and
  "Improved performance" is worse than "p99 from 1.4s to 210ms", which is what
  the examples teach. Together they meant a resume written the way we recommend
  matched worse than one that padded its bullets with tool names, and the
  composer told its author it found nothing.

  **Resolved in §12 below.** The third status already existed — `listed-only` —
  and the composer simply refused to use it.

- **The skill vocabulary is technology-centric, so non-technical roles match
  little.** `data/skills.json` is O*NET's technology-software list and
  `curated.ts` is 90 terms we own, almost all of them engineering. Of the ten
  §11 roles, the nurse, the teacher and the administrative assistant demonstrate
  **nothing** it knows. The composer says so honestly rather than inventing
  something, which is the right behaviour for a limitation that is real.

- **WebKit cannot load this app over plain HTTP**, so the E2E suite cannot cover
  it. Our CSP sets `upgrade-insecure-requests`; WebKit rewrites every
  subresource to `https://localhost:3000`, where nothing is listening for TLS,
  and each one fails with `SSL connect error`. Chrome and Firefox exempt
  localhost as a trustworthy origin and WebKit does not. This is a property of
  testing an https-only product on localhost rather than a production defect —
  in production the origin is https and there is nothing to upgrade — but it
  means Safari is unmeasured. Covering WebKit needs the E2E web server to speak
  TLS with a self-signed certificate and `ignoreHTTPSErrors`.

- **Scripts the vendored fonts do not cover** — Devanagari, Bengali, Tamil, Han,
  Hangul, Kana, Arabic, Hebrew, Thai. Names in these render as `.notdef` boxes.
  Recorded in `src/lib/fonts/charset.ts` and `docs/ATTRIBUTION.md`; the
  mitigation (a Noto fallback chain) is not in M0.
- **Byte-for-byte PDF determinism is not achievable.** pdfkit randomizes the
  embedded font subset tag and react-pdf flushes font streams in async
  completion order. `pdfFingerprint` normalizes both; the document is identical,
  the serialization is not. See `src/lib/emit/pdf/determinism.ts`.
- **The PDF preview needs a browser with `'wasm-unsafe-eval'` support** —
  Chrome 97+, Firefox 102+, Safari 16.4+. react-pdf lays out text with a
  WebAssembly build of Yoga, and the CSP allows WebAssembly without allowing
  `eval` of JavaScript. On an older browser the builder still works and the
  preview does not. Widening the policy to `'unsafe-eval'` would fix it and
  give up the protection entirely, so it is recorded here instead.
- **The development mail outbox never runs in production.** `AUTH_DEV_OUTBOX`
  writes sign-in emails to disk so the flow is usable without an email account;
  it throws under `NODE_ENV=production`. The E2E run therefore does not use it —
  it points the real SMTP transport at a capture server (`e2e/mail-server.ts`),
  which is the code that actually ships.
- **The Google handshake is tested against a local issuer, not against Google.**
  `e2e/oidc-server.ts` stands in for `accounts.google.com`, reached through
  `AUTH_GOOGLE_ISSUER`, which the app accepts over plain HTTP on loopback and
  nowhere else. Everything on our side of the wire is the shipping code —
  discovery, PKCE, `client_secret_basic`, a signed `id_token`, the adapter
  write. What it cannot prove is anything about Google's own service or about
  a particular OAuth client; `pnpm auth:google` covers the client, and check 3
  above covers the consent screen.
- **`ResizeObserver`, `HTMLDialogElement.showModal`, and `URL.createObjectURL`
  are stubbed in jsdom** (`src/test/setup.ts`). Anything depending on their real
  behaviour must be covered by the Playwright suite instead.
