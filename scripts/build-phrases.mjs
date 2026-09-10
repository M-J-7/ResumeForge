/**
 * Builds `data/phrases.json` — the occupation index the phrase library
 * resolves a job title against (P33-C1).
 *
 * Run with `pnpm phrases:build`; the output is committed. Nothing at runtime
 * or test time touches the network, for the same reason `build-skills.mjs`
 * does not: a build that reaches the internet fails in CI on somebody else's
 * outage.
 *
 * ## What comes from O*NET and what does not
 *
 * **From O*NET** (CC BY 4.0, commercial use permitted with attribution):
 * occupation titles, their alternate titles, and their task statements.
 *
 * **Not from O*NET:** a single word the user is shown as a suggested bullet.
 * O*NET tasks are duty-shaped — _"Analyze user needs and software
 * requirements"_ — and `bullets/duty-phrasing` in our own lint engine exists
 * to flag exactly that. Shipping them as bullets would have the product mark
 * its own suggestions as defects. `src/lib/phrases/scaffolds.ts` states the
 * argument in full.
 *
 * So the tasks are read here **only to decide which topics an occupation
 * touches**, by keyword. The task text itself is discarded and never
 * written to the output file. That is a derivation, not a redistribution,
 * and the attribution in `docs/ATTRIBUTION.md` covers it either way.
 *
 * ## Three files, three jobs
 *
 * - `Occupation Data.txt` — the canonical title for each O*NET-SOC code.
 * - `Alternate Titles.txt` — what people actually call the job. This is the
 *   file that makes "Software Developer" findable by typing "Programmer",
 *   and it is most of the value here.
 * - `Task Statements.txt` — read for topic keywords, then thrown away.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHRASE_TOPICS, DEFAULT_TOPIC_IDS } from "../src/lib/phrases/scaffolds.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data", "phrases.json");

const ONET = {
  version: "29.1",
  licence: "CC BY 4.0",
  url: "https://www.onetcenter.org/database.html",
  base: "https://www.onetcenter.org/dl_files/database/db_29_1_text",
};

const FILES = {
  occupations: `${ONET.base}/Occupation%20Data.txt`,
  alternates: `${ONET.base}/Alternate%20Titles.txt`,
  tasks: `${ONET.base}/Task%20Statements.txt`,
};

/**
 * Keywords that put an occupation's task under a topic.
 *
 * Deliberately coarse. The topic index only decides which four or five
 * groups a drawer opens on — a near miss costs the user one extra glance,
 * where a clever classifier would cost a maintenance burden nobody has
 * budgeted. Ordering does not matter here because an occupation may match
 * several topics and keeps all of them.
 */
const TOPIC_KEYWORDS = {
  efficiency: ["efficien", "cost", "budget", "streamlin", "optimiz", "optimis", "reduce", "waste"],
  delivery: ["develop", "build", "construct", "install", "implement", "design", "produce", "deploy"],
  scale: ["volume", "throughput", "capacity", "inventory", "fleet", "portfolio", "network"],
  quality: ["inspect", "test", "quality", "defect", "maintain", "repair", "troubleshoot", "safety"],
  revenue: ["sell", "sales", "customer acquisition", "market", "negotiat", "revenue", "contract"],
  leadership: ["supervis", "manage", "direct", "coordinat", "lead", "train", "assign", "schedul"],
  process: ["procedur", "process", "policy", "policies", "standard", "workflow", "document"],
  analysis: ["analyz", "analys", "evaluat", "research", "data", "report", "forecast", "measur"],
  customer: ["customer", "client", "patient", "guest", "public", "inquir", "complaint", "advis"],
  compliance: ["complian", "regulat", "audit", "law", "legal", "certif", "inspect", "licens"],
  teaching: ["teach", "instruct", "educat", "present", "lectur", "demonstrat", "counsel", "write"],
  study: [],
};

const TOPIC_IDS = new Set(PHRASE_TOPICS.map((t) => t.id));
for (const id of Object.keys(TOPIC_KEYWORDS)) {
  if (!TOPIC_IDS.has(id)) {
    throw new Error(`TOPIC_KEYWORDS names "${id}", which is not a topic in scaffolds.ts.`);
  }
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`O*NET returned ${response.status} for ${url}`);
  return response.text();
}

/** Parses a tab-separated O*NET export into objects keyed by column name. */
function parseTsv(text, required) {
  const [header, ...rows] = text.split("\n");
  const columns = header.split("\t").map((c) => c.trim());
  for (const name of required) {
    if (!columns.includes(name)) {
      throw new Error(`O*NET column layout changed: no "${name}" column. Refusing to guess.`);
    }
  }
  const parsed = [];
  for (const row of rows) {
    if (!row.trim()) continue;
    const cells = row.split("\t");
    const record = {};
    columns.forEach((name, i) => {
      record[name] = (cells[i] ?? "").trim();
    });
    parsed.push(record);
  }
  return parsed;
}

/** Must match `normalizeTerm` in `src/lib/skills/lookup.ts`. */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9+#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O*NET's "All Other" occupations are residual buckets, not jobs anybody
 * has. Including them makes the search results worse for no gain.
 */
function isResidual(title) {
  return /,\s*all other$/i.test(title);
}

const [occupationText, alternateText, taskText] = await Promise.all([
  fetchText(FILES.occupations),
  fetchText(FILES.alternates),
  fetchText(FILES.tasks),
]);

const occupations = new Map();
for (const row of parseTsv(occupationText, ["O*NET-SOC Code", "Title"])) {
  const code = row["O*NET-SOC Code"];
  const title = row.Title;
  if (!code || !title || isResidual(title)) continue;
  occupations.set(code, { code, title, alternates: [], topics: new Set() });
}

for (const row of parseTsv(alternateText, ["O*NET-SOC Code", "Alternate Title"])) {
  const occupation = occupations.get(row["O*NET-SOC Code"]);
  const alternate = row["Alternate Title"];
  if (!occupation || !alternate) continue;
  // Deduplicated against the canonical title and against each other, since
  // the file lists a title once per source that reported it.
  if (normalizeTitle(alternate) === normalizeTitle(occupation.title)) continue;
  if (occupation.alternates.some((a) => normalizeTitle(a) === normalizeTitle(alternate))) continue;
  occupation.alternates.push(alternate);
}

for (const row of parseTsv(taskText, ["O*NET-SOC Code", "Task"])) {
  const occupation = occupations.get(row["O*NET-SOC Code"]);
  if (!occupation) continue;
  const task = row.Task.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => task.includes(keyword))) occupation.topics.add(topic);
  }
  // The task text stops here. It is never written to the output.
}

/**
 * Caps, and why each one.
 *
 * `MAX_ALTERNATES` — some occupations list over a hundred alternates, most
 * of them near-duplicates. Twelve is more than enough to make a title
 * findable and keeps the file small.
 *
 * `MAX_TOPICS` — a drawer showing nine groups is a drawer nobody reads. Five
 * is what fits before scrolling.
 */
const MAX_ALTERNATES = 12;
const MAX_TOPICS = 5;

const entries = [...occupations.values()]
  .map((occupation) => ({
    code: occupation.code,
    title: occupation.title,
    alternates: occupation.alternates.slice(0, MAX_ALTERNATES),
    // Ordered as `PHRASE_TOPICS` is, so the drawer's groups are in a stable,
    // deliberate order rather than in whatever order tasks happened to hit.
    topics: PHRASE_TOPICS.map((t) => t.id)
      .filter((id) => occupation.topics.has(id))
      .slice(0, MAX_TOPICS),
  }))
  .filter((entry) => entry.topics.length > 0 || entry.alternates.length > 0)
  .sort((a, b) => a.code.localeCompare(b.code));

const withoutTopics = entries.filter((e) => e.topics.length === 0).length;

const data = {
  generatedAt: new Date().toISOString(),
  sources: [
    {
      name: `O*NET ${ONET.version} Database — Occupation Data, Alternate Titles, Task Statements`,
      licence: ONET.licence,
      url: ONET.url,
      accessed: new Date().toISOString().slice(0, 10),
      note: "Titles and alternate titles are reproduced. Task statements are read to derive topic tags and are not reproduced.",
    },
    {
      name: "Bullet scaffolds (this project)",
      licence: "Part of this repository",
      url: "",
    },
  ],
  defaultTopics: DEFAULT_TOPIC_IDS,
  occupations: entries,
};

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(data)}\n`, "utf8");

const bytes = Buffer.byteLength(JSON.stringify(data));
console.log(
  `Wrote ${entries.length} occupations ` +
    `(${entries.reduce((n, e) => n + e.alternates.length, 0)} alternate titles, ` +
    `${withoutTopics} with no topic match) to data/phrases.json — ` +
    `${(bytes / 1024 / 1024).toFixed(2)} MB`,
);

if (bytes > 2 * 1024 * 1024) {
  // P33's acceptance names ~2 MB. Failing rather than warning, because the
  // file only ever grows and nobody re-reads a warning later.
  console.error("Bundle exceeds the 2 MB budget in P33.");
  process.exit(1);
}
