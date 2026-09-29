# Redesign — implementation log

The plan is [REDESIGN.md](REDESIGN.md). This file is the ledger: what is done, what
each phase actually changed, what was verified, and where the build departed from the
plan and why. It is written as the work happens, not reconstructed afterwards.

## Status

| Phase | What                              | State    |
| ----- | --------------------------------- | -------- |
| 0     | Mockups                           | skipped  |
| 1     | Token foundation                  | **done** |
| 2     | Landing page                      | **done** |
| 3     | Marketing shell + public routes   | **done** |
| 4     | Conversion surfaces               | **done** |
| 5     | App surfaces                      | **done** |
| 6     | Responsive + reduced-motion sweep | **done** |
| 7     | Amend design.md                   | **done** |

**Phase 0 skipped deliberately.** The plan calls it optional and recommends it "given
the size of the change". The reason to skip it here is that the direction is not in
question — REDESIGN.md already settled the concept, the palette, the family and the
section order with the user. A mockup canvas would re-decide things that are decided
and would be reviewed against the running app anyway. Review happens in `pnpm dev`.

## Log

### Phase 1 — token foundation

**The type scale now exists as tokens.** `design.md` §3.4 specified one in 2025 and
nothing ever encoded it, so the app shipped Tailwind defaults plus hand-written
`clamp()` arbitrary values in eleven files. `globals.css` declares `--type-*` and
exports them through `@theme inline` as the `--text-*` namespace, which makes them
real utilities: `text-display-1`, `text-body-l`, `text-micro`. Each carries its own
line-height and tracking, so a heading is one class instead of four.

Tailwind emits them as `line-height: var(--tw-leading, 1)`, which means an explicit
`leading-*` or `tracking-*` still wins where a call site genuinely needs one. Verified
by compiling `globals.css` through `@tailwindcss/postcss` against a probe file and
reading the emitted rules — `text-display-1`, `text-micro`, `max-w-measure`, `py-band`
and the rest all compile.

Also added: `--measure-sans` / `--measure-read` (as `max-w-measure` / `max-w-read`),
`--space-band` / `--space-band-tight` (as `py-band` / `py-band-tight`), and
`--elev-1` / `--elev-2`.

**Elevation is light, not shadow.** On a near-black stage a drop shadow has nothing to
be darker than. `--elev-*` is a 1px inset top highlight — `rgb(255 255 255 / 0.06)` on
dark, near-invisible on light, where Paper & Ink's chrome is flat and the document
keeps the only real shadow. `--shadow-card` stays `none`.

**`[data-stage="dark"]` is the hybrid.** It declares the complete semantic set, and the
values are `:root[data-theme="dark"]`'s **byte for byte**. That is the decision that
makes the whole thing cheap: §3.3's contrast verification and axe's dark-theme pass
already cover the stage, `opengraph-image.tsx` stays in lockstep for free, and no
component changes at all — `dark:` appears exactly once in the repository (the Google
sign-in button, for brand compliance), so theming really is 100% token swap.

The scope has two halves:

```css
[data-stage="dark"],
body:has(> [data-stage="dark"]) { … }
```

The `:has()` half is what carries the stage onto `<body>` and, by inheritance, onto the
sticky header — which is a sibling of `<main>` and cannot otherwise know what route it
is on. No client component, no pathname check, no first-paint flash. The **child**
combinator is load-bearing: `/examples` and `/guides` open with a dark band over a
light reading body, and a descendant selector would see that band and flip the page.

**Deviation from the plan.** It says "keep `.band-invert` as an alias until Phase 2
lands". It is left _unchanged_ instead, not aliased. `.band-invert` deliberately
_lifts_ in dark mode (`--surface-0: #202b27`) so the band stays a beat against an
already-dark page; aliasing it to the stage would have changed how the shipped landing
page looks in dark mode during a phase whose whole point is that it changes nothing
visible. It is deleted in Phase 2, when `page.tsx` stops using it.

**Fraunces → Instrument Serif.** One weight and an italic, so `.font-display` sets
`font-synthesis-weight: none`: a `font-semibold` on a single-weight serif does not
select a bolder cut, it asks the browser to smear the 400, and that is the most
reliable way to make an expensive display face look like a screenshot of itself. The
class also no longer sets `letter-spacing` — it sits after the utilities in source
order and was quietly beating every `tracking-*` in the app. Tracking belongs to the
size and the scale carries it.

**The 15 `font-display` call sites were swept**, because the font swap made them wrong
rather than merely inconsistent: Instrument Serif at 400 cannot hold a 24px section
head. Display 1 and 2 keep the serif (hero, page titles, closing band); Display 3 and
every section head moved to Geist 600.

### Verification

**Contrast, computed before shipping** — as the plan asks, and then pinned. The one-off
script became `src/app/palette.test.ts`, which parses the three palettes out of
`globals.css` and measures every foreground against every ground. All three pass: the
worst text pair is `--text-faint` at **4.92:1** on dark `--surface-2`, and the worst
light pair is `--accent` at **4.96:1** on `--canvas`. `--line-strong` clears the 3:1
that WCAG 1.4.11 asks of a field's boundary on both grounds a field is ever drawn on.

The test also asserts the stage palette is the dark palette value-for-value, which is
the claim the hybrid rests on and the one that would rot first.

`trust-signals.ts` needed its measured counts moved — 982 → 989 declarations,
1,868 → 1,904 cases — which is the tripwire working exactly as designed.

**Font payload, measured both ways** by building twice:

|                                 | preloaded woff2 |
| ------------------------------- | --------------: |
| Fraunces (3 axes, variable)     |       120,800 B |
| Instrument Serif (400 + italic) |        30,724 B |
| **whole preloaded set, before** |   **173,196 B** |
| **whole preloaded set, after**  |    **83,120 B** |

A 52% reduction, and the plan's "payload goes down" is confirmed rather than assumed.

`pnpm verify` green (1,904 unit tests). `next build` clean.

### Phase 2 — the landing page

`data-stage="dark"` on `<main>`, and the `:has()` half of the scope carries it onto
`<body>` and the sticky header. Nothing in the page knows it is on a dark ground, which
was the point of spending Phase 1 on the token scope.

**Section order**, as the plan specifies: hero, evidence, promises, how it works,
refusals, FAQ, close. Evidence is second because it is the substitute for social proof
this page is not allowed to have.

**The evidence bento** (`EvidenceBento.tsx`) replaces the ledger. Six unequal tiles,
because the claims are unequal — the lead tile is 4 of 6 columns and 2 rows and carries
a live readout, the test count is a `stat` tile with the number set at display size, the
rest are standard. Still `<ul>`/`<li>`; the grid is on the list and the spans on the
items.

`TrustSignal` gained `tile` and `stat`. `stat.value` is duplicated out of `claim` rather
than parsed from it, and the test asserts `claim` still contains it, so the large number
and the sentence a screen reader gets cannot drift apart.

**The readout is computed, not written.** `sampleReadout()` in `PaperSample.tsx` counts
columns, images, headings, entries, bullets, date ranges and recovered lines out of the
same `SAMPLE` object the hero's page and recovered-text pane are both built from, and
the tile is labelled `x-ray · the sample resume on this page`. A made-up scorecard in
the one section headed "things you can check for yourself" would have been the worst
thing on the site.

**The refusals got the weight design.md always wanted.** They were the fine print of a
sidebar card; they are now `text-title` statements on their own rules across the
reading measure, struck one at a time as they arrive. `RefusalList` grew `className` /
`itemClassName` for it.

**The FAQ is new** — eight questions written against real search intent, in
`src/lib/faq.ts`, rendered as `<details>`/`<summary>` with the question as an `<h3>`
inside the summary. No client component and no ARIA written by hand: the browser does
disclosure, keyboard and announcement correctly, and the section is in the HTML for a
crawler that runs nothing. `faqPageJsonLd()` emits `FAQPage` markup **from the same
array**, so the markup cannot describe answers the page does not contain.

`faq.test.ts` screens the copy with `examples.test.ts`'s D14 scan and its refusal escape
hatch, bounds each answer to one paragraph (45–160 words), and asserts the JSON-LD
matches the array entry for entry.

**The sticky CTA** (`StickyCta.tsx`) appears once `#hero` leaves the viewport — one
`IntersectionObserver` on one element, not a scroll listener. Dismissible, no focus
trap, respects `showsPrimaryCta()`, `y` + `clipPath` rather than opacity, carries
`data-build`. The footer takes `pb-28` unconditionally rather than toggling with the
bar: padding that appears and disappears as you scroll past it is a worse artifact than
a little space under the legal links.

**Primitives extracted** (the plan lists these under Phase 3; they were needed here):
`Section` (two rhythms from the token scale, optional top-edge wash, optional stage),
`Eyebrow`, `EvidenceBento`, `Faq`, `StickyCta`. `StatTile`/`BentoTile` did not become
separate files — the three tile shapes are twelve lines of one component and splitting
them would have been indirection rather than structure.

`Eyebrow` needs a word of defence, because design.md §3.6 deleted the landing page's
eyebrows and was right to. This one is monospace, and monospace means exactly one thing
in this app: _a machine produced this_. It is only ever a readout label — `recovered
text`, `x-ray` — never a kicker repeating the heading under it. It is also not
`aria-hidden`, because it carries real information.

**`.band-invert` is gone.** `page.tsx` was its only user. The comments in
`globals.test.ts` and `opengraph-image.test.ts` that named it were updated in the same
change.

### Two real bugs found by looking at the rendered page

**`cn()` could not merge the new type scale.** `tailwind-merge` decides whether
`text-foo` is a size or a colour by looking `foo` up in Tailwind's default scale. Add a
font size called `title` and `text-title` is filed as a _colour_, so it no longer
conflicts with a component's own `text-small`, both survive, and the winner is whichever
Tailwind happened to emit last. It had already shipped: the refusals' `text-title`
override was silently doing nothing.

Fixed in `src/lib/utils.ts` with `extendTailwindMerge` and the scale declared once, and
pinned by `src/lib/utils.test.ts`. This is the kind of failure worth the test — no
error, no warning, and a component prop that simply does not work.

**A dark hover state that failed AA, shipped.** `.card-tinted:hover` mixed 15% accent
into `--surface-0` in both themes, and the same percentage does very different things in
each: pine into near-white barely moves luminance, mint into near-black moves it a long
way. The hovered card put `--text-faint` at **3.78:1** — and `.strike-in[data-struck]`
paints the refusals in exactly that colour, on exactly that card.

The fix is per-theme tint tokens (`--tint-rest` / `--tint-hover` / `--tint-wash`), tuned
so the _perceived_ lift matches rather than the number: 7/12/8 light, 5/8/7 dark. Light
had to come down too — 15/10 put `--accent` on its own tinted card at 4.47:1, which is
the same bug from the other side.

`--text-faint` on dark also moved `#8a968f` → `#909c95`.

### Verification

`palette.test.ts` grew a second half that measures **tinted grounds at the worst point
of their wash**, which is what the plan's gate 2 asks for. It parses each
`background-color: color-mix(in oklab, …)` rule out of the stylesheet, resolves the
share (which may itself be a token), does the mix in OKLab the way a browser does,
composites `backdrop-filter` surfaces over every extreme they can sit on — including the
white page that scrolls under the header on `/builder` — and lays the gradient's
strongest stop over the result. A rule that paints a tinted ground and is not in its list
fails the test rather than shipping unmeasured.

Screenshots at 1440 and 390 in both themes, read rather than glanced at. `pnpm verify`
green (1,925 tests).

### Phase 3 — the marketing shell and the remaining public routes

**Two stage treatments, and which route gets which is a decision about
reading.** `/`, `/templates`, `/check` and `/pricing` put `data-stage="dark"` on
their own `<main>`, so the whole page — and, through the `:has()` half of the
scope, `<body>` and the sticky header — is the stage. `/examples`, `/guides`,
`/examples/[role]` and `/guides/[slug]` take `<PageHeader stage>` instead: a
dark masthead over a Paper & Ink body. Those four are the pages a stranger
reaches from a search, and long-form reading on near-black is a real
comprehension cost. It is the exception the plan asks for, and the child
combinator in the scope is what makes it possible — a nested band cannot flip
the page it is on.

`/templates` is the best argument for the whole direction: twelve renders of
white paper on near-black stop being thumbnails and become twelve lit documents
on a workbench.

**The header is proper glass now.** `bg-surface-0/85` became `.glass` at 92%.
The extra 7% is not taste: what scrolls under this bar on `/builder` is a sheet
of white paper, and at 85% enough of it comes through to lift the ground under
`--text-faint` below AA. `palette.test.ts` measures the 92% composite against
every ground it can meet, the white page included.

The hairline deepens on scroll through a **scroll-driven CSS animation**
(`animation-timeline: scroll(root block)`) rather than a scroll listener — no
client component, nothing added to the builder's bundle. It starts at the
current appearance and strengthens, never the reverse, because `/builder`'s
document does not scroll and a rule that began transparent would leave that
route with no header boundary at all. Browsers without scroll timelines get the
resting state, which is the header exactly as it shipped.

**The two out-of-sync routes are on the system.** `/guides/[slug]` and
`/examples/[role]` hand-rolled a heading row inside `<main>`, a
`bg-accent rounded-md px-5 py-3` anchor, and `underline underline-offset-2` —
they never received the previous redesign. They now use `PageHeader`, `CtaLink`
and `.rule-grow` like everything else.

**`/check` got the drop zone the plan asked for.** It was a dashed grey
rectangle with an icon in it; it is now the parser's own surface — slate
ground, slate border, slate light under the pointer, the icon in a lit disc,
the accepted formats stated in the machine's face. `data-dragging` drives the
active state so the border, the ground and the disc all answer one attribute.

**`/privacy` and `/terms` got the canonicals they never had.** They were
inheriting `alternates: { canonical: "/" }` from the root layout, which tells a
crawler the privacy page _is_ the home page. Invisible from inside the app, and
an SEO bug.

**`/not-found` adopts the band. `/error` deliberately does not** — it is the
boundary that catches a render failure, and `PageHeader` mounts
`MotionProvider`, the ambient field and four client components. If the thing
that threw were in that tree, the error page would throw too and the visitor
would get Next's stock screen instead of the one sentence that matters. It
takes the type tokens and the shared button classes and stops there.

### Two more real bugs, both found by opening the pages

**The 404 page was rendering the error boundary.** `not-found.tsx` is a server
component and `buttonClassName` lived in `control.tsx`, which is `"use
client"`. React does not warn about that — it throws. So the page whose entire
job is to say calmly that a link was wrong was saying "Something went wrong".

Fixed by extracting the pure styling into `src/components/ui/button-style.ts`,
which is not a client module; `control.tsx` re-exports it so the existing
imports are untouched.

**Component classes were beating every utility.** Tailwind v4 declares
`@layer theme, base, components, utilities`, and an _unlayered_ rule beats all
four. `.machine-panel` at the top level of `globals.css` won against
`border-machine/45` on the same element no matter what order the classes came
in — the same trap `.font-display` fell into with `letter-spacing` in Phase 1.
`.card-tinted`, `.card-tinted:hover`, `.machine-panel` and `.glass` moved into
`@layer components`, which is the layer where a utility can win. Everything
else in the file stays unlayered because it is a pseudo-element, a transition
or a keyframe, none of which a utility competes with.

### Phase 4 — conversion surfaces

**`/pricing` is new, and nothing on it is purchasable.** There is no billing
code in this repository, so the Pass card carries a statement rather than a
button: _"There is no checkout here yet. Nothing is being taken."_ A disabled
control that looks like a buy button still tells a reader that buying is a
thing they nearly did, and a site whose whole position is "check this
yourself" cannot do that once.

The page leads with what is free and **why it stays free**, linking D13 as a
dated decision rather than a promise on a marketing page. It closes with
"Things this will never do to you" — the pricing patterns this category
actually uses, struck out, the first of which the largest operator in it is in
court over.

`src/lib/pricing.ts` holds the tiers and the refusals; `pricing.test.ts`
screens the copy for D14 claims, asserts a free tier exists, asserts **no
export format ever appears as a paid feature** (D13 as a test), and pins the
figure against the structured data.

**The structured data gained a second `Offer` — as a `PreOrder`.** The free
offer keeps `price: "0"` and `InStock` because that is true permanently. The
Pass is marked `PreOrder` because it cannot be bought, and saying otherwise to
a crawler is the same lie as saying it to a person. `structured-data.test.ts`
now asserts that directly; the day checkout ships, both change together or it
fails.

**The false trust signal is corrected.** The row claimed "Optional AI
enhancement runs on your device" under a heading promising everything below it
is checkable — and the feature is built and _switched off_, so a stranger who
checked would have found the opposite. It now says what actually happened: four
small models, measured in a real browser, one of which turned a six-minute
pipeline into a six-hour one and passed the guardrail because both digits were
in the evidence. Nobody else in this category publishes a negative result about
their own AI feature.

`trust-signals.test.ts` gained the gate that belongs beside it: **every
evidence link must resolve** — in-app links against the route directory,
repository links against the working tree. `repoFileUrl` now encodes path
segments, because one of those files is `docs/enhance feature.md`.

`/pricing` is in `HEADER_LINKS` (last, deliberately — a bar that opens with
"Pricing" contradicts the page's argument before it is read), in the footer's
About column, in `sitemap.ts` at 0.8, and in the axe sweep in both themes.

### Phase 5 — app surfaces

Identity unchanged, production value raised, and **no Motion entered any of
these bundles**.

`card.tsx` swapped `--shadow-card` (which is `none`) for `--elev-1`: the rule
that chrome is flat is kept, and the card gets back the one thing a hairline
rectangle lacks — a lit top edge. `control.tsx`'s fields moved off Tailwind's
`shadow-sm`, a raw grey blur from outside the palette that did nothing at all
on a dark ground, onto `--elev-2`. `tabs.tsx`'s selected tab did the same.
`dialog.tsx` moved from `shadow-lg` to `--shadow-pop`, the token actually
computed for the two things in this app that float. `empty.tsx` got the icon in
a lit disc and its type on the scale — an empty state is the first thing a new
account sees, and the difference between "unfinished" and "waiting for you" is
almost entirely whether anything in it looks built.

**The builder, to the letter of the plan's rules: CSS and token-level only, no
markup and no accessible-name changes.** Every edit is a class string. The
mobile Edit/Preview switch became `.glass`; the step rail gained
`--elev-1`, so the recessed ground reads as a surface rather than a darker
rectangle; and the three places the builder _reports a measurement_ — the
section count, the page count, the live preview status — moved into the
machine's face at the machine's size, which is the rule the rest of the app
already followed everywhere except here. X-Ray's scorecard now sits on
`.machine-panel`, the same slate surface as the hero's recovered-text pane and
`/check`'s drop zone.

`palette.test.ts` grew a third section for the `--*-weak` grounds, which the
matrix had never looked at because they are not chrome surfaces — but a badge
is `bg-ok-weak text-ok`, a callout is `bg-accent-weak`, and X-Ray's table
header is now `bg-machine-weak`. All five pairs pass in all three palettes.

### Phase 6 — the responsive and reduced-motion sweep

Run rather than eyeballed, and the harness is committed as `pnpm qa:sweep` so it stays
runnable. Three checks:

1. **Horizontal overflow** at 390, 768, 1024 and 1440 across thirteen routes in both
   themes — 104 page loads. It reports the widest offending element rather than a
   number, because "1447 > 1440" says nothing about what to fix. **Clean.**
2. **`prefers-reduced-motion` delivers the finished page.** Every `[data-build]`
   element is checked for a surviving clip, translate, blur or fade. On `/` that is
   70 elements, 0 still hidden, the headline at its full 252px and all seven sections
   present. **Clean.**
3. **The marketing routes render their text with scripting off** — 7,659 visible
   characters on `/`, which is the FAQ and everything else in the HTML. **Clean.**

### A third real bug: Motion reached the builder's bundle

This is the one the sweep did not find and a bundle diff did.

Next renders the root `not-found.tsx` **inside the root layout**, which puts it in the
client component graph of _every route under that layout_ — `/builder` included. So
Phase 3's perfectly reasonable "the 404 should open with the shared band" put Motion's
152 kB chunk on the builder's critical path, violating the plan's hard gate
_"Motion must not enter the builder bundle"_.

Nothing about the import looks wrong. It was found by listing the chunks `/` and
`/builder` each request and scanning them for Motion's own strings.

The fix is a split that should have existed anyway: **`Band`** is the section, the
wash and the container, as a _server_ component; **`PageHeader`** is `Band` plus
`MotionProvider`, the ambient field and the `BuildGroup`. `/not-found` uses `Band`.

|                       |   before |        after |
| --------------------- | -------: | -----------: |
| `/builder` initial JS | 3,557 kB | **3,404 kB** |

Confirmed by re-scanning: the only remaining Motion-marker hit on `/builder` is a
single `skewY` inside react-pdf's transform parser, which has none of Motion's other
symbols in it.

And a fourth, found by auditing gate 4 rather than by a failure: **the hero's
recovered-text lines had no `data-build`.** Motion writes `initial` as an inline style
during _server_ rendering, so all fourteen lines arrived clipped to nothing, and with
scripting off nothing ever unclipped them — the parser's pane, which the whole hero is
an argument about, was an empty rectangle. `build-escape.test.ts` now scans the source
for any `m.*` element that arrives hidden without the attribute, and asserts both rules
that read it still exist.

### Phase 7 — design.md amended

Five amendments, each dated and placed beside what it changes rather than appended:

- **§1** gains a fifth requirement ("look expensive") and lifts two implied
  prohibitions — gradients as light falling on a surface, blur for things that
  genuinely float — with the conditions that make them safe.
- **§3.1** gains the stage: the concept's second half, finally spent, with the scope
  that implements it and the two reading exceptions.
- **§3.2** records what was added (`--elev-*`, `--paper-glow`, `--tint-*`) and the one
  correction (`--text-faint` on dark).
- **§3.3** is demoted from source of truth to historical record, with a note on what
  `palette.test.ts` measures that the table never did — and the two live failures it
  found on its first run.
- **§3.4** records Instrument Serif, the single-weight constraint that decides where
  it is allowed, the payload drop, and the fact that the scale finally exists as
  tokens — plus the two traps that came with that.
- **§3.6** records the shipped seven-band structure.
- **§7** gains seven new binding rules (10–16), each one having cost a debugging
  session during this work.

### Completion pass — auditing the plan's checklist against the tree

Asked whether the implementation was finished, the useful answer came from grepping
the tree for the patterns each phase said to remove rather than from re-reading the
log. Three things were still outstanding:

**Four `underline underline-offset-2` links survived** on `/privacy`, `/signin` and
`/signin/check-email` ×2 — exactly the pattern Phase 3 names. They are
`text-accent rule-grow` now, which is the system's inline link: the accent
distinguishes it in prose and the rule that grows on hover and focus is the
non-colour cue WCAG 1.4.1 asks for.

**Four `text-sm` survived** on `/dashboard` and `/letters`. Three of them turned out
to be hand-rolled _button_ classes re-typing what `buttonClassName` already says —
unfixable from a server component until Phase 3 split `button-style.ts` out of
`control.tsx`, and simply wrong afterwards. They are `buttonClassName()` now; the
accessible names are untouched, which `auth.spec.ts` matches by exact string.

(The first audit of this over-reported: `grep 'text-sm'` matches inside `text-small`.
The real count was four, not thirty-one.)

**`/signin` and `/signin/check-email` had not adopted the band**, which Phase 3 lists.
Built, looked at, and **reverted** — the one deviation in this pass, and the reasoning
is recorded in the file rather than only here:

`Band` is a masthead, for a page you read. These two are the only routes in the app
that are a single task with no content — one field, one button — and a full-width
masthead above that pushes the action down the page on the surface where account
creation happens, which `docs/MONETISATION.md` names as the only conversion event this
product currently has. The band version also misaligned its container against the form
below it. What the bullet actually asks for is to stop _hand-rolling_ the header
treatment, and that is done: both pages use `PAGE_TITLE_CLASS` and `PAGE_LEAD_CLASS`,
the same classes `Band` sets, so the heading cannot drift from the rest of the site —
only its container differs. `/error` keeps its own exemption for a different and
technical reason.

After this pass, no route named in Phases 2–5 contains an off-scale `text-*` size or a
hand-rolled underline.

## Verification, in full

Everything below was run against the production build, not the dev server.

**`pnpm verify`** — 1,951 unit tests, typecheck and lint green.

**`pnpm test:e2e --workers 3`** — 95 passed, up from 93 (the two new `/pricing` axe
scans). Includes axe in both themes on `/`, `/signin`, `/builder` ×2, `/privacy`,
`/terms`, `/pricing`, plus `/examples`, `/examples/registered-nurse`, `/guides`,
`/guides/what-an-ats-actually-does`, `/templates` and `/check` in their own specs.

**Contrast** — `palette.test.ts`, computed from `globals.css`: three palettes, every
foreground against every ground, every tinted ground at the worst point of its wash,
every `backdrop-filter` surface over every extreme it can meet, and all five
`--*-weak` grounds. Worst pair anywhere: **4.61:1**.

**`pnpm qa:sweep`** — clean on all three checks.

**`pnpm qa:budget`** — Fast 4G + 4× CPU throttle, production build:

|                                                | measured |     budget |
| ---------------------------------------------- | -------: | ---------: |
| interactive (first field focusable)            | 2,826 ms | < 3,000 ms |
| keystroke latency, p95                         |    40 ms |    < 50 ms |
| preview render, warm, less the 400 ms debounce |   272 ms |   < 400 ms |

The debounce is subtracted and read from `usePdfPreview.ts` rather than retyped: it is
a deliberate wait so typing a word does not queue eight renders, and counting it as
latency would be measuring our own patience. The render is measured off the canvas
**pixels** — hashing a strip of the painted page and waiting for the hash to change —
because two earlier attempts (watching for a `src` change, then watching the toolbar's
live region) both silently measured nothing and would have reported a pass on a render
that never happened.

**Bundle** — per-route initial JS, uncompressed:

| route                  | chunks |       JS |
| ---------------------- | -----: | -------: |
| `/`                    |     15 |   775 kB |
| `/pricing`             |     15 |   759 kB |
| `/examples`, `/guides` |     15 |   757 kB |
| `/check`               |     19 | 1,711 kB |
| `/templates`           |     20 | 2,858 kB |
| `/builder`             |     23 | 3,404 kB |

Font payload fell from 173,196 B to 83,120 B.

**Visual** — every route read at 1440 and 390 in both themes, as rendered pages rather
than as diffs.

## Not done here

**Lighthouse ≥ 90 against `sixseconds.tech`.** The plan is explicit that this must be
measured against the deployed site rather than localhost, and the deployed site is
running `master` — none of this work is on it. It stays open until after a deploy, and
it is the same blocker (B5/B7) that was deferred for the same reason.
