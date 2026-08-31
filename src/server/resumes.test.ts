/**
 * Server-side resume storage (M2-T3, M2-T4).
 *
 * The tests that matter most are the ownership ones. Every function takes
 * `userId` as an argument and puts it in the `where` clause, so the failure
 * mode being guarded against is not "the check returned false" but "someone
 * removed the check and nothing noticed". Each mutation is therefore
 * attempted against a second user's row and asserted to change nothing.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@/test/database";
import {
  claimDraft,
  createResume,
  deleteResume,
  deriveResumeTitle,
  duplicateResume,
  listResumes,
  loadResume,
  normalizeTitle,
  renameResume,
  saveResume,
  DEFAULT_RESUME_TITLE,
  MAX_TITLE_LENGTH,
} from "./resumes";
import { documentWordCount } from "@/lib/lint/rules";
import { emptyResume, fresherResume, midCareerResume } from "@/test/fixtures/resumes";
import type { PrismaClient } from "@/generated/prisma/client";

let database: TestDatabase;
let client: PrismaClient;

const OWNER = "user-owner";
const OTHER = "user-other";

beforeEach(async () => {
  database = await createTestDatabase();
  client = database.client;
  await client.user.createMany({
    data: [
      { id: OWNER, email: "owner@example.com" },
      { id: OTHER, email: "other@example.com" },
    ],
  });
});

afterEach(async () => {
  await database.destroy();
});

describe("deriveResumeTitle", () => {
  it("names a resume after the most recent role", () => {
    // Someone with several resumes almost always has them tailored per role;
    // "Untitled resume (2)" tells them nothing about which is which.
    expect(deriveResumeTitle(midCareerResume)).toBe(
      midCareerResume.sections.flatMap((s) => (s.type === "experience" ? s.entries : []))[0]?.title,
    );
  });

  it("falls back to the person's own name", () => {
    expect(deriveResumeTitle(fresherResume)).toContain(fresherResume.contact.fullName);
  });

  it("has a placeholder for a genuinely empty document", () => {
    expect(deriveResumeTitle(emptyResume())).toBe(DEFAULT_RESUME_TITLE);
  });
});

describe("normalizeTitle", () => {
  it("trims, caps, and refuses to store nothing", () => {
    expect(normalizeTitle("  Backend Engineer  ")).toBe("Backend Engineer");
    expect(normalizeTitle("   ")).toBe(DEFAULT_RESUME_TITLE);
    expect(normalizeTitle("x".repeat(500))).toHaveLength(MAX_TITLE_LENGTH);
  });
});

describe("createResume", () => {
  it("denormalizes what the dashboard sorts and shows", async () => {
    // Json columns are TEXT on SQLite: not queryable, not sortable. Anything
    // the list needs without opening the document has to be a real column.
    const summary = await createResume(OWNER, { document: midCareerResume }, client);

    expect(summary.wordCount).toBe(documentWordCount(midCareerResume));
    expect(summary.pageSize).toBe(midCareerResume.settings.pageSize);
    expect(summary.schemaVersion).toBe(midCareerResume.schemaVersion);
    expect(summary.pageCount).toBeNull();
  });

  it("leaves pageCount null until something has actually rendered (D3)", async () => {
    const summary = await createResume(OWNER, { document: midCareerResume }, client);
    expect(summary.pageCount).toBeNull();

    const updated = await saveResume(
      OWNER,
      summary.id,
      { document: midCareerResume, pageCount: 1 },
      client,
    );
    expect(updated?.pageCount).toBe(1);
  });

  it("accepts an explicit title over the derived one", async () => {
    const summary = await createResume(
      OWNER,
      { document: midCareerResume, title: "For Acme" },
      client,
    );
    expect(summary.title).toBe("For Acme");
  });
});

describe("listResumes", () => {
  it("returns the account's own resumes, newest first", async () => {
    const first = await createResume(OWNER, { document: fresherResume, title: "A" }, client);
    const second = await createResume(OWNER, { document: midCareerResume, title: "B" }, client);
    await createResume(OTHER, { document: midCareerResume, title: "Theirs" }, client);

    // `updatedAt` defaults to the same instant for rows created in the same
    // millisecond, so make the ordering unambiguous before asserting on it.
    await client.resume.update({
      where: { id: second.id },
      data: { updatedAt: new Date(Date.now() + 60_000) },
    });

    const listed = await listResumes(OWNER, client);
    expect(listed.map((r) => r.title)).toEqual(["B", "A"]);
    expect(listed.map((r) => r.id)).not.toContain("Theirs");
    expect(listed.some((r) => r.id === first.id)).toBe(true);
  });

  it("is empty for an account with nothing saved", async () => {
    expect(await listResumes(OWNER, client)).toEqual([]);
  });
});

describe("loadResume", () => {
  it("round-trips the document through storage", async () => {
    const summary = await createResume(OWNER, { document: midCareerResume }, client);
    const loaded = await loadResume(OWNER, summary.id, client);
    expect(loaded?.document).toEqual(midCareerResume);
  });

  it("reports someone else's resume as absent, not as forbidden", async () => {
    // The caller cannot tell "does not exist" from "not yours", which is the
    // point: an id probe learns nothing either way.
    const summary = await createResume(OWNER, { document: midCareerResume }, client);
    expect(await loadResume(OTHER, summary.id, client)).toBeNull();
  });

  it("migrates on read rather than trusting what was written (D10)", async () => {
    const summary = await createResume(OWNER, { document: midCareerResume }, client);
    // A document stored by a build that predates the version field.
    const legacy = { ...midCareerResume } as Record<string, unknown>;
    delete legacy.schemaVersion;
    await client.resume.update({
      where: { id: summary.id },
      data: { content: JSON.stringify(legacy) },
    });

    const loaded = await loadResume(OWNER, summary.id, client);
    expect(loaded?.document.schemaVersion).toBe(midCareerResume.schemaVersion);
  });

  it("distinguishes an unreadable document from a missing one", async () => {
    // "Your resume is gone" and "this build cannot read your resume" call
    // for very different responses, so they must not both be null.
    const summary = await createResume(OWNER, { document: midCareerResume }, client);
    await client.resume.update({
      where: { id: summary.id },
      data: { content: JSON.stringify({ schemaVersion: 999 }) },
    });
    await expect(loadResume(OWNER, summary.id, client)).rejects.toThrow(/could not be migrated/);
  });
});

describe("ownership", () => {
  it("will not let another account save over a resume", async () => {
    const summary = await createResume(OWNER, { document: midCareerResume }, client);

    expect(await saveResume(OTHER, summary.id, { document: fresherResume }, client)).toBeNull();

    const loaded = await loadResume(OWNER, summary.id, client);
    expect(loaded?.document).toEqual(midCareerResume);
  });

  it("will not let another account rename, duplicate, or delete one", async () => {
    const summary = await createResume(OWNER, { document: midCareerResume }, client);

    expect(await renameResume(OTHER, summary.id, "Mine now", client)).toBeNull();
    expect(await duplicateResume(OTHER, summary.id, client)).toBeNull();
    expect(await deleteResume(OTHER, summary.id, client)).toBe(false);

    expect(await client.resume.count({ where: { userId: OWNER } })).toBe(1);
    expect(await client.resume.count({ where: { userId: OTHER } })).toBe(0);
  });
});

describe("saveResume", () => {
  it("rewrites the derived columns alongside the content", async () => {
    const summary = await createResume(OWNER, { document: fresherResume }, client);
    const updated = await saveResume(OWNER, summary.id, { document: midCareerResume }, client);

    expect(updated?.wordCount).toBe(documentWordCount(midCareerResume));
    expect((await loadResume(OWNER, summary.id, client))?.document).toEqual(midCareerResume);
  });

  it("leaves pageCount alone when the caller has not measured one", async () => {
    const summary = await createResume(OWNER, { document: midCareerResume }, client);
    await saveResume(OWNER, summary.id, { document: midCareerResume, pageCount: 2 }, client);
    const after = await saveResume(OWNER, summary.id, { document: fresherResume }, client);
    expect(after?.pageCount).toBe(2);
  });
});

describe("duplicateResume", () => {
  it("copies the content into a new row", async () => {
    const original = await createResume(
      OWNER,
      { document: midCareerResume, title: "Original" },
      client,
    );
    const copy = await duplicateResume(OWNER, original.id, client);

    expect(copy?.id).not.toBe(original.id);
    expect(copy?.title).toBe("Original (copy)");
    expect((await loadResume(OWNER, copy!.id, client))?.document).toEqual(midCareerResume);
    expect(await listResumes(OWNER, client)).toHaveLength(2);
  });
});

describe("deleteResume", () => {
  it("is a hard delete that takes the resume's history with it (M2-T6)", async () => {
    const summary = await createResume(OWNER, { document: midCareerResume }, client);
    await client.resumeVersion.create({ data: { resumeId: summary.id, content: "{}" } });
    await client.parseCheck.create({
      data: { resumeId: summary.id, format: "PDF", fieldRecovery: "{}", recoveryScore: 100 },
    });

    expect(await deleteResume(OWNER, summary.id, client)).toBe(true);
    expect(await client.resume.count()).toBe(0);
    expect(await client.resumeVersion.count()).toBe(0);
    expect(await client.parseCheck.count()).toBe(0);
  });

  it("reports a second delete as a miss rather than throwing", async () => {
    const summary = await createResume(OWNER, { document: midCareerResume }, client);
    expect(await deleteResume(OWNER, summary.id, client)).toBe(true);
    expect(await deleteResume(OWNER, summary.id, client)).toBe(false);
  });
});

describe("claimDraft (M2-T3)", () => {
  it("moves a guest draft onto the account", async () => {
    const outcome = await claimDraft(OWNER, midCareerResume, client);

    expect(outcome.status).toBe("claimed");
    if (outcome.status !== "claimed") return;
    expect(outcome.hadExisting).toBe(false);
    expect((await loadResume(OWNER, outcome.resume.id, client))?.document).toEqual(midCareerResume);
  });

  it("creates a new resume rather than overwriting an existing one", async () => {
    // M2-T3 names this case explicitly. The asymmetry decides it: a spurious
    // extra resume costs one click to delete, an overwrite destroys work
    // that has no other copy.
    const existing = await createResume(OWNER, { document: fresherResume, title: "Kept" }, client);
    const outcome = await claimDraft(OWNER, midCareerResume, client);

    expect(outcome.status).toBe("claimed");
    if (outcome.status !== "claimed") return;
    expect(outcome.hadExisting).toBe(true);
    expect(outcome.resume.id).not.toBe(existing.id);
    expect((await loadResume(OWNER, existing.id, client))?.document).toEqual(fresherResume);
    expect(await listResumes(OWNER, client)).toHaveLength(2);
  });

  it("migrates the draft on the way in", async () => {
    const legacy = { ...midCareerResume } as Record<string, unknown>;
    delete legacy.schemaVersion;

    const outcome = await claimDraft(OWNER, legacy, client);
    expect(outcome.status).toBe("claimed");
    if (outcome.status !== "claimed") return;
    expect(outcome.resume.schemaVersion).toBe(midCareerResume.schemaVersion);
  });

  it("stores nothing when the draft cannot be read", async () => {
    // The caller only clears local storage on success, so a rejected draft
    // has to leave the account untouched for it to still be recoverable.
    const outcome = await claimDraft(OWNER, { not: "a resume" }, client);
    expect(outcome.status).toBe("invalid");
    expect(await listResumes(OWNER, client)).toEqual([]);
  });
});
