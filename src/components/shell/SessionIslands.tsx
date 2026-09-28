"use client";

/**
 * The parts of `SiteHeader` that depend on who is signed in, which a
 * prerendered page learns only after it loads. See `./client-session.ts` for
 * the whole argument; the short version is that nothing here publishes an
 * owner, or lets the purge run, until the server has actually answered.
 *
 * Until it answers, the header draws the signed-out state. Most visitors to a
 * content page are signed out, so for them it is correct from the first
 * paint, and what a crawler reads in the prerendered HTML is the same thing a
 * guest sees. A signed-in reader sees their account appear a round trip later.
 */

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { HEADER_LINKS, HEADER_SIGNED_IN_LINKS } from "@/lib/nav";
import { HeaderAccount } from "./HeaderAccount";
import { HeaderNav } from "./HeaderNav";
import { StorageOwner } from "./StorageOwner";
import {
  expectSignOut,
  getClientSession,
  getServerClientSession,
  ownerForSession,
  refreshClientSession,
  seedClientSession,
  subscribeToClientSession,
  type ClientSession,
  type ClientSessionUser,
} from "./client-session";

function useClientSession(): ClientSession {
  return useSyncExternalStore(subscribeToClientSession, getClientSession, getServerClientSession);
}

function knownUser(session: ClientSession): ClientSessionUser | null {
  return session.status === "known" ? session.user : null;
}

/**
 * Asks who is signed in on arrival and after every navigation, and hands the
 * answer to `<StorageOwner>` once there is one.
 *
 * Renders `<StorageOwner>` *only* for a known session. An unknown one renders
 * nothing — not a guest owner — because a guest owner purges every slot that
 * is not a guest's, and for a signed-in reader that is their own work.
 */
export function ClientStorageOwner() {
  const session = useClientSession();
  const pathname = usePathname();

  useEffect(() => {
    void refreshClientSession();
  }, [pathname]);

  const owner = ownerForSession(session);
  return owner === null ? null : <StorageOwner owner={owner} />;
}

export function SessionHeaderNav() {
  const user = knownUser(useClientSession());
  const links = user ? [...HEADER_LINKS, ...HEADER_SIGNED_IN_LINKS] : HEADER_LINKS;
  return <HeaderNav links={links} showCta={!user} />;
}

export function SessionHeaderAccount() {
  return <HeaderAccount user={knownUser(useClientSession())} onSignOut={() => expectSignOut()} />;
}

/**
 * Hands the server's answer to the client store, from a route that read it.
 *
 * In an effect, deliberately — unlike `<StorageOwner>`, which writes during
 * render because the builder must not construct a store before it. Nothing
 * on the page that renders this reads the client store; it is for the *next*
 * page, after a soft navigation into a prerendered one. Writing it during
 * render would notify the islands of the page being navigated away from while
 * React is rendering a different component, which React reports as an error.
 */
export function SeedClientSession({ user }: { user: ClientSessionUser | null }) {
  const id = user?.id ?? null;
  const email = user?.email ?? null;

  useEffect(() => {
    seedClientSession(id && email ? { id, email } : null);
  }, [id, email]);

  return null;
}
