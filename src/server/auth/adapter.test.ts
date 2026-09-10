/**
 * What a linked OAuth account is allowed to keep (M2-T2).
 *
 * These assertions are the unit-level half of something the end-to-end
 * Google flow proves for real: `expires_in` reaching `account.create` is a
 * Prisma validation error, and it happens after the user has consented, so
 * the first sign-in of a live deployment is the thing that finds it.
 */

import { describe, expect, it, vi } from "vitest";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { accountIdentity, withIdentityOnlyAccounts } from "./adapter";

/** What Auth.js hands `linkAccount` after a Google sign-in. */
function googleAccount(): AdapterAccount {
  return {
    userId: "user-1",
    type: "oidc",
    provider: "google",
    providerAccountId: "1234567890",
    access_token: "ya29.a0-access-token",
    refresh_token: "1//refresh-token",
    id_token: "header.payload-with-a-picture-claim.signature",
    token_type: "bearer",
    scope: "openid email profile",
    expires_at: 1893456000,
    // Google sends this alongside `expires_at`, and §7's `Account` model has
    // no column for it.
    expires_in: 3599,
  } as AdapterAccount;
}

describe("accountIdentity", () => {
  it("keeps what identifies the account", () => {
    expect(accountIdentity(googleAccount())).toEqual({
      userId: "user-1",
      type: "oidc",
      provider: "google",
      providerAccountId: "1234567890",
    });
  });

  it("drops the field with no column, which is what breaks the write", () => {
    // `prisma.account.create` rejects unknown arguments, so this one key
    // fails the first Google sign-in and reports itself as `Configuration`.
    expect(accountIdentity(googleAccount())).not.toHaveProperty("expires_in");
  });

  it("keeps no provider credential and no avatar-bearing token", () => {
    const stored = accountIdentity(googleAccount());
    for (const field of ["access_token", "refresh_token", "id_token", "scope", "token_type"]) {
      expect(stored).not.toHaveProperty(field);
    }
    // The id_token carries Google's `picture` claim. The profile mapper
    // drops the avatar URL; storing the JWT it came in would put it back.
    expect(JSON.stringify(stored)).not.toContain("picture");
  });

  it("is an allowlist, so an unanticipated field is dropped too", () => {
    const stored = accountIdentity({
      ...googleAccount(),
      something_new_a_provider_added: "value",
    } as AdapterAccount);
    expect(stored).not.toHaveProperty("something_new_a_provider_added");
  });
});

describe("withIdentityOnlyAccounts", () => {
  it("stores only the identity fields", async () => {
    const linkAccount = vi.fn();
    const adapter = withIdentityOnlyAccounts({ linkAccount } as unknown as Adapter);

    await adapter.linkAccount?.(googleAccount());

    expect(linkAccount).toHaveBeenCalledWith({
      userId: "user-1",
      type: "oidc",
      provider: "google",
      providerAccountId: "1234567890",
    });
  });

  it("leaves every other adapter method as it was", () => {
    const base = {
      linkAccount: vi.fn(),
      getUserByAccount: vi.fn(),
      createSession: vi.fn(),
    } as unknown as Adapter;
    const adapter = withIdentityOnlyAccounts(base);

    expect(adapter.getUserByAccount).toBe(base.getUserByAccount);
    expect(adapter.createSession).toBe(base.createSession);
  });

  it("passes an adapter with no linkAccount through untouched", () => {
    const base = {} as Adapter;
    expect(withIdentityOnlyAccounts(base)).toBe(base);
  });
});
