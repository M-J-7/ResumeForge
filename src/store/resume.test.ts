/**
 * M0-T7 acceptance: a hard refresh mid-edit loses nothing, undo/redo works
 * across field types, and "clear all data" genuinely empties storage.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { configurePersistence, moveItem, useResumeStore } from "./resume";
import { STORAGE_KEY, createMemoryBackend, type KeyValueBackend } from "./persistence";
import { createHistory } from "./history";
import { createEmptyResume, createExperienceEntry } from "@/lib/resume/factory";
import { CURRENT_SCHEMA_VERSION, resumeDocumentSchema } from "@/lib/resume/schema";
import { midCareerResume } from "@/test/fixtures/resumes";
import { COALESCE_WINDOW_MS } from "./history";

let backend: KeyValueBackend;

function resetStore() {
  backend = createMemoryBackend();
  // A 0ms debounce keeps the tests about behaviour rather than timing;
  // persistence.test.ts covers the debounce itself.
  configurePersistence(backend, { debounceMs: 0 });
  useResumeStore.setState({
    history: createHistory(createEmptyResume()),
    hydrated: false,
    loadError: null,
  });
}

beforeEach(resetStore);

const store = () => useResumeStore.getState();

describe("editing and history", () => {
  it("records an edit and exposes the new document", () => {
    store().setContact({ ...midCareerResume.contact });
    expect(store().document().contact.fullName).toBe("José Ángel Muñoz-Łukasiewicz");
    expect(store().canUndo()).toBe(true);
  });

  it("undoes and redoes a contact edit", () => {
    const before = store().document().contact.fullName;
    store().setContact({ ...midCareerResume.contact });

    store().undo();
    expect(store().document().contact.fullName).toBe(before);

    store().redo();
    expect(store().document().contact.fullName).toBe("José Ángel Muñoz-Łukasiewicz");
  });

  it("undoes across every field type — contact, settings, sections, entries", () => {
    const blank = store().document();

    store().setContact({ ...blank.contact, fullName: "Ada Lovelace" });
    store().setSettings({ pageSize: "LETTER" });
    const experience = store()
      .document()
      .sections.find((s) => s.type === "experience");
    if (experience?.type !== "experience") throw new Error("expected an experience section");
    store().updateSection(experience.id, (section) =>
      section.type === "experience"
        ? { ...section, entries: [{ ...createExperienceEntry(), id: "e1", title: "Engineer" }] }
        : section,
    );
    store().setSectionVisible(experience.id, false);

    store().undo(); // visibility
    expect(
      store()
        .document()
        .sections.find((s) => s.id === experience.id)?.visible,
    ).toBe(true);
    store().undo(); // entry
    const after = store()
      .document()
      .sections.find((s) => s.id === experience.id);
    expect(after?.type === "experience" && after.entries).toHaveLength(0);
    store().undo(); // settings
    expect(store().document().settings.pageSize).toBe("A4");
    store().undo(); // contact
    expect(store().document().contact.fullName).toBe("");
    expect(store().canUndo()).toBe(false);
  });

  it("collapses a run of typing in one field into a single undo step", () => {
    const contact = store().document().contact;
    const now = Date.now();
    for (let i = 1; i <= 5; i += 1) {
      useResumeStore
        .getState()
        .setContact(
          { ...contact, fullName: "Ada".slice(0, i) },
          { coalesceKey: "contact.fullName", now: now + i * 10 },
        );
    }
    store().undo();
    expect(store().document().contact.fullName).toBe("");
  });

  it("keeps separate fields as separate undo steps", () => {
    const contact = store().document().contact;
    const now = Date.now();
    store().setContact({ ...contact, fullName: "Ada" }, { coalesceKey: "contact.fullName", now });
    store().setContact(
      { ...store().document().contact, email: "ada@example.com" },
      { coalesceKey: "contact.email", now: now + 10 },
    );

    store().undo();
    expect(store().document().contact.email).toBe("");
    expect(store().document().contact.fullName).toBe("Ada");
  });

  it("starts a new undo step after a typing pause", () => {
    const contact = store().document().contact;
    const now = Date.now();
    store().setContact({ ...contact, fullName: "Ada" }, { coalesceKey: "contact.fullName", now });
    store().setContact(
      { ...store().document().contact, fullName: "Ada Lovelace" },
      { coalesceKey: "contact.fullName", now: now + COALESCE_WINDOW_MS + 1 },
    );

    store().undo();
    expect(store().document().contact.fullName).toBe("Ada");
  });

  it("keeps the document schema-valid through every mutation", () => {
    store().setContact({ ...midCareerResume.contact });
    store().setSettings({ density: "compact", margins: 0.5 });
    store().reorderSections(0, 3);
    expect(() => resumeDocumentSchema.parse(store().document())).not.toThrow();
  });
});

describe("section operations", () => {
  it("reorders sections", () => {
    const before = store()
      .document()
      .sections.map((s) => s.type);
    store().reorderSections(0, 2);
    const after = store()
      .document()
      .sections.map((s) => s.type);
    expect(after).not.toEqual(before);
    expect([...after].sort()).toEqual([...before].sort());
  });

  it("adds and removes a custom section", () => {
    store().addCustomSection({
      id: "custom-langs",
      type: "custom",
      visible: true,
      label: "Languages",
      entries: [],
    });
    expect(
      store()
        .document()
        .sections.some((s) => s.id === "custom-langs"),
    ).toBe(true);

    store().removeSection("custom-langs");
    expect(
      store()
        .document()
        .sections.some((s) => s.id === "custom-langs"),
    ).toBe(false);
  });

  it("ignores an update for a section id that does not exist", () => {
    const before = store().document();
    store().updateSection("nope", (s) => s);
    expect(store().document()).toBe(before);
  });
});

describe("persistence — a hard refresh loses nothing", () => {
  it("restores the document a previous session was editing", async () => {
    store().setContact({ ...midCareerResume.contact });
    store().setSettings({ pageSize: "LETTER" });
    await store().flush();

    // Simulate the reload: fresh in-memory state, same backend.
    useResumeStore.setState({
      history: createHistory(createEmptyResume()),
      hydrated: false,
      loadError: null,
    });
    await store().hydrate();

    expect(store().hydrated).toBe(true);
    expect(store().document().contact.fullName).toBe("José Ángel Muñoz-Łukasiewicz");
    expect(store().document().settings.pageSize).toBe("LETTER");
  });

  it("starts clean when there is no saved draft", async () => {
    await store().hydrate();
    expect(store().hydrated).toBe(true);
    expect(store().loadError).toBeNull();
    expect(store().document().contact.fullName).toBe("");
  });

  it("offers no undo into a state the user never saw after rehydration", async () => {
    store().setContact({ ...midCareerResume.contact });
    await store().flush();
    useResumeStore.setState({ history: createHistory(createEmptyResume()), hydrated: false });
    await store().hydrate();
    expect(store().canUndo()).toBe(false);
  });

  it("migrates a draft saved by an older build (D10)", async () => {
    // A v0 document: no schemaVersion, missing settings and section flags.
    const legacy = {
      contact: { fullName: "Legacy User", email: "", phone: "", location: "" },
      sections: [{ type: "summary", content: "From an older build." }],
    };
    await backend.set(STORAGE_KEY, JSON.stringify({ document: legacy, savedAt: 1 }));

    await store().hydrate();

    expect(store().loadError).toBeNull();
    expect(store().document().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(store().document().contact.fullName).toBe("Legacy User");
  });

  it("surfaces a load error rather than crashing on an unmigratable draft", async () => {
    await backend.set(
      STORAGE_KEY,
      JSON.stringify({ document: { schemaVersion: 9999 }, savedAt: 1 }),
    );
    await store().hydrate();
    expect(store().hydrated).toBe(true);
    expect(store().loadError).toMatch(/newer version/i);
  });

  it("persists an undo, so the restored state is what the user last saw", async () => {
    store().setContact({ ...midCareerResume.contact });
    store().undo();
    await store().flush();

    useResumeStore.setState({ history: createHistory(createEmptyResume()), hydrated: false });
    await store().hydrate();
    expect(store().document().contact.fullName).toBe("");
  });
});

describe("clear all data", () => {
  it("empties storage and resets the document", async () => {
    store().setContact({ ...midCareerResume.contact });
    await store().flush();
    expect(await backend.get(STORAGE_KEY)).toBeTruthy();

    await store().clearAll();

    expect(await backend.get(STORAGE_KEY)).toBeUndefined();
    expect(store().document().contact.fullName).toBe("");
    expect(store().canUndo()).toBe(false);
  });

  it("leaves nothing for a later hydrate to restore", async () => {
    store().setContact({ ...midCareerResume.contact });
    await store().flush();
    await store().clearAll();
    await store().hydrate();
    expect(store().document().contact.fullName).toBe("");
  });
});

describe("moveItem", () => {
  it("moves an item forward and backward", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns an equal copy for a no-op or out-of-range move", () => {
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 0, 9)).toEqual(["a", "b"]);
  });
});
