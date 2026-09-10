/**
 * The other half of §10.1: nobody else's work is left on the device.
 *
 * These assert the actual reported failure — build as A, sign in as B, and B
 * finds A's resume — in the only layer where it was ever true, which is the
 * key-value store. There is no server in any of it, because the server was
 * never the leak.
 */

import { afterEach, describe, expect, it } from "vitest";
import { COVER_LETTERS_KEY } from "./cover-letters";
import { JOB_TARGETS_KEY } from "./job-targets";
import { GUEST_OWNER, namespacedKey, resetOwnerForTests } from "./owner";
import { createMemoryBackend, STORAGE_KEY } from "./persistence";
import { NAMESPACED_BASES, foreignSlots, purgeForeignSlots } from "./purge";

afterEach(() => resetOwnerForTests());

const ALICE = "clx-alice";
const BOB = "clx-bob";

describe("foreignSlots", () => {
  it("names every slot belonging to somebody else", () => {
    const held = [
      namespacedKey(STORAGE_KEY, ALICE),
      namespacedKey(COVER_LETTERS_KEY, ALICE),
      namespacedKey(JOB_TARGETS_KEY, ALICE),
    ];
    expect(foreignSlots(held, BOB)).toEqual(held);
  });

  it("keeps the current owner's own slots", () => {
    const mine = namespacedKey(STORAGE_KEY, BOB);
    expect(foreignSlots([mine], BOB)).toEqual([]);
  });

  it("keeps the guest slot, which is what the claim flow adopts", () => {
    // Wiping this on sign-in would destroy the work "Save it to my account"
    // exists to rescue. It is the one deliberate exception in the file.
    const guest = namespacedKey(STORAGE_KEY, GUEST_OWNER);
    expect(foreignSlots([guest], BOB)).toEqual([]);
  });

  it("leaves keys this app does not own alone", () => {
    // The default `keyval-store` is shared. Deleting by exclusion would
    // eventually delete somebody else's library's data.
    const held = ["workbox-precache", "resume-draft-lookalike", "resume-draft"];
    expect(foreignSlots(held, BOB)).toEqual([]);
  });

  it("covers every store that holds resume content", () => {
    // A regression guard with teeth: adding a client store and forgetting to
    // list it here is exactly how this bug comes back.
    expect(NAMESPACED_BASES).toEqual([STORAGE_KEY, COVER_LETTERS_KEY, JOB_TARGETS_KEY]);
  });
});

describe("purgeForeignSlots", () => {
  it("removes the previous person's resume and keeps the new one's", async () => {
    const backend = createMemoryBackend({
      [namespacedKey(STORAGE_KEY, ALICE)]: '{"document":{},"savedAt":1}',
      [namespacedKey(COVER_LETTERS_KEY, ALICE)]: "[]",
      [namespacedKey(STORAGE_KEY, BOB)]: '{"document":{},"savedAt":2}',
      [namespacedKey(STORAGE_KEY, GUEST_OWNER)]: '{"document":{},"savedAt":3}',
    });

    const removed = await purgeForeignSlots(BOB, backend);

    expect(removed.sort()).toEqual(
      [namespacedKey(COVER_LETTERS_KEY, ALICE), namespacedKey(STORAGE_KEY, ALICE)].sort(),
    );
    expect(await backend.get(namespacedKey(STORAGE_KEY, ALICE))).toBeUndefined();
    expect(await backend.get(namespacedKey(STORAGE_KEY, BOB))).toBeTruthy();
    expect(await backend.get(namespacedKey(STORAGE_KEY, GUEST_OWNER))).toBeTruthy();
  });

  it("is idempotent, which is why it needs no recorded last owner", async () => {
    const backend = createMemoryBackend({
      [namespacedKey(STORAGE_KEY, ALICE)]: "{}",
    });
    expect(await purgeForeignSlots(BOB, backend)).toHaveLength(1);
    expect(await purgeForeignSlots(BOB, backend)).toEqual([]);
  });

  it("adopts a pre-namespacing draft into the guest slot", async () => {
    // D6 promises the work stays in your browser. That promise has to hold
    // across the release that introduced the namespace.
    const backend = createMemoryBackend({ [STORAGE_KEY]: '{"document":{},"savedAt":1}' });

    await purgeForeignSlots(GUEST_OWNER, backend);

    expect(await backend.get(namespacedKey(STORAGE_KEY, GUEST_OWNER))).toBe(
      '{"document":{},"savedAt":1}',
    );
    // And the unowned key is gone, so no later purge has to reason about it.
    expect(await backend.get(STORAGE_KEY)).toBeUndefined();
  });

  it("does not let a legacy key overwrite a guest slot that already exists", async () => {
    const backend = createMemoryBackend({
      [STORAGE_KEY]: '{"document":{},"savedAt":1}',
      [namespacedKey(STORAGE_KEY, GUEST_OWNER)]: '{"document":{},"savedAt":99}',
    });

    await purgeForeignSlots(GUEST_OWNER, backend);

    expect(await backend.get(namespacedKey(STORAGE_KEY, GUEST_OWNER))).toBe(
      '{"document":{},"savedAt":99}',
    );
    expect(await backend.get(STORAGE_KEY)).toBeUndefined();
  });

  it("returns empty rather than throwing when storage is unavailable", async () => {
    // Private browsing, a quota error, IndexedDB switched off. None of those
    // may fail the page the purge was called from.
    const broken = {
      ...createMemoryBackend(),
      keys: () => Promise.reject(new Error("no storage")),
    };
    await expect(purgeForeignSlots(BOB, broken)).resolves.toEqual([]);
  });
});
