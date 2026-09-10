/**
 * Local cover-letter enhancement, end to end.
 *
 * ## What is tested here, and what deliberately is not
 *
 * The model itself is not run. `Xenova/flan-t5-small` is a ~120MB one-time
 * download and a beam search that takes seconds to tens of seconds; making
 * every CI run pay that would be slow, flaky and dependent on a third-party
 * host being up — and it would test Transformers.js rather than this product.
 * Output quality, latency and the browser matrix are a measured manual pass,
 * recorded in `docs/QA.md`.
 *
 * What *is* tested here is everything that must hold whether the model works
 * or not, and it is the half that matters most:
 *
 *   1. **Nothing leaves the browser.** The plan's acceptance criterion is
 *      that network inspection during Enhance shows no resume, job-description
 *      or letter text, for a guest and for a signed-in user alike. That is
 *      asserted against every request the page makes, and it holds precisely
 *      *because* the model never loads here — a failed download must not fall
 *      back to a server, and this proves it does not.
 *   2. **Consent gates the download.** No model file is fetched until the
 *      user presses the button in the dialog.
 *   3. **Every failure leaves the paragraph alone**, and the deterministic
 *      Recompose still works — which is the free fallback the whole feature
 *      degrades to.
 *
 * The guardrail that decides whether a proposal is acceptable is pure and is
 * covered exhaustively by `src/lib/cover-letter/enhance.eval.test.ts`,
 * including an adversarial corpus and prompt injection.
 */

import { expect, test, type Page, type Request } from "@playwright/test";
import { waitForDraftSaved } from "./draft";

const JOB_DESCRIPTION = `Senior Platform Engineer

Requirements
- 5+ years running Kubernetes in production
- Strong Terraform experience
`;

/** A phrase that exists only in the user's own resume and letter. */
const PRIVATE_TEXT = "Cut median deploy time from 38 minutes to 6";

async function buildResume(page: Page) {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email", { exact: true }).fill("ada@example.com");
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a role" }).click();
  await page.getByLabel("Job title").fill("Platform Engineer");
  await page.getByLabel("Organization").fill("Meridian Health");
  await page
    .getByRole("textbox", { name: /bullet 1/i })
    .fill(`${PRIVATE_TEXT} by moving 40 services onto a shared Kubernetes cluster.`);
  await waitForDraftSaved(page, PRIVATE_TEXT);
}

/** Composes a draft in the letter editor and returns the evidence textarea. */
async function composeLetter(page: Page) {
  await page.goto("/letters/new");
  await page.getByLabel("Or paste a posting").fill(JOB_DESCRIPTION);
  await page.getByLabel("Company").fill("Acme");
  await page.getByRole("button", { name: "Compose draft" }).click();

  const evidence = page.getByRole("textbox", { name: "Evidence paragraph" });
  await expect(evidence).toBeVisible({ timeout: 60_000 });
  return evidence;
}

/**
 * Records every request the page makes, with its body.
 *
 * The assertion is over the whole conversation rather than over a allow-list
 * of hosts, because "did any of our text go anywhere" is the question, and a
 * host list would answer a narrower one.
 */
function recordRequests(page: Page): Request[] {
  const seen: Request[] = [];
  page.on("request", (request) => seen.push(request));
  return seen;
}

function bodiesOf(requests: readonly Request[]): string {
  return requests.map((request) => `${request.url()} ${request.postData() ?? ""}`).join("\n");
}

/**
 * The availability probe, answered rather than left to the machine.
 *
 * ## Both directions are forced, and that is the point
 *
 * `isEnhancementInstalled()` sends one HEAD for `config.json`, and its answer
 * is the whole of what "installed" means to the editor. Whether that file is
 * really there depends on whether somebody ran `pnpm enhance:fetch` on this
 * machine — CI has not, a developer measuring §11 has — so a test that reads
 * the real answer tests the machine rather than the product.
 *
 * That is not hypothetical: the "did not ship the model" test below passed for
 * months in CI and failed the first time anybody vendored the weights locally,
 * which is exactly backwards. Both states are supported, both are asserted,
 * and neither depends on the filesystem.
 *
 * The weights themselves stay unreachable either way, which is what makes the
 * failure path the one under test.
 */
async function pretendModelInstalled(page: Page): Promise<void> {
  await page.route("**/models/Xenova/flan-t5-small/config.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

/** The other direction: a deployment that did not run `pnpm enhance:fetch`. */
async function pretendModelMissing(page: Page): Promise<void> {
  await page.route("**/models/Xenova/flan-t5-small/config.json", (route) =>
    route.fulfill({ status: 404, contentType: "text/plain", body: "not found" }),
  );
}

/** Cuts off every route the weights could arrive by. */
async function blockModelDownload(page: Page): Promise<void> {
  await page.route("**/*.onnx*", (route) => route.abort());
  await page.route("**/models/**/onnx/**", (route) => route.abort());
  await page.route("**/huggingface.co/**", (route) => route.abort());
  await page.route("**/hf.co/**", (route) => route.abort());
}

/** Any terminal state of an attempt: a proposal, or an honest refusal. */
const SETTLED =
  /Local enhancement is unavailable|Suggestion ready|The proposal|The local model|does not ship the local enhancement model/;

test("does not offer Enhance until a draft exists", async ({ page }) => {
  await buildResume(page);
  await page.goto("/letters/new");

  // Nothing to enhance before Compose. The control is bound to the frozen
  // compose sources, not merely hidden by CSS.
  await expect(page.getByRole("button", { name: "Enhance" })).toBeHidden();
});

test("says so plainly when the deployment did not ship the model", async ({ page }) => {
  /*
   * The recommended state, and since the §11 measured pass the default one:
   * `pnpm enhance:fetch` is a deliberate step, ~120MB, and `docs/QA.md` §11
   * concludes no deployment should run it. What must not happen is a vague
   * failure — the user is told which of the two reasons applies, and the
   * deterministic fallback is named.
   *
   * Forced with a 404 rather than relying on the file being absent. It is
   * absent in CI and present on any machine that has run the measured pass,
   * and this assertion should not depend on which of those it is running on.
   */
  await buildResume(page);
  await composeLetter(page);
  await pretendModelMissing(page);

  const requests = recordRequests(page);
  await page.getByRole("button", { name: "Enhance" }).first().click();

  await expect(page.getByText(/does not ship the local enhancement model/)).toBeVisible();
  await expect(page.getByText(/Recompose needs no model/)).toBeVisible();

  // And it refused before offering a download, so nothing was fetched.
  const urls = requests.map((request) => request.url()).join("\n");
  expect(urls).not.toContain(".onnx");
  expect(urls).not.toContain("huggingface");
});

test("asks before downloading anything, and downloads nothing if declined", async ({ page }) => {
  await buildResume(page);
  await composeLetter(page);
  await pretendModelInstalled(page);

  const requests = recordRequests(page);
  await page.getByRole("button", { name: "Enhance" }).first().click();

  // The first-use disclosure, before a byte is fetched.
  await expect(page.getByRole("heading", { name: "Enhance this paragraph locally" })).toBeVisible();
  await expect(page.getByText(/runs on your device/)).toBeVisible();

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("heading", { name: "Enhance this paragraph locally" })).toBeHidden();

  /*
   * Consent gates the *download*. The 1.5KB availability probe is expected
   * and is not one — asserting on any URL naming the model would fail on the
   * `HEAD config.json` that decides whether to offer the download at all.
   * What must not have happened is a weight fetch, or any request off-origin.
   */
  const urls = requests.map((request) => request.url()).join("\n");
  expect(urls).not.toContain(".onnx");
  expect(urls).not.toContain("huggingface");
  expect(urls).not.toContain("cdn.jsdelivr.net");
  for (const request of requests) {
    expect(new URL(request.url()).origin, request.url()).toBe("http://localhost:3000");
  }
});

test("sends no resume, posting or letter text anywhere during Enhance (guest)", async ({
  page,
}) => {
  await buildResume(page);
  await composeLetter(page);

  await pretendModelInstalled(page);
  const requests = recordRequests(page);

  /*
   * The weights are unreachable, which is the interesting case rather than a
   * limitation: the acceptance criterion is that a *failure* must not fall
   * back to a server. If any of this text were going to be posted somewhere,
   * a dead download is exactly when it would happen.
   */
  await blockModelDownload(page);

  await page.getByRole("button", { name: "Enhance" }).first().click();
  await page.getByRole("button", { name: "Download and enhance" }).click();

  // Whatever happens, it resolves — into a proposal, or into an honest
  // refusal. Either ends the attempt.
  await expect(page.getByText(SETTLED).first()).toBeVisible({ timeout: 120_000 });

  const traffic = bodiesOf(requests);
  expect(traffic).not.toContain(PRIVATE_TEXT);
  expect(traffic).not.toContain("Meridian Health");
  expect(traffic).not.toContain("Ada Lovelace");
  // The posting the user pasted is theirs too.
  expect(traffic).not.toContain("5+ years running Kubernetes");
});

test("leaves the paragraph untouched when enhancement fails, and Recompose still works", async ({
  page,
}) => {
  await buildResume(page);
  const evidence = await composeLetter(page);
  const composed = await evidence.inputValue();
  expect(composed).toContain("deploy time from 38 minutes to 6");

  await pretendModelInstalled(page);
  await blockModelDownload(page);

  await page.getByRole("button", { name: "Enhance" }).first().click();
  await page.getByRole("button", { name: "Download and enhance" }).click();
  await expect(page.getByText(SETTLED).first()).toBeVisible({ timeout: 120_000 });

  // The user's paragraph is exactly as the composer left it. An enhancement
  // that fails must cost nothing.
  await expect(evidence).toHaveValue(composed);

  // And the free fallback is still there — which is the whole reason the
  // feature is allowed to be unavailable rather than served from a server.
  await page.getByRole("button", { name: "Recompose", exact: true }).first().click();
  await expect(evidence).toHaveValue(/deploy time from 38 minutes to 6/);
});

test("never offers Enhance on a paragraph the user wrote themselves", async ({ page }) => {
  await buildResume(page);
  await composeLetter(page);

  await page.getByRole("button", { name: "Add a paragraph of your own" }).click();
  const own = page.getByRole("textbox", { name: "Your own paragraph" });
  await expect(own).toBeVisible();
  await own.fill("A sentence entirely of my own writing.");

  /*
   * Scoped to text the product generated, per the plan. There is nothing for
   * the model to hold to: a custom paragraph has no `sources`, so the
   * guardrail would have no evidence pack to check a proposal against.
   */
  const block = page.locator("li", { has: own });
  await expect(block.getByRole("button", { name: "Enhance" })).toHaveCount(0);
  await expect(block.getByRole("button", { name: "Recompose", exact: true })).toHaveCount(0);
});
