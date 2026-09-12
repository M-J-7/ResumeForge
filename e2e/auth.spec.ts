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
 * The Google flow is exercised the same way, against the local OpenID
 * provider in `oidc-server.ts`: the browser is redirected off the site, the
 * server discovers the issuer, redeems the code with PKCE and its client
 * secret, validates a signed `id_token`, and writes the account. Nothing on
 * our side of that handshake is stubbed either.
 *
 * ## What is deliberately not covered here, and why
 *
 * Google's own consent screen — its branding, the scopes it lists, and
 * whether the OAuth client is published — needs a real Google account in
 * front of a real browser. `docs/QA.md` keeps that, and
 * `scripts/check-google-oauth.mjs` takes the rest of it: whether Google
 * itself accepts these credentials and this redirect URI, which needs no
 * consent from anybody.
 *
 * ## Serial, because there is one SMTP port and one issuer port
 *
 * The app is configured with a single `EMAIL_SERVER` address and a single
 * `AUTH_GOOGLE_ISSUER`, so only one of each can be listening. Running these
 * in parallel workers would have the second fail to bind.
 */

import { expect, test, type Page } from "@playwright/test";
import { GUEST_DRAFT_KEY, readAllKeys, readDraftSlot, waitForDraftSaved } from "./draft";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";
import { E2E_DATABASE_FILE } from "../playwright.config";
import { signInLinkFrom, startMailServer, type MailServer } from "./mail-server";
import {
  OIDC_REDIRECT_URI,
  startOidcServer,
  type OidcAccount,
  type OidcServer,
} from "./oidc-server";

test.describe.configure({ mode: "serial" });

let mail: MailServer;
let oidc: OidcServer;

test.beforeAll(async () => {
  mail = await startMailServer();
  oidc = await startOidcServer();
});

test.afterAll(async () => {
  await mail.close();
  await oidc.close();
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

function oauthAccountCountFor(email: string): number {
  return countRows(
    `SELECT COUNT(*) AS count
       FROM Account a JOIN User u ON u.id = a.userId
      WHERE u.email = ?`,
    email,
  );
}

/** The linked OAuth account row itself, for asserting what it does *not* hold. */
function oauthAccountFor(email: string): Record<string, unknown> | null {
  return queryOne(
    `SELECT a.* FROM Account a JOIN User u ON u.id = a.userId WHERE u.email = ?`,
    email,
  );
}

function queryOne(sql: string, parameter: string): Record<string, unknown> | null {
  const file = path.join(process.cwd(), E2E_DATABASE_FILE);
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return (db.prepare(sql).get(parameter) as Record<string, unknown> | undefined) ?? null;
  } finally {
    db.close();
  }
}

/** The columns a table actually has, read from SQLite rather than from the schema file. */
function columnsOf(table: string): string[] {
  const file = path.join(process.cwd(), E2E_DATABASE_FILE);
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return (db.pragma(`table_info(${table})`) as { name: string }[]).map((column) => column.name);
  } finally {
    db.close();
  }
}

/** Builds a draft as a guest and saves it to the signed-in account. */
async function claimADraft(page: Page, name: string): Promise<void> {
  await page.goto("/builder");
  await page.getByLabel("Full name").fill(name);
  // The name itself, not a fixed sleep: navigating inside the debounce
  // window cancels the write, and the claim below then has no draft to find.
  await waitForDraftSaved(page, name);
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
  // The bullet, because it is the last edit and therefore the one still
  // inside the debounce window when this test used to navigate away.
  await waitForDraftSaved(page, "Built the first compiler.");

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
  await waitForDraftSaved(page, "First Draft");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Save it to my account" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  // Second draft, same account.
  await page.goto("/builder");
  await page.getByLabel("Full name").fill("Second Draft");
  await waitForDraftSaved(page, "Second Draft");
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
  await waitForDraftSaved(page, "Katherine Johnson");
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

test("creates named resumes from the dashboard and keeps their content separate (P24)", async ({
  page,
}) => {
  const email = uniqueEmail("multi");
  await signIn(page, email);

  // "New resume" creates a real, separately-owned row — not a rename of
  // whatever the guest draft held. Confirmed below by giving each one
  // different content and checking neither leaks into the other.
  await page.getByRole("button", { name: "New resume" }).click();
  await page.getByLabel("Title").fill("Google — SRE");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/builder\?resume=/);
  await page.getByLabel("Full name").fill("Ada Lovelace (Google)");
  // Signed in, so durability means the *server* has it — this row is read
  // back from the account at the end of the test. `synced` is the indicator
  // saying exactly that, and it is why the fixed sleep this replaces failed
  // under load: 1500ms is a guess about a round trip, not an observation of
  // one.
  await expect(syncStatus(page)).toHaveAttribute("data-sync-status", "synced", {
    timeout: 15_000,
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Google — SRE" })).toBeVisible();

  await page.getByRole("button", { name: "New resume" }).click();
  await page.getByLabel("Title").fill("Meta — Platform");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/builder\?resume=/);
  await page.getByLabel("Full name").fill("Ada Lovelace (Meta)");
  await expect(syncStatus(page)).toHaveAttribute("data-sync-status", "synced", {
    timeout: 15_000,
  });

  // Renaming from inside the builder (the inline editor next to the step
  // nav), not from the dashboard — the other half of P24.
  await page.getByRole("button", { name: /rename this resume/i }).click();
  await page.getByLabel("Resume title").fill("Meta — Platform (final)");
  await page.getByLabel("Resume title").press("Enter");
  await expect(page.getByRole("button", { name: /Meta — Platform \(final\)/ })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Google — SRE" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meta — Platform (final)" })).toBeVisible();

  // Two independent rows, not one edited twice: switching between them shows
  // each one's own content, never the other's.
  await page
    .getByRole("listitem")
    .filter({ hasText: "Google — SRE" })
    .getByRole("link", { name: "Open", exact: true })
    .click();
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace (Google)");

  await page.goto("/dashboard");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Meta — Platform (final)" })
    .getByRole("link", { name: "Open", exact: true })
    .click();
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace (Meta)");
  const metaUrl = page.url();

  // "Save as new resume" copies what is open right now into a third, new
  // row — the per-application tailoring flow — leaving this one untouched.
  expect(resumeCountFor(email)).toBe(2);
  await page.getByRole("button", { name: "Save as new resume" }).click();

  // Asserting the URL *changed* rather than merely matching `?resume=`: it
  // already matched before the click, so a pattern check here would pass
  // even if nothing happened at all.
  await expect(page).not.toHaveURL(metaUrl);
  await expect(page).toHaveURL(/\/builder\?resume=/);
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace (Meta)");

  // Against the database, not the list: three rows is the claim, and the
  // rendered list is a view of it rather than the fact itself.
  expect(resumeCountFor(email)).toBe(3);
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
/* Google (M2-T2, the other half of "both flows work end to end")              */
/* -------------------------------------------------------------------------- */

/** What Google sends and §7 has no column for. Never stored; asserted below. */
const AVATAR_URL = "https://lh3.googleusercontent.com/a/e2e-avatar";

/** A provider-side identity that cannot collide with another test's. */
function googleAccount(label: string, email: string): OidcAccount {
  return {
    sub: `${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
    email,
    name: "Ada Lovelace",
    picture: AVATAR_URL,
  };
}

/** Clicks the button and lets the redirect handshake run to wherever it lands. */
async function clickContinueWithGoogle(page: Page): Promise<void> {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with Google" }).click();
}

test("signs in end to end through the Google redirect handshake", async ({ page }) => {
  const email = uniqueEmail("google");
  const account = googleAccount("google", email);
  oidc.signInAs(account);

  await clickContinueWithGoogle(page);

  await expect(page.getByRole("heading", { name: "Your resumes" })).toBeVisible();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  expect(userCountFor(email)).toBe(1);
  expect(sessionCountFor(email)).toBe(1);
  expect(oauthAccountCountFor(email)).toBe(1);

  // What left the site is what should have left it. Each of these is a
  // separate way for a live Google client to be rejected, and each fails
  // here with a name rather than as a redirect to a Google error page.
  const request = oidc.authorizations.at(-1);
  expect(request?.redirectUri).toBe(OIDC_REDIRECT_URI);
  expect(request?.scope.split(" ")).toEqual(expect.arrayContaining(["openid", "email", "profile"]));
  expect(request?.codeChallengeMethod).toBe("S256");
  expect(request?.nonce).toBeTruthy();
  expect(request?.state).toBeTruthy();
});

test("keeps only what identifies the Google account, and no avatar", async ({ page }) => {
  const email = uniqueEmail("google-account");
  const account = googleAccount("stored", email);
  oidc.signInAs(account);

  await clickContinueWithGoogle(page);
  await expect(page.getByRole("heading", { name: "Your resumes" })).toBeVisible();

  // The provider really did send an avatar and a full token set — this is a
  // test of what we drop, not of what we were never offered.
  expect(oidc.issuedIdTokens.at(-1)?.picture).toBe(AVATAR_URL);

  const stored = oauthAccountFor(email);
  expect(stored).toMatchObject({
    provider: "google",
    providerAccountId: account.sub,
    type: "oidc",
  });
  // Every credential column empty: the id_token carries the avatar claim,
  // and the access and refresh tokens are live credentials for someone's
  // Google account that this product never calls an API with.
  for (const column of [
    "access_token",
    "refresh_token",
    "id_token",
    "token_type",
    "scope",
    "expires_at",
    "session_state",
  ]) {
    expect(stored?.[column], `Account.${column} should be empty`).toBeNull();
  }
  expect(columnsOf("User")).not.toContain("image");
});

test("signs the same Google account back in rather than creating a second", async ({ page }) => {
  const email = uniqueEmail("google-return");
  oidc.signInAs(googleAccount("return", email));

  await clickContinueWithGoogle(page);
  await expect(page.getByRole("heading", { name: "Your resumes" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  expect(sessionCountFor(email)).toBe(0);

  // The same person, coming back. `signInAs` is deliberately not called
  // again: this is the same Google account, not a new one.
  await clickContinueWithGoogle(page);
  await expect(page.getByRole("heading", { name: "Your resumes" })).toBeVisible();

  expect(userCountFor(email)).toBe(1);
  expect(oauthAccountCountFor(email)).toBe(1);
  expect(sessionCountFor(email)).toBe(1);
});

test("explains the collision when the address already signs in by link", async ({ page }) => {
  const email = uniqueEmail("google-collision");

  // The address exists because a magic link created it.
  await signIn(page, email);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  oidc.signInAs(googleAccount("collision", email));
  await clickContinueWithGoogle(page);

  // Not merged, and not a raw `OAuthAccountNotLinked` either. This is the
  // likeliest error in a two-provider passwordless setup, and the message
  // has to carry the recovery, because there is no password to reset.
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(/already sign in to this address with an email link/i)).toBeVisible();
  expect(oauthAccountCountFor(email)).toBe(0);

  // And the recovery the message promises works.
  await signIn(page, email);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});

test("reads a declined consent screen as declined, not as a failure", async ({ page }) => {
  const email = uniqueEmail("google-declined");
  oidc.signInAs(googleAccount("declined", email));
  oidc.declineNext();

  await clickContinueWithGoogle(page);

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(/closed or declined/i)).toBeVisible();
  // Nothing was created on the way out.
  expect(userCountFor(email)).toBe(0);
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

  // Wait for the builder to actually be interactive before cutting the
  // network. `toHaveURL` resolves as soon as the address changes, which is
  // *before* the page's JavaScript has loaded — going offline at that point
  // strands the remaining chunks in flight and the form never renders at
  // all. The scenario under test is "someone editing a loaded builder loses
  // connectivity", so the builder has to be loaded first.
  await expect(page.getByLabel("Full name")).toBeVisible();

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

test("exports every resume on the account as JSON Resume (M2-T6)", async ({ page }) => {
  const email = uniqueEmail("export");
  await signIn(page, email);
  await claimADraft(page, "Katherine Johnson");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download everything" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^resumes-\d{4}-\d{2}-\d{2}\.json$/);

  const file = await download.path();
  const payload = JSON.parse(readFileSync(file, "utf8")) as {
    resumes: { title: string; resume: { basics: { name: string }; $schema: string } }[];
  };

  // The full content, not a summary of it — this is the GDPR data export as
  // much as it is a convenience.
  expect(payload.resumes).toHaveLength(1);
  expect(payload.resumes[0]?.resume.basics.name).toBe("Katherine Johnson");
  expect(payload.resumes[0]?.resume.$schema).toContain("jsonresume");
});

/* -------------------------------------------------------------------------- */
/* Session hygiene on a shared computer (§10.1)                                */
/* -------------------------------------------------------------------------- */

/**
 * The bug these cover, stated once.
 *
 * Every browser-local store used to write to one fixed key with no identity
 * in it, and nothing cleared it when somebody signed in or out. On a shared
 * computer the next person to sign in opened the builder and saw the previous
 * person's resume — and the dashboard offered it to them by name, one click
 * from copying it into their own account.
 *
 * These run the whole sequence in one browser context, because one browser
 * context *is* the shared computer. Anything that reset storage between the
 * two identities would test the opposite of what is at issue.
 */

/** Builds a named resume in the builder and waits for it to be durable. */
async function buildDraftAs(page: Page, name: string): Promise<void> {
  await page.goto("/builder");
  await page.getByLabel("Full name").fill(name);
  await waitForDraftSaved(page, name);
}

test("does not show one signed-in user the previous user's resume (§10.1)", async ({ page }) => {
  const first = uniqueEmail("hygiene-a");
  const second = uniqueEmail("hygiene-b");

  // A signs in and builds a resume. It is saved to their own local slot, and
  // through the account, exactly as it would be for anyone.
  await signIn(page, first);
  await buildDraftAs(page, "Ada Lovelace");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  // B, on the same computer, in the same browser, with nothing cleared.
  await signIn(page, second);

  await page.goto("/builder");
  await expect(page.getByLabel("Full name")).toHaveValue("");

  // And the dashboard does not offer them A's work either. This was the
  // escalation path: one click copied it into B's account.
  await page.goto("/dashboard");
  await expect(page.getByText("There is a resume saved in this browser")).toBeHidden();
  await expect(page.getByText("Ada Lovelace")).toBeHidden();
});

test("takes the previous user's resume off the device entirely (§10.1)", async ({ page }) => {
  const first = uniqueEmail("purge-a");
  const second = uniqueEmail("purge-b");

  await signIn(page, first);
  await buildDraftAs(page, "Ada Lovelace");

  // It really is on the device at this point — otherwise the assertion below
  // would pass for the wrong reason.
  const slots = await readAllKeys(page);
  expect(slots.some((key) => key.startsWith("resume-draft::") && !key.endsWith("::guest"))).toBe(
    true,
  );

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await signIn(page, second);

  // Not merely unreachable through the UI: gone. A resume in IndexedDB is
  // one developer-tools panel away from being read by whoever is here now.
  await expect
    .poll(async () => {
      const held = await readAllKeys(page);
      return held.filter((key) => key.includes("::") && !key.endsWith("::guest"));
    })
    .toEqual([]);
});

test("keeps a guest draft through sign-in, which is what the claim flow needs (§10.1)", async ({
  page,
}) => {
  const email = uniqueEmail("guest-survives");

  // The one slot the purge deliberately spares. Wiping it on sign-in would
  // destroy the exact work "Save it to my account" exists to rescue.
  await buildDraftAs(page, "Grace Hopper");
  await signIn(page, email);

  await expect(page.getByText("There is a resume saved in this browser")).toBeVisible();
  await expect(readDraftSlot(page, GUEST_DRAFT_KEY)).resolves.toContain("Grace Hopper");
});

test("keeps 'Not now' dismissed rather than re-offering to the next person (§10.1)", async ({
  page,
}) => {
  const first = uniqueEmail("dismiss-a");
  const second = uniqueEmail("dismiss-b");

  await buildDraftAs(page, "Grace Hopper");
  await signIn(page, first);
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByText("There is a resume saved in this browser")).toBeHidden();

  // It used to be `setState` alone, so a reload brought it straight back.
  await page.reload();
  await expect(page.getByText("There is a resume saved in this browser")).toBeHidden();

  // The dismissal is per identity, though: the guest draft is still there,
  // and somebody else signing in on this machine has not declined anything.
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, second);
  await expect(page.getByText("There is a resume saved in this browser")).toBeVisible();
});

test("shows the 404, not a local draft, for a resume that is not yours (§10.1)", async ({
  page,
}) => {
  const owner = uniqueEmail("owner");
  const stranger = uniqueEmail("stranger");

  await signIn(page, owner);
  await claimADraft(page, "Katherine Johnson");
  await page.getByRole("link", { name: "Open", exact: true }).first().click();
  await expect(page).toHaveURL(/\/builder\?resume=/);
  const someoneElsesUrl = page.url();

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, stranger);
  await buildDraftAs(page, "Not Katherine");

  await page.goto(someoneElsesUrl);

  // The same response an id that does not exist gets, which is what stops the
  // page confirming that this one does. It used to fall through to the
  // builder and render whatever draft was in the browser — showing a resume,
  // just not the one in the URL, and saying nothing about it.
  await expect(page.getByText("Not Katherine")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "There is nothing at this address" }),
  ).toBeVisible();
});
