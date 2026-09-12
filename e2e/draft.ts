/**
 * Waiting for a guest's draft to actually be durable.
 *
 * Shared because two specs need it and a third copy was about to be written.
 * Both `auth.spec.ts` and `match-and-letters.spec.ts` build a resume as a
 * guest and then navigate away from the builder, and a guest's resume lives
 * in IndexedDB and nowhere else (D6) — so "has the edit landed" is a question
 * about that one key, not about anything on screen.
 *
 * Since §10.1 that key carries an owner — `resume-draft::guest` for a
 * browser with nobody signed in, `resume-draft::<user id>` afterwards. The
 * separator and the literal are spelled out here rather than imported from
 * `src/store/owner.ts`: these run in the *page*, through `page.evaluate`,
 * where the app's modules are not in scope, and a helper that quietly agreed
 * with the app because it shared a constant would not notice the namespacing
 * being dropped — which is the bug this all exists to prevent.
 */

import { expect, type Page } from "@playwright/test";

/** The slot a browser with nobody signed in writes its draft to. */
export const GUEST_DRAFT_KEY = "resume-draft::guest";

/** Reads one draft slot exactly as `createDraftStore` wrote it, or null. */
export function readDraftSlot(page: Page, key: string): Promise<string | null> {
  return page.evaluate(
    (slot) =>
      new Promise<string | null>((resolve) => {
        const request = indexedDB.open("keyval-store");
        request.onsuccess = () => {
          const read = request.result
            .transaction("keyval", "readonly")
            .objectStore("keyval")
            .get(slot);
          read.onsuccess = () => resolve((read.result as string | undefined) ?? null);
          read.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
      }),
    key,
  );
}

/** Every key the shared `keyval-store` currently holds. */
export function readAllKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const request = indexedDB.open("keyval-store");
        request.onsuccess = () => {
          const read = request.result
            .transaction("keyval", "readonly")
            .objectStore("keyval")
            .getAllKeys();
          read.onsuccess = () => resolve(read.result.map(String));
          read.onerror = () => resolve([]);
        };
        request.onerror = () => resolve([]);
      }),
  );
}

/**
 * Every draft slot in this browser, concatenated.
 *
 * Deliberately not one named key. Since §10.1 the builder writes to
 * `resume-draft::guest` when nobody is signed in and `resume-draft::<user
 * id>` when somebody is, and the specs here build drafts both ways — several
 * sign in *first* and then type. The question this helper exists to answer is
 * "is the edit durable in this browser yet", and that is true of whichever
 * slot it landed in.
 *
 * Which slot it *should* be is a different question, asserted directly by the
 * §10.1 tests in `auth.spec.ts` rather than smuggled in here.
 */
function readAllDrafts(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const request = indexedDB.open("keyval-store");
        request.onsuccess = () => {
          const store = request.result.transaction("keyval", "readonly").objectStore("keyval");
          const read = store.openCursor();
          const found: string[] = [];
          read.onsuccess = () => {
            const cursor = read.result;
            if (!cursor) return resolve(found.join(" "));
            if (
              String(cursor.key).startsWith("resume-draft::") &&
              typeof cursor.value === "string"
            ) {
              found.push(cursor.value);
            }
            cursor.continue();
          };
          read.onerror = () => resolve("");
        };
        request.onerror = () => resolve("");
      }),
  );
}

/**
 * Waits until the builder's 500ms autosave has committed *the edit that
 * matters*, named by a string that must appear in the stored draft.
 *
 * ## Why it takes the text rather than just checking the key exists
 *
 * The obvious version resolves as soon as `resume-draft` is present, and that
 * is a no-op for the thing it is meant to prevent: the key is written by the
 * *first* field a test fills, so the poll passes on the name and returns
 * while the edit under test is still inside the debounce window. The suite
 * then navigates, `pagehide` starts a flush that is asynchronous, the
 * navigation cuts it off, and the edit is never written at all.
 *
 * Measured rather than guessed: autosave commits at ~520ms, exactly the
 * debounce, with or without other interaction in between. The product is not
 * slow — a wait that asks whether *some* draft exists is just answering a
 * different question from the one the test needs answered. Naming the text is
 * what makes it the right question, and it is why a fixed `waitForTimeout`
 * belongs nowhere near this: that hides the race on a fast machine and fails
 * on a loaded one.
 */
export async function waitForDraftSaved(page: Page, mustContain: string): Promise<void> {
  await expect.poll(() => readAllDrafts(page), { timeout: 15_000 }).toContain(mustContain);
}
