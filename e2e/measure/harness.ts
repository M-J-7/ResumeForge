/**
 * The instrumentation behind the QA §11 measured pass.
 *
 * ## Why this exists at all
 *
 * `QA.md` §11 asks for numbers — download size, warm latency on two backends,
 * peak memory, a browser matrix, a refusal rate over ten proposals — and says
 * they cannot come from CI. That is true of *CI*: a headless container with no
 * GPU, on a runner whose bandwidth is not anybody's domestic connection,
 * measures nothing a user would recognise. It is not true of "cannot be
 * automated". Running the checklist by hand produces numbers nobody can
 * reproduce and a tester who quietly rounds; running it from a script on real
 * hardware produces the same numbers twice.
 *
 * So this is deliberately **not** part of `pnpm test:e2e`. It is a separate
 * config, one worker, opt-in, and it writes a machine-readable artifact that
 * `scripts/qa-enhance-report.mjs` renders into the table that goes in
 * `QA.md`. What the tester still owes is the part §11 asks a *person* for:
 * reading the ten proposals and saying whether they would send them.
 *
 * ## One worker, always
 *
 * Latency measured while five other browsers fight for the same twelve
 * threads is not latency. The config pins `workers: 1`; nothing here should
 * ever be made to run in parallel.
 */

import { expect, type BrowserContext, type CDPSession, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ResumeDocument } from "../../src/lib/resume/schema";
import type { MeasurementPosting } from "./postings";

const run = promisify(execFile);

export const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3000";

/** Where the raw artifact lands. Gitignored; `QA.md` is the record. */
const REPORT_PATH = path.join(process.cwd(), "measurements", "enhance.json");

/* -------------------------------------------------------------------------- */
/* The report                                                                  */
/* -------------------------------------------------------------------------- */

export interface MeasurementReport {
  startedAt: string;
  machine: Record<string, unknown>;
  [section: string]: unknown;
}

/**
 * Merged rather than overwritten, so a re-run of one test does not wipe the
 * results of the others. Reading and writing the whole file each time is
 * fine at this size and keeps the tests independent of each other's order.
 */
export async function record(section: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(REPORT_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    // First write of the run.
  }
  existing.startedAt ??= new Date().toISOString();
  existing[section] = value;
  await writeFile(REPORT_PATH, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
}

/* -------------------------------------------------------------------------- */
/* Seeding a resume                                                            */
/* -------------------------------------------------------------------------- */

/** The slot a browser with nobody signed in writes its draft to (see `e2e/draft.ts`). */
const GUEST_DRAFT_KEY = "resume-draft::guest";

/**
 * Writes a resume straight into the guest draft slot.
 *
 * Typing sixteen example resumes through the builder would make this pass
 * measure form filling. The slot's shape (`{ document, savedAt }`, JSON, in
 * `keyval-store`) is the one `createDraftStore` writes and `LetterEditor`
 * reads, and the letter composition that follows is entirely the shipping
 * path — which is the part §11 is actually about.
 */
export async function seedResume(page: Page, document: ResumeDocument): Promise<void> {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(
    async ([key, payload]) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("keyval-store");
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("keyval")) {
            request.result.createObjectStore("keyval");
          }
        };
        request.onsuccess = () => {
          const transaction = request.result.transaction("keyval", "readwrite");
          transaction.objectStore("keyval").put(payload, key);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      });
    },
    [GUEST_DRAFT_KEY, JSON.stringify({ document, savedAt: Date.now() })] as const,
  );
}

/** Skips the one-time disclosure, for runs that are not measuring the dialog. */
export async function acceptEnhancementNotice(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("cover-letter-enhancement-notice-v1", "accepted");
    } catch {
      // Nothing depends on this; the dialog is handled explicitly if it shows.
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Composing                                                                   */
/* -------------------------------------------------------------------------- */

/** Composes a draft letter from the seeded resume and returns the paragraph list. */
export async function composeLetter(page: Page, posting: MeasurementPosting): Promise<void> {
  await page.goto(`${BASE_URL}/letters/new`);
  await page.getByLabel("Or paste a posting").fill(posting.text);
  await page.getByLabel("Company").fill(posting.company);
  await page.getByLabel("Role title").fill(posting.roleTitle);
  await page.getByRole("button", { name: "Compose draft" }).click();
  await expect(page.getByRole("textbox", { name: /paragraph$/ }).first()).toBeVisible({
    timeout: 90_000,
  });
}

/* -------------------------------------------------------------------------- */
/* Running one enhancement                                                     */
/* -------------------------------------------------------------------------- */

export type EnhancementOutcome =
  | { kind: "proposal"; suggested: string; original: string; summary: string; ms: number }
  | { kind: "refused"; message: string; ms: number }
  | { kind: "cancelled"; ms: number }
  | { kind: "unavailable"; message: string; ms: number };

/**
 * Clicks Enhance on one paragraph and waits for the attempt to settle.
 *
 * "Settle" is deliberately every terminal state rather than success: a
 * refusal is a result, and counting refusals is the point of the ten-proposal
 * check. The dialog is dismissed here rather than pre-accepted so that a run
 * which has not seen it still works.
 */
export async function enhanceParagraph(
  page: Page,
  paragraphLabel: string,
  { timeout = 300_000 }: { timeout?: number } = {},
): Promise<EnhancementOutcome> {
  const textarea = page.getByRole("textbox", { name: paragraphLabel });
  await expect(textarea).toBeVisible();
  const original = await textarea.inputValue();
  const block = page.locator("li", { has: textarea });

  /*
   * Anything already complaining on the page is not this attempt's answer.
   *
   * The editor's error banner is one element reused for every failure, and a
   * compose-time notice left over from the previous paragraph would be read
   * as an instant refusal — which is exactly how a run that never started
   * came back as "unavailable in 974ms".
   */
  const before = new Set(await page.locator("p[role='alert']").allTextContents());

  const started = Date.now();
  await block.getByRole("button", { name: "Enhance" }).click();

  /*
   * The consent dialog is asynchronous, and waiting for it wrongly is how the
   * first version of this hung.
   *
   * `requestEnhancement` dynamically imports the adapter and sends a HEAD for
   * `config.json` *before* it opens the dialog, so a bare `isVisible()` right
   * after the click is a race the click loses — the dialog then sits open
   * forever and the run reads as an infinitely slow model rather than as a
   * button nobody pressed. This waits for whichever comes first: the dialog,
   * the work starting (consent already given), or an immediate refusal.
   */
  const consent = page.getByRole("button", { name: "Download and enhance" });
  await Promise.any([
    consent.waitFor({ state: "visible", timeout: 30_000 }).then(() => consent.click()),
    page.getByText("Working locally on your device").waitFor({ state: "visible", timeout: 30_000 }),
    page.getByText("Downloading the model once").waitFor({ state: "visible", timeout: 30_000 }),
    page.locator("p[role='alert']").first().waitFor({ state: "visible", timeout: 30_000 }),
  ]).catch(() => {
    // All four timed out. The polling loop below reports that as a timeout
    // with the page's own state, which is more use than an exception here.
  });

  /*
   * Two identical refusals in a row are two results, not one.
   *
   * The set above dedupes by text, and the editor reuses one banner element
   * for every failure — so a second paragraph refused for the same reason
   * looked like nothing had happened at all, and three of four measurements
   * in the first WebGPU run came back as "timeout" when they had in fact
   * refused within seconds. `requestEnhancement` clears the error before it
   * starts, so waiting for the banner to *go* first makes any banner after
   * that this attempt's own answer.
   */
  if (before.size > 0) {
    await page
      .locator("p[role='alert']")
      .first()
      .waitFor({ state: "hidden", timeout: 15_000 })
      .then(() => before.clear())
      .catch(() => {
        // Still showing the old one. The text comparison below is the
        // fallback, and it is only wrong when the reason repeats.
      });
  }

  const proposal = page.getByText("Suggested local enhancement");
  const deadline = Date.now() + timeout;

  for (;;) {
    if (await proposal.isVisible().catch(() => false)) {
      const ms = Date.now() - started;
      const box = page.locator("div", { has: proposal }).last();
      const suggested = await box
        .locator("details p")
        .last()
        .evaluate((node) => node.textContent ?? "");
      const summary = await box
        .locator("p")
        .nth(1)
        .evaluate((node) => node.textContent ?? "");
      return { kind: "proposal", suggested: suggested.trim(), original, summary, ms };
    }

    const alerts = await page.locator("p[role='alert']").allTextContents();
    const fresh = alerts.map((text) => text.trim()).find((text) => !before.has(text));
    if (fresh) {
      const ms = Date.now() - started;
      const refused = fresh.startsWith("The proposal") || fresh.startsWith("The local model");
      return refused
        ? { kind: "refused", message: fresh, ms }
        : { kind: "unavailable", message: fresh, ms };
    }

    if (Date.now() > deadline) {
      return {
        kind: "unavailable",
        message: `Did not settle within ${timeout}ms. Page status: ${JSON.stringify(
          await page.locator("[role='status']").allTextContents(),
        )}`,
        ms: Date.now() - started,
      };
    }
    await page.waitForTimeout(250);
  }
}

/* -------------------------------------------------------------------------- */
/* Network accounting                                                          */
/* -------------------------------------------------------------------------- */

export interface TrafficLog {
  /** On-the-wire bytes per URL, as the browser actually counted them. */
  bytesByUrl: Map<string, number>;
  origins: Set<string>;
  /** When the first and last model byte landed, relative to `since`. */
  firstModelByteAt: number | null;
  lastModelByteAt: number | null;
  since: number;
}

const isModelAsset = (url: string) => url.includes("/models/") || url.includes("/ort/");

/**
 * Counts bytes with CDP rather than with `content-length`.
 *
 * `Network.loadingFinished` reports `encodedDataLength` — what came down the
 * socket, compression and headers included. A `content-length` sum is the
 * decompressed body and would overstate the answer to "how much of the user's
 * bandwidth does this cost", which is the question §11 asks.
 */
export async function trackTraffic(page: Page): Promise<{ cdp: CDPSession; log: TrafficLog }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");

  const log: TrafficLog = {
    bytesByUrl: new Map(),
    origins: new Set(),
    firstModelByteAt: null,
    lastModelByteAt: null,
    since: Date.now(),
  };
  const urls = new Map<string, string>();

  cdp.on("Network.requestWillBeSent", (event) => {
    const url = event.request.url;
    urls.set(event.requestId, url);
    /*
     * `blob:` and `data:` are recorded by scheme, not by origin.
     *
     * `new URL("blob:http://localhost:3000/…").origin` is the string
     * `"null"`, so parsing them looks exactly like a cross-origin request and
     * would fail the same-origin assertion on the PDF worker the preview
     * already uses. They are same-document by construction and the CSP names
     * them explicitly (`connect-src 'self' blob: data:`), so they are counted
     * as themselves and the assertion is over http(s) origins.
     */
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      log.origins.add(url.slice(0, url.indexOf(":") + 1));
      return;
    }
    try {
      log.origins.add(new URL(url).origin);
    } catch {
      log.origins.add("unparseable");
    }
  });
  cdp.on("Network.loadingFinished", (event) => {
    const url = urls.get(event.requestId);
    if (!url) return;
    log.bytesByUrl.set(url, (log.bytesByUrl.get(url) ?? 0) + event.encodedDataLength);
    if (isModelAsset(url)) {
      const at = Date.now() - log.since;
      log.firstModelByteAt ??= at;
      log.lastModelByteAt = at;
    }
  });

  return { cdp, log };
}

/**
 * Re-bases the clock, and forgets what has already been counted.
 *
 * Called immediately before the Enhance click. Without it the download
 * timings are relative to when tracking started — which is before the resume
 * seed and the compose — and subtracting one from the other produces a
 * negative inference time, which is how this was noticed.
 */
export function restartWindow(log: TrafficLog): void {
  log.since = Date.now();
  log.firstModelByteAt = null;
  log.lastModelByteAt = null;
}

export function modelBytes(log: TrafficLog): number {
  let total = 0;
  for (const [url, bytes] of log.bytesByUrl) if (isModelAsset(url)) total += bytes;
  return total;
}

/* -------------------------------------------------------------------------- */
/* CPU and memory, from outside the browser                                    */
/* -------------------------------------------------------------------------- */

/**
 * Peak private working set across the browser's whole process tree.
 *
 * ## Why not `performance.memory`
 *
 * The model's weights live in a `WebAssembly.Memory`, which Chrome does not
 * count in `usedJSHeapSize`, and `measureUserAgentSpecificMemory()` needs
 * cross-origin isolation this app does not enable. Both would report a few
 * megabytes for a run that allocates hundreds, and §11's question — "does
 * this fit on a laptop with 8GB" — would get a confidently wrong answer.
 *
 * The process tree is the honest measure and it is deliberately the
 * pessimistic one: it includes the browser and GPU processes, not only the
 * renderer holding the tab.
 */
export class MemorySampler {
  private peak = 0;
  private baseline = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private failed = false;

  constructor(private readonly rootPid: number) {}

  private async sample(): Promise<number> {
    // `Get-CimInstance` rather than `Get-Process`: the tree has to be walked
    // by ParentProcessId, and only the CIM class carries that.
    const script = `
      $ids = New-Object System.Collections.Generic.HashSet[int]
      [void]$ids.Add(${this.rootPid})
      $all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, WorkingSetSize
      for ($i = 0; $i -lt 6; $i++) {
        foreach ($p in $all) { if ($ids.Contains([int]$p.ParentProcessId)) { [void]$ids.Add([int]$p.ProcessId) } }
      }
      ($all | Where-Object { $ids.Contains([int]$_.ProcessId) } | Measure-Object -Property WorkingSetSize -Sum).Sum
    `;
    const { stdout } = await run("powershell", ["-NoProfile", "-Command", script], {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    const value = Number(stdout.trim());
    return Number.isFinite(value) ? value : 0;
  }

  /** Call before the work starts, so the number reported is the delta. */
  async start(everyMs = 500): Promise<void> {
    try {
      this.baseline = await this.sample();
    } catch {
      this.failed = true;
      return;
    }
    this.peak = this.baseline;
    this.timer = setInterval(() => {
      void this.sample()
        .then((bytes) => {
          if (bytes > this.peak) this.peak = bytes;
        })
        .catch(() => {
          this.failed = true;
        });
    }, everyMs);
  }

  stop(): { baselineBytes: number; peakBytes: number; deltaBytes: number } | null {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.failed) return null;
    return {
      baselineBytes: this.baseline,
      peakBytes: this.peak,
      deltaBytes: this.peak - this.baseline,
    };
  }
}

/**
 * Cumulative task time for this tab, in seconds.
 *
 * The measurement behind "confirm the CPU actually stops". A spinner
 * disappearing proves the UI moved on; this proves the work did. Sampling it
 * twice across a quiet interval after Cancel gives the number that matters —
 * the delta should collapse to roughly nothing.
 */
export async function taskDuration(cdp: CDPSession): Promise<number> {
  await cdp.send("Performance.enable");
  const { metrics } = await cdp.send("Performance.getMetrics");
  return metrics.find((metric) => metric.name === "TaskDuration")?.value ?? 0;
}
