/**
 * The action-verbs page, held to the checker in the builder.
 *
 * The page's value is that it agrees with the product: a reader who takes a
 * verb from here and opens a bullet with it must not then be told by the
 * builder's lint engine that it is weak. So every verb is checked against the
 * engine's own lists, and every "instead" suggestion must be a verb this page
 * actually offers.
 */

import { describe, expect, it } from "vitest";
import { DUTY_PHRASES, NON_VERB_OPENERS, WEAK_VERBS } from "@/lib/lint/rules";
import { BLANK } from "@/lib/phrases/scaffolds";
import { ALL_ACTION_VERBS, VERB_GROUPS, WEAK_OPENERS } from "./action-verbs";

/** The phrases D14 forbids — the list the guides and the FAQ are screened for. */
const OUTCOME_CLAIM =
  /\b(guarantee\w*|beat\s+the\s+(bots?|ats)|ats[- ]proof|will\s+pass\s+(the\s+)?ats|\d+%\s+more\s+interviews?|land\s+you\s+(the\s+)?job|recruiters?\s+love)\b/i;

const DUTY_OPENERS = new Set(DUTY_PHRASES.map((phrase) => phrase.split(" ")[0]));

describe("action verbs", () => {
  it("offers only verbs the builder's checker accepts as an opener", () => {
    for (const verb of ALL_ACTION_VERBS) {
      expect(verb, verb).toMatch(/^[a-z][a-z-]*$/);
      expect(WEAK_VERBS.has(verb), `"${verb}" is a weak verb in the lint engine`).toBe(false);
      expect(NON_VERB_OPENERS.test(verb), `"${verb}" is not a verb opener`).toBe(false);
      expect(DUTY_OPENERS.has(verb), `"${verb}" opens a duty phrase`).toBe(false);
    }
  });

  it("gives every group enough verbs, and shapes with blanks rather than sentences", () => {
    expect(VERB_GROUPS.length).toBeGreaterThanOrEqual(10);
    for (const group of VERB_GROUPS) {
      expect(group.verbs.length, group.id).toBeGreaterThanOrEqual(6);
      expect(new Set(group.verbs).size, `${group.id} repeats a verb`).toBe(group.verbs.length);
      expect(group.shapes.length, group.id).toBeGreaterThan(0);
      // D8: a shape is something to fill in, never a finished claim.
      for (const shape of group.shapes) expect(shape, shape).toContain(BLANK);
    }
  });

  it("names only openers the checker really flags, and replaces them with verbs on the page", () => {
    const offered = new Set(ALL_ACTION_VERBS);
    for (const weak of WEAK_OPENERS) {
      const flagged = WEAK_VERBS.has(weak.phrase) || DUTY_PHRASES.includes(weak.phrase);
      expect(flagged, `"${weak.phrase}" is not something the lint engine flags`).toBe(true);
      expect(weak.instead.length).toBeGreaterThan(1);
      for (const verb of weak.instead) {
        expect(offered.has(verb), `"${verb}" is suggested but not on the page`).toBe(true);
      }
    }
  });

  it("makes no outcome claim (D14)", () => {
    const copy = [
      ...VERB_GROUPS.flatMap((group) => [group.label, group.hint]),
      ...WEAK_OPENERS.map((weak) => weak.why),
    ];
    for (const line of copy) expect(OUTCOME_CLAIM.exec(line)?.[0] ?? null, line).toBeNull();
  });
});
