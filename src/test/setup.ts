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
