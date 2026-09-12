import { describe, expect, it } from "vitest";
import {
  COALESCE_WINDOW_MS,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  reset,
  undo,
} from "./history";

/** Commits a sequence of values at explicit times, sharing one coalesce key. */
function typeInto(key: string, values: string[], startAt = 1000, stepMs = 100) {
  let history = createHistory("");
  values.forEach((value, i) => {
    history = commit(history, value, { coalesceKey: key, now: startAt + i * stepMs });
  });
  return history;
}

describe("commit", () => {
  it("pushes the previous value onto the past", () => {
    const history = commit(createHistory("a"), "b", { now: 1 });
    expect(history.past).toEqual(["a"]);
    expect(history.present).toBe("b");
  });

  it("ignores a commit of an identical value, so no-ops cannot pollute history", () => {
    const initial = createHistory("a");
    expect(commit(initial, "a", { now: 1 })).toBe(initial);
  });

  it("clears the redo branch when a new edit lands", () => {
    let history = commit(createHistory("a"), "b", { now: 1 });
    history = undo(history);
    expect(canRedo(history)).toBe(true);
    history = commit(history, "c", { now: 2 });
    expect(history.future).toEqual([]);
  });

  it("bounds the past at HISTORY_LIMIT, discarding the oldest", () => {
    let history = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i += 1) {
      history = commit(history, i, { now: i * 10_000 });
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    // The oldest surviving entry, not the original 0.
    expect(history.past[0]).toBe(20);
  });
});

describe("commit — coalescing", () => {
  it("treats a run of typing in one field as a single undo step", () => {
    const history = typeInto("bullet:1", ["h", "he", "hel", "hell", "hello"]);
    expect(history.present).toBe("hello");
    expect(history.past).toEqual([""]);
    expect(undo(history).present).toBe("");
  });

  it("starts a new entry once the coalescing window lapses", () => {
    let history = commit(createHistory(""), "a", { coalesceKey: "f", now: 0 });
    history = commit(history, "ab", { coalesceKey: "f", now: COALESCE_WINDOW_MS + 1 });
    expect(history.past).toEqual(["", "a"]);
  });

  it("starts a new entry when the user moves to a different field", () => {
    let history = commit(createHistory(""), "a", { coalesceKey: "title", now: 0 });
    history = commit(history, "ab", { coalesceKey: "company", now: 10 });
    expect(history.past).toEqual(["", "a"]);
  });

  it("never coalesces edits that carry no key", () => {
    let history = commit(createHistory(""), "a", { now: 0 });
    history = commit(history, "ab", { now: 10 });
    expect(history.past).toEqual(["", "a"]);
  });

  it("does not coalesce the next keystroke into an entry just undone", () => {
    // Without clearing the key on undo, typing after an undo would extend
    // the restored entry and make the undo look like it did nothing.
    let history = typeInto("bullet:1", ["h", "hi"]);
    history = undo(history);
    expect(history.present).toBe("");
    history = commit(history, "x", { coalesceKey: "bullet:1", now: 1200 });
    expect(history.past).toEqual([""]);
    expect(undo(history).present).toBe("");
  });
});

describe("undo and redo", () => {
  it("steps back and forward through distinct edits", () => {
    let history = createHistory("a");
    history = commit(history, "b", { now: 10_000 });
    history = commit(history, "c", { now: 20_000 });

    history = undo(history);
    expect(history.present).toBe("b");
    history = undo(history);
    expect(history.present).toBe("a");
    expect(canUndo(history)).toBe(false);

    history = redo(history);
    expect(history.present).toBe("b");
    history = redo(history);
    expect(history.present).toBe("c");
    expect(canRedo(history)).toBe(false);
  });

  it("is a no-op at either end rather than throwing", () => {
    const empty = createHistory("only");
    expect(undo(empty)).toBe(empty);
    expect(redo(empty)).toBe(empty);
  });

  it("round-trips to the identical value through undo then redo", () => {
    const history = commit(createHistory("a"), "b", { now: 1 });
    expect(redo(undo(history)).present).toBe("b");
  });
});

describe("reset", () => {
  it("drops all history, since rehydration has no prior state to step back to", () => {
    let history = commit(createHistory("a"), "b", { now: 1 });
    history = reset("loaded");
    expect(history.present).toBe("loaded");
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });
});
