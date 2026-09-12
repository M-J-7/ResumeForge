"use client";

/**
 * The current owner key, as something a component can depend on (§10.1).
 *
 * Separate from `./owner.ts` so that module stays free of React — it is
 * imported by `./persistence.ts` and by plain functions in `src/lib/`, and
 * pulling React into that path would make the key algebra untestable in a
 * plain node test.
 *
 * `useSyncExternalStore` rather than `useState` + an effect, for the reason
 * it always is: the owner is decided outside React, and a component that
 * read it into state on mount would render once against the wrong identity.
 * `BuilderShell` puts this in the dependency list of the effect that decides
 * what to hydrate, which is what makes "somebody else signed in" re-run that
 * decision rather than leave the previous person's document on screen.
 */

import { useSyncExternalStore } from "react";
import { GUEST_OWNER, currentOwner, subscribeToOwner } from "./owner";

/**
 * The server snapshot is always `guest`.
 *
 * Not a simplification — it is the truth. `<StorageOwner>` only writes the
 * owner in the browser, precisely because module state on the server is
 * shared by every concurrent request, so one visitor's identity would leak
 * into another's render.
 */
export function useOwnerKey(): string {
  return useSyncExternalStore(subscribeToOwner, currentOwner, () => GUEST_OWNER);
}
