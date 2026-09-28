"use client";

/**
 * The band every reading page opens with, assembling itself.
 *
 * Before this, `/templates`, `/check`, `/examples` and `/guides` all began
 * with a 30px sans heading on the flat app ground — the same opening the
 * landing page had before the redesign, and the reason clicking a nav link
 * felt like leaving the product for its documentation. One shared band fixes
 * that in one place: the workbench grid, a single soft light, display type,
 * and the same build-on-load the landing hero uses.
 *
 * It carries `MotionProvider` itself, so a page that wants nothing else from
 * Motion does not have to know Motion exists. Children are server-rendered
 * and passed through, so the copy stays in the page file where it belongs and
 * is still in the HTML a crawler reads.
 *
 * Wrap each line in `Built` to have it arrive; anything not wrapped is simply
 * present, which is the right default for a page with one line of intro.
 *
 * ## The chrome is not in here
 *
 * `Band` holds the section, the wash and the container, and it is a **server**
 * component. This is that plus the motion. The split exists because the root
 * `not-found.tsx` is in the client graph of every route under the root layout
 * — `/builder` included — so a 404 page that imported this one would put
 * Motion's chunk on the builder's critical path, which is a hard gate. See
 * `Band.tsx`.
 */

import type { ReactNode } from "react";
import { AmbientBackground } from "./AmbientBackground";
import { Band, type BandProps } from "./Band";
import { BuildGroup } from "./Build";
import { MotionProvider } from "./MotionProvider";

export type PageHeaderProps = BandProps & { children: ReactNode };

export function PageHeader({ children, ...band }: PageHeaderProps) {
  return (
    <Band {...band}>
      <MotionProvider>
        {/* The page's whole ground, mounted once. It is fixed and sits behind
            everything, so it belongs to the page rather than to this band —
            this is simply the one component every reading page already
            renders exactly once. */}
        <AmbientBackground />
        {/* The container is `Band`'s; this only has to be the thing the
            stagger propagates from. */}
        <BuildGroup trigger="load" stagger={0.08} className="w-full">
          {children}
        </BuildGroup>
      </MotionProvider>
    </Band>
  );
}

export { PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "./Band";
