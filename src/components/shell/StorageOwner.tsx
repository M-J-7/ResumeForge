"use client";

/**
 * Tells the browser whose storage it is holding (§10.1).
 *
 * Renders nothing. Its whole job is to move one string — the signed-in
 * user's id, or `guest` — from the server, which is the only side that knows
 * it, to `src/store/owner.ts`, which is what every client-side storage key is
 * built from.
 *
 * ## Why the layout, and not the three pages the plan named
 *
 * The improvement plan proposed threading `user.id` down from
 * `builder/page.tsx`, `dashboard/page.tsx` and `letters/[id]/page.tsx`. That
 * covers the three pages the leak was *reported* on, and misses `/letters`,
 * the Match tab, `/templates` and `/check` — all of which write browser-local
 * state too. `AppHeader` is a server component that already reads the session
 * on every route, so publishing the owner from there costs one prop and no
 * extra query, and there is no route where a store can be constructed before
 * the identity is known.
 *
 * ## Why the write happens during render
 *
 * `BuilderShell` decides what to hydrate in a mount effect. React flushes
 * effects in tree order, so an effect here would *probably* run first — but
 * "probably" is not the standard for the fix to a bug that showed one user
 * another user's resume. Render runs strictly parent-before-child and
 * left-to-right, so writing during render is ordered by the framework rather
 * than by a scheduling detail. The write is idempotent module state, not
 * React state, so it cannot loop and cannot tear a render.
 *
 * It is guarded on `window` because a client component's render body also
 * runs during SSR, and module state on the server is shared by every
 * concurrent request — writing there would leak one visitor's identity into
 * another visitor's render. That is why `useOwnerKey`'s server snapshot is a
 * constant.
 *
 * The purge is asynchronous I/O and stays in an effect. It is safe to run
 * late: it only ever deletes slots belonging to *neither* the current owner
 * nor `guest`, and those are the two the app writes to.
 */

import { useEffect } from "react";
import { setCurrentOwner } from "@/store/owner";

export function StorageOwner({ owner }: { owner: string }) {
  if (typeof window !== "undefined") setCurrentOwner(owner);

  useEffect(() => {
    // Belt and braces: the render-phase write above is what orders this
    // correctly against `BuilderShell`, and this is what covers a re-render
    // React discarded. Both are idempotent.
    setCurrentOwner(owner);

    // Imported here rather than at the top of the file so the landing page
    // does not carry it. `@/store/purge` reaches the key constants in every
    // client store — which is the point of it, so adding a store and
    // forgetting to purge it is one change rather than two — and this
    // component is mounted on every route, including the ones a guest sees
    // before they have any local state at all.
    void import("@/store/purge").then(({ purgeForeignStorage }) => purgeForeignStorage(owner));
  }, [owner]);

  return null;
}
