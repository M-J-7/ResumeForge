/**
 * The usage counter's table can hold a count and nothing else.
 *
 * The privacy page says the counter stores an event name, a day and a number,
 * and no user, session, address or content. The strongest form of that claim
 * is structural — there is no column any of those could go in — and this is
 * what keeps it structural: a column added here fails the build until the
 * privacy page, and this test, are changed to say so.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@/test/database";

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await database.destroy();
});

interface Column {
  name: string;
  type: string;
  pk: number | bigint;
}

describe("EventCount", () => {
  it("has a name, a day and a count, keyed on the first two", async () => {
    const columns = await database.client.$queryRawUnsafe<Column[]>(
      `PRAGMA table_info("EventCount")`,
    );
    expect(columns.map((column) => [column.name, column.type, Number(column.pk)])).toEqual([
      ["name", "TEXT", 1],
      ["day", "TEXT", 2],
      ["count", "INTEGER", 0],
    ]);
  });

  it("relates to nothing, so no row can be traced back to anyone", async () => {
    const keys = await database.client.$queryRawUnsafe<unknown[]>(
      `PRAGMA foreign_key_list("EventCount")`,
    );
    expect(keys).toEqual([]);
  });
});
