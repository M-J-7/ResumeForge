/**
 * Saved cover letters (P29-J1).
 *
 * Two properties carry the weight here, and they pull in opposite directions:
 *
 *   - **Ownership.** Same discipline as `resumes.ts` and `job-targets.ts` —
 *     every write filters on `userId` in the statement, so a bystander
 *     changes nothing and is told nothing.
 *   - **Survival.** `resumeId` and `jobTargetId` are `SetNull` while every
 *     other relation in the schema cascades. Deleting a resume must leave its
 *     letters readable; deleting the *account* must not.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@/test/database";
import { createResume, deleteResume } from "./resumes";
import { createJobTarget } from "./job-targets";
import { deleteAccount } from "./accounts";
import {
  countCoverLettersByResume,
  createCoverLetter,
  deleteCoverLetter,
  duplicateCoverLetter,
  listCoverLetters,
  loadCoverLetter,
  renameCoverLetter,
  saveCoverLetter,
  suggestCoverLetterTitle,
} from "./cover-letters";
import { midCareerResume } from "@/test/fixtures/resumes";
import { DEFAULT_SETTINGS } from "@/lib/resume/schema";
import {
  CURRENT_COVER_LETTER_SCHEMA_VERSION,
  DEFAULT_SALUTATION,
  DEFAULT_SIGN_OFF,
  type CoverLetterDocument,
} from "@/lib/cover-letter/schema";
import type { PrismaClient } from "@/generated/prisma/client";

let database: TestDatabase;
let client: PrismaClient;

const OWNER = "user-owner";
const BYSTANDER = "user-bystander";

const document: CoverLetterDocument = {
  schemaVersion: CURRENT_COVER_LETTER_SCHEMA_VERSION,
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "",
    location: "London",
    links: [],
  },
  recipient: { name: "", title: "", company: "Acme", address: "" },
  dateISO: null,
  salutation: DEFAULT_SALUTATION,
  paragraphs: [
    { id: "opening", role: "opening", text: "I am writing about the role.", sources: [] },
  ],
  signOff: DEFAULT_SIGN_OFF,
  settings: { ...DEFAULT_SETTINGS },
};

const content = JSON.stringify(document);

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

describe("round trip", () => {
  it("saves and reloads a letter unchanged", async () => {
    const created = await createCoverLetter(OWNER, { title: "Acme — SRE", content }, client);
    const loaded = await loadCoverLetter(OWNER, created.id, client);

    expect(loaded?.record.title).toBe("Acme — SRE");
    expect(loaded?.document).toEqual(document);
  });

  it("migrates a stored letter on the way out (D10)", async () => {
    // An unversioned document, as an older build would have written it.
    const legacy = JSON.stringify({
      contact: document.contact,
      paragraphs: [{ text: "One paragraph." }],
    });
    const created = await createCoverLetter(OWNER, { title: "Legacy", content: legacy }, client);

    const loaded = await loadCoverLetter(OWNER, created.id, client);
    expect(loaded?.document.schemaVersion).toBe(CURRENT_COVER_LETTER_SCHEMA_VERSION);
    expect(loaded?.document.paragraphs[0]?.id).toBe("paragraph-0");
  });

  it("names the linked resume and posting on the summary", async () => {
    const resume = await createResume(OWNER, { document: midCareerResume }, client);
    const target = await createJobTarget(
      OWNER,
      { title: "Acme — SRE", company: "Acme", roleTitle: "SRE", description: "jd" },
      client,
    );

    await createCoverLetter(
      OWNER,
      { title: "Acme letter", content, resumeId: resume.id, jobTargetId: target.id },
      client,
    );

    const [summary] = await listCoverLetters(OWNER, client);
    expect(summary?.resumeTitle).toBe(resume.title);
    expect(summary?.company).toBe("Acme");
    expect(summary?.roleTitle).toBe("SRE");
  });

  it("refuses to link a resume the caller does not own", async () => {
    const theirs = await createResume(BYSTANDER, { document: midCareerResume }, client);
    const letter = await createCoverLetter(
      OWNER,
      { title: "Mine", content, resumeId: theirs.id },
      client,
    );

    // Silently dropped rather than rejected: the letter is still the user's
    // work, and a stranger's resume name must never render on their card.
    expect(letter.resumeId).toBeNull();
    expect(letter.resumeTitle).toBeNull();
  });
});

describe("ownership", () => {
  it("does not load, save, rename, duplicate or delete another user's letter", async () => {
    const letter = await createCoverLetter(OWNER, { title: "Mine", content }, client);

    expect(await loadCoverLetter(BYSTANDER, letter.id, client)).toBeNull();
    expect(await saveCoverLetter(BYSTANDER, letter.id, { title: "x", content }, client)).toBeNull();
    expect(await renameCoverLetter(BYSTANDER, letter.id, "Hijacked", client)).toBeNull();
    expect(await duplicateCoverLetter(BYSTANDER, letter.id, client)).toBeNull();
    expect(await deleteCoverLetter(BYSTANDER, letter.id, client)).toBe(false);

    const still = await loadCoverLetter(OWNER, letter.id, client);
    expect(still?.record.title).toBe("Mine");
  });

  it("lists only the caller's own letters", async () => {
    await createCoverLetter(OWNER, { title: "Mine", content }, client);
    await createCoverLetter(BYSTANDER, { title: "Theirs", content }, client);

    expect((await listCoverLetters(OWNER, client)).map((l) => l.title)).toEqual(["Mine"]);
  });
});

describe("what survives a delete", () => {
  it("keeps a letter readable after its resume is deleted", async () => {
    const resume = await createResume(OWNER, { document: midCareerResume }, client);
    const letter = await createCoverLetter(
      OWNER,
      { title: "Acme letter", content, resumeId: resume.id },
      client,
    );

    expect(await deleteResume(OWNER, resume.id, client)).toBe(true);

    // `SetNull`, deliberately different from every other relation here: the
    // letter's own text is a complete copy, and the resume link is
    // provenance rather than a dependency.
    const surviving = await loadCoverLetter(OWNER, letter.id, client);
    expect(surviving).not.toBeNull();
    expect(surviving?.record.resumeId).toBeNull();
    expect(surviving?.document.paragraphs[0]?.text).toBe("I am writing about the role.");
  });

  it("takes every letter with the account", async () => {
    await createCoverLetter(OWNER, { title: "Mine", content }, client);
    await deleteAccount(OWNER, client);
    expect(await client.coverLetter.count({ where: { userId: OWNER } })).toBe(0);
  });
});

describe("countCoverLettersByResume", () => {
  it("counts letters per resume, for the dashboard cross-link", async () => {
    const a = await createResume(OWNER, { document: midCareerResume }, client);
    const b = await createResume(OWNER, { document: midCareerResume }, client);

    await createCoverLetter(OWNER, { title: "1", content, resumeId: a.id }, client);
    await createCoverLetter(OWNER, { title: "2", content, resumeId: a.id }, client);
    await createCoverLetter(OWNER, { title: "3", content, resumeId: b.id }, client);
    // Unlinked letters belong to no resume and must not be counted anywhere.
    await createCoverLetter(OWNER, { title: "4", content }, client);

    const counts = await countCoverLettersByResume(OWNER, client);
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBe(1);
    expect(counts.size).toBe(2);
  });
});

describe("duplicateCoverLetter", () => {
  it("copies the content and the links, under a new name and id", async () => {
    const target = await createJobTarget(OWNER, { title: "Acme", description: "jd" }, client);
    const original = await createCoverLetter(
      OWNER,
      { title: "Acme letter", content, jobTargetId: target.id },
      client,
    );

    const copy = await duplicateCoverLetter(OWNER, original.id, client);
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.title).toBe("Acme letter (copy)");
    expect(copy?.jobTargetId).toBe(target.id);

    const loaded = await loadCoverLetter(OWNER, copy!.id, client);
    expect(loaded?.document).toEqual(document);
  });
});

describe("suggestCoverLetterTitle", () => {
  it("pairs company and role, and never returns an empty string", () => {
    expect(suggestCoverLetterTitle("Acme", "SRE")).toBe("Acme — SRE");
    expect(suggestCoverLetterTitle("Acme", " ")).toBe("Acme");
    expect(suggestCoverLetterTitle("", "")).toBe("Untitled letter");
  });
});
