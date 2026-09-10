/**
 * The guest half of job-target storage (P27-H1, D6).
 *
 * What is being pinned here is the D6 guarantee in the only form a test can
 * check it: everything this store does happens against an injected
 * `KeyValueBackend` and nothing else. There is no network call to mock,
 * because there is no network call.
 */

import { describe, expect, it } from "vitest";
import { GUEST_OWNER, namespacedKey } from "./owner";
import { createMemoryBackend } from "./persistence";
import { createLocalJobTargetStore, JOB_TARGETS_KEY, MAX_LOCAL_JOB_TARGETS } from "./job-targets";

/** The slot a signed-out browser writes to (§10.1). */
const GUEST_SLOT = namespacedKey(JOB_TARGETS_KEY, GUEST_OWNER);

function fixedClock(start = Date.UTC(2026, 0, 1)) {
  let tick = 0;
  return () => new Date(start + tick++ * 1000);
}

describe("createLocalJobTargetStore", () => {
  it("starts empty and round-trips a saved posting", async () => {
    const store = createLocalJobTargetStore(createMemoryBackend(), { now: fixedClock() });
    expect(await store.list()).toEqual([]);

    const record = await store.create({
      title: "Acme — SRE",
      company: "Acme",
      roleTitle: "SRE",
      description: "Requirements: Kubernetes.",
    });

    expect(record.description).toBe("Requirements: Kubernetes.");
    expect(await store.list()).toEqual([record]);
  });

  it("writes to the backend and nowhere else", async () => {
    const backend = createMemoryBackend();
    const store = createLocalJobTargetStore(backend, { now: fixedClock() });
    await store.create({ title: "Acme", description: "jd" });

    const raw = await backend.get(GUEST_SLOT);
    expect(raw).toBeTypeOf("string");
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it("treats a blank company or role as absent", async () => {
    const store = createLocalJobTargetStore(createMemoryBackend(), { now: fixedClock() });
    const record = await store.create({
      title: "Acme",
      company: "  ",
      roleTitle: undefined,
      description: "jd",
    });
    expect(record.company).toBeNull();
    expect(record.roleTitle).toBeNull();
  });

  it("updates an existing record in place", async () => {
    const store = createLocalJobTargetStore(createMemoryBackend(), { now: fixedClock() });
    const created = await store.create({ title: "Draft", description: "first" });

    const saved = await store.save(created.id, { title: "Acme — SRE", description: "second" });
    expect(saved?.id).toBe(created.id);
    expect(saved?.description).toBe("second");
    expect(await store.list()).toHaveLength(1);
  });

  it("reports a save against an unknown id rather than creating one", async () => {
    const store = createLocalJobTargetStore(createMemoryBackend(), { now: fixedClock() });
    expect(await store.save("no-such-id", { title: "x", description: "y" })).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it("removes a record, and reports a second removal as nothing to do", async () => {
    const store = createLocalJobTargetStore(createMemoryBackend(), { now: fixedClock() });
    const record = await store.create({ title: "Acme", description: "jd" });

    expect(await store.remove(record.id)).toBe(true);
    expect(await store.remove(record.id)).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it("lists most recently updated first", async () => {
    const store = createLocalJobTargetStore(createMemoryBackend(), { now: fixedClock() });
    const first = await store.create({ title: "First", description: "a" });
    const second = await store.create({ title: "Second", description: "b" });

    expect((await store.list()).map((r) => r.id)).toEqual([second.id, first.id]);

    await store.save(first.id, { title: "First", description: "a2" });
    expect((await store.list()).map((r) => r.id)).toEqual([first.id, second.id]);
  });

  it("drops the oldest past the cap rather than growing without bound", async () => {
    const store = createLocalJobTargetStore(createMemoryBackend(), { now: fixedClock() });
    for (let i = 0; i < MAX_LOCAL_JOB_TARGETS + 3; i += 1) {
      await store.create({ title: `Posting ${i}`, description: "jd" });
    }

    const records = await store.list();
    expect(records).toHaveLength(MAX_LOCAL_JOB_TARGETS);
    expect(records[0]?.title).toBe(`Posting ${MAX_LOCAL_JOB_TARGETS + 2}`);
  });

  it("survives corrupt storage rather than throwing", async () => {
    const backend = createMemoryBackend({ [GUEST_SLOT]: "{not json" });
    const store = createLocalJobTargetStore(backend, { now: fixedClock() });
    expect(await store.list()).toEqual([]);
  });

  it("discards individually malformed records but keeps the rest", async () => {
    const good = {
      id: "keep",
      title: "Keep",
      company: null,
      roleTitle: null,
      description: "jd",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const backend = createMemoryBackend({
      [GUEST_SLOT]: JSON.stringify([good, { id: 7 }, null, { title: "no id" }]),
    });
    const store = createLocalJobTargetStore(backend, { now: fixedClock() });
    expect(await store.list()).toEqual([good]);
  });
});
