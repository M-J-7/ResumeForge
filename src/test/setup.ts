/**
 * Vitest setup for component tests.
 *
 * Loaded only by files that opt into the jsdom environment; the emitter and
 * store suites stay in plain Node, where they are faster and closer to how
 * that code actually runs.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

afterEach(cleanup);

// How long `findBy*` and `waitFor` keep looking. Testing Library's default is
// one second, which is a measure of this machine's load rather than of the
// code: `BuilderShell.test.tsx`'s malformed-email test types twelve characters
// through user-event before its alert can appear, and with the whole suite
// running in parallel that took 2.8–3.2 s and failed two runs in three
// (2026-09-28), while passing every time alone. A wait resolves the moment
// its element appears, so a longer ceiling costs a passing test nothing; it
// only changes how long a genuinely broken one takes to say so. Same
// principle as the e2e rule in `e2e/draft.ts`: wait on the observable thing,
// and give it time a loaded machine actually needs.
configure({ asyncUtilTimeout: 5_000 });

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
