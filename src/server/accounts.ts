/**
 * Account deletion (M2-T6).
 *
 * One statement, because the schema does the work: every relation from
 * `User` is `onDelete: Cascade`, so deleting the row takes the resumes,
 * their version history, score checks, parse checks, OAuth accounts, and
 * sessions with it.
 *
 * That is only true while `PRAGMA foreign_keys=ON` is applied on every
 * connection (`./db.ts`). SQLite has foreign keys **off** by default, and
 * with them off the cascade rules are decorative: the user row disappears,
 * every resume they wrote stays. `accounts.test.ts` asserts the row counts
 * rather than the return value, so that failure cannot pass quietly.
 *
 * There is no soft delete and no grace period. A product whose position is
 * "we do not hold your work hostage" cannot keep a copy of something someone
 * asked to be rid of, and a `deletedAt` column is a copy.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/server/db";

/**
 * Removes the account and everything belonging to it.
 *
 * Returns false if the account is already gone, so a double submit reads as
 * "nothing left to do" rather than as an error.
 */
export async function deleteAccount(userId: string, client?: PrismaClient): Promise<boolean> {
  const prisma = client ?? (await getPrisma());
  const { count } = await prisma.user.deleteMany({ where: { id: userId } });
  return count > 0;
}

/**
 * Confirmation gate for deletion.
 *
 * The user types their own email address. A typed confirmation rather than a
 * second button because the two are not equivalent: a button can be clicked
 * by muscle memory on a dialog that was not read, and this is the one action
 * in the product with nothing behind it.
 */
export function confirmsDeletion(typed: string, email: string): boolean {
  return typed.trim().toLowerCase() === email.trim().toLowerCase();
}
