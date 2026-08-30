/**
 * Vitest setup for component tests.
 *
 * Loaded only by files that opt into the jsdom environment; the emitter and
 * store suites stay in plain Node, where they are faster and closer to how
 * that code actually runs.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// jsdom implements <dialog> only partially: showModal/close are missing, and
// the command palette depends on them. These stubs give the element the
// open/closed behaviour the component relies on.
if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
}

// jsdom implements neither ResizeObserver nor the canvas 2D context. The
// preview pane observes its container to compute fit-width zoom, and the
// PDF canvas needs a context to paint into. Stubbing both keeps component
// tests focused on behaviour that jsdom can actually model; the rendering
// itself is covered by the emitter suites in plain Node, against real bytes.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "blob:stub";
  URL.revokeObjectURL = () => {};
}
