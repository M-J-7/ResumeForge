import { defineConfig, devices } from "@playwright/test";
import { MAIL_PORT } from "./e2e/mail-server";

/** The database the E2E run migrates and signs in against. */
export const E2E_DATABASE_FILE = "e2e.db";
export const E2E_DATABASE_URL = `file:./${E2E_DATABASE_FILE}`;

/**
 * End-to-end tests for the parts jsdom cannot model: the Web Worker that
 * generates the PDF, pdfjs canvas rasterization, IndexedDB persistence
 * across a real reload, and — since M2 — a sign-in that goes all the way
 * through SMTP, a database session, and a cookie.
 *
 * Kept out of the Vitest run (`pnpm test`) and invoked separately with
 * `pnpm test:e2e`, so the fast unit suite stays fast.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build: the dev server's on-demand compilation makes the
    // first render slow enough to look like a timeout rather than a bug.
    // `migrate deploy` runs against the E2E database specifically, so a
    // developer's working `dev.db` is never the thing under test.
    command: "pnpm build && pnpm db:deploy && pnpm start",
    url: "http://localhost:3000/builder",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Its own file, so signing in during a test run does not leave rows in
      // the database a developer is building against.
      DATABASE_URL: E2E_DATABASE_URL,
      // A fixed value rather than a generated one: the sessions it signs
      // have to stay valid across the build step and every worker.
      AUTH_SECRET: "e2e-only-secret-never-used-outside-playwright",
      AUTH_URL: "http://localhost:3000",
      // Points the real SMTP transport at the capture server the auth spec
      // starts. Deliberately not the development file outbox: that refuses
      // to run under the production build this command produces.
      EMAIL_SERVER: `smtp://127.0.0.1:${MAIL_PORT}`,
      EMAIL_FROM: "ATS Resume Builder <no-reply@e2e.test>",
    },
  },
});
