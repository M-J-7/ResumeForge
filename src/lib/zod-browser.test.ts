// @vitest-environment jsdom
/**
 * In a browser, Zod never probes for `eval` — see `zod-browser.ts`. Loading
 * the resume schema is enough to switch the probe off, because every schema
 * in the app is reached through it.
 */

import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, settingsSchema } from "@/lib/resume/schema";

describe("zod in the browser", () => {
  it("is jitless once the resume schema has loaded", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("parses without ever constructing a function from a string", () => {
    const construct = vi.spyOn(globalThis, "Function");
    expect(settingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(construct).not.toHaveBeenCalled();
    construct.mockRestore();
  });
});
