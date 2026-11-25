// What is already on offer stays out of the coupon codes, and comes back when its discount ends.
import assert from "node:assert/strict";
import { test } from "node:test";

import { AUTO_TAG, ELIGIBLE, MANUAL_TAG, tagChanges } from "../tools/pipeline/lib/coupon-scope.mjs";

const p = (handle: string, ...tags: string[]) => ({ id: handle, handle, tags });
const names = (l: { handle: string }[]) => l.map((x) => x.handle);

test("discounted products get the tag, the others lose it", () => {
  const c = tagChanges([p("tee"), p("hat", AUTO_TAG), p("mug", "Auto-Discounted"), p("hoodie", "featured")], ["tee", "hat"]);
  assert.deepEqual(names(c.add), ["tee"]);
  assert.deepEqual(names(c.remove), ["mug"], "whatever the case of the tag");
});

test("a product kept out by hand is not touched", () => {
  assert.deepEqual(tagChanges([p("tee", MANUAL_TAG)], []), { add: [], remove: [] });
});

test("the collection leaves out both tags and anything with a compare-at price", () => {
  assert.deepEqual(ELIGIBLE.rules.map((r: { column: string; relation: string; condition: string }) => [r.column, r.relation, r.condition]), [
    ["TAG", "NOT_EQUALS", "no-coupon"],
    ["TAG", "NOT_EQUALS", "auto-discounted"],
    ["IS_PRICE_REDUCED", "IS_NOT_SET", ""],
  ]);
});
