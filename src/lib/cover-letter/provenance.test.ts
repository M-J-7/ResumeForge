/**
 * Provenance labels (§10.2, 2.1).
 *
 * The composer's guarantee is that every sentence came from the user's own
 * resume. These pin the part of that guarantee the user can actually see: the
 * ids stored on a paragraph resolve to entries with names, and an id that no
 * longer resolves says nothing rather than saying something wrong.
 */

import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, type ResumeDocument } from "@/lib/resume/schema";
import { describeEntry, describeSources, findEntry } from "./provenance";

const resume: ResumeDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "",
    location: "",
    links: [],
  },
  sections: [
    {
      id: "sec-exp",
      type: "experience",
      visible: true,
      entries: [
        {
          id: "exp-1",
          title: "Platform Engineer",
          organization: "Meridian Health",
          location: "London",
          dates: { start: { year: 2021, month: 4 }, end: null, current: true },
          bullets: ["Cut deploy time."],
        },
        {
          id: "exp-2",
          title: "Engineer",
          organization: "",
          location: "",
          dates: { start: { year: 2019, month: null }, end: null, current: false },
          bullets: [],
        },
      ],
    },
    {
      id: "sec-proj",
      type: "projects",
      visible: true,
      entries: [
        { id: "proj-1", name: "Wayfinder", role: "Author", url: "", dates: null, bullets: [] },
      ],
    },
    {
      id: "sec-custom",
      type: "custom",
      visible: true,
      label: "Volunteering",
      entries: [
        {
          id: "cus-1",
          title: "Trustee",
          subtitle: "Camden Foodbank",
          dates: null,
          bullets: [],
        },
      ],
    },
  ],
  settings: { ...DEFAULT_SETTINGS },
};

describe("findEntry", () => {
  it("finds an experience entry and keeps its two halves apart", () => {
    expect(findEntry(resume, "exp-1")).toEqual({
      id: "exp-1",
      kind: "experience",
      name: "Platform Engineer",
      organization: "Meridian Health",
    });
  });

  it("finds a project by its name", () => {
    expect(findEntry(resume, "proj-1")?.name).toBe("Wayfinder");
  });

  it("finds a custom entry, which is the one the old traversal missed", () => {
    expect(findEntry(resume, "cus-1")).toMatchObject({
      kind: "custom",
      name: "Trustee",
      organization: "Camden Foodbank",
    });
  });

  it("returns null for an id that is not in the resume any more", () => {
    // Not an edge case: the resume is editable after the letter was written,
    // and a letter can outlive the entry it quoted.
    expect(findEntry(resume, "exp-deleted")).toBeNull();
    expect(findEntry(resume, "")).toBeNull();
  });
});

describe("describeEntry", () => {
  it("reads as a phrase when both halves are there", () => {
    expect(describeEntry(findEntry(resume, "exp-1")!)).toBe("Platform Engineer at Meridian Health");
  });

  it("drops the preposition rather than emitting an orphaned one", () => {
    expect(describeEntry(findEntry(resume, "exp-2")!)).toBe("Engineer");
  });
});

describe("describeSources", () => {
  it("describes each id in the order the paragraph recorded them", () => {
    expect(describeSources(resume, ["cus-1", "exp-1"])).toEqual([
      "Trustee at Camden Foodbank",
      "Platform Engineer at Meridian Health",
    ]);
  });

  it("collapses two bullets from one job into one source", () => {
    expect(describeSources(resume, ["exp-1", "exp-1"])).toEqual([
      "Platform Engineer at Meridian Health",
    ]);
  });

  it("drops what it cannot name rather than inventing a placeholder", () => {
    // The chip degrades to a count. Naming a source wrongly, in the one
    // component whose job is to be truthful about sources, would be worse
    // than naming none.
    expect(describeSources(resume, ["exp-deleted"])).toEqual([]);
    expect(describeSources(resume, [])).toEqual([]);
  });
});
