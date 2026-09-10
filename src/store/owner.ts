/**
 * Who the browser-local storage on this device belongs to (§10.1).
 *
 * ## The bug this exists to make impossible
 *
 * Every client-side store used to write to one fixed key — `resume-draft`,
 * `cover-letters`, `job-targets` — with no identity in it and nothing to
 * clear it at the auth boundary. On a shared computer the next person to
 * sign in opened the builder and saw the previous person's resume, and the
 * dashboard's claim prompt offered it to them by name.
 *
 * The server was never leaking: every query in `src/server/resumes.ts` and
 * its siblings takes `userId` first and filters on it, writes included. The
 * whole failure was below the auth provider, in the browser, which is why it
 * affected the magic link and Google identically.
 *
 * ## The shape of the fix
 *
 * One **owner key** per identity — the user id when signed in, the literal
 * `guest` when not — appended to every storage key this app owns. A slot
 * therefore belongs to exactly one person, and reading someone else's is not
 * a policy decision made at a call site but something the key algebra makes
 * unreachable.
 *
 * Namespacing alone would still leave A's resume sitting on the device after
 * B signs in, readable by anyone who opens the developer tools. So whenever
 * the browser is acting as somebody, every slot belonging to anybody else is
 * deleted — see `./purge.ts`.
 *
 * ## Why `guest` survives the purge
 *
 * Deliberately. It is what "Save it to my account" reads, and wiping it on
 * sign-in would destroy the exact work that flow exists to rescue: build as
 * a guest, sign in, adopt the draft. A guest slot is also not *somebody's*
 * in the sense that matters here — it is whatever this browser was doing
 * before anyone identified themselves.
 *
 * ## No React in this file
 *
 * The owner is read by `src/store/resume.ts`, which is a module-scoped
 * Zustand store with no component around it, and by plain functions in
 * `src/lib/`. So it is module state with a subscription, published by
 * `<StorageOwner>` from a layout that already reads the session.
 */

/** The owner key for a browser with nobody signed in. */
export const GUEST_OWNER = "guest";

/**
 * Separator between a base key and its owner.
 *
 * Two colons rather than one because base keys already contain single
 * colons (`ats-resume-builder:experience-level`), and `ownerOf` has to be
 * able to split a key back apart without guessing which colon was ours.
 */
export const OWNER_SEPARATOR = "::";

/** Turns a session user id — or its absence — into an owner key. */
export function toOwnerKey(userId: string | null | undefined): string {
  const trimmed = userId?.trim();
  return trimmed ? trimmed : GUEST_OWNER;
}

/** `resume-draft` + `guest` → `resume-draft::guest`. */
export function namespacedKey(base: string, owner: string = currentOwner()): string {
  return `${base}${OWNER_SEPARATOR}${owner}`;
}

/**
 * A namespaced key with a per-record suffix — one slot per resume, say.
 *
 * The suffix goes *after* a second separator rather than being appended to
 * the owner, so `ownerOf` can still read the identity back out of the key.
 * That matters: a key whose owner cannot be recovered is a key the purge
 * cannot decide about, and the only safe thing to do with one of those
 * would be to delete it.
 */
export function scopedKey(base: string, suffix: string, owner: string = currentOwner()): string {
  return `${namespacedKey(base, owner)}${OWNER_SEPARATOR}${suffix}`;
}

/**
 * The owner a key belongs to, or null when the key is not one of ours.
 *
 * Returns null for the legacy unnamespaced key too (`resume-draft` with no
 * separator), which is what lets `./purge.ts` treat those separately rather
 * than mistaking them for a foreign slot and deleting a guest's only draft.
 */
export function ownerOf(base: string, key: string): string | null {
  const prefix = `${base}${OWNER_SEPARATOR}`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  // The owner runs to the next separator, or to the end of the key when
  // there is no suffix. See `scopedKey`.
  const end = rest.indexOf(OWNER_SEPARATOR);
  const owner = end === -1 ? rest : rest.slice(0, end);
  return owner.length > 0 ? owner : null;
}

/* -------------------------------------------------------------------------- */
/* The current owner, as module state                                         */
/* -------------------------------------------------------------------------- */

let owner: string = GUEST_OWNER;
const listeners = new Set<() => void>();

export function currentOwner(): string {
  return owner;
}

/**
 * Publishes the identity this browser is now acting as.
 *
 * Returns whether it changed, so the caller can decide whether a purge is
 * worth doing. Idempotent by design: `<StorageOwner>` calls this during
 * render — see that component for why it cannot wait for an effect — and a
 * re-render with the same owner must be free and must not notify.
 */
export function setCurrentOwner(next: string): boolean {
  const value = next.trim() || GUEST_OWNER;
  if (value === owner) return false;
  owner = value;
  for (const listener of listeners) listener();
  return true;
}

/** Fires when the owner changes, so module-scoped stores can rebind their key. */
export function subscribeToOwner(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}

/** Tests only: puts the module back to a browser nobody has signed in on. */
export function resetOwnerForTests(): void {
  owner = GUEST_OWNER;
  listeners.clear();
}
