/**
 * QA §11 — the local enhancement model, measured on real hardware.
 *
 * ## Not part of `pnpm test:e2e`
 *
 * `playwright.config.ts` ignores this file by name and `pnpm qa:enhance` runs
 * it through `playwright.measure.config.ts` instead. Three reasons, and they
 * are the same ones `e2e/enhance.spec.ts` gives for not running the model at
 * all: the weights are ~120MB, a beam search on the WASM path takes tens of
 * seconds, and a headless CI container has no GPU — so a number measured
 * there would describe the runner rather than a user.
 *
 * ## What it is for
 *
 * §11 asks for measurements, and a checklist run by hand produces numbers
 * that cannot be reproduced and a tester who rounds. Everything here that a
 * machine can count, a machine counts: bytes on the wire, wall-clock latency
 * on each backend, peak process memory, whether the CPU actually stops on
 * Cancel, and the guardrail's refusal rate over ten roles.
 *
 * What stays with a person is the judgement §11 asks for by name — reading
 * the ten proposals and deciding whether they are sentences somebody would
 * send. This run prints them; it does not grade them.
 *
 * Run `pnpm enhance:fetch` first. Without it every test here skips, which is
 * correct: there is nothing to measure, and `e2e/enhance.spec.ts` already
 * asserts that the app says so plainly.
 */

import { chromium, expect, firefox, test, webkit, type Browser } from "@playwright/test";
import type { BrowserType } from "@playwright/test";
import { ROLE_EXAMPLES } from "../src/lib/examples/roles";
import { MEASUREMENT_POSTINGS } from "./measure/postings";
import {
  BASE_URL,
  MemorySampler,
  acceptEnhancementNotice,
  composeLetter,
  enhanceParagraph,
  modelBytes,
  record,
  restartWindow,
  seedResume,
  taskDuration,
  trackTraffic,
  type EnhancementOutcome,
} from "./measure/harness";

/** Enough for a cold WASM beam search on a laptop that is also running a build. */
test.setTimeout(900_000);

const example = (slug: string) => {
  const found = ROLE_EXAMPLES.find((entry) => entry.slug === slug);
  if (!found) throw new Error(`No role example for ${slug}`);
  return found;
};

/** Looked up by slug rather than by index, so `noUncheckedIndexedAccess` holds. */
const posting = (slug: string) => {
  const found = MEASUREMENT_POSTINGS.find((entry) => entry.slug === slug);
  if (!found) throw new Error(`No measurement posting for ${slug}`);
  return found;
};

/** The pair every single-role measurement uses. One role, so runs compare. */
const BASELINE = "software-developer";

/**
 * A launched browser, and the process id behind it.
 *
 * `Browser` has no `process()` — only `BrowserServer` does — so the browser is
 * started as a server and connected to. That is the whole reason for the
 * indirection: without the pid there is no way to measure the memory the run
 * actually costs, and `performance.memory` cannot see the WebAssembly heap
 * where the weights live (see `MemorySampler`).
 */
interface Launched {
  browser: Browser;
  pid: number | undefined;
  close(): Promise<void>;
}

/**
 * Chromium with the GPU actually available.
 *
 * `channel: "chromium"` rather than the default, deliberately: Playwright's
 * `headless: true` otherwise launches `chrome-headless-shell`, which has no
 * GPU process. On that binary `requestAdapter()` resolves to null — exactly
 * the case `hasUsableWebGpu()` exists to catch — and the "WebGPU" half of this
 * measurement would silently become a second WASM run wearing the wrong
 * label. The full binary in new-headless mode has a real adapter, and
 * `webGpuWorks()` below is what confirms we got one rather than assuming it.
 */
async function launchChromium(headless: boolean): Promise<Launched> {
  const server = await chromium.launchServer({
    channel: "chromium",
    headless,
    args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
  });
  const browser = await chromium.connect(server.wsEndpoint());
  return {
    browser,
    pid: server.process().pid,
    close: async () => {
      await browser.close();
      await server.close();
    },
  };
}

async function webGpuWorks(browser: Browser): Promise<{ ok: boolean; adapter: string | null }> {
  const page = await browser.newPage();
  try {
    /*
     * On a real origin, not `about:blank`.
     *
     * `navigator.gpu` is gated on a secure context, and an unnavigated page is
     * not one — so probing before navigating reports "no WebGPU" on a machine
     * with a working GPU, and the measurement quietly becomes a second WASM
     * run labelled as WebGPU. `http://localhost` is a secure context, which is
     * what makes this measurable here at all.
     */
    await page.goto(`${BASE_URL}/`);
    return await page.evaluate(async () => {
      /*
       * Described structurally rather than with `@webgpu/types`.
       *
       * The app does not use WebGPU types anywhere — the adapter only ever
       * asks whether `requestAdapter()` returns something — so pulling a
       * type-only dependency into the project for one probe in one test would
       * be a dependency the product does not need.
       */
      type AdapterInfo = Partial<
        Record<"vendor" | "architecture" | "device" | "description", string>
      >;
      const gpu = (
        navigator as Navigator & {
          gpu?: { requestAdapter(): Promise<{ info?: AdapterInfo } | null> };
        }
      ).gpu;
      if (!gpu) return { ok: false, adapter: null };
      const adapter = await gpu.requestAdapter();
      if (!adapter) return { ok: false, adapter: null };
      // The fields live on `GPUAdapterInfo`'s prototype, so spreading the
      // object gives an empty one. Read them by name.
      const info = adapter.info;
      const described = info
        ? [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(" ")
        : "";
      return { ok: true, adapter: described || "unnamed adapter" };
    });
  } finally {
    await page.close();
  }
}

/**
 * A Chromium with a working GPU.
 *
 * Tries headless first because a window opening in the middle of a long run is
 * unpleasant, and falls back to headed because on some drivers that is the
 * only way to get an adapter. Which one it took is recorded — a WebGPU number
 * measured in a headed browser is still a real one, but the report should not
 * imply headless produced it.
 */
async function chromiumWithGpu(): Promise<Launched & { headless: boolean; adapter: string }> {
  for (const headless of [true, false]) {
    const launched = await launchChromium(headless);
    const { ok, adapter } = await webGpuWorks(launched.browser);
    if (ok) return { ...launched, headless, adapter: adapter ?? "unknown" };
    await launched.close();
  }
  throw new Error("No WebGPU adapter available in either headless or headed Chromium");
}

/**
 * Everything the page complained about, in order.
 *
 * The adapter turns a failed run into one sentence for the user, which is the
 * right thing for the user and useless for a measurement. The console is
 * where the actual cause is — a 404 on a runtime file, a WASM instantiation
 * failure — so it is captured and recorded beside the outcome.
 */
function watchForErrors(page: import("@playwright/test").Page): string[] {
  const seen: string[] = [];
  page.on("pageerror", (error) => seen.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") seen.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) =>
    seen.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ""}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) seen.push(`http ${response.status()}: ${response.url()}`);
  });
  return seen;
}

/** Hides WebGPU from the page, so the adapter takes the WASM path it falls back to. */
const FORCE_WASM = () => {
  try {
    Object.defineProperty(Navigator.prototype, "gpu", {
      get: () => undefined,
      configurable: true,
    });
  } catch {
    // If it cannot be hidden the run is still valid; the report records which
    // backend the adapter reported choosing.
  }
};

/**
 * Clears a proposal so the next paragraph starts from a clean editor.
 *
 * "Keep original" rather than "Apply": the point of measuring four paragraphs
 * in one session is four independent runs against the composer's own text, and
 * applying each one would make every subsequent measurement a rewrite of a
 * rewrite.
 */
async function dismissProposal(page: import("@playwright/test").Page): Promise<void> {
  const keep = page.getByRole("button", { name: "Keep original" });
  if (await keep.isVisible().catch(() => false)) await keep.click();
}

/** True when this deployment vendored the weights. Everything here needs them. */
async function modelIsInstalled(): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/models/Xenova/flan-t5-small/config.json`, {
    method: "HEAD",
  }).catch(() => null);
  return response?.ok === true;
}

test.beforeAll(async () => {
  test.skip(
    !(await modelIsInstalled()),
    "Run `pnpm enhance:fetch` first — there is nothing to measure without the weights.",
  );
});

/* -------------------------------------------------------------------------- */

test("the one-time download, the cold run, and where the bytes went", async () => {
  const { browser, close, pid, headless, adapter } = await chromiumWithGpu();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  const { log } = await trackTraffic(page);
  const consoleErrors = watchForErrors(page);

  await seedResume(page, example(BASELINE).resume);
  await composeLetter(page, posting(BASELINE));

  const sampler = new MemorySampler(pid ?? 0);
  await sampler.start();

  // From here, and not from when tracking started: the seed and the compose
  // are not part of what a user waits for when they press Enhance.
  restartWindow(log);
  const startedAt = Date.now();
  const outcome = await enhanceParagraph(page, "Evidence paragraph");
  const memory = sampler.stop();

  const bytes = modelBytes(log);
  const perFile = [...log.bytesByUrl]
    .filter(([url]) => url.includes("/models/") || url.includes("/ort/"))
    .map(([url, size]) => ({ file: new URL(url).pathname, bytes: size }))
    .sort((a, b) => b.bytes - a.bytes);

  /*
   * The policy and the runtime configuration agreeing, asserted rather than
   * eyeballed in a network tab. `connect-src 'self'` should make anything
   * else impossible; this is the check that it does.
   */
  const offOrigin = [...log.origins].filter(
    (origin) => origin !== BASE_URL && origin !== "blob:" && origin !== "data:",
  );

  await record("download", {
    outcome: outcome.kind,
    // Recorded, not only asserted. A run that ends "unavailable" has a reason,
    // and the reason is the finding.
    message: "message" in outcome ? outcome.message : null,
    suggested: outcome.kind === "proposal" ? outcome.suggested : null,
    consoleErrors: consoleErrors.slice(0, 12),
    totalModelBytes: bytes,
    totalModelMB: Number((bytes / 1_000_000).toFixed(1)),
    perFile,
    downloadMs: log.lastModelByteAt,
    coldRunMs: outcome.ms,
    inferenceMs: outcome.ms - (log.lastModelByteAt ?? 0),
    wallClockMs: Date.now() - startedAt,
    memory,
    peakMemoryMB: memory ? Number((memory.peakBytes / 1_000_000).toFixed(0)) : null,
    deltaMemoryMB: memory ? Number((memory.deltaBytes / 1_000_000).toFixed(0)) : null,
    chromiumHeadless: headless,
    webgpuAdapter: adapter,
    offOriginRequests: offOrigin,
    allOrigins: [...log.origins],
  });

  expect(offOrigin, "every request during a run must be same-origin").toEqual([]);
  expect(bytes).toBeGreaterThan(50_000_000);
  await close();
});

/* -------------------------------------------------------------------------- */

test("warm latency on the only backend there is", async () => {
  const { browser, close, adapter } = await chromiumWithGpu();
  const context = await browser.newContext({ baseURL: BASE_URL });
  await acceptEnhancementNotice(context);
  const page = await context.newPage();

  await seedResume(page, example(BASELINE).resume);
  await composeLetter(page, posting(BASELINE));

  // The first run pays for the download and for building the graph. Warm
  // latency is every run after that, which is what somebody experiences on
  // paragraph two — and paragraph two is where they decide whether the
  // feature is worth using.
  const cold = await enhanceParagraph(page, "Opening paragraph");
  await dismissProposal(page);

  const warm: { paragraph: string; ms: number; kind: string }[] = [];
  for (const label of ["Evidence paragraph", "Alignment paragraph", "Closing paragraph"]) {
    const target = page.getByRole("textbox", { name: label });
    if (!(await target.isVisible().catch(() => false))) continue;
    const outcome = await enhanceParagraph(page, label);
    warm.push({ paragraph: label, ms: outcome.ms, kind: outcome.kind });
    await dismissProposal(page);
  }

  const sorted = warm.map((entry) => entry.ms).sort((a, b) => a - b);
  await record("latency", {
    backend: "wasm",
    // Recorded even though it is unused: the machine had a working GPU and
    // the run did not touch it, which is the point of the note below.
    gpuPresentButUnused: adapter,
    coldMs: cold.ms,
    coldOutcome: cold.kind,
    warm,
    warmMedianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    warmMinMs: sorted[0] ?? null,
    warmMaxMs: sorted[sorted.length - 1] ?? null,
  });
  await close();
});

/* -------------------------------------------------------------------------- */

/**
 * The regression test for the removed WebGPU path.
 *
 * `enhance.hosting.test.ts` asserts the code no longer names a GPU device;
 * this asserts the *behaviour*, which is the half that actually broke. A
 * browser with a working adapter and a browser with none must produce the
 * same proposal, because decoding is deterministic and there is now only one
 * backend. When there were two, these differed by everything: ordinary
 * English on one, `"comunicat cabluvêtement this this this…"` on the other.
 */
test("a working GPU changes nothing about the output", async () => {
  const outputs: Record<string, string> = {};

  for (const withGpu of [true, false]) {
    const launched = withGpu ? await chromiumWithGpu() : await launchChromium(true);
    const context = await launched.browser.newContext({ baseURL: BASE_URL });
    if (!withGpu) await context.addInitScript(FORCE_WASM);
    await acceptEnhancementNotice(context);
    const page = await context.newPage();

    await seedResume(page, example(BASELINE).resume);
    await composeLetter(page, posting(BASELINE));
    const outcome = await enhanceParagraph(page, "Evidence paragraph");
    outputs[withGpu ? "gpuAvailable" : "gpuHidden"] =
      outcome.kind === "proposal"
        ? outcome.suggested
        : `${outcome.kind}: ${"message" in outcome ? outcome.message : ""}`;
    await launched.close();
  }

  await record("gpuIrrelevance", outputs);
  expect(outputs.gpuAvailable).toBe(outputs.gpuHidden);
});

/* -------------------------------------------------------------------------- */

test("Cancel stops the work, not merely the spinner", async () => {
  const { browser, close } = await launchChromium(true);
  const context = await browser.newContext({ baseURL: BASE_URL });
  await acceptEnhancementNotice(context);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  await seedResume(page, example(BASELINE).resume);
  await composeLetter(page, posting(BASELINE));

  const textarea = page.getByRole("textbox", { name: "Evidence paragraph" });

  /*
   * ## The longest run this product can be made to do
   *
   * `tokenBudget()` derives `max_new_tokens` from the input, so a long
   * paragraph is a long run — and this is a paragraph a user could have typed,
   * under the 4,000-character limit the schema enforces.
   *
   * It still may not be long enough, and that is the finding rather than a
   * flaw in the test: see below.
   */
  const composed = await textarea.inputValue();
  const long = `${composed} `.repeat(12).trim().slice(0, 3_500);
  await textarea.fill(long);

  const block = page.locator("li", { has: textarea });
  await block.getByRole("button", { name: "Enhance" }).click();

  const cancel = page.getByRole("button", { name: "Cancel" });
  await page
    .getByText("Working locally on your device")
    .waitFor({ state: "visible", timeout: 600_000 });

  /*
   * ## Measured in the shortest window that can say anything
   *
   * An earlier version sampled CPU for three seconds, then another three, then
   * reached for Cancel — and the run had finished, so the click waited for a
   * button that no longer existed until the test timed out. On this hardware a
   * WASM run of even a 3,500-character paragraph completes in a couple of
   * seconds.
   *
   * So the window is one second, and if the run still beats it, that is
   * **recorded as the result**: cancellation is unreachable here because
   * nothing runs long enough to cancel. That is a true and useful thing to
   * know about the feature, and inventing a slower machine to make the button
   * testable would not be.
   */
  const busyBefore = await taskDuration(cdp);
  await page.waitForTimeout(1_000);
  const cpuWhileRunning = (await taskDuration(cdp)) - busyBefore;

  if (!(await cancel.isVisible().catch(() => false))) {
    await record("cancel", {
      reachable: false,
      note:
        "The run finished before Cancel could be pressed. On this machine a WASM " +
        "run of a 3,500-character paragraph — the longest the schema allows — " +
        "completes in about a second, so there is no window in which a user could " +
        "cancel. The interruption path is asserted by unit tests instead; what is " +
        "measured here is that it is not needed at this speed.",
      paragraphLength: long.length,
      cpuSecondsInOneSecondWindow: Number(cpuWhileRunning.toFixed(2)),
    });
    await close();
    return;
  }

  await cancel.click({ timeout: 30_000 });
  await expect(page.getByText("Enhancement cancelled")).toBeVisible({ timeout: 60_000 });

  await page.waitForTimeout(1_500);
  const idleBefore = await taskDuration(cdp);
  await page.waitForTimeout(1_000);
  const cpuAfterCancel = (await taskDuration(cdp)) - idleBefore;

  await record("cancel", {
    reachable: true,
    cpuSecondsWhileRunning: Number(cpuWhileRunning.toFixed(2)),
    cpuSecondsAfterCancel: Number(cpuAfterCancel.toFixed(2)),
    windowSeconds: 1,
    paragraphLength: long.length,
  });

  // The claim under test: the work stopped, not the spinner.
  expect(cpuAfterCancel).toBeLessThan(Math.max(0.2, cpuWhileRunning * 0.2));
  await expect(textarea).toHaveValue(long);
  await close();
});

/* -------------------------------------------------------------------------- */

test("ten proposals across ten roles", async () => {
  const { browser, close, adapter, headless } = await chromiumWithGpu();
  const context = await browser.newContext({ baseURL: BASE_URL });
  await acceptEnhancementNotice(context);
  const page = await context.newPage();

  const rows: unknown[] = [];
  for (const posting of MEASUREMENT_POSTINGS) {
    const entry = example(posting.slug);
    await seedResume(page, entry.resume);
    await composeLetter(page, posting);

    /*
     * ## Which paragraph to enhance, and why it is not always the evidence one
     *
     * The evidence paragraph is the interesting one — it is the paragraph made
     * of the user's own resume text — and for most of these roles the composer
     * cannot produce it. A requirement counts as `demonstrated` only when a
     * *bullet* names a term the skill vocabulary knows, and across all ten of
     * these example resumes exactly two bullets do: "Go" and "dbt". Everywhere
     * else the composer writes a bracketed explanation instead, and enhancing
     * that measures a model rewriting an error message.
     *
     * So the target is the first paragraph that is real prose. The opening is
     * always real — it is built from the role title and the company — which is
     * what makes ten proposals across ten roles possible at all. Which one was
     * used is recorded, because "we enhanced the opening" and "we enhanced the
     * evidence" are different claims.
     */
    let label = "";
    let paragraphText = "";
    for (const candidate of [
      "Evidence paragraph",
      "Opening paragraph",
      "Alignment paragraph",
      "Closing paragraph",
    ]) {
      const box = page.getByRole("textbox", { name: candidate });
      if (!(await box.isVisible().catch(() => false))) continue;
      const value = await box.inputValue();
      if (!label) {
        label = candidate;
        paragraphText = value;
      }
      // A bracketed paragraph is the composer saying it had nothing to work
      // with. Keep looking for one that is not.
      if (!value.trim().startsWith("[")) {
        label = candidate;
        paragraphText = value;
        break;
      }
    }

    let outcome: EnhancementOutcome;
    try {
      outcome = await enhanceParagraph(page, label);
    } catch (error) {
      outcome = {
        kind: "unavailable",
        message: error instanceof Error ? error.message : String(error),
        ms: 0,
      };
    }

    const row = {
      slug: posting.slug,
      role: entry.role,
      company: posting.company,
      absentRequirements: posting.absent,
      /** Which paragraph this row is about. */
      paragraph: label,
      /*
       * Whether the composer had anything to work with.
       *
       * Read from the editor before the attempt, not from the outcome: only a
       * *proposal* carries the original text back, so deriving it from the
       * outcome silently reported every refusal as real evidence — which is
       * how an earlier run claimed three real rows and had one.
       */
      placeholderEvidence: paragraphText.trim().startsWith("["),
      expectedPlaceholder: posting.expectsPlaceholder === true,
      kind: outcome.kind,
      ms: outcome.ms,
      original: outcome.kind === "proposal" ? outcome.original : null,
      suggested: outcome.kind === "proposal" ? outcome.suggested : null,
      summary: outcome.kind === "proposal" ? outcome.summary : null,
      message:
        outcome.kind === "refused" || outcome.kind === "unavailable" ? outcome.message : null,
    };
    rows.push(row);
    // Printed as it goes: this is the part a person has to read, and a run
    // that dies on role nine should still have shown eight proposals.
    console.log(`\n[${posting.slug}] ${label} — ${outcome.kind} in ${outcome.ms}ms`);
    if (outcome.kind === "proposal") {
      console.log(`  was: ${outcome.original}`);
      console.log(`  now: ${outcome.suggested}`);
      console.log(
        `  (evidence was ${paragraphText.trim().startsWith("[") ? "a placeholder" : "real"})`,
      );
    } else if (outcome.kind !== "cancelled") {
      console.log(`  ${outcome.message}`);
    }
  }

  type Row = { kind: string; placeholderEvidence: boolean };
  const real = rows.filter((row) => !(row as Row).placeholderEvidence);
  const refused = rows.filter((row) => (row as Row).kind === "refused").length;
  const proposed = rows.filter((row) => (row as Row).kind === "proposal").length;
  const realRefused = real.filter((row) => (row as Row).kind === "refused").length;

  await record("corpus", {
    adapter,
    headless,
    total: rows.length,
    proposed,
    refused,
    refusalRate: Number((refused / rows.length).toFixed(2)),
    // The number that means something. A refusal rate over rows where the
    // composer produced only a placeholder is a rate over a corpus of error
    // messages.
    withRealEvidence: real.length,
    refusalRateOnRealEvidence: real.length ? Number((realRefused / real.length).toFixed(2)) : null,
    rows,
  });

  // Deliberately not asserted against a target rate. §11's point is that a
  // rate near zero and a rate near 100% are *both* suspicious, and which one
  // this is takes a person reading the proposals. What is asserted is that
  // every attempt reached a terminal state the product defines.
  expect(rows.length).toBe(MEASUREMENT_POSTINGS.length);
  await close();
});

/* -------------------------------------------------------------------------- */

const ENGINES: readonly { name: string; type: BrowserType }[] = [
  { name: "chromium", type: chromium },
  { name: "firefox", type: firefox },
  { name: "webkit", type: webkit },
];

test("the browser matrix", async () => {
  const results: Record<string, unknown> = {};

  for (const engine of ENGINES) {
    const browser = await engine.type.launch({ headless: true });
    const context = await browser.newContext({ baseURL: BASE_URL });
    await acceptEnhancementNotice(context);
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(message.text());
    });

    let outcome: EnhancementOutcome | { kind: "error"; message: string; ms: number };
    const started = Date.now();
    try {
      await seedResume(page, example(BASELINE).resume);
      await composeLetter(page, posting(BASELINE));
      const enhanceVisible = await page
        .getByRole("button", { name: "Enhance" })
        .first()
        .isVisible()
        .catch(() => false);
      if (!enhanceVisible) throw new Error("Enhance is not offered in this browser");
      /*
       * Four minutes, not ten. An engine that can run this at all does so in
       * seconds once the weights are cached; one that cannot needs to say so
       * before the matrix has spent half an hour finding out twice.
       */
      outcome = await enhanceParagraph(page, "Evidence paragraph", { timeout: 240_000 });
    } catch (error) {
      outcome = {
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
        ms: Date.now() - started,
      };
    }

    results[engine.name] = {
      version: browser.version(),
      kind: outcome.kind,
      ms: outcome.ms,
      text: outcome.kind === "proposal" ? outcome.suggested : null,
      message: "message" in outcome ? outcome.message : null,
      // Truncated: an engine that fails does so loudly and repeatedly, and the
      // first few lines are the diagnosis.
      consoleErrors: failures.slice(0, 5),
    };
    console.log(`\n[${engine.name}] ${outcome.kind} in ${outcome.ms}ms`);
    await browser.close();
  }

  await record("browsers", results);
});

/* -------------------------------------------------------------------------- */

test("apply, reload, revert, and what reaches the exports", async () => {
  const { browser, close } = await chromiumWithGpu();
  const context = await browser.newContext({ baseURL: BASE_URL });
  await acceptEnhancementNotice(context);
  const page = await context.newPage();

  await seedResume(page, example(BASELINE).resume);
  await composeLetter(page, posting(BASELINE));

  /*
   * Whichever paragraph the model will actually propose something for.
   *
   * The first version enhanced the evidence paragraph and skipped when that
   * came back refused — which it does, often, since the model frequently
   * returns its input unchanged. The result was that the half of §11 about
   * Apply, Revert and the exports never ran at all, and a skipped test reads
   * as a passing one. Trying each paragraph in turn is what makes this check
   * about the lifecycle rather than about the model's mood.
   */
  let applied: { label: string; suggested: string; original: string } | null = null;
  for (const label of [
    "Evidence paragraph",
    "Opening paragraph",
    "Alignment paragraph",
    "Closing paragraph",
  ]) {
    const candidate = page.getByRole("textbox", { name: label });
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const original = await candidate.inputValue();
    const attempt = await enhanceParagraph(page, label);
    if (attempt.kind === "proposal") {
      applied = { label, suggested: attempt.suggested, original };
      break;
    }
    await dismissProposal(page);
  }

  expect(applied, "no paragraph produced a proposal, so nothing could be applied").not.toBeNull();
  if (!applied) return;

  const textarea = page.getByRole("textbox", { name: applied.label });
  const composed = applied.original;
  const outcome = { kind: "proposal" as const, suggested: applied.suggested };

  await page.getByRole("button", { name: "Apply enhancement" }).click();
  await expect(textarea).toHaveValue(outcome.suggested);

  // Save it, reload the page, and reopen — Revert has to survive the round
  // trip through storage, because that is when a user actually uses it.
  await page.getByLabel("Save this letter as").fill("Measured pass");
  await page.getByRole("button", { name: /^Save/ }).first().click();
  await expect(page.getByText(/Saved as/)).toBeVisible({ timeout: 30_000 });
  const url = page.url();

  await page.reload();
  await page.goto(url);
  const reopened = page.getByRole("textbox", { name: applied.label });
  await expect(reopened).toHaveValue(outcome.suggested, { timeout: 30_000 });

  const exported = await captureExports(page);

  await page.getByRole("button", { name: "Revert" }).first().click();
  await expect(reopened).toHaveValue(composed);

  await record("lifecycle", {
    composedLength: composed.length,
    appliedLength: outcome.suggested.length,
    survivedReload: true,
    revertRestoredComposerText: true,
    exports: exported,
  });

  for (const [format, text] of Object.entries(exported)) {
    // The enhanced sentence is in the document the employer receives, and the
    // fact that a model touched it is not: `enhancement` is metadata for the
    // editor's Revert, not something to ship in a file.
    expect(text.toLowerCase(), `${format} should not carry enhancement metadata`).not.toContain(
      "modelrevision",
    );
    expect(text.toLowerCase(), `${format} should not name the model`).not.toContain("flan-t5");
  }
  await close();
});

/**
 * Downloads each export and returns its text.
 *
 * PDF and DOCX are binary; what is checked is that no enhancement metadata
 * survives into them, and a byte-level search answers that without a parser —
 * a metadata leak would be the literal key or the model id, both ASCII.
 */
async function captureExports(
  page: import("@playwright/test").Page,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of [/PDF/, /DOCX|Word/, /Text|TXT|Plain/]) {
    const button = page.getByRole("button", { name }).first();
    if (!(await button.isVisible().catch(() => false))) continue;
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 120_000 }),
      button.click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    out[download.suggestedFilename()] = Buffer.concat(chunks).toString("latin1");
  }
  return out;
}
