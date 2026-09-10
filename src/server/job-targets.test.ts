/**
 * Saved job descriptions (P27-H1).
 *
 * The assertions that matter are the ownership ones. Every function here
 * takes `userId` first and puts it in the `where`; the way that regresses is
 * someone "simplifying" `updateMany({ where: { id, userId } })` into
 * `update({ where: { id } })`, which reads identically and lets any signed-in
 * user rewrite anyone's row. So each write is exercised twice — once by the
 * owner, once by a bystander — and the bystander must change nothing.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@/test/database";
import {
  createJobTarget,
  deleteJobTarget,
  listJobTargets,
  loadJobTarget,
  renameJobTarget,
  saveJobTarget,
  suggestJobTargetTitle,
  MAX_JOB_DESCRIPTION_LENGTH,
} from "./job-targets";
import type { PrismaClient } from "@/generated/prisma/client";

let database: TestDatabase;
let client: PrismaClient;

const OWNER = "user-owner";
const BYSTANDER = "user-bystander";

const POSTING = "Requirements:\n- 5 years of Kubernetes\n- Terraform";

beforeEach(async () => {
  database = await createTestDatabase();
  client = database.client;
  await client.user.createMany({
    data: [
      { id: OWNER, email: "owner@example.com" },
      { id: BYSTANDER, email: "bystander@example.com" },
    ],
  });
});

afterEach(async () => {
  await database.destroy();
});

describe("createJobTarget", () => {
  it("stores the posting exactly as pasted", async () => {
    const target = await createJobTarget(
      OWNER,
      { title: "Acme — SRE", company: "Acme", roleTitle: "SRE", description: POSTING },
      client,
    );
    expect(target.description).toBe(POSTING);
    expect(target.company).toBe("Acme");
  });

  it("treats a blank company or role as absent rather than empty", async () => {
    const target = await createJobTarget(
      OWNER,
      { title: "Untitled", company: "   ", roleTitle: "", description: POSTING },
      client,
    );
    expect(target.company).toBeNull();
    expect(target.roleTitle).toBeNull();
  });

  it("falls back to a placeholder rather than storing an empty title", async () => {
    const target = await createJobTarget(OWNER, { title: "   ", description: POSTING }, client);
    expect(target.title).toBe("Untitled job");
  });

  it("caps a description rather than rejecting it", async () => {
    const target = await createJobTarget(
      OWNER,
      { title: "Huge", description: "x".repeat(MAX_JOB_DESCRIPTION_LENGTH + 500) },
      client,
    );
    expect(target.description).toHaveLength(MAX_JOB_DESCRIPTION_LENGTH);
  });
});

describe("ownership", () => {
  it("does not load another user's posting, and does not say why", async () => {
    const target = await createJobTarget(OWNER, { title: "Acme", description: POSTING }, client);
    expect(await loadJobTarget(BYSTANDER, target.id, client)).toBeNull();
    // Indistinguishable from an id that never existed — which is the point.
    expect(await loadJobTarget(BYSTANDER, "no-such-id", client)).toBeNull();
  });

  it("does not let another user overwrite a posting", async () => {
    const target = await createJobTarget(OWNER, { title: "Acme", description: POSTING }, client);

    const attempt = await saveJobTarget(
      BYSTANDER,
      target.id,
      { title: "Hijacked", description: "gone" },
      client,
    );
    expect(attempt).toBeNull();

    const still = await loadJobTarget(OWNER, target.id, client);
    expect(still?.description).toBe(POSTING);
    expect(still?.title).toBe("Acme");
  });

  it("does not let another user rename or delete a posting", async () => {
    const target = await createJobTarget(OWNER, { title: "Acme", description: POSTING }, client);

    expect(await renameJobTarget(BYSTANDER, target.id, "Hijacked", client)).toBeNull();
    expect(await deleteJobTarget(BYSTANDER, target.id, client)).toBe(false);

    const still = await loadJobTarget(OWNER, target.id, client);
    expect(still?.title).toBe("Acme");
  });

  it("lists only the caller's own postings", async () => {
    await createJobTarget(OWNER, { title: "Mine", description: POSTING }, client);
    await createJobTarget(BYSTANDER, { title: "Theirs", description: POSTING }, client);

    const mine = await listJobTargets(OWNER, client);
    expect(mine.map((t) => t.title)).toEqual(["Mine"]);
  });
});

describe("deleteJobTarget", () => {
  it("leaves cover letters written against it intact", async () => {
    const target = await createJobTarget(OWNER, { title: "Acme", description: POSTING }, client);
    const letter = await client.coverLetter.create({
      data: { userId: OWNER, jobTargetId: target.id, title: "Acme letter", content: "{}" },
    });

    expect(await deleteJobTarget(OWNER, target.id, client)).toBe(true);

    // `SetNull`, not `Cascade`. The letter holds its own complete text, and
    // deleting the posting is not a request to destroy the letter.
    const surviving = await client.coverLetter.findUnique({ where: { id: letter.id } });
    expect(surviving).not.toBeNull();
    expect(surviving?.jobTargetId).toBeNull();
  });
});

describe("suggestJobTargetTitle", () => {
  it("pairs company and role when both are known", () => {
    expect(suggestJobTargetTitle("Acme", "Platform Engineer")).toBe("Acme — Platform Engineer");
  });

  it("uses whichever half exists", () => {
    expect(suggestJobTargetTitle("Acme", "  ")).toBe("Acme");
    expect(suggestJobTargetTitle("", "Platform Engineer")).toBe("Platform Engineer");
  });

  it("never returns an empty string", () => {
    expect(suggestJobTargetTitle("  ", "")).toBe("Untitled job");
  });
});
