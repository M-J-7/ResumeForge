/**
 * M2-T2 and M2-T3, end to end (the acceptance criteria, not an approximation).
 *
 *   M2-T2: "both flows work end-to-end; sessions survive restart; sign-out
 *   clears everything."
 *   M2-T3: "guest → signup → draft preserved intact; no data loss on any
 *   path including mid-flow abandonment."
 *
 * The email flow is exercised for real: the app connects to an SMTP server
 * this file starts, the message it sends is parsed, and the link inside it
 * is followed in a browser. Nothing is stubbed between the button and the
 * session cookie.
 *
 * ## What is deliberately not covered here, and why
 *
 * The Google redirect handshake needs a real Google Cloud client id and
 * secret; there is no honest way to fake it that would still prove anything
 * about the live provider. What this project owns — whether Google is
 * offered at all, with which options, and how the account-linking error is
 * explained — is asserted in `src/server/auth/config.test.ts`. The live
 * round trip stays owed, and `docs/QA.md` records it as owed rather than
 * letting the suite imply otherwise.
 *
 * ## Serial, because there is one SMTP port
 *
 * The app is configured with a single `EMAIL_SERVER` address, so only one
 * capture server can be listening. Running these in parallel workers would
 * have the second fail to bind.
 */

import { expect, test, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";
import { E2E_DATABASE_FILE } from "../playwright.config";
import { signInLinkFrom, startMailServer, type MailServer } from "./mail-server";

test.describe.configure({ mode: "serial" });

let mail: MailServer;

test.beforeAll(async () => {
  mail = await startMailServer();
});

test.afterAll(async () => {
  await mail.close();
});

/** A fresh address per test, so no test can observe another's account. */
function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@e2e.test`;
}

/**
 * Reads the session rows the server wrote.
 *
 * Opened read-only against the same SQLite file the app is using. WAL (set
 * by `applyPragmas`) is what makes this safe while the server is running.
 * This is how "sessions survive restart" is checked without restarting the
 * server: the session is on disk rather than in the process's memory, which
 * is the property the claim actually rests on.
 */
function countRows(sql: string, email: string): number {
  const file = path.join(process.cwd(), E2E_DATABASE_FILE);
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return (db.prepare(sql).get(email) as { count: number }).count;
  } finally {
    db.close();
  }
}

function sessionCountFor(email: string): number {
  return countRows(
    `SELECT COUNT(*) AS count
       FROM Session s JOIN User u ON u.id = s.userId
      WHERE u.email = ?`,
    email,
  );
}

function userCountFor(email: string): number {
  return countRows(`SELECT COUNT(*) AS count FROM User WHERE email = ?`, email);
}

function resumeCountFor(email: string): number {
  return countRows(
    `SELECT COUNT(*) AS count
       FROM Resume r JOIN User u ON u.id = r.userId
      WHERE u.email = ?`,
    email,
  );
}

/** Builds a draft as a guest and saves it to the signed-in account. */
async function claimADraft(page: Page, name: string): Promise<void> {
  await page.goto("/builder");
  await page.getByLabel("Full name").fill(name);
  // Give the 500ms autosave debounce room to commit before navigating away.
  await page.waitForTimeout(1500);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Save it to my account" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
}

/** Requests a link for `email` and returns the URL that arrived. */
async function requestSignInLink(page: Page, email: string): Promise<string> {
  const already = mail.messages.length;
  await page.goto("/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  return signInLinkFrom(await mail.waitFor(email, { after: already }));
}

async function signIn(page: Page, email: string): Promise<void> {
  const link = await requestSignInLink(page, email);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Your resumes" })).toBeVisible();
}

test("signs in end to end through a real email link", async ({ page }) => {
  const email = uniqueEmail("signin");

  await signIn(page, email);

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  // The session is a row on disk, not state in the server process — which is
  // what makes it survive a restart.
  expect(sessionCountFor(email)).toBe(1);
});

test("sends a link that stops working after it has been used", async ({ page, context }) => {
  const email = uniqueEmail("single-use");
  const link = await requestSignInLink(page, email);

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Your resumes" })).toBeVisible();

  // A second browser with no cookies: the link itself has to be spent, not
  // merely superseded by a session this browser already holds.
  await context.clearCookies();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  // Not `getByRole("alert")`: Next renders a permanently-present, empty
  // route announcer with that role, so the role alone is ambiguous.
  await expect(page.getByText(/already been used or has expired/i)).toBeVisible();
});

test("signing out deletes the session rather than just the cookie", async ({ page }) => {
  const email = uniqueEmail("signout");
  await signIn(page, email);
  expect(sessionCountFor(email)).toBe(1);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  // "Sign-out clears everything" is only true of a session the server can
  // delete; a JWT strategy would leave this row-equivalent alive until it
  // expired, wherever a copy of the token had got to.
  expect(sessionCountFor(email)).toBe(0);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("refuses the dashboard to a visitor who is not signed in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Sign in to see that page.")).toBeVisible();
});

test("carries a guest draft onto the account and clears it locally (M2-T3)", async ({ page }) => {
  const email = uniqueEmail("claim");

  // Build something as a guest. Nothing has been uploaded at this point —
  // it lives only in this browser's IndexedDB.
  await page.goto("/builder");
  await page.getByLabel("Full name").fill("Grace Hopper");
  await page.getByLabel("Email", { exact: true }).fill("grace@example.com");
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a role" }).click();
  await page.getByLabel("Job title").fill("Systems Architect");
  await page.getByLabel("Organization").fill("US Navy");
  await page.getByRole("textbox", { name: /bullet 1/i }).fill("Built the first compiler.");
  // Give the 500ms autosave debounce room to commit before navigating away.
  await page.waitForTimeout(1500);

  await signIn(page, email);

  const offer = page.getByText("There is a resume saved in this browser");
  await expect(offer).toBeVisible();
  await expect(page.getByText(/Grace Hopper/)).toBeVisible();

  await page.getByRole("button", { name: "Save it to my account" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  // The title comes from the most recent role, not from a placeholder.
  await expect(page.getByRole("heading", { name: "Systems Architect" })).toBeVisible();

  // Local storage is cleared only after the server confirmed, so the builder
  // now starts empty rather than holding a second copy.
  await page.goto("/builder");
  await expect(page.getByLabel("Full name")).toHaveValue("");

  await page.goto("/dashboard");
  await expect(page.getByText("There is a resume saved in this browser")).toBeHidden();
});

test("claiming a second draft adds a resume instead of overwriting one", async ({ page }) => {
  const email = uniqueEmail("conflict");
  await signIn(page, email);

  // First resume, claimed from a draft.
  await page.goto("/builder");
  await page.getByLabel("Full name").fill("First Draft");
  await page.waitForTimeout(1500);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Save it to my account" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  // Second draft, same account.
  await page.goto("/builder");
  await page.getByLabel("Full name").fill("Second Draft");
  await page.waitForTimeout(1500);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Save it to my account" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  // Two resumes, neither overwritten. An unwanted extra costs one click to
  // delete; an overwrite would have destroyed work with no other copy.
  await expect(page.getByRole("heading", { name: "First Draft resume" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Second Draft resume" })).toBeVisible();
});

test("renames, duplicates, and permanently deletes a saved resume (M2-T4)", async ({ page }) => {
  const email = uniqueEmail("crud");
  await signIn(page, email);

  await page.goto("/builder");
  await page.getByLabel("Full name").fill("Katherine Johnson");
  await page.waitForTimeout(1500);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Save it to my account" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: /New title/ }).fill("For NASA");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "For NASA" })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByRole("heading", { name: "For NASA (copy)" })).toBeVisible();

  await page
    .getByRole("listitem")
    .filter({ hasText: "For NASA (copy)" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.getByText(/no trash and no backup copy/)).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page.getByRole("heading", { name: "For NASA (copy)" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "For NASA" })).toBeVisible();
});

test("deletes the account and everything on it (M2-T6)", async ({ page }) => {
  const email = uniqueEmail("erase");
  await signIn(page, email);
  await claimADraft(page, "Ada Lovelace");
  expect(resumeCountFor(email)).toBe(1);

  await page.getByRole("button", { name: "Delete my account" }).click();

  // The button stays disabled until the address matches exactly — this is
  // the one action with nothing behind it.
  const confirm = page.getByRole("button", { name: "Delete everything permanently" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(`Type ${email} to confirm deletion`).fill(email);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page).toHaveURL("http://localhost:3000/");

  // M2-T6's acceptance, asserted against the database rather than the UI:
  // every row goes, not just the one the user could see.
  expect(userCountFor(email)).toBe(0);
  expect(resumeCountFor(email)).toBe(0);
  expect(sessionCountFor(email)).toBe(0);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* Sync (M2-T4)                                                                */
/* -------------------------------------------------------------------------- */

/** The builder's sync indicator, which carries its state as a data attribute. */
function syncStatus(page: Page) {
  return page.locator("[data-sync-status]");
}

test("keeps the guest builder entirely local (D6)", async ({ page }) => {
  await page.goto("/builder");
  // No account in play means no push, and the wording has to keep saying so —
  // the promise on the landing page depends on it.
  await expect(syncStatus(page)).toHaveAttribute("data-sync-status", "idle");
  await expect(page.getByText("Saved in this browser only")).toBeVisible();
});

test("edits made on one device appear on another (M2-T4)", async ({ page, browser }) => {
  const email = uniqueEmail("sync");
  await signIn(page, email);
  await claimADraft(page, "Alan Turing");

  // `exact` matters: the dashboard header also has an "Open the builder"
  // link, which a substring match reaches first and which carries no id.
  await page.getByRole("link", { name: "Open", exact: true }).first().click();
  await expect(page).toHaveURL(/\/builder\?resume=/);
  const builderUrl = page.url();

  await page.getByLabel("Full name").fill("Alan Turing (updated)");
  await expect(syncStatus(page)).toHaveAttribute("data-sync-status", "synced", {
    timeout: 15_000,
  });

  // A second browser, signed into the same account. Nothing is shared between
  // the two but the server.
  const second = await browser.newContext();
  const other = await second.newPage();
  try {
    await signIn(other, email);
    await other.goto(builderUrl);
    await expect(other.getByLabel("Full name")).toHaveValue("Alan Turing (updated)");
  } finally {
    await second.close();
  }
});

test("holds offline edits locally and sends them on reconnect (M2-T4)", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("offline");
  await signIn(page, email);
  await claimADraft(page, "Grace Hopper");

  // `exact` matters: the dashboard header also has an "Open the builder"
  // link, which a substring match reaches first and which carries no id.
  await page.getByRole("link", { name: "Open", exact: true }).first().click();
  await expect(page).toHaveURL(/\/builder\?resume=/);
  const builderUrl = page.url();

  await context.setOffline(true);
  await page.getByLabel("Full name").fill("Grace Hopper (offline edit)");

  // Not an error state: the edit is already durable in this browser, and
  // telling someone on a train that something failed would have them stop
  // typing over work that is perfectly safe.
  await expect(syncStatus(page)).toHaveAttribute("data-sync-status", "offline", {
    timeout: 15_000,
  });
  await expect(page.getByText(/back online/)).toBeVisible();

  await context.setOffline(false);
  await expect(syncStatus(page)).toHaveAttribute("data-sync-status", "synced", {
    timeout: 20_000,
  });

  // And the server really has it: a fresh load of the same URL shows the edit
  // that was made while there was no connection.
  await page.goto(builderUrl);
  await expect(page.getByLabel("Full name")).toHaveValue("Grace Hopper (offline edit)");
});
