# Architecture Decisions

**These are locked.** They were argued against a specific alternative and settled. `docs/IMPLEMENTATION.md` §2.1 names the five that constrain new work hardest.

Do not relitigate mid-build. If evidence emerges that a decision is wrong, stop, say so, and get an explicit reversal — then amend the entry here with the reversal date and reason.

Code references these by ID in comments (`// per D5`). Keep the IDs stable.

---

## D1 — Metric-compatible OFL fonts

**Decision:** Ship Arimo, Carlito, Tinos, Gelasio, EB Garamond, Source Sans 3, Source Serif 4, IBM Plex Sans.

**Rejected:** Arial, Calibri, Georgia, Times New Roman.

**Reason:** Generating a PDF **embeds** the font file — that is redistribution of a proprietary binary we hold no license for. "The user has it installed" does not apply, because we generate the artifact. Metric-compatible substitutes have identical widths, so line breaks and pagination match and the output is visually indistinguishable to a recruiter.

## D2 — PDF preview is the actual PDF blob

**Decision:** Render the PDF client-side and display that blob as the preview.

**Rejected:** HTML/Tailwind preview alongside a separate PDF export path.

**Reason:** Two layout engines disagree on line wrapping, which cascades into pagination and page count. A single engine makes preview/export drift structurally impossible. Also costs zero server CPU per export.

## D3 — react-pdf paginates; we control breaks declaratively

**Decision:** Emit semantic blocks carrying keep-together hints; let react-pdf paginate. Page count is **read back** from the rendered PDF, never estimated.

**Rejected:** A custom layout engine computing pagination ourselves.

**Reason:** Own-pagination requires font-metric text measurement and line-breaking from scratch — weeks of work for the same guarantees that `wrap={false}` and `minPresenceAhead` already provide.

## D4 — PDF, DOCX, and TXT all ship in M0

**Decision:** All three export formats are first-class in the first milestone.

**Rejected:** DOCX deferred to a later phase.

**Reason:** 2026 cross-platform testing puts DOCX at ~97% parse accuracy versus ~76% for text-based PDF and ~53% for design-heavy PDF. An ATS-first product cannot ship the weaker format first while claiming ATS-safety as its differentiator.

## D5 — DOCX references font names; PDF embeds the OFL twin

**Decision:** The DOCX emitter writes real font _names_ (Arial, Calibri, …). The PDF emitter embeds the metric-compatible OFL file.

**Rejected:** Identical font handling across both emitters.

**Reason:** Referencing a font name in a document is not redistribution; only embedding is. Because the twins are metric-compatible, both outputs render near-identically. D1 pays off twice.

## D6 — Guest drafts live in IndexedDB only

**Decision:** Anonymous drafts never touch the server.

**Rejected:** Anonymous rows in the server database.

**Reason:** No anonymous PII, no garbage-collection policy, and no GDPR erasure obligation to a person we cannot identify. Side benefit: the builder works with the server down.

## D7 — Google OAuth and email magic link. No passwords, ever

**Decision:** Passwordless authentication only.

**Rejected:** Credentials (email + password) auth.

**Reason:** Eliminates password reset, email verification, credential-breach exposure, and login rate limiting — weeks of security-sensitive work for a solo part-time developer. Resume content still never leaves our infrastructure.

## D8 — No remote AI/LLM API in the product path

**Decision:** No generative model writes resume content, and no resume, job description, or letter is sent to a hosted AI/LLM API. Coaching remains scaffold-based. The sole exception is the opt-in cover-letter Enhance action: a small open-weight model runs locally in the browser, proposes wording only, and can never overwrite the user's paragraph without review.

**Rejected:** An AI bullet writer, a remote cover-letter writer, and silent local rewrites.

**Reason:** Generic output that recruiters now recognize on sight, and it invents accomplishments users must defend in interviews. Local enhancement is limited to a single already-generated paragraph, given only resume-backed evidence and demonstrated requirements, checked for new claims, and presented as a reversible suggestion. It costs users nothing and preserves the privacy boundary that makes guest mode trustworthy.

**Status, 2026-09-10: the exception is built and switched off.** The privacy argument held — the QA §11 measured pass confirmed that every request during a run is same-origin, with the model served from this app and `allowRemoteModels = false` removing the code path to anywhere else. What did not hold is the model: run in a real browser for the first time, `flan-t5-small` echoes its input, drops facts, or emits fragments, and two larger candidates at 2.9× the download did not clear the bar either. No deployment vendors the weights, so the editor reports the feature unavailable and the deterministic Recompose is unaffected. D8's exception stands as written and is not currently exercised; `docs/QA.md` §11 has the measurements and `docs/enhance feature.md` has what would have to change.

## D9 — Litestream to an S3-compatible bucket, from M2

**Decision:** Continuous WAL streaming with a **rehearsed** restore.

**Rejected:** Periodic file copy, or nothing.

**Reason:** A file database with no continuous backup means one bad volume loses every user's resumes. Litestream gives point-in-time restore for roughly ten lines of config. An untested backup is not a backup.

## D10 — `schemaVersion` and a migration chain from commit one

**Decision:** The resume document carries a version, and a registry of migration functions runs `v1 → v2 → v3 …` in sequence.

**Rejected:** Add versioning when it is first needed.

**Reason:** The single most-regretted omission in JSON-blob applications. The first template change breaks every saved resume without it. The mechanism must exist before it is needed.

## D11 — Rules-based lint

**Decision:** A hand-written rule engine for resume quality checks.

**Rejected:** Self-hosted LanguageTool.

**Reason:** 2–4 GB RAM with ngram data, on a container otherwise around 200 MB, for marginal gain over targeted rules.

## D12 — "3 issues left" during editing; numeric score on demand

**Decision:** Show remaining checklist items while editing. Reveal the numeric breakdown in a dedicated view, with reasons.

**Rejected:** A live 0–100 score badge.

**Reason:** Gamifying a partly-heuristic number trains users to optimize the number instead of the resume.

## D13 — Downloads are never paywalled

**Decision:** PDF, DOCX, and TXT export stay free forever. Monetize tailoring, version history, and cover letters.

**Rejected:** Pay-to-download.

**Reason:** The most-hated pattern in this category. Free downloads are the marketing hook.

## D14 — Honest ATS claims

**Decision:** Single-column is "the highest-reliability choice across the widest set of parsers," not "or you get rejected." The filename convention is for the human recruiter's downloads folder, not ATS search. Never state or imply "guaranteed to pass ATS."

**Rejected:** Competitor-standard fear marketing.

**Reason:** Accuracy is defensible positioning; folklore is not. The evidence on two-column layouts is genuinely contested between sources, which is exactly why the claim is phrased as reliability rather than a mandate. M1 (X-Ray) makes us the only party able to actually substantiate a parse claim.

---

## Amendments

| Date       | Decision   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-13 | Stack line | `create-next-app@latest` resolves to **Next.js 16.3.0 / React 19.2.8**; the plan said Next 15, which was merely current at writing. Adopted 16 — starting a greenfield project on a superseded major only buys a migration later. No D-numbered decision affected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-31 | D7         | Clarified, not reversed: a linked Google account stores `userId`, `type`, `provider`, and `providerAccountId` — no access token, no refresh token, no `id_token`. Nothing calls a Google API after sign-in, so the tokens are a breach liability with no use, and the `id_token` carries the avatar claim the profile mapper already drops. `src/server/auth/adapter.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-02 | D8         | Clarified, not reversed: the phrase library (P33) is curated, committed content and question-asking scaffolds. **No model is called and no scaffold contains a completed claim** — every one carries a blank the user fills, and `phrases.test.ts` asserts both that and that the whole bank passes our own lint engine. O\*NET supplies occupation titles and a topic index; its task statements are read at build time and never shown to a user, because they are duty-shaped and `bullets/duty-phrasing` exists to flag exactly that. D8 is unchanged.                                                                                                                                                                                                                                    |
| 2026-09-09 | D6         | Clarified, not reversed: browser-local storage is namespaced per identity. Every client-side slot carries an owner key — the signed-in user's id, or the literal `guest` — and when the browser is acting as somebody, every slot belonging to anybody else is deleted. D6 still says a guest's work lives in IndexedDB and nowhere else; §10.1 adds that it must not survive on a shared computer into the next person's session. The `guest` slot deliberately survives sign-in, because it is what the "Save it to my account" claim flow exists to rescue. `src/store/owner.ts`, `src/store/purge.ts`.                                                                                                                                                                                    |
| 2026-09-08 | D8         | Reversed for one constrained surface: cover letters can offer an opt-in, browser-only Enhance action. It uses the pinned Apache-2.0 `Xenova/flan-t5-small` ONNX model via Transformers.js, never calls a hosted model/API, sends no user text to a server, validates model output against cited resume evidence, and requires review before applying it. Resume writing and coaching remain model-free.                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-10 | D8         | **Measured, and the exception is not exercised.** Running the model in a browser for the first time found three things: the ONNX runtime was never fully vendored (a `.mjs` loader 404ed after 96MB of weights had downloaded), the WebGPU path returned one byte-identical string for every input, and the model itself cannot rewrite a paragraph. The first two are fixed — the vendoring is asserted against the package's own file list, and the WebGPU path is removed. The third is why no deployment turns the feature on. `pnpm qa:enhance` is the pass; reading its proposals is the acceptance, because a wrong answer here is a plausible sentence rather than an exception.                                                                                                      |
| 2026-09-10 | D8         | **Second evaluation, same answer.** Three instruction-tuned decoders were vendored and measured after the seq2seq round: `SmolLM2-360M-Instruct` echoes its input, and `Qwen2.5-0.5B-Instruct` is fluent but invented a unit ("40 minutes to 6" → "6 hours") and wrote "transformed our daily workload into a seamless, event-driven system" — which no rule can catch, because it invents no noun, number or credential. Six models, two architectures, eight prompt shapes. The binding constraint is D6's local-only requirement, not D8: a model small enough for a browser is not reliable enough for a job application. Two provider-neutral guardrail rules were merged from it (units belong to their numbers; a proposal that talks about itself is refused). The feature stays off. |
