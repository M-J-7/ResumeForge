/**
 * Landing page (M0-T13).
 *
 * Positioning is constrained by D14 and §9: no "beat the bots", no
 * "guaranteed to pass", no invented interview-rate lift. Every claim here is
 * one we can actually substantiate — the downloads really are free, the
 * builder really does work without an account, and nothing is sent anywhere
 * until the user signs in and asks for it.
 *
 * The honest version is also the stronger one: "we won't write lies for you"
 * and "here is what the machine actually reads" are things no competitor
 * making the usual claims can say.
 *
 * ## The redesign, pass three: the stage (see `docs/REDESIGN.md`)
 *
 * Pass one made the page honest and calm, and calm read as inert. Pass two
 * made it live — the page assembles itself, the document leans toward the
 * pointer, the refusals strike through as they arrive. Pass three is about
 * what it is *lit by*.
 *
 * `design.md` §3.1 always said the thing: chrome is a cool, matte workbench,
 * and **the document is the only warm, lit object on the screen.** §3.2 noted
 * the payoff and never spent it — "dark: paper stays white and now genuinely
 * glows". This page is where it gets spent. `data-stage="dark"` on `<main>`
 * re-points the semantic tokens at the verified dark palette for this route
 * and, through the `:has()` half of that scope, for `<body>` and the sticky
 * header too. No component in here knows it is on a dark ground.
 *
 * A near-black room whose entire visual interest is one luminous sheet of
 * white paper and a slate readout beside it is also a picture of the
 * product's argument — and it is a look this category does not have, being
 * split between light consumer forms and violet AI dashboards.
 *
 * ## The headline, pass four: the claim instead of the grievance
 *
 * It was "A resume builder that does not hold your resume **hostage**". That
 * sentence is true, it is distinctive, and it has two problems. It is defined
 * by a negative, so it argues with a competitor the visitor has not thought
 * about yet — and it spends the one accent word on the page, at 84px, on
 * *hostage*.
 *
 * "The resume you write is the resume a **machine** reads" is the same
 * position stated forwards. It is also the only headline on this page that
 * the page can prove: the pair of panes immediately to its right is that
 * sentence, performed — a document, and the plain text a parser recovered
 * from it, drawn from one source so they cannot disagree. Nobody else in this
 * category can put that under their headline, which is the test a headline
 * should have to pass.
 *
 * ## The section order is a conversion decision
 *
 * Hero, evidence, promises, how it works, refusals, FAQ, close. Evidence sits
 * second because it is the substitute for the social proof this page is not
 * allowed to have: no logos, no ratings, no user count (D14, `REFUSED_CLAIMS`,
 * and `structured-data.test.ts` asserting there is no `aggregateRating`). The
 * FAQ is second-to-last because it is written for search intent rather than
 * for the reader who has already got that far.
 *
 * ## Three rules that keep it from being the usual marketing page
 *
 * 1. **Nothing fades text.** Every reveal is a clip, a translate or a blur.
 *    axe scores contrast on whatever it catches mid-flight, and text at 40%
 *    opacity is a build failure — `e2e/a11y.spec.ts` has already flaked once
 *    on exactly that.
 * 2. **Hover, focus and press are CSS.** Motion is here for entrances, scroll
 *    linkage and the pointer-driven tilt, and nothing else.
 * 3. **`prefers-reduced-motion` gets the finished page**, not a faster
 *    version of the animated one.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/shell/AppFooter";
import { JsonLdScript } from "@/components/seo/JsonLd";
import {
  faqPageJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "@/lib/structured-data";
import { AmbientBackground } from "@/components/marketing/AmbientBackground";
import { BuildGroup, Built, BuiltListItem, DrawnRule } from "@/components/marketing/Build";
import { CtaLink } from "@/components/marketing/CtaLink";
import { EvidenceBento } from "@/components/marketing/EvidenceBento";
import { Faq } from "@/components/marketing/Faq";
import { HeroDocument } from "@/components/marketing/HeroDocument";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { RefusalList } from "@/components/marketing/RefusalList";
import { ScrollProgress } from "@/components/marketing/ScrollProgress";
import { ScrollSpine } from "@/components/marketing/ScrollSpine";
import { Section } from "@/components/marketing/Section";
import { StickyCta } from "@/components/marketing/StickyCta";
import { SpotlightGroup } from "@/components/ui/Spotlight";
import { FAQ } from "@/lib/faq";
import { pageMetadata } from "@/lib/seo";
import { REPO_URL, repoFileUrl, SITE_NAME } from "@/lib/site";
import { MEASURED, REFUSED_CLAIMS, TRUST_SIGNALS } from "@/lib/trust-signals";

/**
 * The title leads with the category, not the brand.
 *
 * It was `Six Seconds Resume — free downloads, nothing uploaded`, which
 * spends the most valuable forty pixels in a search result on a name nobody
 * has searched for yet. A product with no brand equity earns it by ranking
 * for what people actually type — "free resume builder" — and carries the
 * name along in the tail, where it starts being recognised.
 *
 * `absoluteTitle` because the root layout's `%s — <product name>` template
 * would otherwise append the name to a title that already ends with it.
 */
export const metadata: Metadata = pageMetadata({
  title: "Free resume builder",
  absoluteTitle: `Free ATS resume builder — ${SITE_NAME}`,
  description:
    "Build a resume that parses cleanly, then see exactly what a machine reads back from it. " +
    "PDF, Word, plain text and JSON Resume, free permanently. No account needed.",
  path: "/",
});

/**
 * The formats, stated where a visitor decides — not two sections later.
 *
 * "Word (.docx)", not "DOCX". The line directly above these pills says
 * "PDF, Word, plain text and JSON Resume" — as does the pricing table, the
 * FAQ and the footer — and a chip reading DOCX sitting two inches under it
 * read as a fifth, different thing. The extension stays because it is what
 * an application form asks for by name.
 */
const FORMATS = ["PDF", "Word (.docx)", "Plain text", "JSON Resume"];

/** What the sticky bar watches. Leaving this reveals the ask again. */
const HERO_ID = "hero";

const PROMISES = [
  {
    title: "Downloads are free, permanently",
    body: "PDF, DOCX, and plain text. No paywall at the last step, no watermark, no account needed to get your own work back out.",
  },
  {
    title: "Nothing is uploaded unless you ask",
    body: "Without an account your resume is written to storage inside your browser and stays there. An account is optional, adds syncing between devices, and deletes on request — every resume, immediately, with no copy kept.",
  },
  {
    title: "No AI writes your resume",
    body: "We will not invent accomplishments you would then have to defend in an interview. The coaching here asks you questions; the words stay yours.",
  },
  {
    title: "Four formats, and we say which one to send",
    body: "Word reads most reliably through older application systems. PDF preserves exactly what you laid out. Plain text is what you paste into a form that will not take a file. JSON Resume is how you take the whole thing somewhere else.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "Write it",
    body: "Fill in the sections. Every field validates as you type, and the checklist tells you what is still worth fixing — and why it matters, not just that it does.",
  },
  {
    step: "See the real document",
    body: "The preview is not an approximation of your PDF. It is the PDF, rendered live, so what you see is byte-for-byte what you download.",
  },
  {
    step: "Download and apply",
    body: "All four formats, named the way a recruiter's downloads folder wants them.",
  },
];

export default function Home() {
  return (
    <MotionProvider>
      {/*
        The free-tool signal, in the form a crawler reads (§10.4b).
        `offers` with `price: "0"` is the one claim worth making loudly
        here: it is true permanently (D13), and it is the difference
        between this and every competitor whose paywall is at the download
        step. There is deliberately no `aggregateRating` — this product has
        no users yet, and D14 forbids manufacturing that proof for a machine
        as firmly as for a person. See `lib/structured-data.ts`.
      */}
      <JsonLdScript data={softwareApplicationJsonLd()} />
      {/* The site name a search result prints, and who publishes it. Home
          page only: Google reads `WebSite` from here, and "Six Seconds" on
          its own is another organization's name (see `organizationJsonLd`). */}
      <JsonLdScript data={websiteJsonLd()} />
      <JsonLdScript data={organizationJsonLd()} />
      {/* Built from the same array the `<details>` below are, because markup
          describing answers the page does not contain is a policy violation
          and the way it happens is two copies drifting. */}
      <JsonLdScript data={faqPageJsonLd(FAQ)} />
      {/* The `<noscript>` rule that undoes every reveal when there is no
          JavaScript to run it lives in `app/layout.tsx`, because every
          marketing surface needs it and two of them are crawled. */}
      <ScrollProgress />
      <AmbientBackground />

      {/*
        The stage. One attribute, and the `:has()` half of the scope in
        `globals.css` carries it onto `<body>` and the sticky header — which
        is a sibling of this element and cannot otherwise know what route it
        is on. The child combinator there is why `/examples` and `/guides`
        can open with a dark *band* over a light reading body without the
        whole page flipping.
      */}
      <main id="main-content" tabIndex={-1} data-stage="dark" className="flex flex-1 flex-col">
        {/*
          The hero pairs the claim with the object it is a claim about — and
          with the evidence. The document is the hero, the chrome recedes,
          which is the same idea the builder is built around, said once here
          so it is not a surprise later.
        */}
        <section id={HERO_ID} className="pb-band relative px-6 pt-14 sm:pt-20">
          <BuildGroup trigger="load" stagger={0.08} className="mx-auto max-w-7xl">
            {/*
              The headline spans, rather than sharing the row with the
              document. At this size a half-width column sets it in five
              ragged lines and the type — which is carrying the personality of
              the whole site — reads as an accident. Given the full measure it
              lands in two.
            */}
            <Built>
              <h1 className="font-display text-text text-display-1 max-w-[17ch] text-balance">
                The resume you write is the resume a{" "}
                {/* One word in the accent, and it is the word the whole
                    position turns on. `--accent` clears AA on this ground at
                    any size; at display size it is not close. */}
                <span className="text-accent">machine</span> reads
              </h1>
            </Built>

            <div className="mt-12 grid items-start gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-16">
              <div>
                <Built>
                  <p className="text-muted text-body-l max-w-[46ch]">
                    One column of real text, downloadable as PDF, Word, plain text and JSON Resume
                    &mdash; all four free, permanently. It runs in your browser and works without an
                    account, so nothing is sent anywhere unless you ask for it.
                  </p>
                </Built>

                <Built className="mt-8">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <CtaLink href="/builder">Start building</CtaLink>
                    {/* `/check` is the strongest thing we can offer someone
                        who already has a resume and is not ready to start a
                        new one. It needs no account and nothing is uploaded,
                        so it costs them nothing to try — which is the whole
                        argument. */}
                    <Link
                      href="/check"
                      className="text-text focus-visible:ring-accent rule-grow text-small rounded-sm font-medium transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Or check a resume you already have
                    </Link>
                  </div>
                </Built>

                <Built className="mt-6">
                  <p className="text-faint text-small">No sign-up needed. Nothing to cancel.</p>
                </Built>

                {/*
                  The formats, at the point where someone is deciding whether
                  this tool makes the file they need. It used to be a sentence
                  in section two.
                */}
                <Built className="mt-8">
                  <SpotlightGroup>
                    <ul className="flex flex-wrap gap-2">
                      {FORMATS.map((format) => (
                        <li
                          key={format}
                          className="border-line bg-surface-0 text-muted spot lift elev-1 text-small rounded-md border px-3 py-1.5 font-medium"
                        >
                          {format}
                        </li>
                      ))}
                    </ul>
                  </SpotlightGroup>
                </Built>
              </div>

              <HeroDocument />
            </div>
          </BuildGroup>
        </section>

        {/*
          The evidence, in the slot a competitor fills with logos and a star
          rating. We have no users yet, D14 rules out the manufactured kind,
          and the honest options were an empty slot or claims that survive
          being checked. Each one names where a stranger can verify it, and
          `trust-signals.test.ts` measures the numeric ones against this
          repository — a test count that quietly goes stale is a false
          statement on a marketing page.

          Lit in slate, because this is the parser's section and the accent
          would be claiming the wrong voice for it.
        */}
        <Section lit="machine" ruled labelledBy="evidence-heading">
          <BuildGroup stagger={0.07}>
            <Built>
              <h2 id="evidence-heading" className="text-text text-display-3 font-semibold">
                Things you can check for yourself
              </h2>
            </Built>
            <Built className="mt-4">
              <p className="text-muted text-body-l max-w-measure">
                Four things you would want to know before typing your employment history into a
                website, and the place to check each one &mdash; a page in this app, or a dated
                decision in the public source.
              </p>
            </Built>
            <EvidenceBento signals={TRUST_SIGNALS} />

            {/*
              Where the two tiles that used to be here went.
              "1,951 tests, and the number is checked" and the write-up of the
              AI rewriter we built and switched off are both true and neither
              is addressed to somebody deciding whether to trust a resume
              tool — a job seeker has no idea whether 1,951 tests is a lot,
              and "clone the repository and run `pnpm verify`" is an
              instruction almost nobody arriving here can carry out. As two of
              six tiles they were two-thirds of the attention this section
              gets, spent on the authors rather than on the reader.

              One line, under the grid, keeps both facts for the person who
              does want them without making everybody else read past them —
              and it keeps `MEASURED.unitTests` rendered, which is what makes
              the tripwire in `trust-signals.test.ts` worth having.
            */}
            <Built className="mt-8">
              <p className="text-faint text-small max-w-read leading-relaxed">
                If you want to go further than that: the whole thing is{" "}
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-machine rounded-sm underline decoration-dotted underline-offset-4 hover:decoration-solid"
                >
                  open source
                </a>
                , there are {MEASURED.unitTests.toLocaleString("en")} tests &mdash; including one
                that fails if the number in this sentence goes stale &mdash; and the on-device AI
                rewriter we built, measured and then switched off is{" "}
                <a
                  href={repoFileUrl("docs/enhance feature.md")}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-machine rounded-sm underline decoration-dotted underline-offset-4 hover:decoration-solid"
                >
                  written up with its failures
                </a>
                .
              </p>
            </Built>
          </BuildGroup>
        </Section>

        {/*
          Asymmetric on purpose. Every band on the old page was a centred
          heading over a grid, six times; giving this one a column of its own
          for the heading — held in place while the statements scroll past it
          — is what stops the page reading as one rhythm repeated.
        */}
        <Section rhythm="tight" labelledBy="promises-heading">
          <BuildGroup stagger={0.09}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-16">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <Built>
                  <h2
                    id="promises-heading"
                    className="text-text text-display-3 font-semibold text-balance"
                  >
                    What we actually promise
                  </h2>
                </Built>
                <DrawnRule className="rule-fade mt-6" />
                <Built className="mt-5">
                  <p className="text-faint text-small max-w-[32ch] leading-relaxed">
                    Four statements, each of which we would have to change the product to break.
                  </p>
                </Built>
              </div>

              {/* Still a <dl>: these are term-and-definition pairs, and a grid
                  of divs would throw that away for nothing.

                  One light across the four, rather than four hover states.
                  The statements are one argument in four parts and they
                  should read as one surface. */}
              <SpotlightGroup>
                <dl className="grid gap-y-3">
                  {PROMISES.map((promise) => (
                    <Built
                      key={promise.title}
                      className="card-tinted spot lift elev-1 rounded-lg border px-5 py-5"
                    >
                      <dt className="promise-mark text-text text-body font-semibold">
                        {promise.title}
                      </dt>
                      <dd className="text-muted text-small max-w-measure mt-2 leading-relaxed">
                        {promise.body}
                      </dd>
                    </Built>
                  ))}
                </dl>
              </SpotlightGroup>
            </div>
          </BuildGroup>
        </Section>

        {/*
          Numbered, and the only numbered thing on the page. Three steps in a
          fixed order genuinely are a sequence, which is the one case where a
          numbered marker carries information rather than decorating — and the
          one place a scroll-linked rule is saying something rather than
          moving.
        */}
        <Section lit="accent" ruled labelledBy="how-heading" containerClassName="max-w-5xl">
          <BuildGroup stagger={0.09}>
            <Built>
              <h2 id="how-heading" className="text-text text-display-3 font-semibold">
                How it works
              </h2>
            </Built>
            {/*
              The one section that had no line under its heading, which made
              it read as a diagram somebody dropped in. It is also the only
              sensible place on the page to say what the name means: the
              footer's bottom rule carried that, which is to say the last line
              a visitor reads, if they read it at all. A product whose name is
              an argument should make the argument where the argument is being
              made.

              Deliberately not opening with "Named for the six seconds", which
              is how `AppFooter`'s bottom rule opens — the footer is on this
              page too, and two paragraphs sharing their first nine words read
              as a templating fault rather than as a refrain.
            */}
            <Built className="mt-4">
              <p className="text-muted text-body-l max-w-measure">
                Six seconds is about what a recruiter gives a resume &mdash; and a parser has
                already read the file before they ever see it. Three steps, and every one of them is
                about surviving both. That is where the name comes from.
              </p>
            </Built>

            <ScrollSpine className="mt-10">
              <SpotlightGroup>
                <ol className="mt-8 grid gap-6 sm:grid-cols-3">
                  {HOW_IT_WORKS.map((item, index) => (
                    <BuiltListItem
                      key={item.step}
                      className="group card-tinted spot lift elev-1 flex flex-col rounded-lg border p-5"
                      variant="item"
                    >
                      {/* The marker sits above the step rather than beside
                          it, at a size that makes the sequence legible from
                          across the room. `aria-hidden`, so the contrast
                          checker has nothing to measure and the sequence is
                          carried by the `<ol>` itself. */}
                      <span
                        aria-hidden
                        className="font-display numeral-accent group-hover:text-accent text-[2.75rem] leading-none transition-colors duration-[var(--dur)]"
                      >
                        {index + 1}
                      </span>
                      <h3 className="text-text text-body mt-3 font-semibold">{item.step}</h3>
                      <p className="text-muted text-small mt-2 leading-relaxed">{item.body}</p>
                    </BuiltListItem>
                  ))}
                </ol>
              </SpotlightGroup>
            </ScrollSpine>
          </BuildGroup>
        </Section>

        {/*
          The honesty section, and the most distinctive copy on the site.

          Every competitor in this category claims to guarantee ATS success;
          none can. Saying plainly what is and is not knowable is the
          differentiator, per D14 — so the refusals are set as statements at
          reading size rather than as the fine print of a sidebar card, which
          is what they were. The strike draws itself as each one arrives; the
          sentence above the list carries that meaning in text, because a line
          through a word is not something a screen reader conveys.
        */}
        <Section rhythm="tight" labelledBy="refusals-heading" containerClassName="max-w-5xl">
          <BuildGroup stagger={0.08}>
            <Built>
              <h2 id="refusals-heading" className="text-text text-display-3 font-semibold">
                What we will not tell you
              </h2>
            </Built>

            <Built className="mt-6">
              <p className="text-muted text-body-l max-w-read">
                We will not promise this resume &ldquo;beats the bots&rdquo; or is &ldquo;guaranteed
                to pass ATS&rdquo;. Nobody can promise that. Applicant tracking systems differ from
                each other, are configured differently by every employer, and are only one step
                before a human decides. Here is the whole list of things you will never see us claim
                &mdash; struck out, because we took them off the page.
              </p>
            </Built>

            <Built className="mt-10">
              <RefusalList
                claims={REFUSED_CLAIMS}
                className="border-line max-w-read gap-0 border-t"
                itemClassName="text-title border-line border-b py-5 leading-snug"
              />
            </Built>

            {/*
              One paragraph, where there were two. The second was "the filename
              convention we use is for the recruiter's downloads folder, not
              because an ATS searches on it" — true, and already the whole of
              FAQ question eight two sections below this one. Spending a major
              section's closing words on a footnote about filenames deflated
              the ending; the strong sentence should be the last one.
            */}
            <Built className="mt-10">
              <p className="text-muted text-small max-w-read leading-relaxed">
                What we can say is narrower and true: a single-column layout with real text,
                standard section headings, and no images is the most reliably readable structure
                across the widest range of parsers. That is what this tool produces, and it is the
                only kind of claim we will make.
              </p>
            </Built>
          </BuildGroup>
        </Section>

        {/*
          The questions people actually type, answered without a sales pitch.
          `<details>` rather than a React accordion: this section exists to be
          found from a search, so it has to be in the HTML and openable with
          no bundle at all. The matching `FAQPage` markup is emitted above
          from the same array.
        */}
        <Section lit="accent" ruled labelledBy="faq-heading" containerClassName="max-w-4xl">
          <BuildGroup stagger={0.06}>
            <Built>
              <h2 id="faq-heading" className="text-text text-display-3 font-semibold">
                Questions worth a straight answer
              </h2>
            </Built>
            <Built className="mt-4">
              <p className="text-muted text-body-l max-w-measure">
                The things people search for before they start writing. Where the honest answer is
                &ldquo;it depends&rdquo;, it says so and then says what it depends on.
              </p>
            </Built>
            <Faq items={FAQ} />
          </BuildGroup>
        </Section>

        {/*
          The closing ask. The old page ended on the refusals and then the
          footer, which left the only route into the product at the very top —
          a visitor who read the whole argument had to scroll back up to act
          on it.
        */}
        <Section ruled containerClassName="max-w-3xl text-center">
          <BuildGroup stagger={0.09}>
            <Built>
              <h2 className="font-display text-text text-display-2 text-balance">
                Start with a blank page. Leave with four files.
              </h2>
            </Built>
            <Built className="mt-5">
              <p className="text-muted text-body-l mx-auto max-w-[46ch]">
                No account, no card, and no step at the end where the download stops being free.
              </p>
            </Built>
            <Built className="mt-9">
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                <CtaLink href="/builder">Start building</CtaLink>
                <Link
                  href="/templates"
                  className="text-text focus-visible:ring-accent rule-grow text-small rounded-sm font-medium transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
                >
                  Look at the templates first
                </Link>
              </div>
            </Built>
          </BuildGroup>
        </Section>

        {/* The room the sticky bar needs. Unconditional rather than toggled
            with the bar: a footer whose padding appears and disappears as you
            scroll past it is a worse artifact than a little space under the
            legal links. */}
        <AppFooter className="pb-28" />
      </main>

      <StickyCta after={HERO_ID}>Free downloads, no account, nothing uploaded.</StickyCta>
    </MotionProvider>
  );
}
