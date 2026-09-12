/**
 * Undo/redo history (M0-T7).
 *
 * Kept as a pure module so the coalescing rules — the subtle part — can be
 * tested without a store, a DOM, or IndexedDB.
 *
 * ## Why whole snapshots rather than diffs
 *
 * A `ResumeDocument` is a few kilobytes. Fifty of them is a rounding error
 * against the font files we already ship, and snapshots make undo a pointer
 * swap that cannot desynchronize from the document the way a
 * replay-the-inverse-command scheme can. Diffing would buy memory we do not
 * need at the cost of the one property that matters here: that undo always
 * lands exactly where the user was.
 *
 * ## Coalescing
 *
 * Users editing prose expect one undo to remove a word or a phrase, not one
 * keystroke. Every edit therefore carries an optional `coalesceKey`
 * identifying the field being typed into. Consecutive edits sharing a key,
 * arriving within `COALESCE_WINDOW_MS` of each other, extend the current
 * history entry instead of pushing a new one — so typing a bullet is one
 * undo step, and pausing, switching fields, or undoing starts a fresh one.
 */

/** Plan says ~50. Bounded so a long session cannot grow memory without limit. */
export const HISTORY_LIMIT = 50;

/**
 * A pause longer than this starts a new undo entry even in the same field.
 * Long enough to span normal typing rhythm, short enough that "type, think,
 * type again" leaves a checkpoint in between.
 */
export const COALESCE_WINDOW_MS = 700;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Field identity of the last edit, or null when the last change was not coalescable. */
  lastCoalesceKey: string | null;
  /** Timestamp of the last edit, for the coalescing window. */
  lastEditAt: number;
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastCoalesceKey: null, lastEditAt: 0 };
}

export interface CommitOptions {
  /** Identifies the field being edited; consecutive edits to it coalesce. */
  coalesceKey?: string;
  /** Injected so tests do not depend on wall-clock timing. */
  now?: number;
}

/**
 * Records a new present value.
 *
 * Returns the history unchanged when the value is identical, so a form
 * re-submitting the same content cannot pollute the undo stack with no-ops.
 */
export function commit<T>(history: History<T>, next: T, options: CommitOptions = {}): History<T> {
  if (Object.is(history.present, next)) return history;

  const now = options.now ?? Date.now();
  const coalesceKey = options.coalesceKey ?? null;

  const shouldCoalesce =
    coalesceKey !== null &&
    coalesceKey === history.lastCoalesceKey &&
    now - history.lastEditAt < COALESCE_WINDOW_MS;

  if (shouldCoalesce) {
    // The entry already on `past` is the pre-edit state for this run of
    // typing; replacing only `present` extends that entry rather than
    // stacking another.
    return { ...history, present: next, lastCoalesceKey: coalesceKey, lastEditAt: now };
  }

  const past = [...history.past, history.present];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: next,
    // Any new edit invalidates the redo branch.
    future: [],
    lastCoalesceKey: coalesceKey,
    lastEditAt: now,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    // Clearing the key stops the next keystroke from coalescing into the
    // entry we just stepped back into, which would make undo appear to
    // do nothing.
    lastCoalesceKey: null,
    lastEditAt: 0,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    lastCoalesceKey: null,
    lastEditAt: 0,
  };
}

/**
 * Replaces the present without recording history — for rehydration from
 * storage, where there is no prior state for the user to step back to.
 */
export function reset<T>(present: T): History<T> {
  return createHistory(present);
}
