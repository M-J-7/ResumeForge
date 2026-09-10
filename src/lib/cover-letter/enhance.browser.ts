"use client";

/**
 * The browser-only model adapter.
 *
 * Dynamically imported after an Enhance click, so the ONNX runtime and the
 * tokeniser never reach the letter editor's bundle for the users who never
 * press the button — which is most of them. Nothing here posts a prompt or a
 * response anywhere: inference runs in this tab, and the only network request
 * the feature can make is the one-time fetch of the model's static files.
 *
 * ## What this file is not allowed to do
 *
 * It does not decide whether a proposal is acceptable. That is `./enhance.ts`,
 * which is pure, provider-neutral and tested against an adversarial corpus.
 * The split matters: a future adapter for a different runtime inherits the
 * guardrail rather than reimplementing it, and the guardrail can be reasoned
 * about without a model anywhere near it.
 */

import "client-only";
import type { Text2TextGenerationPipeline } from "@huggingface/transformers";
import { buildEnhancementPrompt, validateEnhancement, type EnhancementRequest } from "./enhance";

export const LOCAL_ENHANCEMENT_MODEL = {
  id: "Xenova/flan-t5-small",
  // Immutable Hugging Face commit, rather than the moving `main` branch.
  // `scripts/fetch-enhancement-model.mjs` pins the same value; a test asserts
  // the two agree, because two places naming one revision is two places that
  // will eventually disagree.
  revision: "ec15bc2d425022b2de62f639b15cfea4bd9b8b3b",
} as const;

/** Where the vendored weights are served from. Same origin, always. */
export const LOCAL_MODEL_BASE = "/models/";

/** One small file, fetched to find out whether this deployment shipped the model. */
const MODEL_PROBE = `${LOCAL_MODEL_BASE}${LOCAL_ENHANCEMENT_MODEL.id}/config.json`;

export interface LocalEnhancementResult {
  text: string;
  modelId: string;
  modelRevision: string;
}

/** Progress on the one-time download, 0–1, or null while it is indeterminate. */
export type EnhancementProgress = (fraction: number | null) => void;

export interface EnhancementOptions {
  /** Aborts the download and interrupts generation already in flight. */
  signal?: AbortSignal;
  onProgress?: EnhancementProgress;
}

/** Thrown when the user cancelled. Distinguished so the UI stays silent. */
export class EnhancementAbortedError extends Error {
  constructor() {
    super("Enhancement cancelled.");
    this.name = "EnhancementAbortedError";
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new EnhancementAbortedError();
}

/* -------------------------------------------------------------------------- */
/* Same-origin only                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Points Transformers.js at this app and forbids it looking anywhere else.
 *
 * ## This is what makes the privacy claim structural
 *
 * `allowRemoteModels = false` is not a preference — it removes the code path
 * that could reach a third party. Combined with the app's
 * `connect-src 'self'` policy it means there is no configuration, no failure
 * mode and no future edit to this file that quietly sends a user's cover
 * letter to somebody else's server. The feature either runs on files this
 * origin served, or it does not run.
 *
 * ## And it is also the only way the feature works at all
 *
 * The library defaults to fetching weights from `huggingface.co` and the ORT
 * binary from a CDN. Both are blocked by our own CSP, so before this the
 * download failed in every production build — silently, and identically to a
 * device that genuinely could not run the model.
 */
async function configureLocalRuntime(): Promise<void> {
  const { env } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = LOCAL_MODEL_BASE;
  /*
   * Vendored beside the weights by the same script, for the same reason.
   *
   * `backends.onnx.wasm` is typed read-only by `onnxruntime-common` even
   * though setting `wasmPaths` on it is the documented way to relocate the
   * binary. The cast is narrow and named rather than an `any` on the whole
   * `env` object.
   */
  const wasm = env.backends.onnx.wasm as { wasmPaths?: string } | undefined;
  if (wasm) wasm.wasmPaths = "/ort/";
}

/* -------------------------------------------------------------------------- */
/* Availability                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Whether this device can run the feature at all.
 *
 * Checked before the consent dialog rather than after it, so a browser that
 * cannot do this is told so instead of being offered a download it will not
 * be able to use. Per the plan, an unsupported device leaves the feature
 * unavailable — the deterministic Recompose is the fallback, and nothing
 * moves to a server.
 *
 * WASM is the whole of it: `WebAssembly` is what the ONNX runtime needs, and
 * since the §11 measured pass it is also the only backend this feature uses
 * — see `createGenerator` for why the WebGPU path was removed rather than
 * fixed.
 */
export function isEnhancementSupported(): boolean {
  try {
    return typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
  } catch {
    return false;
  }
}

/**
 * Whether *this deployment* shipped the model.
 *
 * `pnpm enhance:fetch` is a deliberate step, not part of `prebuild` — ~120MB
 * on every build and every CI run would be indefensible for a feature most
 * users never press. So a build without it is a normal, supported state, and
 * the honest thing is to find out before offering the user a download that
 * will 404.
 *
 * One `HEAD` for a 1.5KB config file, cached after the first answer.
 */
let modelPresent: Promise<boolean> | null = null;

export function isEnhancementInstalled(): Promise<boolean> {
  modelPresent ??= fetch(MODEL_PROBE, { method: "HEAD" })
    .then((response) => response.ok)
    .catch(() => false);
  return modelPresent;
}

/* -------------------------------------------------------------------------- */
/* The pipeline                                                                */
/* -------------------------------------------------------------------------- */

let generatorPromise: Promise<Text2TextGenerationPipeline> | null = null;

/**
 * `pipeline` is overloaded across every task Transformers.js supports, so
 * TypeScript tries to resolve the options object against all of them at once
 * and gives up with "union type that is too complex to represent". Narrowing
 * to the one signature this module uses is what keeps `tsc` — and therefore
 * `next build` — able to check this file.
 */
type LoadPipeline = (
  task: "text2text-generation",
  model: string,
  options: Record<string, unknown>,
) => Promise<Text2TextGenerationPipeline>;

async function createGenerator(options: EnhancementOptions): Promise<Text2TextGenerationPipeline> {
  await configureLocalRuntime();
  const { pipeline } = await import("@huggingface/transformers");
  throwIfAborted(options.signal);

  const load = pipeline as unknown as LoadPipeline;
  const base = {
    revision: LOCAL_ENHANCEMENT_MODEL.revision,
    // The quantized weights keep the one-time download and the resident
    // memory within reach of an ordinary laptop. Transformers.js caches the
    // files after the first successful load, so this is paid once.
    dtype: "q8" as const,
    /*
     * Download progress, forwarded as a single fraction.
     *
     * Transformers.js reports per-file progress for several files. Averaging
     * them would jump backwards as each new file starts, so this reports the
     * file currently in flight and lets the UI show indeterminate progress
     * when it has nothing better — which is honest about what is known.
     */
    progress_callback: (event: { status?: string; progress?: number }) => {
      if (!options.onProgress) return;
      if (event.status === "progress" && typeof event.progress === "number") {
        options.onProgress(Math.max(0, Math.min(1, event.progress / 100)));
      } else if (event.status === "ready" || event.status === "done") {
        options.onProgress(1);
      } else {
        options.onProgress(null);
      }
    },
  };

  /*
   * ## WASM only. There used to be a WebGPU path, and it was silently wrong
   *
   * The adapter previously passed the pipeline a webgpu device wherever
   * `requestAdapter()` returned something, and fell back to WASM otherwise.
   * The QA §11 measured pass — the first time anything ran this model in a
   * browser — found that on the WebGPU execution provider the pipeline
   * returns **the same string regardless of its input**:
   *
   *     "comunicat cabluvêtement this this this this this this …"
   *
   * Byte-identical for four different paragraphs, which means the encoder's
   * output never reaches the decoder at all. The same weights, the same
   * prompt and the same build produce ordinary English on the WASM path in
   * one to three seconds. int8 (`dtype: "q8"`) weights on ONNX Runtime Web's
   * JSEP provider are a known-bad combination — the runtime warns that it
   * could not assign every node to the preferred provider — and this is what
   * that looks like from the outside.
   *
   * It was invisible because the guardrail did its job: the garbage was
   * rejected as "stopped mid-sentence", so the user saw a plausible failure
   * message rather than nonsense. A feature that is broken on every machine
   * with a working GPU, and correct on every machine without one, is worse
   * than one that is simply slower everywhere.
   *
   * Restoring a GPU path means re-running `pnpm qa:enhance` and reading the
   * output, not just checking that it does not throw. `enhance.hosting.test.ts`
   * pins this decision so it cannot come back by accident.
   */
  throwIfAborted(options.signal);
  return load("text2text-generation", LOCAL_ENHANCEMENT_MODEL.id, base);
}

async function generator(options: EnhancementOptions): Promise<Text2TextGenerationPipeline> {
  // One load per tab, shared across every paragraph. Two concurrent Enhance
  // clicks must not each fetch ~100MB of weights.
  generatorPromise ??= createGenerator(options);
  try {
    return await generatorPromise;
  } catch (error) {
    // A transient download or cache failure is retryable from the UI, so the
    // rejected promise must not be cached as the answer forever. An abort is
    // the same: the next click should start a fresh load.
    generatorPromise = null;
    throw error;
  }
}

/**
 * How much room to give the answer.
 *
 * A rewrite is about as long as its input, so the budget is derived from it
 * with headroom rather than fixed. Too small and beam search stops
 * mid-clause — which `validateEnhancement` now rejects outright, so a mean
 * budget shows up to the user as "the model stopped mid-sentence" rather
 * than as a bad suggestion. The ceiling is the practical limit of a
 * small seq2seq model, past which quality falls off before length does.
 */
function tokenBudget(originalText: string): number {
  const estimatedInputTokens = Math.ceil(originalText.length / 4);
  return Math.max(64, Math.min(320, Math.round(estimatedInputTokens * 1.6) + 24));
}

/**
 * Generates and validates one proposal. It never mutates a letter.
 *
 * Returns only what survived `validateEnhancement`; a proposal that
 * introduced a claim throws with the reason, which the editor shows verbatim
 * because "why was this rejected" is information the user needs in order to
 * judge the next suggestion.
 */
export async function enhanceLocally(
  request: EnhancementRequest,
  options: EnhancementOptions = {},
): Promise<LocalEnhancementResult> {
  throwIfAborted(options.signal);
  const model = await generator(options);
  throwIfAborted(options.signal);

  /*
   * Back to indeterminate, now that there is nothing left to download.
   *
   * The load reports `ready`, the UI holds the last fraction it was given,
   * and no further events arrive — so the editor sat on "Downloading the
   * model once — 100%" for the whole of a run that had finished downloading
   * before it started. Found by watching the status text through an entire
   * measured run: the number was true once and then wrong for twenty seconds,
   * which is worse than no number, because it tells somebody on a slow
   * connection that the wait they are in is a download that has completed.
   */
  options.onProgress?.(null);

  /*
   * Real interruption, not merely a discarded result.
   *
   * `InterruptableStoppingCriteria` is checked between generated tokens, so
   * pressing Cancel stops the work rather than leaving a beam search running
   * on the user's CPU while the UI pretends it stopped. That matters most on
   * the WASM path, which is exactly where somebody is most likely to cancel.
   */
  const { InterruptableStoppingCriteria } = await import("@huggingface/transformers");
  const stopper = new InterruptableStoppingCriteria();
  const abort = () => stopper.interrupt();
  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    /*
     * `stopping_criteria` is cast in, not asserted away lightly.
     *
     * `Text2TextGenerationPipeline`'s published option type is
     * `Partial<GenerationConfig>`, which does not name it — but the pipeline
     * body spreads its options straight into `model.generate({...inputs,
     * ...generate_kwargs})`, and `generate` does accept it. The type is
     * narrower than the implementation, so this is the one place the two are
     * reconciled, with the reason written down rather than an unexplained
     * `any` at the call site.
     */
    const generate = model as unknown as (
      text: string,
      options: Record<string, unknown>,
    ) => Promise<unknown>;

    const output = await generate(buildEnhancementPrompt(request), {
      // Deterministic: the same paragraph twice gives the same proposal, so
      // "Try again" is honest about being a retry of a failure rather than a
      // reroll for a luckier answer.
      do_sample: false,
      num_beams: 4,
      repetition_penalty: 1.1,
      max_new_tokens: tokenBudget(request.originalText),
      stopping_criteria: stopper,
    });
    throwIfAborted(options.signal);

    /*
     * The pipeline's return type is `single | single[]`, and with no
     * `num_return_sequences` it is always the array form — but the type does
     * not say so, so the shape is checked rather than asserted. Anything
     * else yields an empty candidate and fails validation below, which is
     * the correct outcome either way.
     */
    const first = Array.isArray(output) ? output[0] : output;
    const candidate =
      first !== null && typeof first === "object" && "generated_text" in first
        ? String(first.generated_text)
        : "";

    const validation = validateEnhancement(candidate, request);
    if (!validation.ok) throw new Error(validation.error);

    return {
      text: validation.text,
      modelId: LOCAL_ENHANCEMENT_MODEL.id,
      modelRevision: LOCAL_ENHANCEMENT_MODEL.revision,
    };
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}
