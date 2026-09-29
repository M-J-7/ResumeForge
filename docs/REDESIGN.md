# Six Seconds Resume — UI Redesign: "Instrument"

## Context

`sixseconds.tech` is live and already carries a deliberate, documented design system
([design.md](design.md), 813 lines — "Paper & Ink", nine shipped phases plus a "live pass").
It is not a generic template: it has contrast-verified tokens, a three-voice type system,
an ambient parallax field, pointer-lit cards, scroll-linked reveals and a three-state theme
toggle.

The ask is to make it feel premium, modern and conversion-focused — dark-first on marketing,
Paper & Ink retained in the app, full conversion structure added, and a typographic direction
that is not the SaaS default. Four parts of that brief (gradients, glass, card grids, "AI SaaS
look") contradict design.md as written, so this plan **amends design.md** rather than ignoring it,
and resolves the conflict with a direction that is more faithful to the original concept than the
current light marketing page is.

**Decisions taken with the user (2026-09-12):** hybrid (dark-first marketing, Paper & Ink app);
scope is everything including the builder; build the conversion surfaces; typography is mine to
choose, optimised for "not commonly seen."

**Intended outcome:** a marketing surface that looks expensive and converts, an app that feels
sharper without changing identity, and zero regressions in the ~40 locked accessibility selectors,
the mid-flight axe scans, or the builder's performance budget.

---

## The direction: Instrument

design.md §3.1 already states the concept:

> Chrome is a cool, matte workbench. **The document is the only warm, lit object on the screen.**

And §3.2 already notes the payoff it never spent:

> Dark — chrome drops to a deep graphite-green; **paper stays white and now genuinely glows**,
> which is the payoff for having kept it invariant.

So dark-first marketing is not a pivot to techno-futurist AI SaaS. It is **the existing concept,
finally spent**: a dark room in which the only lit object is the document. That reading gives
every contested element an honest job:

| Requested | How it earns its place here | Where it is banned |
|---|---|---|
| **Gradients** | Only ever *light falling on a surface* — a wash from the top edge of a band, the glow around the paper, the slate tint under machine evidence. | Never a brand gradient (violet→cyan). Never gradient-clipped text. Never behind body copy. |
| **Glass / blur** | Only for things that genuinely float above the stage: the sticky header, the sticky CTA bar, dialogs, the mobile nav panel. Backdrop blur over a token background solid enough to hold contrast. | Never a glass card containing body text. Never a translucent surface as the only ground under a paragraph. |
| **Modern cards / bento** | One bento: the **evidence grid**. Unequal tiles because the claims are unequal — X-Ray gets a large tile with a live mono readout, "free forever" and "nothing uploaded" get medium tiles, the test count gets a small numeric tile. | Not restored anywhere design.md removed them for being habit. The promises band stays hairline statements. |
| **Premium / modern** | Depth from *light*, not shadow — on dark, shadows do not read. Elevation = a 1px inset top highlight plus a surface step. Paper keeps the only real shadow. | No neon. Accent stays pine/mint `#6fcfa8` and machine slate `#8fb6da` — already uncommon against a category of violet and indigo. |

**Why this is not commonly seen:** every competitor is either a light consumer form (Zety, FlowCV)
or a dark violet AI dashboard (Teal, Rezi, Jobright). A near-black stage whose entire visual
interest is a single luminous sheet of white paper and a slate-blue machine readout beside it is a
look this category does not have — and it is a picture of the product's actual argument.

### Where dark applies

Dark-first **stage** treatment: `/` (all bands), `/templates`, `/check`, and the header bands of
`/examples` and `/guides`.

**Reading surfaces stay light-comfortable**: the article bodies of `/guides/[slug]` and
`/examples/[role]`. Long-form reading on near-black is a real comprehension cost, and these are the
SEO pages — the ones a stranger lands on from search. They get the dark stage header band, then a
Paper & Ink body. This is a deliberate exception, not an oversight.

**App keeps Paper & Ink entirely**: `/builder`, `/dashboard`, `/letters`, `/signin`.

---

## How the hybrid works technically (the key insight)

`dark:` utilities are used in exactly **two** places repo-wide (one is a comment, one is Google
brand compliance). Theming is 100% semantic-token swap, and `globals.css` already contains
`.band-invert` (lines ~459–511), which re-points `--surface-*`, `--text`, `--accent` and friends to
dark values for one landing section.

**Generalise that class into a scope**, `[data-stage="dark"]`, and apply it at the route shell.
Every existing component — `Card`, `Button`, `Badge`, `Spotlight`, `CtaLink`, `PageHeader` — inherits
correct dark styling with **zero component changes**. This is the difference between a two-week
rewrite and a two-day one.

Critical: the scope must define the full semantic set (not a partial override like `.band-invert`
does today), and it must resolve identically whether the user's theme is light or dark — a dark
stage is dark in both.

**Files:** `src/app/globals.css` (the scope + the new token groups), plus a `data-stage="dark"`
attribute on the marketing route shells.

---

## Type system

`--font-display` today is **Fraunces** (variable, 3 axes — `SOFT`, `WONK`, `opsz`). Replace it with
**Instrument Serif** (400 + italic only) via `next/font/google`, which self-hosts at build time —
mandatory, because `font-src 'self' data:` blocks every external font host.

| Voice | Face | Role |
|---|---|---|
| Display | **Instrument Serif** | Display 1 & 2 only — hero, page titles, the closing band. High-contrast, tight, dramatic at 64px+ on near-black. Rare in SaaS. |
| Interface | **Geist Sans** (keep) | Everything worked in. Display 3 and section heads move here at semibold — Instrument Serif's single 400 weight goes thin below ~40px. |
| Machine | **Geist Mono** (keep) | Locked semantic role: recovered text, parser output, X-Ray. Never decorative. |

Payload goes **down** — one static face replaces a three-axis variable font.

**The real polish win is not the family — it is that no type scale exists as tokens.** Sizes today
are Tailwind defaults (`text-sm` ×197, `text-xs` ×157) plus hand-written `clamp()` arbitrary values
scattered across files. That inconsistency is where "unfinished" actually lives.

Add a fluid scale as custom properties in `globals.css`, exported through `@theme inline` as
`--text-*` so they become real utilities (`text-display-1`, `text-body-l`, `text-micro`):

```
--text-display-1: clamp(2.75rem, 7vw, 5.25rem)   / 1.0  / Instrument Serif
--text-display-2: clamp(2.25rem, 4.6vw, 3.5rem)  / 1.06 / Instrument Serif
--text-display-3: clamp(1.5rem, 2.6vw, 2rem)     / 1.15 / Geist 600
--text-title:     1.375rem / 1.3
--text-body-l:    1.125rem / 1.65
--text-body:      0.9375rem / 1.6
--text-small:     0.8125rem / 1.5
--text-micro:     0.6875rem / 1.4  (mono)
```

Plus measure tokens (`--measure-sans: 68ch`, `--measure-read: 74ch`) and a section rhythm scale.
Then sweep the hand-clamped values in `src/app/page.tsx`, `PageHeader.tsx` and the content routes
onto the tokens.

---

## Hard gates — each of these has a test that fails

These are not style preferences. Every one is enforced.

1. **Never animate `opacity` on anything containing text.** `e2e/a11y.spec.ts` runs axe in *both*
   themes immediately after `page.goto` — no scroll, no settle wait — so on-load builds are scored
   mid-flight and below-fold builds are scored in their `hidden` state. Reveals use
   `clipPath` / `y` / `filter: blur()` only. This suite has already flaked on exactly this.
2. **Gradients and glass must never be the only ground under text.** Compute contrast at the
   *worst* point of any gradient, not the average. A `backdrop-blur` surface needs a token
   background opaque enough to pass 4.5:1 on its own.
3. **`m.*` only, never `motion.*`.** `LazyMotion strict` + `domAnimation` throws on the full
   component. `whileInView`, `layoutId` and `drag` are **not in `domAnimation`** — they type-check,
   lint, ship, and silently never fire. Use the `useInView` hook (as `Build.tsx` already does).
4. **Every new animated element needs `data-build=""`.** Both escape hatches key off it — the
   `prefers-reduced-motion` block in `globals.css` (~line 1121) and the `<noscript>` rule in
   `layout.tsx`. Miss it and reduced-motion or no-JS users get a blank region.
5. **Content routes must be server-rendered text.** `e2e/content.spec.ts` loads `/examples/*`,
   `/guides/*` and `/templates` with `javaScriptEnabled: false` and asserts 200 + verbatim strings
   (`"Why it is written this way"`, `"What a parser reads from this resume"`) + **>2000 characters**
   for examples, **>300 words** for guides. Also: a `<pre>` must remain the first `<pre>` on
   `/examples/software-developer`.
6. **~40 locked role/name selectors** ([docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) §2.3). There
   are **zero class-name assertions** anywhere — everything is role- and label-based, and several
   are anchored at string start (`/^Experience/`, `/^Atlas/`, `/^Chancery/`). Prefixing a button
   label with an icon label or a number breaks them. Exact button names, heading levels,
   `ResumeList` staying `<ul>`/`<li>`, and `[data-sync-status]` all stay.
7. **`globals.css` is parsed as text by two unit tests.** `globals.test.ts` requires `::selection`
   to appear exactly once and to use `--accent`/`--on-accent` (not `--accent-weak`), and
   `.bg-paper ::selection` to keep its literal `#2f6b57`/`#ffffff`. `opengraph-image.test.ts`
   locates the block starting exactly `:root[data-theme="dark"] {` and asserts its hex values match
   the literals in `opengraph-image.tsx` — **any dark palette change updates that file in lockstep.**
8. **`h-14` header height is a contract.** `BuilderShell` computes a full-height layout below it and
   `ScrollProgress` hangs at `top-14`. Changing it touches both.
9. **`--paper` is `#ffffff` in both themes and never inverts.** Only `--canvas` follows the theme.
10. **CSP allows no external anything.** No font host, no image CDN, no script. Glass is CSS
    `backdrop-filter`; texture is an inline `data:` SVG. `'unsafe-inline'` for style and script must
    stay (there is no nonce infrastructure); `'wasm-unsafe-eval'` must stay (react-pdf's Yoga).
11. **Motion must not enter the builder bundle.** Budget: interactive under 3s on throttled 4G,
    preview re-render under 400ms. `HeaderCta.tsx` is already hand-styled rather than reusing
    `CtaLink` for exactly this reason — keep it that way.
12. **Copy gates.** `trust-signals.test.ts` screens `TRUST_SIGNALS` with **no refusal escape hatch**
    (`guarantee`, `beat the bots`, `will pass`, `more interviews`, `get hired`, `\d+% more`).
    `examples.test.ts` screens `roles.ts`/`guides.ts` with an escape hatch for sentences that
    explicitly refuse a claim. No `.tsx` may contain the literal product name — import
    `PRODUCT_NAME`/`SITE_NAME`. `structured-data.test.ts` forbids `aggregateRating`.

---

## Phases

Each is independently shippable and leaves the app working.

### Phase 0 (optional) — Mockups before code

Run the `design` skill to produce a multi-artboard canvas: hero, evidence bento, pricing, a content
page, and the builder shell, in both stage-dark and Paper & Ink. Published as an Artifact you can
click through and edit before any code is written. **Recommended given the size of the change** —
skip it only if you'd rather review in the running app.

### Phase 1 — Token foundation (no visible redesign yet)

The whole redesign rests on this, and it is the only phase that touches shared files.

- `src/app/globals.css`: add the fluid type scale, measure and rhythm tokens, and dark-stage
  elevation tokens (`--elev-1`/`--elev-2` as inset top highlight + surface step, replacing the
  no-op `--shadow-card` on dark grounds). Export all through `@theme inline`.
- Generalise `.band-invert` into `[data-stage="dark"]` with the **complete** semantic set, resolving
  identically under both user themes. Keep `.band-invert` as an alias until Phase 2 lands.
- `src/app/layout.tsx`: swap Fraunces → Instrument Serif on `--font-display`.
- Re-verify every contrast pair against the new dark-stage grounds using design.md §3.3's method;
  update the §3.3 table. Any pair below 4.5 (text) or 3.0 (boundaries) moves before it ships.
- Update `opengraph-image.tsx` literals if the dark palette shifts.

### Phase 2 — Landing page

Rebuild `src/app/page.tsx` on the dark stage. Section order, optimised for search intent and a
single dominant action:

1. **Hero** — `data-stage="dark"`. Instrument Serif h1 (keep the existing headline; it is strong and
   on-brand), one primary CTA, `HeroDocument` reworked so the paper reads as the lit object: real
   `--shadow-page` plus a soft radial glow behind it, machine-slate readout beside it. Keep the
   900ms read sweep.
2. **Evidence bento** — the redesign's centrepiece and the social-proof substitute. `TRUST_SIGNALS`
   becomes unequal tiles rather than a ledger of rows. You cannot use logos, ratings, testimonials
   or user counts (D14 + `REFUSED_CLAIMS` + the `aggregateRating` ban), so *checkable claims are
   the proof*. Each tile keeps its `evidence` link.
3. **Promises** — unchanged in structure (hairline statements, no boxes), restyled for the stage.
4. **How it works** — keep the numbered spine; upgrade the numerals and the scroll-linked rule.
5. **What we will not tell you** — give it the weight design.md always wanted. This is the most
   distinctive copy on the site and no competitor has anything like it. Struck refusals, large.
6. **FAQ** — new. 6–8 questions written against real search intent ("does a two-column resume break
   ATS parsing?", "is PDF or DOCX better for applications?"). Server-rendered, `<details>`-based so
   it works with JS off. Emits `FAQPage` JSON-LD via the existing `faqSections()` helper pattern in
   `src/lib/structured-data.ts`.
7. **Closing CTA** — unchanged copy, restyled.

Plus a **sticky CTA bar** that appears after the hero leaves the viewport on marketing routes only.
Must respect `showsPrimaryCta()`, be dismissible, not trap focus, and carry `data-build`.

### Phase 3 — Marketing shell and remaining public routes

- `AppHeader`: keep `h-14`. Proper glass — `backdrop-blur` over a token background opaque enough to
  pass contrast, a hairline that strengthens on scroll.
- `PageHeader`: dark stage band; adopt the type tokens.
- `/templates`, `/check`: dark stage throughout. `/check` gets a genuinely premium drop zone — this
  is your highest-value acquisition surface per [docs/MONETISATION.md](docs/MONETISATION.md) and
  currently looks like a form.
- `/examples`, `/guides`: dark stage header, Paper & Ink body.
- **Fix the two out-of-sync routes.** `/guides/[slug]` and `/examples/[role]` hand-roll
  `bg-accent rounded-md px-5 py-3` anchors and `underline underline-offset-2` instead of `CtaLink`
  and `.rule-grow` — they never received the redesign. Bring them onto the system.
- `/privacy`, `/terms`, `/signin`, `/not-found`, `/error`: adopt `PageHeader` and the type tokens
  instead of hand-rolled headers. **Add the missing canonicals on `/privacy` and `/terms`** — they
  currently inherit `"/"` from the layout, which is an SEO bug.
- Extract the section primitives that do not exist yet (`Section`, `Eyebrow`, `StatTile`,
  `BentoTile`) into `src/components/marketing/` so the landing page stops being ad-hoc Tailwind.

### Phase 4 — Conversion surfaces

- **`/pricing`** — new route. Hero states what is free and *why it stays free*, linking D13 the way
  the trust page does. Then the $19 one-time Pass from [docs/MONETISATION.md](docs/MONETISATION.md),
  with "one payment, no auto-renew, no card stored" as the headline feature. **Visual only — no
  billing code.**
- `src/lib/structured-data.ts`: the landing `SoftwareApplication` keeps `offers.price: "0"` (the app
  *is* free — that claim must stay true) and gains a second `Offer` for the Pass. Do not add
  `aggregateRating`; its absence is asserted.
- `src/lib/nav.ts`: add Pricing to `HEADER_LINKS` and `FOOTER_SECTIONS`. Add `/pricing` to
  `sitemap.ts` at 0.8.
- **Correct the false trust signal.** `trust-signals.ts:139-144` claims "Optional AI enhancement runs
  on your device" under a heading that says these are checkable — the feature is shipped off and
  production reports it unavailable. Rewrite it as what actually happened (built, measured,
  switched off, here is why), which is a stronger signal than the original, and update
  `trust-signals.test.ts`.

### Phase 5 — App surfaces (Paper & Ink, elevated)

Identity unchanged. Production value raised. **No Motion enters these bundles.**

- `/dashboard`, `/letters`, `/signin`: type tokens, elevation tokens, better empty states, tighter
  card rhythm.
- `src/components/ui/`: `control.tsx` (focus ring, field depth, button press feel via the existing
  `--ease-press` `linear()` spring), `card.tsx` (elevation tokens), `badge.tsx`, `tabs.tsx`,
  `empty.tsx`, `dialog.tsx`.
- **Builder, last and most carefully.** Three grounds sharpened, step rail spine, preview toolbar,
  X-Ray on `--machine`. Rules: CSS only, token-level changes only, **no markup or accessible-name
  changes to anything in IMPLEMENTATION.md §2.3**. Note `PdfCanvas.tsx:107` sets page-chrome classes
  in JavaScript, not JSX — reading the markup will not reveal it. `BuilderShell`'s
  `key={step.id + externalRevision}` stays; it is how uncontrolled inputs resync after undo/redo.

### Phase 6 — Responsive and reduced-motion sweep

390px through 1440px on every route. Touch targets stay on the existing `@media (pointer: coarse)`
rule. Verify `prefers-reduced-motion` delivers the *finished* page, not a fast version of the
animated one. Verify every new animated node carries `data-build`.

### Phase 7 — Amend design.md

Rewrite §1 (the brief now permits light-as-gradient and float-as-glass), §3.1 (the stage/workbench
split), §3.2 (new palette + re-verified §3.3 table), §3.4 (Instrument Serif + the token scale),
§3.6 (the new landing structure), and add the dark-stage rule to §7. **An undocumented redesign is
how the next one starts from scratch.**

---

## Verification

Run after every phase — `pnpm verify` (typecheck + lint + unit) and `pnpm test:e2e --workers 3`
(the default 6 fakes 30s timeouts).

- **Contrast, manually, before shipping Phase 1.** Compute every foreground/ground pair against the
  new dark-stage grounds with the WCAG relative-luminance formula, exactly as design.md §3.3 did.
  axe catches failures but computing first is cheaper than three CI rounds.
- **axe, mid-flight and settled.** The committed suite scans immediately after `goto`; also scan
  manually after scrolling the whole page so both states are known good. Both themes, all routes:
  `/`, `/signin`, `/builder` (×2), `/privacy`, `/terms`, `/examples`, `/examples/registered-nurse`,
  `/guides`, `/guides/what-an-ats-actually-does`, `/templates`.
- **No-JS.** `e2e/content.spec.ts` must stay green — it is the only thing standing between a
  `data-build` omission and an invisible page for crawlers.
- **Reduced motion.** Set the OS preference and load `/`: full-height headline, no sweep, no tilt,
  no replay control, every section present.
- **Builder budget.** Chrome DevTools, Fast 4G + 4× CPU throttle on `/builder`: interactive under 3s,
  preview re-render under 400ms, no dropped frames while typing. Confirm no Motion in the
  `/builder` chunk.
- **Bundle.** Compare `.next` route chunk sizes before and after. Instrument Serif should make the
  font payload smaller, not larger.
- **Lighthouse ≥ 90 against `sixseconds.tech`**, not localhost — this closes blocker B5/B7, which
  was deferred precisely because a localhost measurement is meaningless.
- **Live.** `pnpm dev`, walk every route at 390px and 1440px in both themes, then deploy and re-walk.
