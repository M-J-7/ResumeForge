// @vitest-environment jsdom
/**
 * The Interview tab's ticks: per owner, keyed by the words, and purged with
 * everything else the browser holds for somebody.
 */

import { afterEach, describe, expect, it } from "vitest";
import { NAMESPACED_LOCAL_STORAGE_BASES } from "@/store/purge";
import { INTERVIEW_READY_STORAGE_KEY, lineKey, parseReady, readReadyRaw, setReady } from "./ready";

afterEach(() => {
  localStorage.clear();
});

describe("lineKey", () => {
  it("is stable for the same words and changes when a figure does", () => {
    expect(lineKey("Cut churn from 9% to 4%.")).toBe(lineKey("Cut churn from 9% to 4%."));
    expect(lineKey("Cut churn from 9% to 4%.")).not.toBe(lineKey("Cut churn from 9% to 5%."));
    expect(lineKey("anything")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("does not store the sentence itself", () => {
    setReady("Closed 118% of a $2.4m quota.", true);
    expect(readReadyRaw()).not.toContain("quota");
  });
});

describe("setReady", () => {
  it("ticks and unticks one line, leaving the others", () => {
    setReady("First line with 3 things.", true);
    setReady("Second line with 4 things.", true);
    setReady("First line with 3 things.", false);
    const ready = parseReady(readReadyRaw());
    expect(ready.has(lineKey("Second line with 4 things."))).toBe(true);
    expect(ready.has(lineKey("First line with 3 things."))).toBe(false);
  });

  it("survives a corrupt slot by starting again", () => {
    expect(parseReady("{not json")).toEqual(new Set());
    expect(parseReady(JSON.stringify([1, "abc", null]))).toEqual(new Set(["abc"]));
  });
});

describe("the purge", () => {
  it("knows about the slot, so another person's ticks never survive a sign-in", () => {
    expect(NAMESPACED_LOCAL_STORAGE_BASES).toContain(INTERVIEW_READY_STORAGE_KEY);
  });
});
