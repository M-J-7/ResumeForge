import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the parts jsdom cannot model: the Web Worker that
 * generates the PDF, pdfjs canvas rasterization, and IndexedDB persistence
 * across a real reload.
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
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000/builder",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
