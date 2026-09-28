/**
 * The browser-side session, held to the one rule that keeps it safe: an
 * answer that is not known publishes no owner.
 *
 * `<StorageOwner>` deletes every browser-local slot that belongs to neither
 * the owner it is given nor `guest`. So the failure these tests exist for is
 * not a wrong header — it is a signed-in person's own local work deleted
 * because a flaky request, or a response missing one field, was read as
 * "nobody is signed in".
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  SIGN_OUT_POLL_LIMIT,
  expectSignOut,
  getClientSession,
  ownerForSession,
  parseSessionResponse,
  refreshClientSession,
  resetClientSessionForTests,
  seedClientSession,
  subscribeToClientSession,
} from "./client-session";

const ADA = { id: "user-ada", email: "ada@example.com" };

function respond(body: unknown, init: { ok?: boolean } = {}): typeof fetch {
  return (async () =>
    ({ ok: init.ok ?? true, json: async () => body }) as unknown as Response) as typeof fetch;
}

afterEach(() => resetClientSessionForTests());

describe("parseSessionResponse", () => {
  it("reads nobody from each shape Auth.js uses for a missing session", () => {
    expect(parseSessionResponse(null)).toBeNull();
    expect(parseSessionResponse({})).toBeNull();
    expect(parseSessionResponse({ user: null })).toBeNull();
  });

  it("reads a user with an id and an email", () => {
    expect(parseSessionResponse({ user: { ...ADA, name: null }, expires: "…" })).toEqual(ADA);
  });

  it("refuses a user it cannot key storage by, rather than calling them nobody", () => {
    // Somebody is signed in and the id is missing. "Nobody" here would
    // publish the guest owner and purge that person's own slots.
    expect(parseSessionResponse({ user: { email: ADA.email } })).toBeUndefined();
    expect(parseSessionResponse({ user: { id: "", email: ADA.email } })).toBeUndefined();
    expect(parseSessionResponse({ user: { id: ADA.id } })).toBeUndefined();
  });

  it("refuses a body that is not a session at all", () => {
    expect(parseSessionResponse("<html>")).toBeUndefined();
    expect(parseSessionResponse([])).toBeUndefined();
    expect(parseSessionResponse(42)).toBeUndefined();
  });
});

describe("refreshClientSession", () => {
  it("starts unknown, and unknown has no owner", () => {
    expect(getClientSession()).toEqual({ status: "unknown" });
    expect(ownerForSession(getClientSession())).toBeNull();
  });

  it("publishes a signed-in user, and a guest when nobody is", async () => {
    await refreshClientSession(respond({ user: ADA }));
    expect(ownerForSession(getClientSession())).toBe(ADA.id);

    await refreshClientSession(respond({}));
    expect(ownerForSession(getClientSession())).toBe("guest");
  });

  it("publishes nothing when the request fails in any way", async () => {
    const failures: (typeof fetch)[] = [
      (async () => {
        throw new TypeError("offline");
      }) as typeof fetch,
      respond({ user: ADA }, { ok: false }),
      respond("not json"),
      respond({ user: { email: ADA.email } }),
    ];

    for (const fetcher of failures) {
      await refreshClientSession(fetcher);
      expect(getClientSession()).toEqual({ status: "unknown" });
    }
  });

  it("keeps a known answer through a later failure", async () => {
    // A signed-in reader whose second request drops must not be demoted —
    // to unknown or to guest. The last real answer stands.
    await refreshClientSession(respond({ user: ADA }));
    await refreshClientSession(respond(null, { ok: false }));
    expect(ownerForSession(getClientSession())).toBe(ADA.id);
  });

  it("notifies only when the answer changes", async () => {
    let calls = 0;
    subscribeToClientSession(() => void (calls += 1));

    seedClientSession(ADA);
    await refreshClientSession(respond({ user: ADA }));
    expect(calls).toBe(1);

    await refreshClientSession(respond(null));
    expect(calls).toBe(2);
  });
});

describe("expectSignOut", () => {
  it("keeps asking until the server says nobody, then stops", async () => {
    seedClientSession(ADA);

    // The first answer races the sign-out and still sees the session.
    const answers = [{ user: ADA }, { user: ADA }, null];
    let asked = 0;
    const fetcher = (async () => {
      const body = answers[Math.min(asked, answers.length - 1)];
      asked += 1;
      return { ok: true, json: async () => body } as unknown as Response;
    }) as typeof fetch;

    const queue: (() => void)[] = [];
    expectSignOut(fetcher, (run) => void queue.push(run));

    while (queue.length > 0) {
      queue.shift()!();
      // Let the refresh resolve and schedule its successor, if any.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(asked).toBe(3);
    expect(ownerForSession(getClientSession())).toBe("guest");
  });

  it("gives up after a bounded number of tries, leaving the truth on screen", async () => {
    seedClientSession(ADA);
    let asked = 0;
    const fetcher = (async () => {
      asked += 1;
      return { ok: true, json: async () => ({ user: ADA }) } as unknown as Response;
    }) as typeof fetch;

    const queue: (() => void)[] = [];
    expectSignOut(fetcher, (run) => void queue.push(run));
    while (queue.length > 0) {
      queue.shift()!();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(asked).toBe(SIGN_OUT_POLL_LIMIT);
    expect(ownerForSession(getClientSession())).toBe(ADA.id);
  });
});
