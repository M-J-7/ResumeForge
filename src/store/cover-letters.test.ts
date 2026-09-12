/**
 * The guest half of cover letter storage (P29-J1, D6).
 *
 * The guarantee being pinned is the same one `job-targets.test.ts` pins, and
 * it is pinned the same way: everything happens against an injected
 * `KeyValueBackend`. There is no network call to mock because there is none
 * to make.
 */

import { describe, expect, it } from "vitest";
import { GUEST_OWNER, namespacedKey } from "./owner";
import { createMemoryBackend } from "./persistence";
import {
  COVER_LETTERS_KEY,
  createLocalCoverLetterStore,
  MAX_LOCAL_COVER_LETTERS,
} from "./cover-letters";

/** The slot a signed-out browser writes to (§10.1). */
const GUEST_SLOT = namespacedKey(COVER_LETTERS_KEY, GUEST_OWNER);

function harness() {
  const backend = createMemoryBackend();
  let tick = 0;
  let counter = 0;
  const store = createLocalCoverLetterStore(backend, {
    now: () => new Date(Date.UTC(2026, 0, 1) + tick++ * 1000),
    newId: () => `letter-${counter++}`,
  });
  return { backend, store };
}

const content = JSON.stringify({ schemaVersion: 1, paragraphs: [] });

describe("createLocalCoverLetterStore", () => {
  it("round-trips a letter, content and all", async () => {
    const { store } = harness();
    const created = await store.create({ title: "Acme — SRE", content, company: "Acme" });

    expect(created.id).toBe("letter-0");
    expect(await store.load(created.id)).toEqual(created);
  });

  it("keeps content out of the list, which is what the grid renders", async () => {
    const { store } = harness();
    await store.create({ title: "Acme", content });

    const [summary] = await store.list();
    expect(summary).toBeDefined();
    expect(summary).not.toHaveProperty("content");
  });

  it("writes to the backend and nowhere else", async () => {
    const { backend, store } = harness();
    await store.create({ title: "Acme", content });

    const raw = await backend.get(GUEST_SLOT);
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it("updates in place, keeping the id", async () => {
    const { store } = harness();
    const created = await store.create({ title: "Draft", content });

    const saved = await store.save(created.id, { title: "Acme — SRE", content: "{}" });
    expect(saved?.id).toBe(created.id);
    expect((await store.load(created.id))?.content).toBe("{}");
    expect(await store.list()).toHaveLength(1);
  });

  it("reports a save against an unknown id rather than creating one", async () => {
    const { store } = harness();
    expect(await store.save("nope", { title: "x", content })).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it("renames without touching the content", async () => {
    const { store } = harness();
    const created = await store.create({ title: "Draft", content });

    expect((await store.rename(created.id, "Acme — SRE"))?.title).toBe("Acme — SRE");
    expect((await store.load(created.id))?.content).toBe(content);
  });

  it("duplicates under a new id and a marked name", async () => {
    const { store } = harness();
    const created = await store.create({ title: "Acme", content });

    const copy = await store.duplicate(created.id);
    expect(copy?.id).not.toBe(created.id);
    expect(copy?.title).toBe("Acme (copy)");
    expect((await store.load(copy!.id))?.content).toBe(content);
    expect(await store.list()).toHaveLength(2);
  });

  it("removes, and reports a second removal as nothing to do", async () => {
    const { store } = harness();
    const created = await store.create({ title: "Acme", content });

    expect(await store.remove(created.id)).toBe(true);
    expect(await store.remove(created.id)).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it("lists most recently updated first", async () => {
    const { store } = harness();
    const first = await store.create({ title: "First", content });
    const second = await store.create({ title: "Second", content });

    expect((await store.list()).map((l) => l.id)).toEqual([second.id, first.id]);

    await store.rename(first.id, "First again");
    expect((await store.list()).map((l) => l.id)).toEqual([first.id, second.id]);
  });

  it("drops the oldest past the cap rather than growing without bound", async () => {
    const { store } = harness();
    for (let i = 0; i < MAX_LOCAL_COVER_LETTERS + 2; i += 1) {
      await store.create({ title: `Letter ${i}`, content });
    }
    expect(await store.list()).toHaveLength(MAX_LOCAL_COVER_LETTERS);
  });

  it("survives corrupt storage rather than throwing", async () => {
    const backend = createMemoryBackend({ [GUEST_SLOT]: "not json at all" });
    const store = createLocalCoverLetterStore(backend);
    expect(await store.list()).toEqual([]);
  });
});
