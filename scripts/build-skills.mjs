/**
 * Builds `data/skills.json` — the skill vocabulary the JD matcher resolves
 * against (M3-T1).
 *
 * Run with `pnpm skills:build`; the output is committed. Nothing at runtime
 * or test time touches the network, for the same reason the font pipeline
 * does not: a build that reaches the internet fails in CI on somebody
 * else's outage.
 *
 * ## Sources, and why these ones
 *
 * **O*NET Technology Skills** (CC BY 4.0). One file, one request, ~8,700
 * distinct technology names, each already categorised by a UNSPSC commodity
 * title. It is the closest public thing to "the software people list on
 * resumes", and the licence permits commercial use with attribution — which
 * `docs/ATTRIBUTION.md` and the `sources` field below both record.
 *
 * **Our own curated list** (`src/lib/skills/curated.ts`). Merged in first
 * and always wins a collision. O*NET has "Kubernetes" but has never heard
 * of "k8s", and the aliases are what make the matcher trustworthy — see
 * that file's header.
 *
 * ## Why ESCO is not here
 *
 * The plan names ESCO alongside O*NET, and its licence is the more
 * permissive of the two. It is absent because of delivery, not licensing:
 * ESCO publishes bulk downloads behind a registration form, and its open
 * API is a per-query search endpoint. Harvesting ~13k skills through
 * paginated search would be a slow, fragile build step whose failure mode is
 * a half-populated vocabulary. O*NET plus the curated list already clears
 * M3-T1's acceptance, and ESCO can be added here later without touching a
 * single consumer — `SkillEntry.source` exists so the provenance stays
 * visible when it is.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CURATED_SKILLS } from "../src/lib/skills/curated.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data", "skills.json");

const ONET = {
  name: "O*NET 29.1 Technology Skills",
  licence: "CC BY 4.0",
  url: "https://www.onetcenter.org/database.html",
  file: "https://www.onetcenter.org/dl_files/database/db_29_1_text/Technology%20Skills.txt",
};

/** Turns a display name into a stable slug. Must match `curated.ts`'s style. */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, "")
    .trim()
    .replace(/[\s.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * O*NET uses its commodity titles as placeholder "examples" for occupations
 * with no specific product named — rows where Example equals Commodity
 * Title, plus bare category words. Those are not skills anybody lists, and
 * including them would have the matcher tell a candidate they are missing
 * "Email software".
 */
function isPlaceholder(example, commodity) {
  const e = example.trim().toLowerCase();
  if (e === commodity.trim().toLowerCase()) return true;
  return /\b(software|systems?|tools?|applications?)$/.test(e) && !/[A-Z]/.test(example.slice(1));
}

async function fetchTechnologySkills() {
  const response = await fetch(ONET.file);
  if (!response.ok) {
    throw new Error(`O*NET returned ${response.status} for ${ONET.file}`);
  }
  return response.text();
}

function parseTechnologySkills(text) {
  const [header, ...rows] = text.split("\n");
  const columns = header.split("\t").map((c) => c.trim());
  const iExample = columns.indexOf("Example");
  const iCommodity = columns.indexOf("Commodity Title");
  const iHot = columns.indexOf("Hot Technology");
  if (iExample < 0 || iCommodity < 0) {
    throw new Error("O*NET column layout changed; refusing to guess at it.");
  }

  /** Deduplicated by slug — the file has one row per occupation. */
  const seen = new Map();
  for (const row of rows) {
    if (!row.trim()) continue;
    const cells = row.split("\t");
    const example = (cells[iExample] ?? "").trim();
    const commodity = (cells[iCommodity] ?? "").trim();
    if (!example || isPlaceholder(example, commodity)) continue;

    const id = slugify(example);
    if (!id || seen.has(id)) continue;

    seen.set(id, {
      id,
      canonical: example,
      aliases: [],
      category: commodity || "technology",
      source: "onet",
      hot: (cells[iHot] ?? "").trim() === "Y",
    });
  }
  return [...seen.values()];
}

const text = await fetchTechnologySkills();
const ingested = parseTechnologySkills(text);

// Curated ids win: the entry we control carries the aliases and the casing.
const curatedIds = new Set(CURATED_SKILLS.map((s) => s.id));
const kept = ingested.filter((entry) => !curatedIds.has(entry.id));

const data = {
  generatedAt: new Date().toISOString(),
  sources: [
    { name: ONET.name, licence: ONET.licence, url: ONET.url },
    { name: "Curated alias list (this project)", licence: "Part of this repository", url: "" },
  ],
  skills: kept,
};

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(data, null, 0)}\n`, "utf8");

const bytes = Buffer.byteLength(JSON.stringify(data));
console.log(
  `Wrote ${kept.length} ingested skills (+${CURATED_SKILLS.length} curated, merged at runtime) ` +
    `to data/skills.json — ${(bytes / 1024 / 1024).toFixed(2)} MB`,
);
if (bytes > 2 * 1024 * 1024) {
  // M3-T1's acceptance names 2 MB. Failing here rather than warning, because
  // the bundle only ever grows and nobody re-reads the number later.
  console.error("Bundle exceeds the 2 MB budget in M3-T1.");
  process.exit(1);
}
