import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSizeTable } from "../src/lib/catalog/size-table";

test("a size table typed with bars: first line is the columns", () => {
  assert.deepEqual(
    parseSizeTable("Size | Chest | Length\nS | 18 | 28\n\nM | 20 | 29\n"),
    {
      columns: ["Size", "Chest", "Length"],
      rows: [
        ["S", "18", "28"],
        ["M", "20", "29"],
      ],
    },
  );
});

test("a table pasted from a spreadsheet (tabs) or written with outer bars", () => {
  assert.deepEqual(parseSizeTable("Size\tChest\r\nL\t22"), {
    columns: ["Size", "Chest"],
    rows: [["L", "22"]],
  });
  assert.deepEqual(parseSizeTable("| Size | Chest |\n| XL | 24 |"), {
    columns: ["Size", "Chest"],
    rows: [["XL", "24"]],
  });
});

test("an empty table has no rows", () => {
  assert.deepEqual(parseSizeTable(""), { columns: [], rows: [] });
  assert.deepEqual(parseSizeTable(null), { columns: [], rows: [] });
});
