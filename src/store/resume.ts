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
import {
  createDraftStore,
  idbBackend,
  STORAGE_KEY,
  type DraftStore,
  type DraftStoreOptions,
  type KeyValueBackend,
} from "./persistence";
import { namespacedKey, subscribeToOwner } from "./owner";
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
import { createRemoteSync, type RemoteSync, type SyncStatus, type SyncTarget } from "./sync";
import { createEmptyResume } from "@/lib/resume/factory";
import { safeMigrate } from "@/lib/resume/migrate";
import type {
  Contact,
  CustomSection,
  ResumeDocument,
  Section,
  SectionType,
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

  /**
   * The account resume being edited, or null for a guest draft (M2-T4).
   * Guest is still the default: the builder never requires an account.
   */
  remoteId: string | null;
  /** Where the open document currently lives. Drives the sync indicator. */
  syncStatus: SyncStatus;
  /**
   * Pages, as measured from the rendered PDF by the preview (D3 — measured
   * from the artifact, never predicted). Null until something has rendered.
   * Pushed to the server so the dashboard can show it without rendering.
   */
  measuredPageCount: number | null;

  document: () => ResumeDocument;
  canUndo: () => boolean;
  canRedo: () => boolean;

  hydrate: () => Promise<void>;
  update: (updater: (doc: ResumeDocument) => ResumeDocument, options?: CommitOptions) => void;
  undo: () => void;
  redo: () => void;
  flush: () => Promise<void>;
  clearAll: () => Promise<void>;

  /**
   * Points the store at an account resume and loads `document` into it.
   *
   * Pass `unsynced` when `document` came from this browser rather than from
   * the server — it is then pushed immediately, and recorded as not yet
   * confirmed, so closing the tab before the push lands does not lose it.
   */
  attachRemote: (input: { id: string; document: ResumeDocument; unsynced?: boolean }) => void;
  /** Returns to guest editing — what signing out leaves behind. */
  detachRemote: () => void;
  setMeasuredPageCount: (pageCount: number | null) => void;

  setContact: (contact: Contact, options?: CommitOptions) => void;
  setSettings: (settings: Partial<Settings>) => void;
  updateSection: (
    sectionId: string,
    updater: (section: Section) => Section,
    options?: CommitOptions,
  ) => void;
  setSectionVisible: (sectionId: string, visible: boolean) => void;
  reorderSections: (from: number, to: number) => void;
  /**
   * Applies a template preset in **one** history entry (P32-B3).
   *
   * Deliberately not `setSettings` followed by a run of `reorderSections`.
   * Each of those is its own `applyChange`, so applying a template would
   * cost the user five or six presses of Ctrl+Z to undo one click — which is
   * not undo, it is a puzzle. One change, one undo step.
   *
   * Sections the template does not name keep their relative order and follow
   * the ones it does: custom sections are the user's own and a preset has no
   * business reordering, hiding or dropping them.
   */
  applyTemplate: (settings: Settings, sectionOrder: readonly SectionType[]) => void;
  addCustomSection: (section: CustomSection) => void;
  removeSection: (sectionId: string) => void;
  replaceDocument: (document: ResumeDocument) => void;
  /**
   * Replaces the document with one the user brought from outside (M2-T6).
   *
   * Distinct from `replaceDocument` only in bumping `externalRevision`: an
   * import changes every field at once for a reason no open form caused, so
   * the steps have to remount rather than keep showing the old values.
   * Undoable, because it is the one action that can wipe out a draft.
   */
  importDocument: (document: ResumeDocument) => void;
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

/**
 * The persistence seam, and the identity it is currently bound to.
 *
 * Both are held rather than just the store, because the store's key is
 * decided at construction and the owner can change *after* this module is
 * imported — a person signs in, and the slot the builder should be writing
 * to changes underneath a module that has no component to re-render. The
 * subscription below rebuilds the store on that event so no write can land
 * in the previous owner's slot (§10.1).
 */
let backendInUse: KeyValueBackend = idbBackend;
let persistenceOptions: DraftStoreOptions | undefined;
let draftStore: DraftStore = createDraftStore(backendInUse);

/**
 * Swaps the persistence backend. Exists for tests, which run in Node where
 * IndexedDB does not exist, and for any future server-side rendering path.
 */
export function configurePersistence(backend: KeyValueBackend, options?: DraftStoreOptions): void {
  backendInUse = backend;
  persistenceOptions = options;
  draftStore = createDraftStore(backend, options);
}

/**
 * Rebinds to the new owner's slot when identity changes.
 *
 * A queued autosave is flushed to the *old* slot first, deliberately: it is
 * the previous owner's own work, and dropping it mid-debounce would lose an
 * edit they made seconds before signing out. `purgeForeignStorage` deletes
 * it afterwards if it belongs to neither the new owner nor `guest`.
 *
 * An explicit `key` in `persistenceOptions` wins — that is a test pinning a
 * slot on purpose, and re-deriving it here would silently ignore them.
 */
subscribeToOwner(() => {
  const previous = draftStore;
  draftStore = createDraftStore(backendInUse, {
    ...persistenceOptions,
    key: persistenceOptions?.key ?? namespacedKey(STORAGE_KEY),
  });
  void previous.flush().catch(() => undefined);

  /*
   * Rebinding the key is not enough on its own.
   *
   * `signOutAction` redirects through a Server Action, which is a *soft*
   * navigation: this module is never re-evaluated, so the document, the
   * history stack and the `remoteId` all survive in memory. The next
   * person's first paint would show the previous person's resume even
   * though every subsequent read went to the right slot.
   *
   * `detachRemote` is called for its own job — dropping the sync target so
   * a stray queued push cannot go out stamped with a foreign resume id.
   * That method was written for exactly this moment and had no callers.
   */
  const store = useResumeStore.getState();
  store.detachRemote();
  useResumeStore.setState({
    history: createHistory(createEmptyResume()),
    // The next mount hydrates from the new owner's slot. Left true, a
    // builder still on screen would keep rendering the emptied document as
    // if it were loaded.
    hydrated: false,
    loadError: null,
    externalRevision: store.externalRevision + 1,
    measuredPageCount: null,
  });
});

/**
 * The queue that pushes to the account (M2-T4), or null when there is no
 * account in play — which includes every guest session and every test that
 * has not asked for one.
 *
 * Injected the same way the persistence backend is, and for the same reason:
 * the store must remain importable and fully functional with no server
 * anywhere near it.
 */
let remoteSync: RemoteSync | null = null;

export function configureRemoteSync(
  target: SyncTarget | null,
  options?: Parameters<typeof createRemoteSync>[1],
): void {
  remoteSync?.dispose();
  remoteSync = target
    ? createRemoteSync(target, {
        ...options,
        onStatusChange: (status) => {
          useResumeStore.setState({ syncStatus: status });
          // Once the server has confirmed the newest revision, the local copy
          // is no longer ahead of it. Recorded so a reload knows which side
          // to believe without comparing two machines' clocks.
          if (status === "synced") {
            const state = useResumeStore.getState();
            draftStore.save({
              document: state.history.present,
              savedAt: Date.now(),
              remoteId: state.remoteId,
              pendingSync: false,
            });
          }
          options?.onStatusChange?.(status);
        },
      })
    : null;
  if (!target) useResumeStore.setState({ syncStatus: "idle" });
}

/** Exposed so the builder can flush and retry without reaching into the store. */
export function activeRemoteSync(): RemoteSync | null {
  return remoteSync;
}

export const useResumeStore = create<ResumeState>((set, get) => {
  /**
   * Writes the document everywhere it belongs.
   *
   * Local first and always — that write does not depend on a network, an
   * account, or a server being up. The remote push is queued behind it and
   * is allowed to fail.
   */
  const persist = (document: ResumeDocument) => {
    const remoteId = get().remoteId;
    draftStore.save({
      document,
      savedAt: Date.now(),
      remoteId,
      pendingSync: remoteId !== null,
    });
    remoteSync?.queue(document);
  };

  /** Records a document change in history and queues an autosave. */
  const applyChange = (next: ResumeDocument, options?: CommitOptions) => {
    const history = commit(get().history, next, options);
    if (history === get().history) return;
    set({ history });
    persist(history.present);
  };

  return {
    history: createHistory(createEmptyResume()),
    hydrated: false,
    externalRevision: 0,
    loadError: null,
    remoteId: null,
    syncStatus: "idle",
    measuredPageCount: null,

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
        // A draft that was last edited against an account keeps that link, so
        // reopening `/builder` with no query string continues the resume the
        // user was on rather than silently forking a guest copy of it.
        remoteId: draft.remoteId ?? null,
      });
      remoteSync?.setResumeId(draft.remoteId ?? null);
      // Edits made while the server was unreachable go out as soon as the
      // tab is open again, without waiting for the next keystroke.
      if (draft.remoteId && draft.pendingSync) remoteSync?.queue(result.document);
    },

    update(updater, options) {
      applyChange(updater(get().history.present), options);
    },

    undo() {
      const history = undo(get().history);
      if (history === get().history) return;
      set({ history, externalRevision: get().externalRevision + 1 });
      persist(history.present);
    },

    redo() {
      const history = redo(get().history);
      if (history === get().history) return;
      set({ history, externalRevision: get().externalRevision + 1 });
      persist(history.present);
    },

    // Flushes local first: it is the copy that must survive the tab closing.
    async flush() {
      await draftStore.flush();
      await remoteSync?.flush();
    },

    async clearAll() {
      await draftStore.clear();
      remoteSync?.setResumeId(null);
      set({
        history: createHistory(createEmptyResume()),
        loadError: null,
        externalRevision: get().externalRevision + 1,
        remoteId: null,
        syncStatus: "idle",
      });
    },

    attachRemote({ id, document, unsynced = false }) {
      set({
        remoteId: id,
        history: reset(document),
        hydrated: true,
        loadError: null,
        externalRevision: get().externalRevision + 1,
      });
      remoteSync?.setResumeId(id);

      if (unsynced) {
        // Straight out, rather than waiting for the next keystroke — the
        // user may have no more edits to make.
        persist(document);
      } else {
        draftStore.save({ document, savedAt: Date.now(), remoteId: id, pendingSync: false });
      }
    },

    detachRemote() {
      remoteSync?.setResumeId(null);
      set({ remoteId: null, syncStatus: "idle" });
    },

    setMeasuredPageCount(pageCount) {
      if (get().measuredPageCount === pageCount) return;
      set({ measuredPageCount: pageCount });
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

    applyTemplate(settings, sectionOrder) {
      const doc = get().history.present;
      const rank = new Map(sectionOrder.map((type, index) => [type, index]));
      // Anything unranked — every custom section — sorts after everything
      // ranked, and `sort` is stable, so those keep the order the user chose.
      const ordered = [...doc.sections].sort(
        (a, b) =>
          (rank.get(a.type) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.type) ?? Number.MAX_SAFE_INTEGER),
      );
      applyChange({ ...doc, settings, sections: ordered });
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

    importDocument(document) {
      applyChange(document);
      set({ externalRevision: get().externalRevision + 1, loadError: null });
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
  // Coming back online is the one moment a queued push is certain to
  // succeed. Waiting out the backoff instead would leave the indicator
  // saying "on this device" long after the connection returned.
  const onOnline = () => remoteSync?.retryNow();

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", flush);
  window.addEventListener("pagehide", flush);
  window.addEventListener("online", onOnline);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("blur", flush);
    window.removeEventListener("pagehide", flush);
    window.removeEventListener("online", onOnline);
  };
}
