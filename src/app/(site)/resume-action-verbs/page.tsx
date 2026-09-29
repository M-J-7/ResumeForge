/**
 * `/resume-action-verbs` — verbs to open a bullet with, grouped by what you
 * did (ROADMAP Phase 3).
 *
 * The usual answer to this search is two hundred words in alphabetical order,
 * which helps nobody choose. This one is grouped the way the builder's phrase
 * bank is, gives each group sentence shapes to fill in, and ends with the
 * openers the builder's own checker will flag — so the page and the product
 * cannot give a reader different advice. Everything here is data from
 * `lib/verbs/action-verbs.ts`, which says where each part comes from.
 *
 * Prerendered and server-only, like every page in this group: a reference
 * list is exactly the content a crawler should get as plain HTML.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { CtaLink } from "@/components/marketing/CtaLink";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { Breadcrumbs } from "@/components/marketing/Breadcrumbs";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, referenceArticleJsonLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";
import { formatContentDate } from "@/lib/content-dates";
import { GUIDES } from "@/lib/guides/guides";
import { ROLE_EXAMPLES } from "@/lib/examples/roles";
import {
  ACTION_VERBS_PATH,
  ACTION_VERBS_UPDATED,
  ALL_ACTION_VERBS,
  VERB_GROUPS,
  WEAK_OPENERS,
} from "@/lib/verbs/action-verbs";

const TITLE = "Resume action verbs, grouped by what you did";
const DESCRIPTION =
  `${ALL_ACTION_VERBS.length} action verbs for a resume, grouped by the kind of thing you did, ` +
  "with sentence shapes to fill in — and the openers to stop using.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: ACTION_VERBS_PATH,
});

/** The guides and examples this page is most useful beside. */
const RELATED_GUIDES = ["how-to-quantify-a-bullet", "what-an-ats-actually-does"];
const RELATED_EXAMPLES = ["sales-representative", "registered-nurse", "graduate-no-experience"];

export default function ActionVerbsPage() {
  const trail = [
    { name: "Guides", path: "/guides" },
    { name: "Resume action verbs", path: ACTION_VERBS_PATH },
  ];

  return (
    <>
      <JsonLdScript
        data={referenceArticleJsonLd({
          headline: TITLE,
          description: DESCRIPTION,
          path: ACTION_VERBS_PATH,
          dateModified: ACTION_VERBS_UPDATED,
        })}
      />
      <JsonLdScript data={breadcrumbJsonLd(trail)} />

      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        <PageHeader stage containerClassName="max-w-4xl">
          <Built>
            <Breadcrumbs trail={trail} />
          </Built>
          <Built className="mt-3">
            <h1 className={PAGE_TITLE_CLASS}>{TITLE}</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              Find the group that matches what you actually did, open the bullet with one of its
              verbs, then fill the blanks with your own facts. A verb on its own says nothing; the
              shapes under each group are the part that turns one into a bullet.
            </p>
          </Built>
          <Built className="mt-4">
            <p className="text-faint text-micro font-mono">
              {ALL_ACTION_VERBS.length} verbs · {VERB_GROUPS.length} groups · Updated{" "}
              <time dateTime={ACTION_VERBS_UPDATED}>{formatContentDate(ACTION_VERBS_UPDATED)}</time>
            </p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-4xl flex-col gap-12 px-6">
          {/* A jump list, because twelve groups is a long page and a reader
              arrives knowing which one they want. In-page anchors, so it also
              works with scripting off. */}
          <nav aria-labelledby="groups-heading" className="flex flex-col gap-3">
            <h2 id="groups-heading" className="text-text text-title font-semibold">
              What did you do?
            </h2>
            <ul className="flex flex-wrap gap-2">
              {VERB_GROUPS.map((group) => (
                <li key={group.id}>
                  <a
                    href={`#${group.id}`}
                    className="border-line bg-surface-1 text-muted hover:border-line-strong hover:text-text focus-visible:ring-accent inline-flex rounded-full border px-3 py-1.5 text-sm transition focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {group.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-faint text-small max-w-read leading-relaxed">
              Spellings here are British &mdash; analysed, organised. The American ones (analyzed,
              organized) are just as correct; what matters is using one of them throughout.
            </p>
          </nav>

          {VERB_GROUPS.map((group) => (
            <section
              key={group.id}
              id={group.id}
              aria-labelledby={`${group.id}-heading`}
              className="border-line flex scroll-mt-20 flex-col gap-4 border-t pt-8"
            >
              <div className="flex flex-col gap-1">
                <h2 id={`${group.id}-heading`} className="text-text text-title font-semibold">
                  {group.label}
                </h2>
                <p className="text-muted text-small max-w-read leading-relaxed">{group.hint}</p>
              </div>

              <ul className="flex flex-wrap gap-2" aria-label={`Verbs for: ${group.label}`}>
                {group.verbs.map((verb) => (
                  <li
                    key={verb}
                    className="border-line bg-surface-0 text-text rounded-md border px-2.5 py-1 font-mono text-sm"
                  >
                    {verb}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2">
                <h3 className="text-muted text-small font-semibold">Shapes to fill in</h3>
                <ul className="flex flex-col gap-1.5">
                  {group.shapes.map((shape) => (
                    <li
                      key={shape}
                      className="machine-panel text-muted text-micro rounded-md border px-3 py-2 font-mono"
                    >
                      {shape}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}

          <section
            aria-labelledby="weak-heading"
            className="border-line flex flex-col gap-4 border-t pt-8"
          >
            <h2 id="weak-heading" className="text-text text-title font-semibold">
              Openers to stop using
            </h2>
            <p className="text-muted text-body max-w-read leading-relaxed">
              These are the openings the checker in the builder flags. None of them is wrong
              English; each one describes being present rather than what you did, and the fix is
              nearly always to say the thing it is standing in for.
            </p>
            <div className="border-line overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-1 text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      Instead of
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      Why
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      Try
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {WEAK_OPENERS.map((weak) => (
                    <tr key={weak.phrase} className="border-line border-t align-top">
                      <th scope="row" className="text-text px-4 py-3 font-mono font-medium">
                        {weak.phrase}
                      </th>
                      <td className="text-muted px-4 py-3 leading-relaxed">{weak.why}</td>
                      <td className="text-text px-4 py-3 font-mono">{weak.instead.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <RelatedLinks
            groups={[
              {
                title: "Guides",
                items: GUIDES.filter((guide) => RELATED_GUIDES.includes(guide.slug)).map(
                  (guide) => ({
                    href: `/guides/${guide.slug}`,
                    label: guide.title,
                    detail: guide.summary,
                  }),
                ),
              },
              {
                title: "See them in a full resume",
                items: ROLE_EXAMPLES.filter((example) =>
                  RELATED_EXAMPLES.includes(example.slug),
                ).map((example) => ({
                  href: `/examples/${example.slug}`,
                  label: `${example.role} resume example`,
                  detail: example.summary,
                })),
              },
            ]}
          />

          <section className="border-line flex flex-wrap items-center gap-x-6 gap-y-4 border-t pt-8">
            {/* `MotionProvider` because `CtaLink` is an `m.*` component and
                `LazyMotion strict` throws outside one. */}
            <MotionProvider>
              <CtaLink href="/builder" size="md">
                Write a bullet with them
              </CtaLink>
            </MotionProvider>
            <Link
              href="/guides"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              All guides
            </Link>
            <Link
              href="/bullet-point-checker"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              Check a bullet
            </Link>
            <Link href="/check" className="text-accent rule-grow text-small rounded-sm font-medium">
              Check a resume
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
