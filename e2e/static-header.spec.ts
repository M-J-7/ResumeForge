/**
 * The prerendered content pages, and the header that learns who is reading
 * from the browser (ROADMAP Phase 1 · §10.1 still holding).
 *
 * The content pages stopped reading the session on the server so that they
 * could be built once and served as files. Three things have to stay true for
 * that to be a pure win rather than a trade:
 *
 * 1. The page really is one file for everyone — nothing personal in the HTML.
 * 2. A signed-in reader still sees their account, and **the purge of other
 *    people's browser-local data still runs on these pages**. It used to run
 *    from the server-rendered header on every route; now, on these routes, it
 *    runs once the browser has asked who is signed in.
 * 3. Signing out from the landing page is noticed. The sign-out redirects to
 *    `/`, which from `/` is not a navigation. Two things re-ask today — Next
 *    remounts the tree after a cookie-changing Server Action, and the form
 *    reports the submit (`expectSignOut`) — and this asserts the outcome, not
 *    which of them delivered it.
 *
 * A session is created directly in the e2e database rather than through the
 * magic link: the mail capture server binds a fixed port that
 * `auth.spec.ts` owns, and these tests are about what happens *after*
 * sign-in, which the auth spec already proves end to end.
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { E2E_DATABASE_FILE } from "../playwright.config";
import { readAllKeys } from "./draft";

const ORIGIN = "http://localhost:3000";
/** Auth.js's cookie name over plain HTTP; `__Secure-` is added only on https. */
const SESSION_COOKIE = "authjs.session-token";

/** Stored the way the Prisma adapter stores them: ISO text with an offset. */
function isoWithOffset(date: Date): string {
  return date.toISOString().replace("Z", "+00:00");
}

/** A signed-in identity: a real user row and a real session row. */
function createSignedInUser(label: string): { id: string; email: string; token: string } {
  const id = `static-${label}-${randomUUID()}`;
  const email = `${label}-${Date.now()}@e2e.test`;
  const token = randomUUID();
  const now = new Date();

  const db = new Database(E2E_DATABASE_FILE);
  try {
    db.pragma("busy_timeout = 5000");
    db.prepare("INSERT INTO User (id, email, emailVerified, createdAt) VALUES (?, ?, ?, ?)").run(
      id,
      email,
      isoWithOffset(now),
      isoWithOffset(now),
    );
    db.prepare("INSERT INTO Session (id, sessionToken, userId, expires) VALUES (?, ?, ?, ?)").run(
      randomUUID(),
      token,
      id,
      isoWithOffset(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    );
  } finally {
    db.close();
  }
  return { id, email, token };
}

async function signInAs(context: BrowserContext, token: string): Promise<void> {
  await context.addCookies([
    { name: SESSION_COOKIE, value: token, url: ORIGIN, httpOnly: true, sameSite: "Lax" },
  ]);
}

/** Writes keys the way idb-keyval does, creating its store if nothing has yet. */
function seedSlots(page: Page, keys: string[]): Promise<void> {
  return page.evaluate(
    (slots) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("keyval-store");
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("keyval")) {
            request.result.createObjectStore("keyval");
          }
        };
        request.onsuccess = () => {
          const tx = request.result.transaction("keyval", "readwrite");
          for (const slot of slots) tx.objectStore("keyval").put(`seeded ${slot}`, slot);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    keys,
  );
}

test.beforeAll(async ({ request }) => {
  // The server applies its migrations on first use, and the rows below need
  // the tables to exist before anything else in this file has made a request.
  expect((await request.get("/api/health")).ok()).toBe(true);
});

test("a content page is the same file for a guest and a signed-in reader", async ({
  request,
  playwright,
}) => {
  const ada = createSignedInUser("static-file");

  const guest = await request.get("/");
  const signedIn = await playwright.request.newContext({
    baseURL: ORIGIN,
    extraHTTPHeaders: { cookie: `${SESSION_COOKIE}=${ada.token}` },
  });
  const theirs = await signedIn.get("/");

  const guestHtml = await guest.text();
  const theirHtml = await theirs.text();
  await signedIn.dispose();

  // Nothing about the reader is in the markup: no address, and the header
  // is the signed-out one for both until the browser asks.
  expect(theirHtml).not.toContain(ada.email);
  expect(guestHtml).toContain("Sign in");
  expect(theirHtml).toContain("Sign in");

  // And it is served as a file, not rendered for this request.
  expect(guest.headers()["cache-control"] ?? "").not.toMatch(/no-store|private/);
});

test("a signed-in reader sees their account on a content page, and the purge runs there", async ({
  page,
  context,
}) => {
  const ada = createSignedInUser("static-purge");
  const theirs = `resume-draft::${ada.id}`;
  const someoneElses = "resume-draft::somebody-who-used-this-computer-before";

  // Seed as a guest first, so the slots exist before anybody is signed in.
  await page.goto("/terms");
  await seedSlots(page, [theirs, someoneElses]);

  await signInAs(context, ada.token);
  await page.goto("/templates");

  // The account arrives once the browser has asked…
  await expect(page.getByRole("img", { name: `Signed in as ${ada.email}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // …and so does the purge: the other person's slot is gone, and theirs is
  // exactly where they left it.
  await expect.poll(() => readAllKeys(page)).not.toContain(someoneElses);
  expect(await readAllKeys(page)).toContain(theirs);
});

test("signing out from the landing page is noticed on the landing page", async ({
  page,
  context,
}) => {
  const ada = createSignedInUser("static-signout");
  const theirs = `resume-draft::${ada.id}`;

  await signInAs(context, ada.token);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await seedSlots(page, [theirs]);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${ORIGIN}/`);

  // Same pathname before and after. The header has to have re-asked anyway —
  // and with the answer, purged the signed-out account's slot.
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect.poll(() => readAllKeys(page)).not.toContain(theirs);
});
