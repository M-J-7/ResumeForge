/**
 * `/changelog` — what changed on the site, and when (ROADMAP R7).
 *
 * Rendered from `src/lib/changelog.ts`, which says why the page exists and
 * what it is held to. Static, like every page in `(site)`: it changes when
 * the site does, and the site changes by deploying.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/shell/AppFooter";
import { BuildGroup, Built, BuiltListItem } from "@/components/marketing/Build";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CHANGELOG_UPDATED, changelogByDay, type ChangeKind } from "@/lib/changelog";
import { formatContentDate } from "@/lib/content-dates";
import { pageMetadata } from "@/lib/seo";
import { PRODUCT_NAME } from "@/lib/product";

export const metadata: Metadata = pageMetadata({
  title: "What changed",
  description:
    `Every change to ${PRODUCT_NAME} that reached the site, dated — new tools, fixes and what ` +
    "each one means for the resume you are building.",
  path: "/changelog",
});

const KIND: Record<ChangeKind, { label: string; tone: BadgeTone }> = {
  new: { label: "New", tone: "accent" },
  improved: { label: "Improved", tone: "ok" },
  fixed: { label: "Fixed", tone: "neutral" },
};

export default function ChangelogPage() {
  return (
    <>
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        <PageHeader stage containerClassName="max-w-3xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>What changed</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              Everything that has reached this site, newest first, dated by the day it arrived. A
              tool you trust with your resume should say what it is doing and when that changes.
            </p>
          </Built>
          <Built className="mt-3">
            <p className="text-faint text-micro font-mono">
              Last updated {formatContentDate(CHANGELOG_UPDATED)}.
            </p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-3xl flex-col gap-12 px-6">
          <MotionProvider>
            {changelogByDay().map((day) => (
              <section
                key={day.date}
                aria-labelledby={`day-${day.date}`}
                className="flex flex-col gap-4"
              >
                <h2
                  id={`day-${day.date}`}
                  className="text-text text-display-3 border-line border-b pb-2 font-semibold"
                >
                  <time dateTime={day.date}>{formatContentDate(day.date)}</time>
                </h2>
                <BuildGroup stagger={0.06}>
                  <ul className="flex flex-col gap-6">
                    {day.entries.map((entry) => (
                      <BuiltListItem key={entry.title} className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={KIND[entry.kind].tone}>{KIND[entry.kind].label}</Badge>
                          <h3 className="text-text text-title font-semibold">{entry.title}</h3>
                        </div>
                        <p className="text-muted text-body max-w-read leading-relaxed">
                          {entry.body}
                        </p>
                        {entry.link ? (
                          <Link
                            href={entry.link.href}
                            className="text-accent rule-grow text-small self-start rounded-sm font-medium"
                          >
                            {entry.link.label}
                          </Link>
                        ) : null}
                      </BuiltListItem>
                    ))}
                  </ul>
                </BuildGroup>
              </section>
            ))}
          </MotionProvider>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
