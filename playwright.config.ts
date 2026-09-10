import { defineConfig, devices } from "@playwright/test";
import { MAIL_PORT } from "./e2e/mail-server";
import { OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ISSUER } from "./e2e/oidc-server";

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
  /**
   * The QA §11 measured pass lives in `e2e/` so it shares the helpers, but it
   * is not part of this run: it loads ~120MB of weights and runs beam searches
   * that take tens of seconds. `pnpm qa:enhance` runs it through
   * `playwright.measure.config.ts`, one worker, on a machine somebody chose.
   */
  testIgnore: /\.measured\.spec\.ts$/,
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
    //
    // The database is deleted first and **no migrate step is run**. That is
    // deliberate: the server applies its own pending migrations on first use
    // (`src/server/db.ts`), so every E2E run exercises the real first-deploy
    // path — empty volume, container starts, schema appears, sign-in works.
    // Running `migrate deploy` here would test the CLI instead of the thing
    // that actually happens in production.
    command: "node scripts/reset-e2e-db.mjs && pnpm build && pnpm start",
    url: "http://localhost:3000/builder",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Its own file, so signing in during a test run does not leave rows in
      // the database a developer is building against.
      DATABASE_URL: E2E_DATABASE_URL,
      E2E_DATABASE_FILE,
      // A fixed value rather than a generated one: the sessions it signs
      // have to stay valid across the build step and every worker.
      AUTH_SECRET: "e2e-only-secret-never-used-outside-playwright",
      AUTH_URL: "http://localhost:3000",
      // Points the real SMTP transport at the capture server the auth spec
      // starts. Deliberately not the development file outbox: that refuses
      // to run under the production build this command produces.
      EMAIL_SERVER: `smtp://127.0.0.1:${MAIL_PORT}`,
      EMAIL_FROM: "Six Seconds Resume <no-reply@e2e.test>",
      // Google sign-in, pointed at the local OpenID provider the auth spec
      // starts. Same arrangement as the mail server above: the real OAuth
      // code path runs — discovery, PKCE, a signed id_token, the adapter
      // write — against an issuer that answers on loopback. `googleIssuer`
      // accepts plain HTTP there and nowhere else.
      AUTH_GOOGLE_ID: OIDC_CLIENT_ID,
      AUTH_GOOGLE_SECRET: OIDC_CLIENT_SECRET,
      AUTH_GOOGLE_ISSUER: OIDC_ISSUER,
    },
  },
});
