import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * The QA §11 measured pass (`pnpm qa:enhance`).
 *
 * Separate from `playwright.config.ts` rather than a project inside it,
 * because the two runs want opposite things. The suite wants parallelism and
 * short timeouts; this wants one browser on the machine at a time and the
 * patience for a cold WASM beam search. Merging them would mean either a slow
 * suite or a measurement that is really a measurement of contention.
 *
 * The web server, the environment and the database file are inherited, so the
 * thing being measured is the same production build the suite runs against —
 * including the real CSP, which is the point: `connect-src 'self'` is what
 * makes the model download have to come from this origin.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /enhance\.measured\.spec\.ts$/,

  /**
   * One. Not a default, a requirement.
   *
   * Warm latency measured while other workers hold the other cores is not
   * warm latency, and peak memory sampled across two browsers is not this
   * browser's peak. Everything in this file exists to make one measurement at
   * a time possible.
   */
  workers: 1,
  fullyParallel: false,

  /**
   * No retries, deliberately. A retry would quietly replace a slow, honest
   * number with a faster one taken when the caches were warm — and a failure
   * here is a finding, not a flake to paper over.
   */
  retries: 0,
  reporter: [["list"]],
  timeout: 900_000,
  use: { ...base.use, trace: "off" },
  webServer: base.webServer,
});
