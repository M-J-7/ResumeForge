/**
 * The iPhone failure of 2026-10-19, reproduced where the suite can see it.
 *
 * Every iPhone was told its PDF "could not be read as a PDF". The PDF was
 * fine: pdfjs reads text with a `for await` over a `ReadableStream`, and no
 * shipping Safari can iterate one. Playwright's WebKit is a trunk build that
 * can, so the e2e suite never saw it.
 *
 * Under Node, pdfjs runs its worker in this same thread, so taking the two
 * features away from Node's globals puts the page and the worker in exactly
 * the state Safari leaves them in — which is what lets this test fail the way
 * the phone did, and pass the way it now does.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { installPdfPolyfills } from "./polyfills.mjs";
import { parseResumeFile } from "@/lib/import/parse-resume";
import { renderPdf } from "@/lib/emit/pdf/render";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { midCareerResume } from "@/test/fixtures/resumes";

const native = {
  iterator: Object.getOwnPropertyDescriptor(ReadableStream.prototype, Symbol.asyncIterator),
  values: Object.getOwnPropertyDescriptor(ReadableStream.prototype, "values"),
  withResolvers: Object.getOwnPropertyDescriptor(Promise, "withResolvers"),
};

/** Leaves this runtime with what Safari 17.0–26.x has: neither feature. */
function removeLikeSafari(): void {
  const stream = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>;
  delete stream[Symbol.asyncIterator];
  delete stream.values;
  delete (Promise as unknown as Record<string, unknown>).withResolvers;
}

afterEach(() => {
  if (native.iterator) {
    Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, native.iterator);
  }
  if (native.values) Object.defineProperty(ReadableStream.prototype, "values", native.values);
  if (native.withResolvers) Object.defineProperty(Promise, "withResolvers", native.withResolvers);
  vi.restoreAllMocks();
});

let pdf: Uint8Array;
beforeAll(async () => {
  ({ bytes: pdf } = await renderPdf(midCareerResume, { resolveFont: nodeFontResolver }));
});

describe("reading a PDF in a browser without stream iteration — every Safari", () => {
  it("fails without the polyfills, and says it is the browser rather than the file", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    removeLikeSafari();

    const read = parseResumeFile(pdf, "pdf");
    await expect(read).rejects.toThrow(/browser stopped the PDF reader/);
    await expect(read).rejects.not.toThrow(/could not be read as a PDF/);
  });

  it("reads the same PDF once they are installed", async () => {
    removeLikeSafari();
    installPdfPolyfills();

    const result = await parseResumeFile(pdf, "pdf");
    expect(result.document.contact.email).toBe("jose.munoz@example.com");
    const experience = result.document.sections.find((s) => s.type === "experience");
    expect(experience?.type === "experience" && experience.entries).toHaveLength(2);
  });
});

describe("the polyfills themselves", () => {
  it("leave a native implementation alone", () => {
    installPdfPolyfills();
    expect(Object.getOwnPropertyDescriptor(Promise, "withResolvers")).toEqual(native.withResolvers);
  });

  it("give Promise.withResolvers its shape", async () => {
    removeLikeSafari();
    installPdfPolyfills();
    const { promise, resolve } = (
      Promise as unknown as {
        withResolvers: <T>() => { promise: Promise<T>; resolve: (value: T) => void };
      }
    ).withResolvers<number>();
    resolve(7);
    await expect(promise).resolves.toBe(7);
  });

  it("iterate a stream to the end and release it", async () => {
    removeLikeSafari();
    installPdfPolyfills();
    const stream = new ReadableStream<number>({
      start(controller) {
        [1, 2, 3].forEach((n) => controller.enqueue(n));
        controller.close();
      },
    });
    const seen: number[] = [];
    for await (const n of stream as unknown as AsyncIterable<number>) seen.push(n);
    expect(seen).toEqual([1, 2, 3]);
    expect(stream.locked).toBe(false);
  });

  it("cancel the stream when a loop leaves early, as the spec says", async () => {
    removeLikeSafari();
    installPdfPolyfills();
    const cancel = vi.fn();
    const stream = new ReadableStream<number>({
      pull(controller) {
        controller.enqueue(1);
      },
      cancel,
    });
    for await (const n of stream as unknown as AsyncIterable<number>) {
      expect(n).toBe(1);
      break;
    }
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });
});
