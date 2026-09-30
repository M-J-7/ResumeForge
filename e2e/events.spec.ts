/**
 * The usage counter, in a real browser against the production build.
 *
 * The unit suite proves each rule on its own: what `track` puts in a request,
 * what the server refuses, what the table can hold. This proves the claims
 * the privacy page makes about the whole of it, as a visitor's browser
 * actually behaves: an event is a name and nothing else, it travels without
 * a cookie even when the browser holds one, nothing is sent for a visitor
 * whose browser says no, and the counts really do end up in the table.
 */

import Database from "better-sqlite3";
import path from "node:path";
import { expect, test, type Page, type Request, type Response } from "@playwright/test";
import { E2E_DATABASE_FILE } from "../playwright.config";

const DISTINCTIVE = "Zebulon Quartermaine";

interface Seen {
  requests: Request[];
  responses: Response[];
}

function watchEvents(page: Page): Seen {
  const seen: Seen = { requests: [], responses: [] };
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/e") seen.requests.push(request);
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/e") seen.responses.push(response);
  });
  return seen;
}

function namesOf(seen: Seen): string[] {
  return seen.requests.map(
    (request) => (JSON.parse(request.postData() ?? "{}") as { e: string }).e,
  );
}

function countIn(name: string): number {
  const db = new Database(path.join(process.cwd(), E2E_DATABASE_FILE), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const row = db
      .prepare(`SELECT COALESCE(SUM("count"), 0) AS total FROM "EventCount" WHERE "name" = ?`)
      .get(name) as { total: number };
    return Number(row.total);
  } finally {
    db.close();
  }
}

test("an event is its name alone: no cookie, nothing typed, and no cookie back", async ({
  page,
}) => {
  const seen = watchEvents(page);

  await page.goto("/");
  await expect.poll(() => namesOf(seen)).toContain("view:/");
  // Opened directly, so the visit is counted as having come from nowhere.
  expect(namesOf(seen)).toContain("src:direct");

  await page.goto("/builder");
  await page.getByLabel("Full name").fill(DISTINCTIVE);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download TXT", exact: true }).click();
  await download;
  await expect.poll(() => namesOf(seen)).toContain("export:txt");

  for (const request of seen.requests) {
    expect(request.method()).toBe("POST");
    const body = request.postData() ?? "";
    expect(body).toMatch(/^\{"e":"[a-z0-9:/-]+"\}$/);
    expect(body).not.toContain(DISTINCTIVE);
    expect((await request.allHeaders()).cookie, "an event carried a cookie").toBeUndefined();
  }
  await expect.poll(() => seen.responses.length).toBe(seen.requests.length);
  for (const response of seen.responses) {
    expect(response.status()).toBe(204);
    expect((await response.allHeaders())["set-cookie"]).toBeUndefined();
  }
});

test("a cookie the browser holds does not travel with an event", async ({ page, context }) => {
  // A stand-in for a session. What is under test is the browser leaving it
  // behind (`credentials: "omit"`), and the server counting the event anyway
  // rather than refusing it — which it would, were the cookie there.
  await context.addCookies([
    { name: "authjs.session-token", value: "e2e-not-a-real-session", url: "http://localhost:3000" },
  ]);
  const seen = watchEvents(page);

  await page.goto("/pricing");
  await expect.poll(() => namesOf(seen)).toContain("view:/pricing");
  for (const request of seen.requests) {
    expect((await request.allHeaders()).cookie).toBeUndefined();
  }
  await expect.poll(() => seen.responses.map((response) => response.status())).toContain(204);
});

test("nothing is sent from a browser with Global Privacy Control on", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true });
  });
  const seen = watchEvents(page);

  await page.goto("/");
  await page.getByRole("link", { name: /check a resume you already have/i }).click();
  await expect(page).toHaveURL(/\/check$/);
  await page.waitForLoadState("networkidle");

  expect(seen.requests.map((request) => request.url())).toEqual([]);
});

test("the counts reach the table", async ({ page }) => {
  // Other workers may view this page too; what matters is that this visit
  // moved the number, so it is compared against where it started.
  const before = countIn("view:/terms");
  await page.goto("/terms");
  await expect.poll(() => countIn("view:/terms"), { timeout: 15_000 }).toBeGreaterThan(before);
});
