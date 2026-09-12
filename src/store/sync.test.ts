/**
 * The push queue (M2-T4).
 *
 * Two properties carry the weight, and both are about lying to the user:
 *
 *   - A push that resolves *after* newer edits were queued must not report
 *     "saved". It saved something older, and someone reading the indicator
 *     is deciding whether it is safe to close the tab.
 *   - A failed push must not drop the document it was carrying. Local
 *     storage still has it, but the queue is what gets it to the server, and
 *     a queue that forgets on failure never retries.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRemoteSync, RETRY_DELAYS_MS, SYNC_DEBOUNCE_MS, type SyncTarget } from "./sync";
import { emptyResume, fresherResume, midCareerResume } from "@/test/fixtures/resumes";
import type { ResumeDocument } from "@/lib/resume/schema";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

interface Recorder extends SyncTarget {
  calls: { resumeId: string; document: ResumeDocument }[];
  /** Resolves the oldest unresolved push. */
  settle(index?: number): void;
  reject(index?: number): void;
}

/** A target whose pushes stay pending until the test resolves them. */
function recorder(): Recorder {
  const calls: Recorder["calls"] = [];
  const settlers: { resolve: () => void; reject: () => void }[] = [];

  return {
    calls,
    push(resumeId, document) {
      calls.push({ resumeId, document });
      return new Promise<void>((resolve, reject) => {
        settlers.push({ resolve, reject: () => reject(new Error("push failed")) });
      });
    },
    settle(index = settlers.length - 1) {
      settlers[index]?.resolve();
    },
    reject(index = settlers.length - 1) {
      settlers[index]?.reject();
    },
  };
}

/**
 * Lets a settled push's `.then`/`.catch` run, and any timer it schedules
 * get registered, before the clock is advanced again.
 *
 * Without this, advancing straight past a retry delay measures the wait from
 * before the retry was scheduled and the test reads as a missing retry.
 */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

/** A target that always succeeds immediately. */
function alwaysOk(): SyncTarget & { calls: ResumeDocument[] } {
  const calls: ResumeDocument[] = [];
  return {
    calls,
    async push(_id, document) {
      calls.push(document);
    },
  };
}

describe("queueing", () => {
  it("does nothing until a resume is attached", () => {
    const target = alwaysOk();
    const sync = createRemoteSync(target);

    sync.queue(midCareerResume);
    vi.advanceTimersByTime(SYNC_DEBOUNCE_MS * 5);

    expect(target.calls).toHaveLength(0);
    expect(sync.status()).toBe("idle");
  });

  it("coalesces a burst of edits into one push", async () => {
    const target = alwaysOk();
    const sync = createRemoteSync(target);
    sync.setResumeId("r1");

    sync.queue(emptyResume());
    sync.queue(fresherResume);
    sync.queue(midCareerResume);
    expect(sync.status()).toBe("pending");

    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);

    expect(target.calls).toEqual([midCareerResume]);
    expect(sync.status()).toBe("synced");
  });

  it("sends immediately on flush", async () => {
    const target = alwaysOk();
    const sync = createRemoteSync(target);
    sync.setResumeId("r1");
    sync.queue(midCareerResume);

    await sync.flush();

    expect(target.calls).toEqual([midCareerResume]);
    expect(sync.status()).toBe("synced");
  });

  it("stops pushing once the resume is detached", async () => {
    const target = alwaysOk();
    const sync = createRemoteSync(target);
    sync.setResumeId("r1");
    sync.queue(midCareerResume);

    sync.setResumeId(null);
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS * 5);

    expect(target.calls).toHaveLength(0);
    expect(sync.status()).toBe("idle");
  });
});

describe("out-of-order responses", () => {
  it("does not report saved when newer edits were queued mid-flight", async () => {
    const target = recorder();
    const sync = createRemoteSync(target);
    sync.setResumeId("r1");

    sync.queue(fresherResume);
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    expect(sync.status()).toBe("saving");

    // Typed while the first push was still in the air.
    sync.queue(midCareerResume);
    target.settle(0);
    await settle();

    // The response acknowledged the older document, so nothing on screen is
    // saved yet — a "synced" here is how someone closes a tab on lost work.
    expect(sync.status()).not.toBe("synced");

    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    expect(target.calls.map((call) => call.document)).toEqual([fresherResume, midCareerResume]);
  });
});

describe("failure", () => {
  it("keeps the document and retries with a backoff", async () => {
    const target = recorder();
    const sync = createRemoteSync(target);
    sync.setResumeId("r1");
    sync.queue(midCareerResume);

    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    target.reject(0);
    await settle();

    // Work is not lost and the indicator says where it is, not that
    // something is broken.
    expect(sync.status()).toBe("offline");

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    expect(target.calls).toHaveLength(2);
    expect(target.calls[1]?.document).toEqual(midCareerResume);
  });

  it("lengthens the wait between successive failures", async () => {
    const target = recorder();
    const sync = createRemoteSync(target);
    sync.setResumeId("r1");
    sync.queue(midCareerResume);

    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    target.reject(0);
    await settle();

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    expect(target.calls).toHaveLength(2);
    target.reject(1);
    await settle();

    // Still waiting: the second delay is longer than the first.
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    expect(target.calls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
    expect(target.calls).toHaveLength(3);
  });

  it("recovers on the retry that succeeds", async () => {
    const target = recorder();
    const sync = createRemoteSync(target);
    sync.setResumeId("r1");
    sync.queue(midCareerResume);

    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    target.reject(0);
    await settle();

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    target.settle(1);
    await settle();

    expect(sync.status()).toBe("synced");
  });
});

describe("offline", () => {
  it("does not attempt a push while the browser reports no connection", async () => {
    const target = alwaysOk();
    let online = false;
    const sync = createRemoteSync(target, { isOnline: () => online });
    sync.setResumeId("r1");
    sync.queue(midCareerResume);

    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS * 5);

    expect(target.calls).toHaveLength(0);
    expect(sync.status()).toBe("offline");

    // No timer is left running while offline — the radio is off, so polling
    // it costs battery and learns nothing. `retryNow` is what the `online`
    // event calls.
    online = true;
    sync.retryNow();
    await settle();

    expect(target.calls).toEqual([midCareerResume]);
    expect(sync.status()).toBe("synced");
  });

  it("has nothing to retry when everything is already saved", async () => {
    const target = alwaysOk();
    const sync = createRemoteSync(target);
    sync.setResumeId("r1");
    sync.queue(midCareerResume);
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);

    sync.retryNow();
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);

    expect(target.calls).toHaveLength(1);
  });
});

describe("status reporting", () => {
  it("announces each transition once", async () => {
    const seen: string[] = [];
    const target = alwaysOk();
    const sync = createRemoteSync(target, { onStatusChange: (status) => seen.push(status) });

    sync.setResumeId("r1");
    sync.queue(midCareerResume);
    sync.queue(fresherResume);
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);

    // "pending" appears once despite two queued edits: a status that
    // re-announces on every keystroke would make a live region unusable.
    expect(seen).toEqual(["synced", "pending", "saving", "synced"]);
  });
});
