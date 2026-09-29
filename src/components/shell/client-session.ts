/**
 * Who is signed in, as the browser learns it on a page the server did not
 * render for anybody in particular.
 *
 * ## Why this exists
 *
 * The content pages — the landing page, `/check`, `/templates`, the examples
 * and guides — are prerendered once at build time and served identically to
 * everyone. That is what lets a 1/8-OCPU instance survive a link going viral:
 * serving a file costs nothing, rendering a page per request costs a CPU the
 * instance does not have. It also means their HTML cannot know who is
 * reading it, so the header asks after load, from `/api/auth/session`.
 *
 * The application routes (`/builder`, `/dashboard`, `/letters`, `/signin`)
 * still read the session on the server, and seed this store with the answer
 * so that navigating from one of them to a content page shows the right
 * header immediately rather than after a round trip.
 *
 * ## The rule that makes it safe: unknown is not guest
 *
 * `<StorageOwner>` does two things with an identity: it namespaces every
 * browser-local slot by it, and it **deletes every slot belonging to anyone
 * else** (§10.1). Publishing `guest` for a signed-in person would therefore
 * delete that person's own local work. So until an answer has actually
 * arrived the state is `unknown`, and nothing publishes an owner or purges.
 * A failed request — offline, a server restart — leaves it `unknown`, which
 * is the one outcome that can never destroy anything.
 *
 * The content pages hold no owner-scoped personal data (their only storage is
 * tab-scoped `sessionStorage` handoffs and sample thumbnails), so acting as
 * the module default until the answer lands reads nothing that is anybody's.
 *
 * ## Re-asked on every navigation
 *
 * Signing out is a Server Action that redirects to `/` as a *soft*
 * navigation, so the module state here survives it. Asking once per page
 * load would leave the header saying "signed in" after sign-out — and, far
 * worse, would never tell `<StorageOwner>` that the browser is a guest now,
 * so the previous person's slots would survive until a hard reload. Asking
 * on every pathname change is one small same-origin request and closes that.
 */

import { toOwnerKey } from "@/store/owner";

export interface ClientSessionUser {
  id: string;
  email: string;
}

export type ClientSession =
  { status: "unknown" } | { status: "known"; user: ClientSessionUser | null };

const UNKNOWN: ClientSession = { status: "unknown" };

let state: ClientSession = UNKNOWN;
const listeners = new Set<() => void>();

function publish(next: ClientSession): void {
  if (
    state.status === next.status &&
    (state.status === "unknown" ||
      (next.status === "known" &&
        state.user?.id === next.user?.id &&
        state.user?.email === next.user?.email))
  ) {
    return;
  }
  state = next;
  for (const listener of listeners) listener();
}

export function getClientSession(): ClientSession {
  return state;
}

/** The server has no browser session to report, ever. */
export function getServerClientSession(): ClientSession {
  return UNKNOWN;
}

export function subscribeToClientSession(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}

/**
 * An answer the server already had, from a route that read the session.
 *
 * Called from an effect in `<SeedClientSession>` — see there for why not
 * during render. Idempotent and silent when nothing changed, which `publish`
 * is.
 */
export function seedClientSession(user: ClientSessionUser | null): void {
  publish({ status: "known", user });
}

/**
 * Reads what Auth.js returns from `/api/auth/session`: a user, `null` for
 * nobody, or `undefined` when the body is not an answer this code can trust.
 *
 * `null` and `{}` both mean nobody — Auth.js has returned each for a missing
 * session across versions.
 *
 * **A user without a usable id is `undefined`, not nobody.** That shape means
 * somebody *is* signed in and the session callback in
 * `src/server/auth/config.ts` stopped putting the id on it. Reading it as
 * nobody would publish the guest owner, and the guest owner purges every slot
 * that is not a guest's — which for this signed-in person is their own work.
 * Unknown publishes nothing, and nothing is the only safe response to an
 * answer that does not add up.
 */
export function parseSessionResponse(body: unknown): ClientSessionUser | null | undefined {
  if (body === null) return null;
  if (typeof body !== "object" || Array.isArray(body)) return undefined;
  const user = (body as { user?: { id?: unknown; email?: unknown } | null }).user;
  if (user === undefined || user === null) return null;
  if (typeof user.id !== "string" || typeof user.email !== "string") return undefined;
  if (!user.id.trim() || !user.email.trim()) return undefined;
  return { id: user.id, email: user.email };
}

let inFlight: Promise<void> | null = null;

/**
 * Asks the server who is signed in, and publishes the answer.
 *
 * A request already in flight is shared rather than duplicated. Any failure
 * — network, a non-2xx, a body that does not parse — publishes nothing, so a
 * page that could not ask stays `unknown` and never purges.
 */
export function refreshClientSession(
  fetcher: typeof fetch = (...args) => fetch(...args),
): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetcher("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!response.ok) return;
      const user = parseSessionResponse(await response.json());
      if (user === undefined) return;
      publish({ status: "known", user });
    } catch {
      // Unknown stays unknown. See the file header for why that is the safe
      // failure rather than a guess.
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** How often, and how many times, to re-ask after a sign-out is submitted. */
export const SIGN_OUT_POLL_MS = 300;
export const SIGN_OUT_POLL_LIMIT = 20;

/**
 * A sign-out was just submitted from a prerendered page.
 *
 * Asking on every navigation covers signing out from anywhere *but* the
 * landing page: the Server Action redirects to `/`, and from `/` that is not
 * a navigation — the pathname does not change, so the effect keyed on it
 * does not re-run.
 *
 * Measured on 2026-09-28 (Next 16.3), that gap is closed anyway: a Server
 * Action that changes cookies makes the router remount the tree, the island
 * mounts again, and mounting asks. That is a framework detail rather than a
 * contract, and the cost of it changing silently is the previous person's
 * slots surviving on a shared computer — so this does not rely on it. The
 * form reports the submit, and this asks until the server says nobody:
 * the request that deletes the session and the one asking about it race, and
 * the first answer can still be the old session. Bounded — if the sign-out
 * genuinely failed, the header goes on showing the account that is still
 * signed in, which is the truth.
 *
 * It does not drop the state to `unknown` first, tempting as that is for the
 * header. The submit handler runs while React is dispatching the form's
 * Server Action, and a synchronous store change there re-renders the header
 * and removes the very form being submitted. The account stays on screen for
 * the few hundred milliseconds until the server confirms, which is accurate.
 */
export function expectSignOut(
  fetcher: typeof fetch = (...args) => fetch(...args),
  schedule: (run: () => void, ms: number) => void = (run, ms) => void setTimeout(run, ms),
): void {
  let attempts = 0;
  const ask = (): void => {
    attempts += 1;
    void refreshClientSession(fetcher).then(() => {
      const signedOut = state.status === "known" && state.user === null;
      if (!signedOut && attempts < SIGN_OUT_POLL_LIMIT) schedule(ask, SIGN_OUT_POLL_MS);
    });
  };
  schedule(ask, SIGN_OUT_POLL_MS);
}

/** The owner key for a known session, or null while it is not known. */
export function ownerForSession(session: ClientSession): string | null {
  return session.status === "known" ? toOwnerKey(session.user?.id) : null;
}

/** Tests only. */
export function resetClientSessionForTests(): void {
  state = UNKNOWN;
  listeners.clear();
  inFlight = null;
}
