import { describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  createDraftStore,
  createMemoryBackend,
  type KeyValueBackend,
} from "./persistence";

function trackingBackend(): KeyValueBackend & {
  writes: number;
  deletes: number;
  raw: Map<string, string>;
} {
  const raw = new Map<string, string>();
  const backend = {
    writes: 0,
    deletes: 0,
    raw,
    async get(key: string) {
      return raw.get(key);
    },
    async set(key: string, value: string) {
      backend.writes += 1;
      raw.set(key, value);
    },
    async del(key: string) {
      backend.deletes += 1;
      raw.delete(key);
    },
  };
  return backend;
}

describe("createDraftStore — debounced autosave", () => {
  it("collapses a burst of saves into one write", async () => {
    vi.useFakeTimers();
    try {
      const backend = trackingBackend();
      const store = createDraftStore(backend, { debounceMs: 500 });

      for (let i = 0; i < 40; i += 1) {
        store.save({ document: { keystroke: i }, savedAt: i });
      }
      expect(backend.writes).toBe(0);

      await vi.advanceTimersByTimeAsync(500);
      expect(backend.writes).toBe(1);

      const saved = JSON.parse(backend.raw.get(STORAGE_KEY) ?? "{}");
      expect(saved.document).toEqual({ keystroke: 39 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not write before the debounce window elapses", async () => {
    vi.useFakeTimers();
    try {
      const backend = trackingBackend();
      const store = createDraftStore(backend, { debounceMs: 500 });
      store.save({ document: { a: 1 }, savedAt: 0 });
      await vi.advanceTimersByTimeAsync(499);
      expect(backend.writes).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(backend.writes).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createDraftStore — flush", () => {
  it("writes the queued draft immediately", async () => {
    const backend = trackingBackend();
    const store = createDraftStore(backend, { debounceMs: 10_000 });
    store.save({ document: { a: 1 }, savedAt: 0 });
    expect(store.isPending()).toBe(true);

    await store.flush();

    expect(store.isPending()).toBe(false);
    expect(backend.writes).toBe(1);
    expect(await store.read()).toMatchObject({ document: { a: 1 } });
  });

  it("is a safe no-op when nothing is queued", async () => {
    const backend = trackingBackend();
    const store = createDraftStore(backend, { debounceMs: 10 });
    await expect(store.flush()).resolves.toBeUndefined();
    expect(backend.writes).toBe(0);
  });

  it("cancels the pending timer so flushing does not cause a second write", async () => {
    vi.useFakeTimers();
    try {
      const backend = trackingBackend();
      const store = createDraftStore(backend, { debounceMs: 500 });
      store.save({ document: { a: 1 }, savedAt: 0 });
      await store.flush();
      await vi.advanceTimersByTimeAsync(1000);
      expect(backend.writes).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves the newest draft as the last committed value", async () => {
    const backend = trackingBackend();
    const store = createDraftStore(backend, { debounceMs: 5 });
    store.save({ document: { v: 1 }, savedAt: 0 });
    store.save({ document: { v: 2 }, savedAt: 1 });
    await store.flush();
    expect(await store.read()).toMatchObject({ document: { v: 2 } });
  });
});

describe("createDraftStore — read", () => {
  it("returns null when nothing has been saved", async () => {
    const store = createDraftStore(createMemoryBackend());
    expect(await store.read()).toBeNull();
  });

  it("returns null rather than throwing on corrupt storage", async () => {
    const store = createDraftStore(createMemoryBackend({ [STORAGE_KEY]: "{not json" }));
    expect(await store.read()).toBeNull();
  });

  it("returns null when the stored value is the wrong shape", async () => {
    const store = createDraftStore(createMemoryBackend({ [STORAGE_KEY]: '{"unexpected":true}' }));
    expect(await store.read()).toBeNull();
  });

  it("round-trips a draft through storage", async () => {
    const backend = createMemoryBackend();
    const writer = createDraftStore(backend, { debounceMs: 1 });
    writer.save({ document: { fullName: "José" }, savedAt: 42 });
    await writer.flush();

    // A fresh store over the same backend is what a page reload looks like.
    const reader = createDraftStore(backend);
    expect(await reader.read()).toEqual({ document: { fullName: "José" }, savedAt: 42 });
  });
});

describe("createDraftStore — clear", () => {
  it("removes the draft and drops anything queued", async () => {
    const backend = trackingBackend();
    const store = createDraftStore(backend, { debounceMs: 10_000 });
    store.save({ document: { a: 1 }, savedAt: 0 });
    await store.clear();

    expect(backend.deletes).toBe(1);
    expect(store.isPending()).toBe(false);
    expect(await store.read()).toBeNull();
  });

  it("does not let a pending save resurrect cleared data", async () => {
    vi.useFakeTimers();
    try {
      const backend = trackingBackend();
      const store = createDraftStore(backend, { debounceMs: 500 });
      store.save({ document: { a: 1 }, savedAt: 0 });
      await store.clear();
      await vi.advanceTimersByTimeAsync(1000);
      expect(backend.raw.has(STORAGE_KEY)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
