# Design

> The visual and interaction plan for the redesign. **Direction: Paper & Ink.**
>
> This document is the design counterpart to `docs/IMPLEMENTATION.md`. That file
> owns what is built and what binds it; this one owns what it looks like and how
> it moves. Where the two disagree about a constraint, `IMPLEMENTATION.md` wins —
> §2.3 in particular, because a redesign that breaks a role-and-label selector has
> regressed the accessible structure, and the test is right.
>
> **Written:** 2026-09-03 · **Status:** Phase 0–1 building, 2–6 planned.

---

## 1. The brief

**What this is.** A resume builder whose entire differentiator is honesty: downloads
are free forever, nothing is uploaded unless you ask, no model writes a word for you,
and — the wedge — it re-parses the file it just made and shows you what a machine
actually recovered from it.

**Who it is for.** Someone applying for jobs, usually anxious, usually mid-application,
often on a phone. They have been burned by a builder that paywalled the download at
the last step. They are not shopping for software; they want the document and they
want to trust it.

**What the design must do.**

1. Make the document the hero. It is the thing being made, and it is the only
   genuinely beautiful object in the product.
2. Feel calm. This is a stressful task. The interface should lower the temperature,
   not raise it.
3. Look like it is telling the truth. The competitors in this category all use
   urgency, badges, scores and "ATS-optimized!" gradients. Looking like them
   undercuts the one thing we have.
4. Never get in the way of typing. The performance budget in §2.2 of
   `IMPLEMENTATION.md` is binding and it is stricter than the design.

---

## 2. What is wrong with the current UI

Not opinion — this is from screenshots of the running app at 1400px and 390px.

### The landing page is six identical bands

Every section is `border-b px-6 py-16` with a tracked-out uppercase label and a grid
of identical `Card`s. Same radius, same hairline, same near-invisible shadow, same
rhythm, six times. The eye gets no hierarchy and no rest, so a page that says careful,
considered things reads as a list of boxes.

### Nothing is the hero

The most compelling thing this product does — showing the recovered text beside the
document — is section four of six, rendered at about 240px wide. The hero above it is
a paragraph and a small button.

### The builder's form grid is visibly broken

In the two-column contact grid, help text sits **between** the label and the input.
Fields whose help text is a different number of lines put their inputs at different
heights, so "Full name" and "Email" inputs do not share a baseline. The grid looks
misaligned because it is.

### Inputs are nearly invisible

`--line-strong: #d4d4d8` on a white field is **1.5:1**. WCAG 1.4.11 asks 3:1 for the
boundary of an interactive component. The fields read as faint rectangles, which is
why the form looks unfinished.

### The preview's empty state is a blank white rectangle

Half the screen, on first load, is nothing. No skeleton, no ghost, no invitation.

### `SectionManager` uses raw browser checkboxes

Bright system blue against a sky-and-zinc palette — the one place the app looks
unstyled, and it is in the primary workspace.

### The mobile navigation is unreachable

`AppHeader.tsx:53` sets `overflow-hidden` on the nav to protect the builder's height
contract. At 390px that does not collapse the links into a menu — it **clips them**.
Builder, Templates, Examples and Check simply cannot be reached on a phone. This is a
navigation failure, not a cosmetic one.

### Copy bug

`PreviewPane.tsx:141` renders `` `${pageCount} pages` `` — a one-page resume reads
"1 pages".

### Everything is one typeface at three sizes

Geist at 14/16/36px, weight 400/500/600. Nothing carries personality, so nothing is
memorable.

### 187 classes bypass the token system

`globals.css` promises the accent is "a one-line change", and it is not: **166 raw
`zinc-*` classes across 15 files and 21 `sky-*`** never went through a token. They were
invisible while the tokens held the same zinc-and-sky values. Repointing the palette
made them visible — `zinc` is a cool neutral against a green-cast ground, and `sky` is
the accent the app no longer has.

Two of them were also an accessibility bug. `text-zinc-500 dark:text-zinc-400` on
`SyncStatus` and nine siblings measured **4.36:1** — under AA, and under it on the old
palette too, at 4.46:1. Fixed in Phase 0 by pointing them at `--text-faint`. The
remaining ~175 are Phase 2 work and are listed there.

---

## 3. Pass one — the design plan

### 3.1 The concept: warmth is earned by the document

The codebase already has the right idea and does not yet spend it. `globals.css`
distinguishes **paper** (the resume page, `#ffffff`, theme-invariant, because a
recruiter will never see an inverted one) from **chrome** (everything else). Today
both are near-white, so the distinction is invisible.

The redesign makes that split the whole design language:

> **Chrome is a cool, matte workbench. The document is the only warm, lit object on
> the screen.** Warmth, shadow and white are reserved for paper and never spent on
> chrome.

This is worth stating as a rule because it decides a hundred small questions. Cards
get hairlines, not shadows — the page gets the only real shadow in the app. Chrome
greys are cooled slightly green so the paper's warm white separates from them by
temperature as well as by value. When the eye is drawn anywhere, it is drawn to the
document.

The second half of the concept comes from the product's actual wedge. There are two
readers of a resume: a person, who sees typography and layout, and a machine, which
recovers plain text. The product exists in the gap between them — so the interface
gives the machine its own voice:

> **Monospace means "this is what the machine recovered."** Never a UI label, never a
> stylistic choice. `Geist Mono` appears only where extracted text, parser output or
> X-Ray findings appear.

That turns a generic decorative habit into a semantic device: anywhere you see
monospace in this app, you are looking at evidence rather than at our words.

### 3.2 Color

Six named values carry the system; the rest derive from them. **Every pair below was
computed, not eyeballed** — the ratios are in §3.3.

**Light**

| Token           | Value     | Role                                                     |
| --------------- | --------- | -------------------------------------------------------- |
| `--surface-1`   | `#F2F4F2` | The workbench. App ground, cool green-grey.              |
| `--surface-0`   | `#FBFCFB` | Raised chrome: cards, inputs, header.                    |
| `--surface-2`   | `#E7EAE7` | Recessed wells, hover, the step rail.                    |
| `--canvas`      | `#E6E5E1` | The ground the page floats on. Warmer than chrome.       |
| `--paper`       | `#FFFFFF` | The document. **Theme-invariant. Never changes.**        |
| `--text`        | `#16211D` | Ink — near-black with a green cast, not a neutral black. |
| `--accent`      | `#2F6B57` | Pine. Actions, active state, focus.                      |
| `--machine`     | `#3B5A78` | Slate. The parser's voice: X-Ray, `/check`, recovery.    |

**Dark** — chrome drops to a deep graphite-green; paper stays white and now genuinely
glows, which is the payoff for having kept it invariant.

| Token         | Value     |
| ------------- | --------- |
| `--surface-1` | `#0E1311` |
| `--surface-0` | `#161C19` |
| `--surface-2` | `#202824` |
| `--canvas`    | `#0A0F0D` |
| `--text`      | `#ECEFEC` |
| `--accent`    | `#6FCFA8` |
| `--machine`   | `#8FB6DA` |

`--machine` is a new token and the only addition to the semantic set. It earns its
place: "what a person reads" and "what a parser read" are different claims with
different reliability, and the product's credibility depends on never letting them
blur. They should not share a color.

### 3.3 Contrast, verified

Computed with the WCAG relative-luminance formula against all four chrome grounds.
Worst case shown; AA body text needs 4.5, non-text boundaries need 3.0.

| Pair                             | Worst | Floor |     |
| -------------------------------- | ----: | ----: | --- |
| `--text` on chrome               | 13.12 |   4.5 | ✓   |
| `--text-muted` `#4A5750`         |  6.01 |   4.5 | ✓   |
| `--text-faint` `#55635D`         |  5.00 |   4.5 | ✓   |
| `--accent` `#2F6B57`             |  4.96 |   4.5 | ✓   |
| `--machine` `#3B5A78`            |  5.71 |   4.5 | ✓   |
| `--ok` `#1A6B4A`                 |  5.13 |   4.5 | ✓   |
| white on `--accent` (buttons)    |  6.25 |   4.5 | ✓   |
| `--line-strong` `#7A887F` border |  3.36 |   3.0 | ✓   |
| dark: all foregrounds on chrome  |  4.92 |   4.5 | ✓   |
| dark: `#5E7166` border           |  3.32 |   3.0 | ✓   |

Two values had to move off their first draft to get here: `--text-faint` from
`#66736C` (3.93 on canvas — fails) and `--ok` from `#1F7A55` (4.19 — fails). The
input border went from the inherited 1.5:1 to 3.36:1, which is the single change that
most improves how finished the form looks.

`e2e/a11y.spec.ts` runs axe in both themes on every route and blocks on serious and
critical findings. It is the regression net for all of the above.

### 3.4 Type

**One new family.** Geist Sans and Geist Mono are already loaded and are competent;
replacing them buys nothing. What is missing is a voice.

| Face                | Role                                                       |
| ------------------- | ---------------------------------------------------------- |
| **Fraunces**        | Display. Marketing and reading surfaces only.               |
| **Geist Sans**      | Every interface: forms, nav, buttons, the whole builder.    |
| **Geist Mono**      | The machine's voice. Recovered text and parser output only. |

Fraunces is a variable serif with `SOFT` and `WONK` axes, set here soft and slightly
wonky rather than tight and high-contrast — warm and humanist, not fashion-editorial.

It is deliberately **absent from the builder**. The split is semantic: serif marks
surfaces you read, sans marks surfaces you work in. Crossing into the builder would
also risk competing with the resume's own faces, since the templates ship EB Garamond
and Tinos and the paper must always be the most typographically interesting thing on
screen.

**Scale** — a major third (1.25) for interface sizes, wider jumps for display.

| Step      |    Size | Line |    Face | Use                       |
| --------- | ------: | ---: | ------: | ------------------------- |
| Display 1 |    68px | 1.02 | Fraunces | Hero, once per site      |
| Display 2 |    48px | 1.08 | Fraunces | Page titles              |
| Display 3 |    32px | 1.15 | Fraunces | Section heads            |
| Title     |    22px |  1.3 |   Geist | Card and panel titles     |
| Body L    |    18px | 1.65 |   Geist | Lead paragraphs           |
| Body      |    15px |  1.6 |   Geist | Default                   |
| Small     |    13px |  1.5 |   Geist | Help text, meta           |
| Micro     |    11px |  1.4 |    Mono | Recovered text, evidence  |

Measure caps at **68ch** for sans body and 74ch for serif. Display sizes clamp down
fluidly on small viewports; 68px never reaches a phone.

### 3.5 Layout

**Alignment: left, throughout.** Centered column layouts are the reflex for a marketing
page, and they are wrong here — a resume is a left-aligned document, the builder is a
left-aligned form, and the site should not switch reading habits between them. The one
exception is the hero's document, which is optically centered in its own field.

**Three grounds, spatially distinct.** The builder's rail, form and preview currently
sit on one continuous near-white plane. They separate by depth instead:

```
┌────────────────────────────────────────────────────────────────────┐
│  header — surface-0, hairline under                                │
├──────────────┬───────────────────────────────┬─────────────────────┤
│              │                               │                     │
│   RAIL       │   WORKSPACE                   │   CANVAS            │
│   surface-2  │   surface-1                   │   canvas (darker)   │
│   recessed   │   the form                    │   ┌───────────┐     │
│              │                               │   │           │     │
│  ● Contact   │   Full name                   │   │  paper    │     │
│  ○ Summary   │   [_____________________]     │   │  white +  │     │
│  ○ Experience│   Exactly as you want it read │   │  the only │     │
│  ○ Education │                               │   │  shadow   │     │
│              │   Email                       │   │  in the   │     │
│  ──────────  │   [_____________________]     │   │  app      │     │
│  3 issues    │                               │   │           │     │
│              │                               │   └───────────┘     │
└──────────────┴───────────────────────────────┴─────────────────────┘
     recessed            working                    the document
```

**The form grid, fixed.** Label → input → help text. Help text moves *below* the
field, so every input in a row shares a baseline regardless of how long its hint is.
This is the single highest-value layout fix in the redesign.

```
  before (broken)                     after
  ┌ Full name ─────┐ ┌ Email ──┐      ┌ Full name ─┐ ┌ Email ─────┐
  │ Exactly as you │ │         │      │ [________] │ │ [________] │
  │ want it read.  │ │[______] │      │ Exactly as │ │            │
  │ One field,     │ │         │      │ you want   │ │            │
  │ because names… │ │         │      │ it read.   │ │            │
  │ [___________]  │ │         │      └────────────┘ └────────────┘
  └────────────────┘ └─────────┘       inputs share a baseline
   inputs at different heights
```

**Vertical rhythm on marketing pages varies by weight.** Not `py-16` six times. The
hero gets air; the ledger of checkable claims is dense on purpose, because density is
what a ledger looks like.

### 3.6 The landing page

The hero is the redesign's one bold move, and it is the product's actual thesis
rather than a decoration: **the document, and what the machine read from it, side by
side, deriving from one object.** `PaperSample` already exposes exactly this — it
renders the page and `sampleAsPlainText()` returns the recovered text, so the two can
never drift into promising a parse the structure would not produce.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▪ ATS Resume Builder      Build  Templates  Examples  Check    ◐  ⟶ │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   A resume builder that            ┌──────────┐   ┌ recovered ─────┐ │
│   does not hold your               │ Priya R. │   │ Priya Raghu…   │ │
│   resume hostage                   │ ▬▬▬▬▬▬▬▬ │   │ priya@ex.com   │ │
│   ── Fraunces 68/1.02              │          │   │                │ │
│                                    │ EXPERIENCE│  │ EXPERIENCE     │ │
│   Build it, download all three     │ ▬▬▬ ▬▬▬  │══▶│ Senior Platform│ │
│   formats free, and keep every     │ ▬▬▬▬▬▬▬  │   │ Engineer       │ │
│   word. Nothing is uploaded        │ ▬▬ ▬▬▬▬  │   │ Mar 2022 – …   │ │
│   unless you ask.                  │          │   │                │ │
│                                    │ EDUCATION│   │ EDUCATION      │ │
│   ▐ Start building ▌  no signup    │ ▬▬▬▬▬▬▬  │   │ BE, Computer…  │ │
│                                    └──────────┘   └────────────────┘ │
│                                     what a person   what a machine   │
│                                     reads           recovered        │
└──────────────────────────────────────────────────────────────────────┘
```

One orchestrated moment on load, and only one on the whole page: a read-line sweeps
the document once, and the recovered column fills in behind it. It runs for about
900ms, once, never loops, and is skipped entirely under `prefers-reduced-motion`,
where both panes are simply present. It is not decoration — it is the claim, performed.

Below the hero, the card grid goes away:

- **The promises** become four statements at Body L on the open ground, separated by
  hairlines. No boxes. What made them cards was habit.
- **How it works** stays numbered, because three steps in order genuinely are a
  sequence — the one case where numbered markers carry information.
- **Things you can check for yourself** becomes a **ledger**: claim left, how to verify
  right, hairline between rows, the verification set in mono because it is evidence.
  A ledger is what an auditable claim looks like, and the structure now says so.
- **What we will not tell you** gets real weight and the refusals are set as struck
  clauses — the visual form of something removed. It is the most distinctive copy on
  the site and currently the quietest thing on the page.

---

## 4. Pass two — critique against the brief

The `frontend-design` skill names the traits that AI-generated design currently
clusters around. Three of them describe either my first draft or the code as it
stands today. Working through them honestly:

**"A warm cream background with a high-contrast serif display."** My first draft was
bone `#FAF7F2` with Fraunces — squarely this. **Changed.** The chrome is now a cool
green-grey workbench and the warm ground is confined to `--canvas`, the field the
document floats on. That is not a stylistic retreat: it comes from the two-ground rule
the codebase already had, and it makes the paper the warmest thing on screen instead
of one warm thing among many. Fraunces stays — the user's brief picked it — but set
soft and humanist, kept off every application surface, and paired with a green-cast
ink rather than the high-contrast black the cliché uses.

**"The SaaS-card kit: identical rounded cards, one radius, the same soft grey shadow
under each."** This is the current landing page exactly — ten cards, one `Card`
component, one radius, one shadow. **Changed.** Chrome loses its shadows entirely;
shadow becomes the exclusive signal for paper. Content that was carded becomes lists,
ledgers and open ground, and radius now varies by role rather than being 10px on
everything.

**"A tracked-out ALL-CAPS eyebrow label above every heading."** Four on the landing
page, plus `SECTIONS` and `ORDER & VISIBILITY` in the builder. **Changed.** They
become real headings at Display 3, or they are deleted — most of them were labelling
content that already announced itself.

**"A monospace face for small data labels."** Kept, but narrowed to the point where it
is no longer that trait: mono appears only for text a parser recovered. It is the
machine's voice, and it is used nowhere else.

**"Fade-and-slide-up entrances on each section."** The current `.anim-fade-up` is
applied per section. **Changed.** One orchestrated moment per page, at most. Sections
do not announce themselves as you scroll.

**Numbered markers.** Kept in "How it works" only, where the content is a real
sequence, and removed everywhere else they might have been reached for.

What survives this pass is the part that came from the subject rather than from
habit: paper against workbench, evidence in mono, and a hero that performs the
product's actual claim.

---

## 5. Motion

Using **Motion** (`motion`, v13.1.1 — motion.dev, formerly Framer Motion), imported
from `motion/react`, never from `framer-motion`.

### 5.0 Amendment: the marketing pages are live

**This supersedes the "one orchestrated moment per page" rule below, on marketing
surfaces only.** Phase 1 shipped that rule and it was judged running: honest, calm,
and inert. Six bands of hairline rules on one flat ground gave the eye nothing to
catch, and a page whose argument is *look at the evidence* cannot be the least
interesting thing a visitor sees that day.

The direction is now **live: the page builds itself.** Rules draw, statements are
uncovered, the "How it works" spine fills as you read past it, the refusals are struck
through one at a time, the document leans toward the pointer, and pointing at either
half of the hero lights the matching half of the other. One hard contrast beat — the
evidence ledger on the machine's own dark ground — gives the page its only change of
key, and it lands on the section that most deserves it.

Two things carry it beyond the landing page, and both are in §5.4.

**The ground moves.** One fixed field sits behind every marketing route: a hairline
grid that parallaxes against the scrollbar, a broad wash of light from overhead, three
slow lights drifting on three different periods, a glow that follows the pointer, and a
film of grain over all of it. It replaced a grid and a pair of auras *per section*,
which is how a page ends up with six atmospheres instead of one.

**Cards are lit rather than highlighted.** A card under the pointer gets a wash beneath
its content and a one-pixel border lit where the pointer is near it; its neighbours are
lit in proportion to how close the pointer is to *their* edges. Twelve independent
hover states read as twelve buttons. One light moving across twelve cards reads as a
surface, and that difference is the whole of it.

Three rules keep that from becoming the usual scroll-jacked marketing page, and each
one is enforced by something other than taste:

1. **Nothing fades text.** Every reveal is a `clip-path`, a translate or a blur.
   `e2e/a11y.spec.ts` runs axe over `/` in both themes and scores contrast on whatever
   it catches mid-flight; text at 40% opacity is a build failure, and that suite has
   already flaked once on exactly this. Clip, translate and blur are invisible to a
   contrast check and run on the compositor. Verified: axe finds zero blocking
   violations on `/` in both themes, both at first paint and after the whole page has
   been scrolled and every reveal has fired.
2. **Hover, focus and press stay CSS.** Motion is used for entrances, scroll linkage
   and the pointer-driven tilt, and for nothing else. `.lift`, `.sheen`, `.rule-grow`
   and `.strike-in` in `globals.css` carry the rest.
3. **`prefers-reduced-motion` gets the finished page**, not a faster version of the
   animated one — no sweep, no print, no tilt, and the hero's replay control is not
   rendered at all, because there is nothing to replay.

A fourth rule is about scripting rather than motion. Every built element starts
clipped, and the clip is an inline style Motion writes during *server* rendering — so
with scripting off the page would arrive complete in the HTML and invisible on the
screen. A `<noscript>` rule on `[data-build]` in `page.tsx` reverses all of it. Checked
with `javaScriptEnabled: false`: full-height headline, every section present.

**None of this reaches the builder.** `/builder` loads no marketing component, the
performance budget below is untouched, and the first three rows of the table still bind.

### 5.1 What moves, and what does not

The performance budget is stricter than the design and wins every disagreement:
builder interactive under 3s on throttled 4G, preview re-render under 400ms, **typing
never drops a frame**.

| Never animated                            | Why                                          |
| ----------------------------------------- | -------------------------------------------- |
| Anything inside a step form               | The typing path. Non-negotiable.             |
| The preview canvas and its scroll region  | It repaints a real PDF.                      |
| Layout of the three builder columns       | Layout animation there thrashes on every keystroke. |
| Opacity, on any text, anywhere            | axe scores contrast mid-flight. §5.0.        |
| Section entrances on scroll, in the app   | Still the generic default outside marketing. |

| Animated                          | How                                                |
| --------------------------------- | -------------------------------------------------- |
| Marketing sections, on scroll     | Motion, `useInView` + variants, clip and translate  |
| The hero read-and-print           | Motion, on load and on demand, ~900ms               |
| The hero page's tilt              | Motion values + springs, pointer only, mouse only   |
| The "How it works" spine          | Motion `useScroll`, `scaleX`                        |
| Scroll progress, marketing routes | Motion `useScroll` + `useSpring`, `scaleX`          |
| Dialog and command palette        | Motion `AnimatePresence` — needs a real exit        |
| Step-rail active indicator        | Motion `layoutId`, shell-level only                 |
| Toasts, sync status               | Motion `AnimatePresence`                            |
| Hover, focus, press, disclosure   | **CSS.** No library involved.                       |

CSS still covers most of it. Motion is added for the things CSS genuinely cannot
express — exit animations, scroll linkage, pointer-driven transforms and orchestrated
entrances.

**Bundle.** `MotionProvider` loads `domAnimation` through `LazyMotion strict` — 4.6kb
plus that feature bundle, against 34kb for the full `motion` component. `domMax` is
deliberately not loaded: nothing on these pages animates layout or drags. One
consequence is worth writing down, because it type-checks, lints, ships and then does
nothing: **`whileInView` is part of the viewport feature, and the viewport feature is
not in `domAnimation`.** It never fires. Every on-scroll reveal here uses the
`useInView` hook, which works under any feature bundle.

### 5.2 Feel

A calm document tool, so: **no overshoot.** Springs settle rather than bounce
(`bounce: 0` to `0.1`). A wobble reads as playful, and this product's job is to lower
the temperature of a stressful task.

```
--dur-fast:  120ms   state changes: hover, focus, press
--dur:       200ms   transitions: disclosure, tab change
--dur-slow:  320ms   entrances: dialog, palette, toast
--dur-hero:  900ms   the hero's read-and-print
--ease:      cubic-bezier(0.2, 0.8, 0.2, 1)     small movements (kept)
--ease-soft: cubic-bezier(0.32, 0.72, 0, 1)     larger travel, decelerating
```

Springs used through Motion are specified perceptually — `type: "spring", bounce: 0,
visualDuration: 0.3` — rather than by stiffness and damping.

### 5.3 Bundle discipline

`motion/react` is tree-shakeable but not free. Marketing routes load it directly.
The builder loads only what it needs and never on the typing path; if the shell-level
uses grow, they move behind `LazyMotion` with the `m` component so the feature bundle
loads separately. Exact API surface to be confirmed against the installed version at
implementation time rather than assumed here.

`prefers-reduced-motion` is already handled globally in `globals.css` and that block
stays. Motion respects it through `useReducedMotion()`; the hero renders both panes
in their final state with no sweep.

### 5.4 The ambient field and the pointer light

Both are in `globals.css` and both are deliberately cheap.

**`AmbientBackground`** is one `position: fixed` layer per marketing page,
`aria-hidden` and `pointer-events: none`. Everything in it animates `transform` or
`opacity` alone. The three drifting lights run at **34s, 46s and 58s** — the different
periods are the point, because two lights on one duration resolve into a visible
pattern inside a minute, which is about how long a visitor stays. Two are the accent,
one is `--machine`, so the ground carries the same two-voice palette the content does.
The pointer glow is a spring over motion values, so a mouse crossing the page causes no
React render at all.

Grain is not decoration either. Large soft gradients band on 8-bit displays, and the
banding is what makes a gradient read as cheap; a film of noise dithers the steps away.
It has to be an inline `data:` URI — the CSP is `img-src 'self' data: blob:`, and a
texture from a CDN would simply be blocked.

**`Spotlight` / `SpotlightGroup`** write three custom properties per card — `--mx`,
`--my`, `--spot-o` — and nothing else. `globals.css` turns them into the wash and the
lit border. The group caches every card's rectangle when the pointer arrives and
re-measures only on scroll and resize: measuring on every pointer move is the textbook
layout thrash, because the previous frame's custom-property writes dirty style and the
next frame's `getBoundingClientRect` forces the recalculation back.

Neither touches a text colour, a size or a position, so a contrast check has nothing to
see and a card cannot move out from under a click. Touch and pen are ignored throughout
— a finger is already on the card, and a light chasing a thumb that is covering it is an
effect nobody sees.

Two rules that only look like details:

- **`clip-path` clips an element's shadow.** The build variants therefore drop the clip
  in `transitionEnd` once an element has arrived. A card left at `inset(0 0 0 0)` hovers
  with `.lift` and grows no shadow at all, and its lit border is cut off square at the
  edge.
- **`prefers-reduced-motion` has to be cancelled in CSS, not only in JavaScript.**
  `useReducedMotion()` cannot run on the server, so every built element is
  *server-rendered clipped* and unclipped on hydration. For everyone else that gap is
  the reveal; for someone who asked for less motion it is a blank page until the bundle
  lands. The media query in `globals.css` un-clips `[data-build]` a frame earlier, and
  it is the same rule the `<noscript>` block applies for the same reason.

---

## 6. Screen by screen

### Landing — §3.6 above.

### Builder

The workspace, and the screen that matters most.

- Three grounds, spatially separated (§3.5). The rail recedes, the canvas darkens,
  the paper lifts.
- **Form grid fixed**: label → input → help. Inputs share a baseline.
- **Inputs get a visible boundary** at 3.36:1, plus a clear focus ring.
- **`SectionManager` checkboxes** replaced with on-palette controls. The drag handle
  gets a real affordance and a hover state.
- **Step rail** replaces status dots with a progress spine — a continuous rule down
  the rail, filled to the completed point, with the active step marked by a moving
  indicator (`layoutId`). Keeps `aria-current="step"` and the `sr-only` status text
  exactly as they are: `e2e/builder.spec.ts` matches `/^Experience/` anchored at the
  start of the accessible name, so nothing may be prefixed to the label.
- **The experience-level prompt** gets equal-height cards on one row at desktop and a
  clean stack on mobile, instead of the current ragged 3-then-2 grid.
- **Undo/redo** move out of the step header into the rail footer, where they are not
  competing with the step title.

### Preview

- **Empty state**: a ghosted page with a soft skeleton of the resume's block
  structure and one line — "Your document appears here as you type." Not a blank
  rectangle.
- **One toolbar, not two.** View tabs, page count, zoom and Design collapse into a
  single bar.
- **`1 page` / `2 pages`** — pluralize (`PreviewPane.tsx:141`).
- The paper gets the app's only real shadow and sits on the darker canvas.
- **X-Ray** adopts `--machine` throughout: recovered text in mono, findings in slate,
  never in the accent. The scorecard keeps `section[aria-label='Field recovery
  scorecard']` and its `<table>`.

### Dashboard

Resume cards currently show a thumbnail in a bordered box. The thumbnail *is* paper —
so it gets the paper treatment, lifted off the canvas, and the metadata sits quietly
beneath it. Stays `<ul>`/`<li>` with headings for titles; the suite nth-indexes
`getByRole("listitem")`.

### Templates

Already the strongest page — real renders, not mockups. Needs: a consistent thumbnail
aspect ratio (they are currently stretched tall with dead white below the content),
paper treatment on each, and the intro cut from two dense paragraphs to a lead plus
the gallery. The card stays an `<a href>` on the public page and a `<button>` in the
Design dialog — one prop, per `IMPLEMENTATION.md`.

### `/check`

The free, no-account ATS check, and the best acquisition surface on the site. It is
the machine's own page: `--machine` leads, recovered text in mono, and the result
reads as a report rather than a score. No number that could be mistaken for a
prediction about an employer's software — D14, and the copy discipline in §2.2.

### Sign-in, letters, guides, examples

Inherit the system. Sign-in gets the calm single-column treatment; `/examples` and
`/guides` are reading surfaces, so Fraunces leads and measure caps at 68ch.

### Mobile

- **Fix the clipped nav.** The links collapse into a menu rather than being hidden by
  `overflow-hidden`. The header's fixed `h-14` height contract with `BuilderShell`
  is preserved — the menu opens over the page, it does not grow the bar.
- Builder tabs (Edit / Preview) get more presence; they are the primary navigation on
  a phone.
- Touch targets at 44px minimum throughout.

---

## 7. What binds this redesign

Non-negotiable, and each one has already cost someone a debugging session.

1. **§2.3 of `IMPLEMENTATION.md`** — every locked role-and-label selector. Headings
   keep their levels, `ResumeList` stays `<ul>`/`<li>`, the step button's accessible
   name keeps its prefix-free start, `[data-sync-status]` stays, exact button names
   stay exact. **A visual change that breaks one of these has regressed the accessible
   structure.**
2. **Verbatim copy strings** in §2.3 are matched by tests and are not the redesign's
   to reword.
3. **`PdfCanvas.tsx:107` sets page-chrome classes in JavaScript, not JSX.** Restyling
   the page frame means editing that file, and reading the markup will not reveal it.
4. **`BuilderShell.tsx` `key={step.id + externalRevision}`** stays. That remount is how
   uncontrolled inputs resync after undo/redo.
5. **Paper never inverts.** `--paper` is `#ffffff` in both themes because the PDF is.
6. **CSP: `font-src 'self' data:`.** No external font host. Fraunces must come through
   `next/font`, which self-hosts at build time. A `<link>` to Google Fonts would be
   blocked in production and pass in dev.
7. **`--canvas` follows the theme; `--paper` does not.** The existing two-ground rule.
8. **D12 / D13 / D14** — issues remaining while editing rather than a live score,
   downloads never paywalled, no "beat the ATS" claim in any new copy.
9. **`pnpm verify` and `e2e/a11y.spec.ts`** pass before any phase is called done.

---

## 8. Delivery

Each phase is independently shippable and leaves the app working.

| Phase | Scope                                                                                                   | State       |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------- |
| **0** | Token layer: palette, contrast-verified pairs, `--machine`, radius and shadow scales, motion variables   | **done**    |
| **1** | Typography (Fraunces via `next/font`), header, footer, landing page including the hero sequence          | **done**    |
| **1b** | The live pass (§5.0), landing page: build-on-view primitives, the interactive hero, scroll spine and progress, the inverted evidence band, drawn rules, struck refusals, the closing call to action | **done** |
| **1c** | The same language on every public reading surface: one `PageHeader` band (display type, build-on-load) on `/templates`, `/check`, `/examples` and `/guides`; Fraunces on the article and policy headings; `.lift` on template, example and guide cards and on the `/check` drop zone; `.rule-grow` on their inline links | **done** |
| **1d** | The ambient field behind every marketing route, and the pointer light on every card in every grid (§5.4). The per-section grids and auras it replaced are gone; the promises band is frosted so the field carries through it, and the evidence band is lit from its own top edge | **done** |
| **2** | Builder shell: three grounds, step rail spine, form grid fix, inputs, `SectionManager` controls, and every remaining raw palette class onto tokens | **done** |
| **3** | Preview: single toolbar, empty state, paper treatment, page-count plural, X-Ray on `--machine`, and the flaky "Updating…" live region | **done** |
| **4** | Dashboard, templates gallery, `/check`                                                                   | **done**    |
| **5** | Sign-in, letters, guides, examples                                                                       | **done**    |
| **6** | Mobile pass: nav menu, builder tabs, touch targets; full a11y and reduced-motion sweep                   | **done**    |

Every phase is built. What follows records what each of them actually changed,
including the three places the built thing differs from the plan above and why.

### What phases 0 and 1 shipped

| Change                                                                                     | Where                                     |
| ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| The palette, both themes, every pair contrast-checked; `--machine`; radius and shadow scales | `src/app/globals.css`                     |
| Fraunces on `SOFT`/`WONK`/`opsz` through `next/font`, self-hosted for the CSP                | `src/app/layout.tsx`, `globals.css`       |
| The hero: document and recovered text, one 900ms read-line sweep, reduced-motion aware       | `src/components/marketing/HeroDocument.tsx` |
| Landing rebuilt — no card grid, no eyebrows, evidence at the top, the trust ledger           | `src/app/page.tsx`                        |
| Mobile navigation that exists: a disclosure that cannot alter the header's height            | `src/components/shell/HeaderNav.tsx`      |
| Header and footer on the new system; the wordmark yields to the controls below `sm`          | `src/components/shell/`                   |
| Ten `text-zinc-500 dark:text-zinc-400` sites at 4.36:1 moved onto `--text-faint`             | 10 files                                  |
| `motion` v13.1.1 added; `LazyMotion` + `m`, used on the hero only                            | `package.json`                            |

### What the live pass shipped

| Change                                                                                          | Where                                          |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Build primitives — `BuildGroup`/`Built`/`BuiltListItem`/`DrawnRule`, on `useInView` and variants  | `src/components/marketing/Build.tsx`           |
| The feel, in one file: `BUILD`, `SETTLE`, `GLIDE`, and the clip-not-fade variants                 | `src/components/marketing/motion-tokens.ts`    |
| The hero: pointer tilt on springs, the two-way block↔line highlight, a replay control, a second sheet, the structural callout | `HeroDocument.tsx`, `PaperSample.tsx` |
| Scroll progress and the "How it works" spine, both `useScroll` → `scaleX`                         | `ScrollProgress.tsx`, `ScrollSpine.tsx`        |
| The magnetic, sheened call to action                                                              | `CtaLink.tsx`                                  |
| The shared page-opening band                                                                      | `PageHeader.tsx`                               |
| CSS layer: `.band-invert`, `.field-grid`, `.aura`, `.sheen`, `.lift`, `.rule-grow`, `.strike-in`, `.paper-mark`, `.machine-mark`, `--ease-press`, `--shadow-lift`, `--shadow-accent` | `src/app/globals.css` |
| The ambient field: wash, parallaxing grid, three drifting lights, pointer glow, grain               | `AmbientBackground.tsx`, `globals.css`         |
| The pointer light on cards, single and across a grid                                               | `Spotlight.tsx`, `globals.css`                 |
| The `<noscript>` reveal-undo, global rather than per page                                          | `src/app/layout.tsx`                           |
| `/privacy` and `/terms` headings off raw `zinc-*` and onto tokens                                  | two files                                      |

### What phases 2 to 6 shipped

| Change                                                                                                                   | Where                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **The form grid, fixed.** Hint moved below the control, so every input in a row shares a baseline whatever its hint runs to | `ui/control.tsx`                         |
| **The step rail as a spine** — a rule down the rail filled to the completed point, a marker per step, the active one ringed | `builder/StepNav.tsx`                    |
| **Three grounds.** The rail recedes onto `--surface-2`, sticky with its own scroll; the workspace is the page ground; the canvas is darker | `builder/BuilderShell.tsx`      |
| **Undo and redo moved to the rail footer**, out of the step header where they competed with the title                      | `builder/BuilderShell.tsx`               |
| **The checkbox, on palette.** `text-accent` does nothing to a native checkbox, so every visibility toggle was system blue   | `ui/control.tsx`, `globals.css`          |
| **The experience prompt** as five equal rows rather than a three-then-two grid with a hole in it                            | `builder/ExperienceLevelPrompt.tsx`      |
| **One preview toolbar**, not two rules across a narrow pane for six controls                                               | `preview/PreviewPane.tsx`                |
| **A preview empty state**: a ghosted page with the block structure, not a blank rectangle with a sentence in it            | `preview/PreviewPane.tsx`                |
| **The "Updating…" live region holds no text when idle** — the fix for the axe flake, which was scanning it mid-fade         | `preview/PreviewPane.tsx`                |
| **`1 page` / `2 pages`**, and `0.0 pages` → `0.0 pages used`, which is what the figure has always meant                     | `preview/PreviewPane.tsx`, `layout/fit.ts` |
| **X-Ray in the machine's voice**: recovered values slate and mono, the extracted text on `--machine-weak`, verdicts still `--ok`/`--danger` | `xray/XRayPanel.tsx`     |
| **The dashboard thumbnail is paper** — lit on the canvas, not a picture in a bordered box                                   | `dashboard/ResumeThumbnail.tsx`          |
| **The pointer light on every card grid in the app**: dashboard, letters, templates, examples, guides                        | `ui/Spotlight.tsx` and five call sites   |
| **Every raw palette class onto tokens** — 178 `zinc-*`/`sky-*` plus 30 `emerald-*`/`red-*`/`amber-*`, including the two dialog backdrops, which became a `--scrim` token | 20 files |
| **Mobile Edit/Preview**: full width, two equal halves, sticky under the header                                             | `builder/BuilderShell.tsx`               |
| **44px touch targets under `pointer: coarse`**, so density follows the input device rather than the viewport                | `globals.css`                            |

### Where the built thing differs from the plan

Three, each deliberate.

**The step rail's active marker is CSS, not Motion `layoutId`.** §5.1 named
`layoutId`, which needs the `domMax` feature bundle — the Motion runtime in the
builder's bundle, on the screen whose budget is the strictest in the app, for one
moving dot. A transition on the marker's ring reads the same and costs nothing.

**The experience prompt is five rows, not one row of cards.** §6 asked for "equal-height
cards on one row at desktop". Five cards each carrying a label *and* a sentence do not
fit one row of a column this narrow without the sentences collapsing to two words. A
single column of equal rows is the shape the content actually has: five mutually
exclusive answers to one question, in order.

**`0.0 pages` became `0.0 pages used` rather than being pluralized away.** The figure is
how full the page is, not how many pages there are — the fix was the missing word, not
the missing `s`. The genuine plural bug was the integer fallback beside it, and that is
fixed.

### How phases 2 to 6 were checked

- **axe**, serious and critical, over **twelve routes in both themes** — including
  `/builder` and `/letters`, which the standing suite does not cover — plus the X-Ray
  panel scanned with a real extraction in it. One genuine pre-existing failure found and
  fixed: both "New cover letter" buttons carried `text-accent-fg`, a class this system
  does not define, so the label inherited its colour on a pine ground in both themes.
- **Every raw palette class is gone.** `grep` for `zinc-|sky-|emerald-|amber-|red-\d`
  across `src` returns nothing but one explanatory comment.
- **Touch targets** measured on a coarse pointer at 390px: no button or tab under 44px.
- **`prefers-reduced-motion` and scripting-off** re-checked across every route after the
  builder and preview changes.
- **`pnpm verify`** — typecheck, lint, 1,627 unit tests. Green.

### How the live pass was checked

- **axe**, serious and critical, `wcag2a`/`2aa`/`21a`/`21aa`, over ten routes in **both
  themes** — twenty combinations, zero blocking violations. Each route is scanned after
  the whole page has been scrolled, so every reveal has fired and is scored in its final
  state as well as its first.
- **`prefers-reduced-motion`**: every `[data-build]` element measured at `opacity: 1`
  with no clip, on load; all three ambient lights at `animation-name: none`; and the
  hero's replay control absent from the tree. The first of those failed until the media
  query above was added — the elements were correct after hydration and clipped before
  it.
- **No JavaScript**: all ten routes at 200, a full-height `<h1>`, and no element left
  clipped — including `/examples` and `/guides`, which `e2e/content.spec.ts` requires to
  render with scripting off.
- **`pnpm verify`** — typecheck, lint, 1,627 unit tests. Green.
- **The template gallery's contract**, in a browser: twelve links in the named list and a
  first thumbnail at 329×466, which is what `templates.spec.ts` asserts.


### How it was checked

- **`pnpm verify`** — typecheck, lint, 1,627 unit tests across 54 files. Passing.
- **axe**, serious and critical, on `/`, `/builder`, `/templates`, `/check` and `/signin`,
  **in both themes** — ten route/theme combinations, no violations. This is what caught
  the `zinc-500` contrast bug, and it is why the palette was computed before it was
  written rather than after.
- **The header's height contract**, measured with the menu open: 56px, unchanged. That
  is `BuilderShell`'s assumption and the reason the old nav was clipping rather than
  wrapping.
- **The mobile menu**, driven end to end: links unreachable while closed, reachable when
  open, Escape closes it.

- **Playwright**, the specs the redesign could plausibly have broken: `builder.spec.ts`,
  `content.spec.ts`, `templates.spec.ts` and `a11y.spec.ts` — 35 tests, passing. That
  covers the locked selectors, the page titles, the security headers, and "loads the
  builder with no console errors under the CSP", which is what proves the new font is
  genuinely self-hosted rather than quietly reaching for Google's CDN.

One flake found and left alone. `a11y.spec.ts`'s dark-theme builder scan failed once on
`.transition-opacity`, then passed twice on re-run. It is the "Updating…" indicator in
`PreviewPane`, which fades between `opacity-0` and `opacity-100`; axe occasionally scans
it mid-fade and measures the contrast of half-transparent text. Pre-existing, not a
palette regression — the fix is for the live region to hold no text when idle rather than
to hold invisible text, and it belongs with the rest of the preview work in Phase 3.

The suites were run against the development server already holding port 3000 (landmine
24: `reuseExistingServer` reuses it). It serves this same source, so the results stand,
but the full suite should get a clean production run before these phases are signed off.
