"use client";

/**
 * The social-proof slot, filled with things that survive being checked.
 *
 * ## Why this shape
 *
 * Every competitor puts logos, a star rating and "trusted by 2 million job
 * seekers" here. We have no users yet, D14 rules out manufacturing that, and
 * `structured-data.test.ts` asserts there is no `aggregateRating` anywhere —
 * so the honest options were an empty slot or **checkable claims as the
 * proof**. That is what these are, and each tile names where a stranger goes
 * to check it.
 *
 * It was a ledger: six rows, each a claim and a link, stacked. The content is
 * genuinely rows-of-a-list, so that was not wrong — it was just flat, and it
 * said all six claims were worth the same. They are not. The one the whole
 * product turns on is "we re-read the file we just made you", and in a ledger
 * it was the first of six identical lines.
 *
 * So: unequal tiles, because the claims are unequal. The lead tile is twice
 * the size and carries a readout; the number is set at the size a number
 * deserves; the rest are standard. This is the page's one bento, and the
 * reason it is allowed to be one is that the *content* has a hierarchy — not
 * because bento grids are what landing pages have.
 *
 * ## Still a list
 *
 * `<ul>`/`<li>`, with the grid on the list and the spans on the items. A grid
 * of `<div>`s would throw away the one structural fact about this section —
 * that it is six of the same kind of thing — for a layout CSS gives either
 * way.
 *
 * ## Lit in slate
 *
 * `SpotlightGroup tint="machine"`: this is the parser's section and the accent
 * would be claiming the wrong voice for it. One light across all six rather
 * than six hover states, so the grid reads as one surface.
 */

import { BuiltListItem } from "./Build";
import { Eyebrow } from "./Eyebrow";
import { sampleReadout } from "./PaperSample";
import { SpotlightGroup } from "@/components/ui/Spotlight";
import { cn } from "@/lib/utils";
import type { TrustSignal } from "@/lib/trust-signals";

/**
 * Where each kind of tile sits in the six-column grid.
 *
 * The lead takes the whole width and the other three take a third each, which
 * is one clean row under it. It used to be four columns tall enough for two
 * rows, with five standard tiles flowing around it — that arrangement fills
 * the grid exactly at six tiles and leaves a two-thirds-empty row at four.
 *
 * Going full width is not a concession to the arithmetic. The lead tile is
 * the claim the product turns on, and a tile that spans everything says so
 * more plainly than a tall one in a corner; it also gives the readout a
 * column of its own instead of stacking it under the prose.
 */
const SPAN = {
  lead: "sm:col-span-2 lg:col-span-6",
  standard: "sm:col-span-1 lg:col-span-2",
} as const;

function EvidenceLink({ signal }: { signal: TrustSignal }) {
  if (!signal.href) {
    // The one row with nowhere to send you: "run `pnpm verify`" is a command,
    // and inventing a destination for it would be worse than admitting that.
    return <p className="text-machine text-micro mt-4 font-mono">{signal.evidence}</p>;
  }

  return (
    <p className="text-small mt-4">
      <a
        href={signal.href}
        className="text-machine focus-visible:ring-machine rounded-sm underline decoration-dotted underline-offset-4 transition-colors hover:decoration-solid focus-visible:ring-2 focus-visible:outline-none"
        {...(signal.href.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer noopener" })}
      >
        {signal.evidence}
      </a>
    </p>
  );
}

/**
 * The lead tile's readout.
 *
 * Computed from the sample resume this page already renders, and labelled with
 * which document it is describing. A made-up scorecard on the one section
 * headed "things you can check for yourself" would be the worst thing on the
 * site; this is the same object the hero is built from, read back.
 */
function Readout() {
  return (
    <div className="machine-panel rounded-lg border p-4">
      <Eyebrow>x-ray · the sample resume on this page</Eyebrow>
      <dl className="text-micro mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 font-mono">
        {sampleReadout().map((row) => (
          <div key={row.field} className="col-span-2 grid grid-cols-subgrid items-baseline">
            <dt className="text-faint">{row.field}</dt>
            {/* The values are the machine's, so they are in the machine's
                colour. The labels are ours, so they are not. */}
            <dd className="text-machine text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EvidenceBento({ signals }: { signals: readonly TrustSignal[] }) {
  return (
    <SpotlightGroup tint="machine">
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {signals.map((signal) => {
          const kind = signal.tile ?? "standard";
          return (
            <BuiltListItem
              key={signal.claim}
              variant="row"
              className={cn(
                "spot lift machine-panel flex flex-col rounded-xl border p-6",
                SPAN[kind],
                kind === "lead" && "lg:p-8",
              )}
            >
              {/*
                The lead sets its prose and its readout side by side; every
                other tile is a single column. `items-start` so the readout
                sits against the top of its column rather than stretching to
                whatever height the sentence beside it happens to need.
              */}
              <div
                className={cn(
                  kind === "lead" &&
                    "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10",
                )}
              >
                <div className="flex flex-col">
                  <p
                    className={cn(
                      "text-text font-semibold",
                      kind === "lead" ? "text-display-3" : "text-body",
                    )}
                  >
                    {signal.claim}
                  </p>

                  <p
                    className={cn(
                      "text-muted max-w-measure mt-2 leading-relaxed",
                      kind === "lead" ? "text-body-l" : "text-small",
                    )}
                  >
                    {signal.detail}
                  </p>
                </div>

                {kind === "lead" ? <Readout /> : null}
              </div>

              {/*
                Pushed to the bottom edge, so the links line up across a row of
                tiles that do not have the same amount to say — the lead
                included.

                The lead's link was briefly inside the prose column, which put
                it under the sentence it belongs to on a wide screen and
                *above* the readout everywhere the two columns stack. A call
                to action buried in the middle of a tile is worse than one a
                line further down, and one rule for all four tiles is worth
                more than the wide-screen nicety it cost.
              */}
              <div className="mt-auto">
                <EvidenceLink signal={signal} />
              </div>
            </BuiltListItem>
          );
        })}
      </ul>
    </SpotlightGroup>
  );
}
