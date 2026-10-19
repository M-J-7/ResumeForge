/**
 * The platform features pdfjs 6 calls without polyfilling, installed where a
 * browser lacks them.
 *
 * pdfjs's "legacy" build bundles core-js for the language features it uses,
 * but not for these, and it needs them on every read:
 *
 * - **`ReadableStream` async iteration.** `page.getTextContent()` is a
 *   `for await` over a stream. No shipping Safari has it — caniuse lists it
 *   as missing through Safari 26.5, on Mac and on iOS — and every browser on
 *   an iPhone is Safari underneath. So on every iPhone, `/check` and resume
 *   import threw "readableStream is not async iterable", and the visitor was
 *   told their PDF was broken (2026-10-19, found with a real resume on a real
 *   phone). Playwright's WebKit is a trunk build that already has it, which
 *   is why nothing in the suite saw it.
 * - **`Promise.withResolvers`.** Safari 17.4. Called when a document opens.
 * - **`Response#bytes` and `Blob#bytes`.** Safari 18. Off the read path today,
 *   on the font, image and save paths pdfjs may take tomorrow.
 *
 * ## Why this is a plain `.mjs` file
 *
 * It has to run in two places: the page, where `lib/pdf/worker.ts` imports
 * it, and pdfjs's worker, which is a separate global with its own copy of
 * every built-in. `scripts/sync-public-fonts.mjs` copies this file into
 * `public/` unchanged and puts an entry in front of the worker that imports
 * it first. One file, no build step between the two copies.
 *
 * Each install is guarded, so a browser that has the real feature keeps it.
 */

function define(target, name, value) {
  Object.defineProperty(target, name, { value, writable: true, configurable: true });
}

/** Installs whatever is missing on `scope`. Safe to call more than once. */
export function installPdfPolyfills(scope = globalThis) {
  const PromiseCtor = scope.Promise;
  if (PromiseCtor && typeof PromiseCtor.withResolvers !== "function") {
    define(PromiseCtor, "withResolvers", function withResolvers() {
      let resolve;
      let reject;
      const promise = new this((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    });
  }

  const Stream = scope.ReadableStream;
  if (Stream && typeof Stream.prototype[Symbol.asyncIterator] !== "function") {
    // The shape the Streams spec gives `values()`: read until done, release
    // the lock when finished, and cancel the stream when a loop exits early
    // unless asked not to.
    const values = function values(options) {
      const preventCancel = Boolean(options && options.preventCancel);
      const reader = this.getReader();
      return {
        async next() {
          try {
            const result = await reader.read();
            if (result.done) reader.releaseLock();
            return result;
          } catch (error) {
            reader.releaseLock();
            throw error;
          }
        },
        async return(value) {
          if (preventCancel) {
            reader.releaseLock();
          } else {
            const cancelled = reader.cancel(value);
            reader.releaseLock();
            await cancelled;
          }
          return { done: true, value };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    };
    if (typeof Stream.prototype.values !== "function") define(Stream.prototype, "values", values);
    define(Stream.prototype, Symbol.asyncIterator, values);
  }

  for (const Ctor of [scope.Response, scope.Blob]) {
    if (Ctor && typeof Ctor.prototype.bytes !== "function") {
      define(Ctor.prototype, "bytes", function bytes() {
        return this.arrayBuffer().then((buffer) => new Uint8Array(buffer));
      });
    }
  }
}

installPdfPolyfills();
