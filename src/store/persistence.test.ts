import { afterEach, describe, expect, it, vi } from "vitest";
import { GUEST_OWNER, namespacedKey } from "./owner";
import {
  STORAGE_KEY,
  createDraftStore,
  createMemoryBackend,
  requestPersistentStorage,
  type KeyValueBackend,
} from "./persistence";

/**
 * The slot a draft store writes to with nobody signed in.
 *
 * Spelled out rather than reusing the store's default, so these tests fail
 * if the namespacing in `./owner.ts` ever stops being applied — which is the
 * bug §10.1 fixed, and the one thing here worth pinning.
 */
const GUEST_SLOT = namespacedKey(STORAGE_KEY, GUEST_OWNER);

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
    async keys() {
      return [...raw.keys()];
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

      const saved = JSON.parse(backend.raw.get(GUEST_SLOT) ?? "{}");
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
    const store = createDraftStore(createMemoryBackend({ [GUEST_SLOT]: "{not json" }));
    expect(await store.read()).toBeNull();
  });

  it("returns null when the stored value is the wrong shape", async () => {
    const store = createDraftStore(createMemoryBackend({ [GUEST_SLOT]: '{"unexpected":true}' }));
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
      expect(backend.raw.has(GUEST_SLOT)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createDraftStore — storage persistence request", () => {
  it("asks for persistent storage once, on the first write", async () => {
    const backend = trackingBackend();
    const requestPersistence = vi.fn(async () => true);
    const store = createDraftStore(backend, { debounceMs: 0, requestPersistence });

    // Nothing written yet: asking before there is anything worth keeping
    // wastes the one heuristic score we get.
    expect(requestPersistence).not.toHaveBeenCalled();

    store.save({ document: { a: 1 }, savedAt: 0 });
    await store.flush();
    store.save({ document: { a: 2 }, savedAt: 1 });
    await store.flush();

    expect(backend.writes).toBe(2);
    expect(requestPersistence).toHaveBeenCalledTimes(1);
  });

  it("saves even when the request rejects", async () => {
    const backend = trackingBackend();
    const requestPersistence = vi.fn(async () => {
      throw new Error("SecurityError");
    });
    const store = createDraftStore(backend, { debounceMs: 0, requestPersistence });

    store.save({ document: { a: 1 }, savedAt: 0 });
    await store.flush();

    // The whole point of not awaiting it: a storage API that throws must not
    // be able to fail a draft save.
    expect(backend.raw.has(GUEST_SLOT)).toBe(true);
  });
});

describe("requestPersistentStorage", () => {
  const originalNavigator = globalThis.navigator;

  function withStorage(storage: unknown): void {
    Object.defineProperty(globalThis, "navigator", {
      value: { storage },
      configurable: true,
      writable: true,
    });
  }

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("returns false when the API is absent", async () => {
    withStorage(undefined);
    expect(await requestPersistentStorage()).toBe(false);
  });

  it("does not re-ask when persistence is already granted", async () => {
    const persist = vi.fn(async () => true);
    withStorage({ persist, persisted: async () => true });

    expect(await requestPersistentStorage()).toBe(true);
    // Re-asking costs a round trip and re-prompts in browsers that prompt.
    expect(persist).not.toHaveBeenCalled();
  });

  it("asks when persistence has not been granted", async () => {
    const persist = vi.fn(async () => true);
    withStorage({ persist, persisted: async () => false });

    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("reports a denial as false rather than throwing", async () => {
    withStorage({ persist: async () => false, persisted: async () => false });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it("swallows a throwing storage API", async () => {
    withStorage({
      persist: async () => true,
      persisted: async () => {
        throw new Error("denied");
      },
    });
    expect(await requestPersistentStorage()).toBe(false);
  });
});
