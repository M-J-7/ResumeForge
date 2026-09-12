/**
 * Landing page (M0-T13).
 *
 * Positioning is constrained by D14 and §9: no "beat the bots", no
 * "guaranteed to pass", no invented interview-rate lift. Every claim here is
 * one we can actually substantiate — the downloads really are free, the
 * builder really does work without an account, and nothing is sent anywhere
 * until the user signs in and asks for it.
 *
 * Revised when M2 added optional accounts. The hero used to say "there is no
 * account", which stopped being true — and a landing page that overstates a
 * privacy position is the same failure as one that overstates a result.
 *
 * The honest version is also the stronger one: "we won't write lies for you"
 * and "here is what the machine actually reads" are things no competitor
 * making the usual claims can say.
 *
 * ## The redesign, pass one (see `design.md` §3)
 *
 * This page was six identical bands: `border-b px-6 py-16`, a tracked-out
 * uppercase eyebrow, and a grid of identical cards, six times over. **The
 * evidence moved to the top**, **the cards went away** in favour of the
 * structure each piece of content actually has, and **the eyebrows went** —
 * they are real headings now, or they were deleted because the content
 * already announced itself.
 *
 * ## The redesign, pass two: live
 *
 * Pass one was honest and calm and it read as inert. Six sections of hairline
 * rules on one flat ground gave the eye nothing to catch, and a page whose
 * argument is "look at the evidence" cannot afford to be the least
 * interesting thing a visitor sees that day.
 *
 * So the page assembles itself. Rules draw, statements are uncovered rather
 * than faded up, the sequence fills as you read past it, the refusals are
 * struck through one at a time, and the document leans toward the pointer.
 * The one hard contrast beat — the evidence ledger on the machine's own dark
 * ground — is the page's only real change of key, and it lands on the section
 * that most deserves it.
 *
 * Three rules kept it from becoming the usual scroll-jacked marketing page:
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
import { softwareApplicationJsonLd } from "@/lib/structured-data";
import { AmbientBackground } from "@/components/marketing/AmbientBackground";
import { BuildGroup, Built, BuiltListItem, DrawnRule } from "@/components/marketing/Build";
import { CtaLink } from "@/components/marketing/CtaLink";
import { HeroDocument } from "@/components/marketing/HeroDocument";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { RefusalList } from "@/components/marketing/RefusalList";
import { ScrollProgress } from "@/components/marketing/ScrollProgress";
import { ScrollSpine } from "@/components/marketing/ScrollSpine";
import { Spotlight, SpotlightGroup } from "@/components/ui/Spotlight";
import { SITE_NAME } from "@/lib/site";
import { REFUSED_CLAIMS, TRUST_SIGNALS } from "@/lib/trust-signals";

export const metadata: Metadata = {
  // `absolute` so the root layout's "%s — <product name>" template does not
  // append the name to a title that already carries it. Built from
  // `SITE_NAME` rather than written out, so the name stays one line.
  title: { absolute: `${SITE_NAME} — free downloads, nothing uploaded` },
  description:
    "Build a resume that parses cleanly. PDF, DOCX, and plain text, free forever. Works without an account, and your resume never leaves your browser.",
};

/** The formats, stated where a visitor decides — not two sections later. */
const FORMATS = ["PDF", "DOCX", "Plain text", "JSON Resume"];

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
    title: "Three formats, because they parse differently",
    body: "DOCX reads most reliably through the older application systems. PDF preserves exactly what you laid out. We tell you which to use where.",
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
    body: "All three formats, named the way a recruiter's downloads folder wants them.",
  },
];

/**
 * Rendered per request so its metadata reads the runtime environment.
 *
 * `metadataBase` — and with it every canonical and Open Graph URL — comes
 * from the deployment's origin. Prerendering this page would freeze the
 * origin as it was at *build* time, and an image built in CI has no idea
 * what host it will be run on. The symptom is silent: correct-looking pages
 * whose canonical links and social cards all point at `localhost`.
 *
 * The cost is rendering a page of static text per request, which for a
 * single-container deployment with no CDN in front of it is nothing.
 */
export const dynamic = "force-dynamic";

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
      {/* The `<noscript>` rule that undoes every reveal when there is no
          JavaScript to run it lives in `app/layout.tsx`, because every
          marketing surface needs it and two of them are crawled. */}
      <ScrollProgress />
      <AmbientBackground />

      <main className="flex flex-1 flex-col">
        {/*
          The hero pairs the claim with the object it is a claim about — and
          with the evidence. The document is the hero, the chrome recedes,
          which is the same idea the builder is built around, said once here
          so it is not a surprise later.

          The ground it sits on is `AmbientBackground`, mounted once for
          the whole page: a parallaxing hairline grid, three slow lights and a
          glow that follows the pointer. It used to be a grid and two auras
          per section, which is how a page ends up with six atmospheres
          instead of one.
        */}
        <section className="relative px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
          <BuildGroup trigger="load" stagger={0.08} className="mx-auto max-w-7xl">
            {/*
              The headline spans, rather than sharing the row with the
              document. At this size a half-width column sets it in five
              ragged lines and the type — which is carrying the personality of
              the whole site — reads as an accident. Given the full measure it
              lands in two.
            */}
            <Built>
              <h1 className="font-display text-text max-w-[19ch] text-[clamp(2.6rem,6.8vw,4.75rem)] leading-[1.02] font-semibold tracking-tight text-balance">
                A resume builder that does not hold your resume{" "}
                {/* One word in the accent, and it is the word the whole
                    position turns on. `--accent` clears AA on this ground at
                    any size; at display size it is not close. */}
                <span className="text-accent">hostage</span>
              </h1>
            </Built>

            <div className="mt-12 grid items-start gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-16">
              <div>
                <Built>
                  <p className="text-muted max-w-[46ch] text-lg leading-relaxed">
                    Build a single-column resume in three formats, download all of them for nothing,
                    and keep every word you wrote. It runs in your browser, and works without an
                    account &mdash; nothing is sent anywhere unless you sign in and save it.
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
                      className="text-text focus-visible:ring-accent rule-grow rounded-sm text-sm font-medium transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Or check a resume you already have
                    </Link>
                  </div>
                </Built>

                <Built className="mt-6">
                  <p className="text-faint text-sm">No sign-up needed. Nothing to cancel.</p>
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
                          className="border-line bg-surface-0 text-muted spot lift rounded-md border px-3 py-1.5 text-xs font-medium"
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
          Asymmetric on purpose. Every band on the old page was a centred
          heading over a grid, six times; giving this one a column of its own
          for the heading — held in place while the statements scroll past it
          — is what stops the page reading as one rhythm repeated.
        */}
        {/* Frosted rather than opaque: the band is still a distinct ground,
            but the field behind the page carries through it, so the page
            reads as one atmosphere with bands laid on it rather than as six
            unrelated rectangles. */}
        <section className="bg-surface-0/70 border-line border-y px-6 py-16 backdrop-blur-sm sm:py-24">
          <BuildGroup className="mx-auto max-w-6xl" stagger={0.09}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-16">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <Built>
                  <h2 className="font-display text-text text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.1] font-semibold tracking-tight text-balance">
                    What we actually promise
                  </h2>
                </Built>
                <DrawnRule className="rule-fade mt-6" />
                <Built className="mt-5">
                  <p className="text-faint max-w-[32ch] text-sm leading-relaxed">
                    Four statements, each of which we would have to change the product to break.
                  </p>
                </Built>
              </div>

              {/* Still a <dl>: these are term-and-definition pairs, and a grid
                  of divs would throw that away for nothing.

                  They were a top hairline over nothing, on the theory that a
                  rule is enough to separate one statement from the next. It
                  is — but it left the four of them uncoloured on a page whose
                  argument is carried in pine, and the only colour they ever
                  had arrived under the pointer, which is to say never on a
                  phone. `card-tinted` gives them the palette at rest and
                  `promise-mark` gives each term the accent at the size where
                  it reads as punctuation; the spotlight still supplies the
                  hover on top of both. */}
              {/* One light across the four, rather than four hover states.
                  The statements are one argument in four parts and they
                  should read as one surface. */}
              <SpotlightGroup>
                <dl className="grid gap-y-3">
                  {PROMISES.map((promise) => (
                    <Built
                      key={promise.title}
                      className="card-tinted spot lift rounded-lg border px-5 py-5"
                    >
                      <dt className="promise-mark text-text text-base font-semibold">
                        {promise.title}
                      </dt>
                      <dd className="text-muted mt-2 max-w-[64ch] text-sm leading-relaxed">
                        {promise.body}
                      </dd>
                    </Built>
                  ))}
                </dl>
              </SpotlightGroup>
            </div>
          </BuildGroup>
        </section>

        {/*
          Numbered, and the only numbered thing on the page. Three steps in a
          fixed order genuinely are a sequence, which is the one case where a
          numbered marker carries information rather than decorating — and the
          one place a scroll-linked rule is saying something rather than
          moving.
        */}
        <section className="px-6 py-16 sm:py-24">
          <BuildGroup className="mx-auto max-w-5xl" stagger={0.09}>
            <Built>
              <h2 className="font-display text-text text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold tracking-tight">
                How it works
              </h2>
            </Built>

            <ScrollSpine className="mt-10">
              <SpotlightGroup>
                <ol className="mt-8 grid gap-6 sm:grid-cols-3">
                  {HOW_IT_WORKS.map((item, index) => (
                    <BuiltListItem
                      key={item.step}
                      className="group card-tinted spot lift flex flex-col rounded-lg border p-5"
                      variant="item"
                    >
                      {/* The marker sits above the step rather than beside
                          it, at a size that makes the sequence legible from
                          across the room. It is the one place on the page
                          where a number is carrying information — and it was
                          drawn in the hairline colour, which is the palette's
                          most neutral value, on the page's largest glyph.
                          `numeral-accent` gives it the accent at the strength
                          a marker should have; hover still takes it all the
                          way. */}
                      <span
                        aria-hidden
                        className="font-display numeral-accent group-hover:text-accent text-[2.75rem] leading-none transition-colors duration-[var(--dur)]"
                      >
                        {index + 1}
                      </span>
                      <h3 className="text-text mt-3 text-base font-semibold">{item.step}</h3>
                      <p className="text-muted mt-2 text-sm leading-relaxed">{item.body}</p>
                    </BuiltListItem>
                  ))}
                </ol>
              </SpotlightGroup>
            </ScrollSpine>
          </BuildGroup>
        </section>

        {/*
          Trust signals (P37), in the slot a competitor fills with logos and a
          star rating. We have no users yet, D14 rules out the manufactured
          kind, and the honest options were an empty slot or claims that
          survive being checked. Each one names where a stranger can verify
          it, and `trust-signals.test.ts` measures the numeric ones against
          this repository — a test count that quietly goes stale is a false
          statement on a marketing page.

          Set as a ledger rather than as cards, because that is the structure
          the content actually has: every row is a claim and the way to check
          it, and the verification is in mono because it is evidence rather
          than our words.

          The one inverted band on the page, and it is this one on purpose:
          this is the parser's section, `--machine` leads it, and the palette
          it flips to is the dark set already contrast-checked in `design.md`
          §3.3. Nothing inside needs to know it is on a dark ground.
        */}
        <section className="band-invert border-line border-y px-6 py-16 sm:py-24">
          <BuildGroup className="mx-auto max-w-5xl" stagger={0.08}>
            <Built>
              <h2 className="font-display text-text text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold tracking-tight">
                Things you can check for yourself
              </h2>
            </Built>
            <Built>
              <p className="text-muted mt-4 max-w-[58ch] text-sm leading-relaxed">
                Every line below links to where a stranger can verify it &mdash; a page in this app,
                a file in the repository, or a command you can run.
              </p>
            </Built>
            <DrawnRule className="rule-fade mt-8" />

            {/* Lit in slate, not pine. This is the parser's section and the
                accent would be claiming the wrong voice for it. */}
            <SpotlightGroup tint="machine">
              <ul className="mt-2">
                {TRUST_SIGNALS.map((signal) => (
                  <BuiltListItem
                    key={signal.claim}
                    className="group border-line hover:bg-surface-0 spot relative grid gap-x-10 gap-y-2 rounded-lg border-b px-4 py-6 transition-colors duration-[var(--dur-fast)] md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]"
                  >
                    {/* The row answering the pointer. A rule rather than a
                        background alone, because the ledger's whole visual
                        language is rules. */}
                    <span
                      aria-hidden
                      className="bg-machine absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 transition-transform duration-[var(--dur)] ease-[var(--ease)] group-hover:scale-y-100"
                    />
                    <div>
                      <p className="text-text text-base font-semibold">{signal.claim}</p>
                      <p className="text-muted mt-2 max-w-[62ch] text-sm leading-relaxed">
                        {signal.detail}
                      </p>
                    </div>
                    {/*
                      The evidence column, and the one §10.4 rewrote.
                      It used to be a repository path set in mono — which
                      told a job seeker, in the section headed "things you
                      can check for yourself", to go and read a file they
                      have no copy of. It is now what the reader should do,
                      linked to where they do it. Mono stays only on the
                      unlinked row, which is a literal command.
                    */}
                    {signal.href ? (
                      <p className="text-xs leading-relaxed md:pt-1">
                        <a
                          href={signal.href}
                          className="text-machine focus-visible:ring-machine rounded-sm underline decoration-dotted underline-offset-4 transition-colors hover:decoration-solid focus-visible:ring-2 focus-visible:outline-none"
                          {...(signal.href.startsWith("/")
                            ? {}
                            : { target: "_blank", rel: "noreferrer noopener" })}
                        >
                          {signal.evidence}
                        </a>
                      </p>
                    ) : (
                      <p className="text-machine font-mono text-xs leading-relaxed md:pt-1">
                        {signal.evidence}
                      </p>
                    )}
                  </BuiltListItem>
                ))}
              </ul>
            </SpotlightGroup>
          </BuildGroup>
        </section>

        {/*
          The honesty section. Every competitor in this category claims to
          guarantee ATS success; none can. Saying plainly what is and is not
          knowable is the differentiator, per D14 — and it is the only claim
          here that would survive being checked.
        */}
        <section className="px-6 py-16 sm:py-24">
          <BuildGroup className="mx-auto max-w-5xl" stagger={0.09}>
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-20">
              <div>
                <Built>
                  <h2 className="font-display text-text text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold tracking-tight">
                    What we will not tell you
                  </h2>
                </Built>
                <Built className="mt-7">
                  <div className="text-muted flex max-w-[62ch] flex-col gap-4 text-sm leading-relaxed">
                    <p>
                      We will not promise this resume &ldquo;beats the bots&rdquo; or is
                      &ldquo;guaranteed to pass ATS&rdquo;. Nobody can promise that. Applicant
                      tracking systems differ from each other, are configured differently by every
                      employer, and are only one step before a human decides.
                    </p>
                    <p>
                      What we can say is narrower and true: a single-column layout with real text,
                      standard section headings, and no images is the most reliably readable
                      structure across the widest range of parsers. That is what this tool produces,
                      and it is the only kind of claim we will make.
                    </p>
                    {/* `text-muted`, not a hard-coded zinc: the literal here
                        was 4.0:1 on the dark ground, under the 4.5:1 AA floor
                        §9 sets. The token is picked to clear it on every
                        surface. */}
                    <p>
                      The filename convention we use is for the recruiter&rsquo;s downloads folder,
                      not because an ATS searches on it.
                    </p>
                  </div>
                </Built>
              </div>

              {/* The refusals, listed rather than implied. The claims in the
                  section above are credible in proportion to these being
                  absent, so the two belong on one page. The strike-through is
                  the visual form of a clause removed, and it now draws itself
                  as the list arrives; the sentence introducing the list
                  carries that meaning in text, because a line through a word
                  is not something a screen reader conveys. */}
              <Built variant="row">
                <Spotlight className="card-tinted lift rounded-lg border p-6">
                  <h3 className="text-text text-sm font-semibold">
                    Claims you will never see us make
                  </h3>
                  <RefusalList claims={REFUSED_CLAIMS} />
                </Spotlight>
              </Built>
            </div>
          </BuildGroup>
        </section>

        {/*
          The closing ask. The old page ended on the refusals and then the
          footer, which left the only route into the product at the very top —
          a visitor who read the whole argument had to scroll back up to act
          on it.
        */}
        <section className="border-line relative border-t px-6 py-20 sm:py-28">
          <BuildGroup className="mx-auto max-w-3xl text-center" stagger={0.09}>
            <Built>
              <h2 className="font-display text-text text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.06] font-semibold tracking-tight text-balance">
                Start with a blank page. Leave with four files.
              </h2>
            </Built>
            <Built className="mt-5">
              <p className="text-muted mx-auto max-w-[46ch] text-base leading-relaxed">
                No account, no card, and no step at the end where the download stops being free.
              </p>
            </Built>
            <Built className="mt-9">
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                <CtaLink href="/builder">Start building</CtaLink>
                <Link
                  href="/templates"
                  className="text-text focus-visible:ring-accent rule-grow rounded-sm text-sm font-medium transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
                >
                  Look at the templates first
                </Link>
              </div>
            </Built>
          </BuildGroup>
        </section>

        <AppFooter />
      </main>
    </MotionProvider>
  );
}
