/**
 * Resolving a job title to topics and related titles (P33-C2).
 *
 * ## Exact first, claim once — landmine 10
 *
 * "Backend Engineer" is a substring of "Senior Backend Engineer". A greedy
 * substring pass therefore hands the junior title the senior one's index,
 * silently. The X-Ray scorecard learned this the expensive way and states it
 * in `scorecard.ts`; the rule is the same here, so the implementation is the
 * same shape: **every exact match is claimed before any fuzzy one is
 * considered.**
 *
 * The consequence is worth naming, because it looks like extra work for no
 * gain until it bites: a user who types "Engineer" should get the generic
 * engineering topics, not whichever specific engineering occupation happened
 * to sort first in a 941-row file.
 *
 * ## Lazy-loaded, exactly like the skill index
 *
 * `data/phrases.json` is ~0.4 MB. §2.2 budgets the builder at three seconds
 * to interactive on throttled 4G, and most sessions never open the phrase
 * drawer at all — so it lives in a chunk of its own behind a dynamic
 * `import()`, cached on the module, the same arrangement `loadSkillIndex()`
 * uses and for the same reason.
 *
 * A failed load degrades to the default topics rather than rejecting. The
 * scaffolds are ours and are already in the bundle; the O\*NET half only
 * decides *which* of them to show first. Losing it should cost a little
 * relevance, never the feature.
 */

import { normalizeTerm } from "@/lib/skills/lookup";
import { DEFAULT_TOPIC_IDS, PHRASE_TOPICS, getTopic, type PhraseTopic } from "./scaffolds";

export interface OccupationEntry {
  code: string;
  title: string;
  alternates: string[];
  /** Topic ids from `./scaffolds.ts`, in that file's order. */
  topics: string[];
}

export interface PhrasesData {
  generatedAt: string;
  sources: { name: string; licence: string; url: string; accessed?: string; note?: string }[];
  defaultTopics: string[];
  occupations: OccupationEntry[];
}

/**
 * Folds a trailing plural on the last word.
 *
 * O\*NET names occupations in the plural — "Software Developers",
 * "Accountants", "Registered Nurses" — and a person types their own job
 * title in the singular, because that is what it says on their contract.
 * Without this, the single commonest lookup in the feature misses.
 *
 * Deliberately three cases and no stemmer. "Attorneys" → "attorney" and
 * "Bus Drivers" → "bus driver" is the whole job; a real stemmer would also
 * turn "Bus" into "bu" and cost a dependency for the privilege.
 */
function singularize(term: string): string {
  const words = term.split(" ");
  const last = words[words.length - 1];
  if (!last || last.length < 4) return term;

  const folded = last.endsWith("ies")
    ? `${last.slice(0, -3)}y`
    : last.endsWith("sses") || last.endsWith("ches") || last.endsWith("shes")
      ? last.slice(0, -2)
      : last.endsWith("s") && !last.endsWith("ss") && !last.endsWith("us")
        ? last.slice(0, -1)
        : last;

  if (folded === last) return term;
  return [...words.slice(0, -1), folded].join(" ");
}

/**
 * The shortest a contained title may be, as a fraction of what was typed.
 *
 * Without a floor, "Chief Vibes Officer" resolves to whichever occupation
 * lists "Officer" as an alternate title — which was, in practice, Transit
 * and Railroad Police. A match covering barely a third of the input is not a
 * match; it is a coincidence with an index behind it, and it is worse than
 * returning nothing, because nothing falls back to the default topics.
 */
const MIN_CONTAINED_COVERAGE = 0.5;

export class OccupationIndex {
  /** Normalised title (canonical *and* alternate) to occupation. */
  private readonly byTitle = new Map<string, OccupationEntry>();
  private readonly all: readonly OccupationEntry[];

  constructor(occupations: readonly OccupationEntry[] = []) {
    this.all = occupations;
    // Registration order is load-bearing, in three passes.
    //
    // Every occupation's canonical title goes in before any alternate does.
    // Otherwise one occupation's alternate can occupy the exact name of
    // another's canonical title and make it unreachable — "Cook" is an
    // alternate for Chef and is also a job in its own right. Same first-wins
    // collision the skill index handles the same way.
    //
    // Singular forms go in last, so a real title always beats a folded one.
    for (const occupation of occupations) {
      this.register(normalizeTerm(occupation.title), occupation);
    }
    for (const occupation of occupations) {
      for (const alternate of occupation.alternates) {
        this.register(normalizeTerm(alternate), occupation);
      }
    }
    for (const occupation of occupations) {
      for (const title of [occupation.title, ...occupation.alternates]) {
        this.register(singularize(normalizeTerm(title)), occupation);
      }
    }
  }

  private register(key: string, occupation: OccupationEntry): void {
    if (key && !this.byTitle.has(key)) this.byTitle.set(key, occupation);
  }

  get size(): number {
    return this.all.length;
  }

  /**
   * The occupation a written title names, or null.
   *
   * Exact match first, across the whole index. Only when nothing matches
   * exactly does it fall back to the longest title contained in what the
   * user typed — longest, so "Senior Backend Engineer" prefers "Backend
   * Engineer" over "Engineer", which is the same preference a human reader
   * has.
   */
  resolve(title: string): OccupationEntry | null {
    const key = normalizeTerm(title);
    if (!key) return null;

    // Exact, across the whole index, before anything fuzzy is considered.
    const exact = this.byTitle.get(key) ?? this.byTitle.get(singularize(key));
    if (exact) return exact;

    const floor = key.length * MIN_CONTAINED_COVERAGE;
    let best: { entry: OccupationEntry; length: number } | null = null;
    for (const [candidate, entry] of this.byTitle) {
      if (candidate.length < 4 || candidate.length < floor) continue;
      // On a word boundary at both ends: "engineer" must not match inside
      // "engineering", and "art" must not match inside "smart".
      if (!new RegExp(`(^| )${escapeRegExp(candidate)}( |$)`).test(key)) continue;
      if (!best || candidate.length > best.length) best = { entry, length: candidate.length };
    }
    return best?.entry ?? null;
  }

  /**
   * Titles to offer as a search, ranked.
   *
   * Prefix matches before contained ones: someone typing "acc" is far more
   * likely to want "Accountant" than "Tax Preparer, Public Accountant".
   */
  search(query: string, limit = 8): OccupationEntry[] {
    const key = normalizeTerm(query);
    if (key.length < 2) return [];

    const prefix: OccupationEntry[] = [];
    const contains: OccupationEntry[] = [];
    const seen = new Set<string>();

    for (const [candidate, entry] of this.byTitle) {
      if (seen.has(entry.code)) continue;
      if (candidate.startsWith(key)) {
        prefix.push(entry);
        seen.add(entry.code);
      } else if (candidate.includes(key)) {
        contains.push(entry);
        seen.add(entry.code);
      }
      if (prefix.length >= limit) break;
    }

    return [...prefix, ...contains].slice(0, limit);
  }
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

let cached: Promise<OccupationIndex> | null = null;

export function loadOccupationIndex(): Promise<OccupationIndex> {
  cached ??= import("../../../data/phrases.json")
    .then((module) => {
      const data = (module.default ?? module) as unknown as PhrasesData;
      return new OccupationIndex(data.occupations);
    })
    .catch(() => new OccupationIndex());

  return cached;
}

/** Test seam: drops the cached index so the next call rebuilds it. */
export function resetOccupationIndexCache(): void {
  cached = null;
}

/* -------------------------------------------------------------------------- */
/* The two questions the drawer asks                                           */
/* -------------------------------------------------------------------------- */

export interface PhraseSuggestions {
  /** The occupation the title resolved to, or null when nothing matched. */
  occupation: OccupationEntry | null;
  /** Topics to show, in `PHRASE_TOPICS` order. Never empty. */
  topics: PhraseTopic[];
  /** Other names for the same job — the "related roles" list. */
  relatedTitles: string[];
}

/**
 * Topics and scaffolds for a job title.
 *
 * Never returns nothing. A title we do not recognise gets the default
 * topics, which are the shapes that apply to almost any role — a drawer that
 * opened empty because O\*NET has no row for "Growth Hacker" would be worse
 * than one that opened on four useful groups.
 */
export async function phrasesForTitle(title: string): Promise<PhraseSuggestions> {
  const index = await loadOccupationIndex();
  const occupation = index.resolve(title);

  const ids = occupation && occupation.topics.length > 0 ? occupation.topics : DEFAULT_TOPIC_IDS;
  const topics = PHRASE_TOPICS.filter((topic) => ids.includes(topic.id));

  return {
    occupation,
    // `getTopic` is the fallback for an id in the data file that no longer
    // exists in `scaffolds.ts` — possible whenever the two are regenerated
    // out of step, and silently showing nothing would be the worse failure.
    topics: topics.length > 0 ? topics : DEFAULT_TOPIC_IDS.map(getTopic).filter(isTopic),
    relatedTitles: occupation?.alternates ?? [],
  };
}

function isTopic(topic: PhraseTopic | null): topic is PhraseTopic {
  return topic !== null;
}

/** Titles contain `+` and `.` — both regex metacharacters after normalisation. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Other names for the job a title names. Empty when nothing matched. */
export async function relatedTitles(title: string): Promise<string[]> {
  const index = await loadOccupationIndex();
  return index.resolve(title)?.alternates ?? [];
}

export { PHRASE_TOPICS, DEFAULT_TOPIC_IDS, getTopic, BLANK, ALL_SCAFFOLDS } from "./scaffolds";
export type { PhraseTopic } from "./scaffolds";
