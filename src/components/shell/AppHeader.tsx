/**
 * The header for the application routes, which read the session on the
 * server (P22-E1). The markup, and why it looks the way it does, is
 * `HeaderChrome`.
 *
 * ## Two headers, because there are two kinds of page
 *
 * `/builder`, `/dashboard`, `/letters` and `/signin` are rendered per request
 * anyway — they are about one person's data — and here the identity is
 * knowable on the server. Rendering the signed-out state first and correcting
 * it on the client is the flicker every app with a header has, and on these
 * routes it would be worse than a flicker: `<StorageOwner>` has to know the
 * owner *before* `BuilderShell` constructs a store (§10.1), which only a
 * server-rendered answer guarantees. `getSessionUser()` costs one indexed read
 * when a session cookie is present and nothing when it is not.
 *
 * The content pages are the other kind. They are prerendered once and served
 * to everyone, which a per-request session read would forbid — so they mount
 * `SiteHeader`, which asks from the browser. Each application route mounts
 * this one from its own `layout.tsx`, and the content pages share
 * `src/app/(site)/layout.tsx`.
 *
 * It also seeds the browser's session store (`<SeedClientSession>`), so that
 * a soft navigation from here to a content page shows the right account at
 * once instead of a round trip later.
 */

import { getSessionUser } from "@/server/auth/session";
import { toOwnerKey } from "@/store/owner";
import { HEADER_LINKS, HEADER_SIGNED_IN_LINKS } from "@/lib/nav";
import { HeaderAccount } from "./HeaderAccount";
import { HeaderChrome } from "./HeaderChrome";
import { HeaderNav } from "./HeaderNav";
import { SeedClientSession } from "./SessionIslands";
import { StorageOwner } from "./StorageOwner";

export async function AppHeader() {
  const user = await getSessionUser();
  const links = user ? [...HEADER_LINKS, ...HEADER_SIGNED_IN_LINKS] : HEADER_LINKS;

  return (
    <HeaderChrome
      before={
        <>
          {/*
            Publishes who this browser is acting as, before anything below it
            can construct a storage key (§10.1). Renders nothing. See
            `StorageOwner` for why it is first.
          */}
          <StorageOwner owner={toOwnerKey(user?.id)} />
          <SeedClientSession user={user ? { id: user.id, email: user.email } : null} />
        </>
      }
      nav={<HeaderNav links={links} showCta={!user} />}
      account={<HeaderAccount user={user} />}
    />
  );
}
