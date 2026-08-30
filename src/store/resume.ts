/**
 * The builder's document store (M0-T7).
 *
 * Holds one `ResumeDocument`, an undo/redo history, and an autosaving link
 * to IndexedDB. Per D6 nothing here ever leaves the browser.
 *
 * Zustand's `persist` middleware is deliberately not used. It serializes on
 * every state change and rehydrates synchronously into whatever shape it
 * finds, whereas this store needs three things persist does not give
 * cleanly: a debounced write with an explicit flush, history excluded from
 * what gets saved, and every read routed through `migrate()` per D10. The
 * store owns those directly instead.
 */

import { create } from "zustand";
import { createDraftStore, idbBackend, type DraftStore, type KeyValueBackend } from "./persistence";
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  reset,
  undo,
  type CommitOptions,
  type History,
} from "./history";
import { createEmptyResume } from "@/lib/resume/factory";
import { safeMigrate } from "@/lib/resume/migrate";
import type {
  Contact,
  CustomSection,
  ResumeDocument,
  Section,
  Settings,
} from "@/lib/resume/schema";

export interface ResumeState {
  history: History<ResumeDocument>;
  /** False until the persisted draft has been read; the UI waits on this. */
  hydrated: boolean;
  /**
   * Bumped only when the document changes for a reason the user's current
   * form did not cause — undo, redo, rehydration, clearing. Forms key
   * themselves on it so they remount with fresh values then, and *only*
   * then: re-syncing on every keystroke would fight the caret.
   */
  externalRevision: number;
  /** Set when a persisted draft existed but could not be migrated. */
  loadError: string | null;

  document: () => ResumeDocument;
  canUndo: () => boolean;
  canRedo: () => boolean;

  hydrate: () => Promise<void>;
  update: (updater: (doc: ResumeDocument) => ResumeDocument, options?: CommitOptions) => void;
  undo: () => void;
  redo: () => void;
  flush: () => Promise<void>;
  clearAll: () => Promise<void>;

  setContact: (contact: Contact, options?: CommitOptions) => void;
  setSettings: (settings: Partial<Settings>) => void;
  updateSection: (
    sectionId: string,
    updater: (section: Section) => Section,
    options?: CommitOptions,
  ) => void;
  setSectionVisible: (sectionId: string, visible: boolean) => void;
  reorderSections: (from: number, to: number) => void;
  addCustomSection: (section: CustomSection) => void;
  removeSection: (sectionId: string) => void;
  replaceDocument: (document: ResumeDocument) => void;
}

/** Moves an item within an array, returning a new array. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...items];
  next.splice(to, 0, moved);
  return next;
}

function mapSection(
  doc: ResumeDocument,
  sectionId: string,
  updater: (section: Section) => Section,
): ResumeDocument {
  let changed = false;
  const sections = doc.sections.map((section) => {
    if (section.id !== sectionId) return section;
    const next = updater(section);
    if (next !== section) changed = true;
    return next;
  });
  return changed ? { ...doc, sections } : doc;
}

let draftStore: DraftStore = createDraftStore(idbBackend);

/**
 * Swaps the persistence backend. Exists for tests, which run in Node where
 * IndexedDB does not exist, and for any future server-side rendering path.
 */
export function configurePersistence(
  backend: KeyValueBackend,
  options?: { debounceMs?: number },
): void {
  draftStore = createDraftStore(backend, options);
}

export const useResumeStore = create<ResumeState>((set, get) => {
  /** Records a document change in history and queues an autosave. */
  const applyChange = (next: ResumeDocument, options?: CommitOptions) => {
    const history = commit(get().history, next, options);
    if (history === get().history) return;
    set({ history });
    draftStore.save({ document: history.present, savedAt: Date.now() });
  };

  return {
    history: createHistory(createEmptyResume()),
    hydrated: false,
    externalRevision: 0,
    loadError: null,

    document: () => get().history.present,
    canUndo: () => canUndo(get().history),
    canRedo: () => canRedo(get().history),

    async hydrate() {
      const draft = await draftStore.read();
      if (!draft) {
        set({ hydrated: true, loadError: null });
        return;
      }
      // Every read goes through the migration chain (D10) — a document saved
      // by an older build must never reach the UI unmigrated.
      const result = safeMigrate(draft.document);
      if (!result.ok) {
        set({ hydrated: true, loadError: result.error.message });
        return;
      }
      set({
        history: reset(result.document),
        hydrated: true,
        loadError: null,
        externalRevision: get().externalRevision + 1,
      });
    },

    update(updater, options) {
      applyChange(updater(get().history.present), options);
    },

    undo() {
      const history = undo(get().history);
      if (history === get().history) return;
      set({ history, externalRevision: get().externalRevision + 1 });
      draftStore.save({ document: history.present, savedAt: Date.now() });
    },

    redo() {
      const history = redo(get().history);
      if (history === get().history) return;
      set({ history, externalRevision: get().externalRevision + 1 });
      draftStore.save({ document: history.present, savedAt: Date.now() });
    },

    flush: () => draftStore.flush(),

    async clearAll() {
      await draftStore.clear();
      set({
        history: createHistory(createEmptyResume()),
        loadError: null,
        externalRevision: get().externalRevision + 1,
      });
    },

    setContact(contact, options) {
      applyChange({ ...get().history.present, contact }, options);
    },

    setSettings(settings) {
      const doc = get().history.present;
      applyChange({ ...doc, settings: { ...doc.settings, ...settings } });
    },

    updateSection(sectionId, updater, options) {
      applyChange(mapSection(get().history.present, sectionId, updater), options);
    },

    setSectionVisible(sectionId, visible) {
      applyChange(
        mapSection(get().history.present, sectionId, (section) =>
          section.visible === visible ? section : { ...section, visible },
        ),
      );
    },

    reorderSections(from, to) {
      const doc = get().history.present;
      applyChange({ ...doc, sections: moveItem(doc.sections, from, to) });
    },

    addCustomSection(section) {
      const doc = get().history.present;
      applyChange({ ...doc, sections: [...doc.sections, section] });
    },

    removeSection(sectionId) {
      const doc = get().history.present;
      applyChange({ ...doc, sections: doc.sections.filter((s) => s.id !== sectionId) });
    },

    replaceDocument(document) {
      applyChange(document);
    },
  };
});

/**
 * Flushes pending autosaves at the two moments a tab is most likely to
 * disappear before the debounce timer fires. Returns a teardown function.
 *
 * `visibilitychange` rather than `beforeunload`: mobile browsers routinely
 * kill a backgrounded tab without ever firing an unload event, so
 * `beforeunload` alone loses exactly the edits it looks like it protects.
 */
export function installAutosaveFlush(): () => void {
  if (typeof document === "undefined") return () => {};

  const flush = () => void useResumeStore.getState().flush();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush();
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", flush);
  window.addEventListener("pagehide", flush);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("blur", flush);
    window.removeEventListener("pagehide", flush);
  };
}
