/**
 * Shows how a job posting was split (M3-T3).
 *
 * Exists for the manual check in `docs/QA.md`: M3-T3's acceptance is a
 * correct section split on ten postings collected from the wild, and the
 * automated fixtures cover conventions rather than real text (see
 * `src/test/fixtures/job-descriptions.ts` for why). This makes checking a
 * real posting one command instead of a debugging session.
 *
 *   node scripts/parse-jd.mjs path/to/posting.txt
 *   pbpaste | node scripts/parse-jd.mjs
 *
 * Imports the TypeScript module directly — Node strips the types, and
 * `src/lib/jd/parse.ts` deliberately has no imports of its own, so there is
 * no build step between a pasted posting and an answer.
 */

import { readFileSync } from "node:fs";
import process from "node:process";
import { parseJobDescription, sectionSummary, weightedLines } from "../src/lib/jd/parse.ts";

function readInput() {
  const [, , file] = process.argv;
  if (file) return readFileSync(file, "utf8");
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const source = readInput();
if (source.trim().length === 0) {
  console.error("Nothing to parse. Pass a file path, or pipe the posting in on stdin.");
  process.exit(1);
}

const parsed = parseJobDescription(source);

console.log(`Title: ${parsed.title ?? "(none detected)"}`);
console.log("");

for (const section of parsed.sections) {
  const heading = section.heading ?? "(opening text, before any heading)";
  const scored = section.weight === 0 ? "ignored" : `weight ${section.weight}`;
  console.log(`## ${heading}  ->  ${section.kind} (${scored})`);
  for (const line of section.lines) {
    const override = line.kindOverride ? `  <- reclassified as ${line.kindOverride}` : "";
    console.log(`   ${line.bullet ? "-" : " "} ${line.text}${override}`);
  }
  console.log("");
}

console.log("Lines per kind:", sectionSummary(parsed));
console.log("Lines a scorer would see:", weightedLines(parsed).length);
console.log("");
console.log("Check: does every heading above carry the kind you would have given it,");
console.log("and is everything under 'ignored' genuinely boilerplate?");
