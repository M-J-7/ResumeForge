/**
 * The published two-column measurement is the one this code produces today.
 *
 * `columns.json` is what the guide prints. A table of numbers that the code no
 * longer produces would be a claim nobody can reproduce, so this runs the
 * whole measurement — every example, three layouts, two readers, about three
 * seconds — and compares. When the layouts, the examples or the extractor
 * change, it fails; rerun it with `MEASURE_WRITE=1` to rewrite the file, then
 * re-read what the guide says about the new numbers.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_EXAMPLES } from "@/lib/examples/roles";
import { LAYOUTS, STRATEGIES, measureColumns } from "./columns";

const FILE = path.join(process.cwd(), "src", "lib", "measured", "columns.json");
const SAMPLE = "customer-service-representative";

describe("the two-column measurement", () => {
  it(
    "matches the published results",
    async () => {
      const fresh = await measureColumns(
        ROLE_EXAMPLES.map((example) => ({ slug: example.slug, resume: example.resume })),
        SAMPLE,
      );
      if (process.env.MEASURE_WRITE === "1") {
        writeFileSync(FILE, `${JSON.stringify(fresh, null, 2)}\n`);
      }
      const published: unknown = JSON.parse(readFileSync(FILE, "utf8"));
      expect(published).toEqual(JSON.parse(JSON.stringify(fresh)));
    },
    120_000,
  );

  it("covers every layout under both readers, on every example", () => {
    const published = JSON.parse(readFileSync(FILE, "utf8")) as Awaited<
      ReturnType<typeof measureColumns>
    >;
    expect(published.resumes).toBe(ROLE_EXAMPLES.length);
    for (const layout of LAYOUTS) {
      for (const strategy of STRATEGIES) {
        expect(
          published.results.some((r) => r.layout === layout && r.strategy === strategy),
          `${layout} / ${strategy}`,
        ).toBe(true);
      }
    }
  });

  it("finds one column intact under both readers — the control the comparison rests on", () => {
    // If the single-column control loses anything, the measurement is
    // measuring its own layout code rather than the difference between
    // layouts, and none of the other rows mean anything.
    const published = JSON.parse(readFileSync(FILE, "utf8")) as Awaited<
      ReturnType<typeof measureColumns>
    >;
    for (const result of published.results.filter((r) => r.layout === "one-column")) {
      expect(result.fieldsRecovered).toBe(result.fieldsTotal);
      expect(result.bulletsIntact).toBe(result.bulletsTotal);
    }
  });
});
