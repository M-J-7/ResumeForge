/**
 * The application header (P22-E1).
 *
 * There was no shared header before this. The landing page inlined a footer,
 * the dashboard hand-rolled a heading row with a sign-out form in it, and the
 * builder had no way back to anything. Every page now has one bar with the
 * same three jobs: say where you are, get you somewhere else, and hold the
 * theme control.
 *
 * ## A server component, reading the session
 *
 * Whether to show "Sign in" or the account menu is knowable on the server, and
 * rendering the signed-out state first and correcting it on the client is the
 * flicker every app with a header has. `getSessionUser()` costs one indexed
 * read when a session cookie is present and nothing at all when it is not, so
 * a guest on the landing page pays nothing.
 *
 * ## Height is a contract
 *
 * `h-14` is fixed and the header never grows. `BuilderShell` computes a
 * full-height three-column layout beneath it, and the preview's scroll region
 * depends on knowing how much vertical space it has. A header that reflowed —
 * wrapping nav items onto a second line on a narrow viewport, say — would
 * silently shrink the preview canvas.
 *
 * That contract used to be enforced with `overflow-hidden`, which kept the
 * height correct by clipping the navigation off the screen entirely on a
 * phone. `HeaderNav` now holds it properly: below `md` the links live in an
 * absolutely-positioned panel, which cannot affect the bar's height whether it
 * is open or closed. `relative` here is what that panel is positioned against.
 */

import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { signOutAction } from "@/app/signin/actions";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { FileTextIcon } from "@/components/ui/icons";
import { HeaderNav, type HeaderLinkSpec } from "./HeaderNav";
import { StorageOwner } from "./StorageOwner";
import { toOwnerKey } from "@/store/owner";
import { PRODUCT_NAME } from "@/lib/product";

const PUBLIC_LINKS: readonly HeaderLinkSpec[] = [
  { href: "/builder", label: "Builder" },
  // Public and useful before anyone has built anything, which is the whole
  // point of it — see `app/check/page.tsx`.
  { href: "/templates", label: "Templates" },
  { href: "/examples", label: "Examples" },
  { href: "/check", label: "Check" },
  /*
    Public, and it was not. The argument for hiding it from guests was that a
    list which is empty until you have built a resume is a dead end — but the
    empty state is not a dead end, it explains what a letter here is and hands
    over a "Write a cover letter" button, and `/letters` genuinely works
    signed out: a guest's letters live in IndexedDB, exactly like their
    resume (D6). Reaching it only from the Match tab meant the whole feature
    was invisible to anyone who had not already pasted a job description,
    which is every first-time visitor.
  */
  { href: "/letters", label: "Cover letters" },
];

const SIGNED_IN_LINKS: readonly HeaderLinkSpec[] = [{ href: "/dashboard", label: "My resumes" }];

export async function AppHeader() {
  const user = await getSessionUser();
  const links = user ? [...PUBLIC_LINKS, ...SIGNED_IN_LINKS] : PUBLIC_LINKS;

  return (
    <header className="border-line bg-surface-0/85 sticky top-0 z-40 h-14 shrink-0 border-b backdrop-blur-md">
      {/*
        Publishes who this browser is acting as, before anything below it can
        construct a storage key (§10.1). Renders nothing; it is here rather
        than in each page because this is the one server component that reads
        the session on every route. See `StorageOwner` for why it is first.
      */}
      <StorageOwner owner={toOwnerKey(user?.id)} />
      <div className="relative mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="text-text focus-visible:ring-accent flex shrink-0 items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          <FileTextIcon className="text-accent h-5 w-5" />
          {/* Read from `lib/product.ts`, never written out here — choosing a
              name has to stay the one-line change that file promises, and the
              way that stops being true is a component hardcoding the string.
              `trust-signals.test.ts` asserts no surface does.

              `sr-only` below `sm`, not hidden: the wordmark plus the menu
              button, the theme control and the sign-in link overflow 390px
              together, and the wordmark is the one of the four that a phone
              can spare — the mark still identifies the product and the h1
              says the name. Hiding it outright would leave the link with no
              accessible name at all, which is why it stays in the tree. */}
          <span className="sr-only sm:not-sr-only">{PRODUCT_NAME}</span>
        </Link>

        <HeaderNav links={links} />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {user ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-accent rounded-md px-2.5 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/signin"
              className="border-line-strong text-text hover:bg-surface-2 focus-visible:ring-accent rounded-md border px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
