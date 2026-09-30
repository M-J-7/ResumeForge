/**
 * The sign-in hook the usage counter hangs off (`auth/index.ts`).
 *
 * Auth.js hands its `signIn` event the user, the account and the profile.
 * The hook it calls here is given none of them — the counter records that a
 * sign-in happened and has no use for whose — and a config built without a
 * hook has no event at all.
 */

import { describe, expect, it, vi } from "vitest";
import type { Adapter } from "next-auth/adapters";
import { buildAuthConfig } from "./config";
import { memoryTransport } from "./mail";

const base = { adapter: {} as Adapter, mailTransport: () => memoryTransport(), google: null };

describe("buildAuthConfig's onSignIn", () => {
  it("runs on every successful sign-in, and is passed nothing about who", async () => {
    const onSignIn = vi.fn();
    const config = buildAuthConfig({ ...base, onSignIn });

    await config.events?.signIn?.({
      user: { id: "u1", email: "ada@example.com" },
      account: null,
      profile: undefined,
      isNewUser: true,
    } as never);

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onSignIn.mock.calls[0]).toEqual([]);
  });

  it("adds no event when there is no hook", () => {
    expect(buildAuthConfig(base).events).toBeUndefined();
  });
});
