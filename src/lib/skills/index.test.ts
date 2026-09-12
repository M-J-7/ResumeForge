/**
 * That the ingested vocabulary actually loads.
 *
 * `loadSkillIndex` degrades to the curated-only index when the data file
 * cannot be read, which is the right behaviour at runtime and a silent
 * failure in CI: everything keeps working, the matcher just stops knowing
 * about seven thousand technologies. This is the test that notices.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { CURATED_SKILLS, loadSkillIndex, resetSkillIndexCache } from "./index";

beforeEach(() => {
  resetSkillIndexCache();
});

describe("loadSkillIndex", () => {
  it("loads far more than the curated list alone", async () => {
    const index = await loadSkillIndex();

    // If the JSON failed to load this falls back to curated-only, and the
    // count would land exactly on the curated length.
    expect(index.size).toBeGreaterThan(CURATED_SKILLS.length * 10);
  });

  it("resolves an entry that only exists in the ingested data", async () => {
    const index = await loadSkillIndex();

    // Not in `curated.ts` — it can only have come from O*NET.
    expect(index.resolve("Adobe Photoshop")?.source).toBe("onet");
  });

  it("still prefers curated entries over ingested ones", async () => {
    const index = await loadSkillIndex();
    const resolved = index.resolve("k8s");

    expect(resolved?.canonical).toBe("Kubernetes");
    expect(resolved?.source).toBe("curated");
  });

  it("caches, so a second call is the same index", async () => {
    const first = await loadSkillIndex();
    const second = await loadSkillIndex();
    expect(second).toBe(first);
  });

  it("rebuilds after the cache is reset", async () => {
    const first = await loadSkillIndex();
    resetSkillIndexCache();
    const second = await loadSkillIndex();

    expect(second).not.toBe(first);
    expect(second.size).toBe(first.size);
  });
});
