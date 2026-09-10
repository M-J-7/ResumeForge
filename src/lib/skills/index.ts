/**
 * The skill vocabulary, loaded on demand.
 *
 * `data/skills.json` is about 1.2 MB — worth having, and not worth putting
 * in the bundle every visitor downloads. §9 budgets the builder at three
 * seconds on throttled 4G, and most sessions never open the match view at
 * all. The dynamic `import()` puts the vocabulary in a chunk of its own that
 * arrives only when something actually asks for it.
 *
 * The result is cached on the module, so opening the match tab, switching
 * away, and coming back costs one load rather than three.
 */

import { buildSkillIndex, type SkillEntry, type SkillIndex, type SkillsData } from "./lookup";

export * from "./lookup";
export * from "./idf";
export { CURATED_SKILLS, type CuratedSkill } from "./curated";

let cached: Promise<SkillIndex> | null = null;

/**
 * The full index: curated entries plus everything ingested from O*NET.
 *
 * A failed load resolves to the curated-only index rather than rejecting.
 * The curated list is the half that carries the aliases and does most of the
 * work, so degrading to it leaves the matcher useful; failing outright would
 * take the whole match view down because a static asset 404'd.
 */
export function loadSkillIndex(): Promise<SkillIndex> {
  cached ??= import("../../../data/skills.json")
    .then((module) => {
      const data = (module.default ?? module) as unknown as SkillsData;
      return buildSkillIndex(data.skills as SkillEntry[]);
    })
    .catch(() => buildSkillIndex());

  return cached;
}

/** Test seam: drops the cached index so the next call rebuilds it. */
export function resetSkillIndexCache(): void {
  cached = null;
}
