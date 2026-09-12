/**
 * The key algebra behind §10.1.
 *
 * This is the whole of the confidentiality fix expressed as string handling,
 * which is exactly why it is worth pinning here rather than only through the
 * browser: an owner that cannot be read back out of a key is a slot the
 * purge cannot decide about, and a base that is a prefix of another base
 * would let one store's purge delete another store's data.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GUEST_OWNER,
  OWNER_SEPARATOR,
  currentOwner,
  namespacedKey,
  ownerOf,
  resetOwnerForTests,
  scopedKey,
  setCurrentOwner,
  subscribeToOwner,
  toOwnerKey,
} from "./owner";

afterEach(() => resetOwnerForTests());

describe("toOwnerKey", () => {
  it("uses the user id when there is one", () => {
    expect(toOwnerKey("clx0001")).toBe("clx0001");
  });

  it("falls back to guest for every shape of absence", () => {
    expect(toOwnerKey(null)).toBe(GUEST_OWNER);
    expect(toOwnerKey(undefined)).toBe(GUEST_OWNER);
    // A blank string is the dangerous one: it is falsy in the right places
    // and truthy in a template literal, so a naive `${userId}` would build
    // `resume-draft::` — a slot with no owner, shared by everybody.
    expect(toOwnerKey("   ")).toBe(GUEST_OWNER);
  });
});

describe("namespacedKey / ownerOf", () => {
  it("round-trips an owner through a key", () => {
    const key = namespacedKey("resume-draft", "clx0001");
    expect(key).toBe(`resume-draft${OWNER_SEPARATOR}clx0001`);
    expect(ownerOf("resume-draft", key)).toBe("clx0001");
  });

  it("round-trips through a base that already contains a colon", () => {
    const base = "ats-resume-builder:experience-level";
    expect(ownerOf(base, namespacedKey(base, "clx0002"))).toBe("clx0002");
  });

  it("reads the owner back out of a key with a per-record suffix", () => {
    const key = scopedKey("resume-thumbnail", "resume-9:2026-01-01T00:00:00Z", "clx0003");
    expect(ownerOf("resume-thumbnail", key)).toBe("clx0003");
  });

  it("does not claim a legacy unnamespaced key", () => {
    // The distinction the purge depends on. Treating `resume-draft` as
    // somebody's slot would delete a guest's only copy of their resume.
    expect(ownerOf("resume-draft", "resume-draft")).toBeNull();
    expect(ownerOf("resume-draft", `resume-draft${OWNER_SEPARATOR}`)).toBeNull();
  });

  it("does not claim another store's key", () => {
    expect(ownerOf("resume-draft", namespacedKey("cover-letters", "clx0001"))).toBeNull();
    // Nor a key belonging to something else entirely, which the shared
    // default `keyval-store` is full of.
    expect(ownerOf("resume-draft", "some-other-library-cache")).toBeNull();
  });
});

describe("the current owner", () => {
  it("starts as guest, because nobody has signed in on a fresh tab", () => {
    expect(currentOwner()).toBe(GUEST_OWNER);
  });

  it("notifies subscribers once per real change", () => {
    const onChange = vi.fn();
    subscribeToOwner(onChange);

    expect(setCurrentOwner("clx0001")).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);

    // `<StorageOwner>` writes during render, so a re-render with the same
    // identity must cost nothing and must not tear down the draft store.
    expect(setCurrentOwner("clx0001")).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);

    expect(setCurrentOwner(GUEST_OWNER)).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("treats a blank owner as guest rather than as a shared slot", () => {
    setCurrentOwner("");
    expect(currentOwner()).toBe(GUEST_OWNER);
  });

  it("is what an un-owned namespacedKey call resolves against", () => {
    setCurrentOwner("clx0009");
    expect(namespacedKey("resume-draft")).toBe(`resume-draft${OWNER_SEPARATOR}clx0009`);
  });
});
