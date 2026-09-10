/**
 * Account deletion (M2-T6).
 *
 * M2-T6's acceptance is "delete removes every row across all tables (test
 * asserts this)", so the assertion is on the table counts rather than on the
 * function's return value. The way this breaks in practice is not a wrong
 * boolean — it is `PRAGMA foreign_keys` being off on some connection, which
 * leaves every resume behind while the call still reports success.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@/test/database";
import { confirmsDeletion, deleteAccount } from "./accounts";
import { createResume } from "./resumes";
import { createJobTarget } from "./job-targets";
import { midCareerResume } from "@/test/fixtures/resumes";
import type { PrismaClient } from "@/generated/prisma/client";

let database: TestDatabase;
let client: PrismaClient;

const USER = "user-leaving";
const BYSTANDER = "user-staying";

beforeEach(async () => {
  database = await createTestDatabase();
  client = database.client;

  await client.user.createMany({
    data: [
      { id: USER, email: "leaving@example.com", name: "Leaving" },
      { id: BYSTANDER, email: "staying@example.com" },
    ],
  });

  const resume = await createResume(USER, { document: midCareerResume }, client);
  await client.resumeVersion.create({ data: { resumeId: resume.id, content: "{}" } });
  await client.scoreCheck.create({
    data: { resumeId: resume.id, jobDescription: "jd", overallScore: 70, breakdown: "{}" },
  });
  await client.parseCheck.create({
    data: { resumeId: resume.id, format: "PDF", fieldRecovery: "{}", recoveryScore: 100 },
  });
  await client.session.create({
    data: { sessionToken: "session-token", userId: USER, expires: new Date(Date.now() + 60_000) },
  });
  await client.account.create({
    data: {
      userId: USER,
      type: "oauth",
      provider: "google",
      providerAccountId: "google-123",
    },
  });

  // P27/P29's two tables. Added in the same commit as their migration,
  // because a table that appears without an assertion here is a table that
  // survives the one operation this product promises is complete.
  const jobTarget = await createJobTarget(
    USER,
    { title: "Acme — Platform Engineer", description: "Requirements: Kubernetes." },
    client,
  );
  await client.coverLetter.create({
    data: { userId: USER, jobTargetId: jobTarget.id, title: "Acme letter", content: "{}" },
  });

  await createResume(BYSTANDER, { document: midCareerResume }, client);
});

afterEach(async () => {
  await database.destroy();
});

describe("deleteAccount", () => {
  it("removes every row belonging to the account, across all tables", async () => {
    expect(await deleteAccount(USER, client)).toBe(true);

    expect(await client.user.count({ where: { id: USER } })).toBe(0);
    expect(await client.resume.count({ where: { userId: USER } })).toBe(0);
    expect(await client.session.count({ where: { userId: USER } })).toBe(0);
    expect(await client.account.count({ where: { userId: USER } })).toBe(0);
    // These hang off Resume rather than User, so they only go if the cascade
    // ran the whole way down.
    expect(await client.resumeVersion.count()).toBe(0);
    expect(await client.scoreCheck.count()).toBe(0);
    expect(await client.parseCheck.count()).toBe(0);
    expect(await client.jobTarget.count({ where: { userId: USER } })).toBe(0);
    // `CoverLetter.resumeId` and `.jobTargetId` are `SetNull`, deliberately —
    // so a letter would survive its resume being deleted. Only the `userId`
    // cascade takes it, and this is the assertion that proves it still does.
    expect(await client.coverLetter.count({ where: { userId: USER } })).toBe(0);
  });

  it("leaves other accounts untouched", async () => {
    await deleteAccount(USER, client);
    expect(await client.user.count({ where: { id: BYSTANDER } })).toBe(1);
    expect(await client.resume.count({ where: { userId: BYSTANDER } })).toBe(1);
  });

  it("reports an already-deleted account as nothing to do", async () => {
    expect(await deleteAccount(USER, client)).toBe(true);
    expect(await deleteAccount(USER, client)).toBe(false);
  });
});

describe("confirmsDeletion", () => {
  it("accepts the account's own address, however it was typed", () => {
    expect(confirmsDeletion("  Leaving@Example.com ", "leaving@example.com")).toBe(true);
  });

  it("rejects anything else, including an empty box", () => {
    expect(confirmsDeletion("", "leaving@example.com")).toBe(false);
    expect(confirmsDeletion("delete", "leaving@example.com")).toBe(false);
    expect(confirmsDeletion("staying@example.com", "leaving@example.com")).toBe(false);
  });
});
