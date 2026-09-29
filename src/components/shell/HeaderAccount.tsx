/**
 * The right end of the header: which account, and the way out of it — or the
 * way in, and the one thing the product is for.
 *
 * Takes the user rather than reading one, because it is rendered from both
 * sides of the network: by `AppHeader` on the server and by `SiteHeader`'s
 * client island after it has asked. No directive for the same reason as
 * `HeaderChrome`. The sign-out Server Action is importable from either side.
 */

import Link from "next/link";
import { signOutAction } from "@/app/signin/actions";
import { HeaderCta } from "./HeaderCta";

export interface HeaderAccountProps {
  user: { email: string } | null;
  /**
   * Told when sign-out is submitted. Only the prerendered header passes it —
   * see `expectSignOut` in `./client-session.ts` for why it has to know. A
   * server component cannot pass a function, and `AppHeader` has no need to.
   */
  onSignOut?: () => void;
}

export function HeaderAccount({ user, onSignOut }: HeaderAccountProps) {
  if (user) {
    return (
      <>
        {/*
          Which account, not just that there is one. `role="img"` with a
          label keeps it a statement: an avatar rendered as a button is
          a menu, and the menu it would open has exactly one item in it.
        */}
        <span
          role="img"
          aria-label={`Signed in as ${user.email}`}
          title={user.email}
          className="bg-accent-weak text-accent hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:flex"
        >
          {user.email.slice(0, 1).toUpperCase()}
        </span>
        <form action={signOutAction} onSubmit={onSignOut}>
          <button
            type="submit"
            className="text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-accent rounded-md px-2.5 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none"
          >
            Sign out
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <Link
        href="/signin"
        className="text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-accent rounded-md px-2.5 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none"
      >
        Sign in
      </Link>
      <HeaderCta />
    </>
  );
}
