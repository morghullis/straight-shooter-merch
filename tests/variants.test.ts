// Picking a variant must always land on something Shopify sells: these are the cases the buy box
// meets (a colour not made in every size, sold-out sizes, links to a variant, sale prices).
import assert from "node:assert/strict";
import { test } from "node:test";

import type { ProductVariant } from "../src/lib/catalog/types";
import { initialVariant, isAvailable, matches, numericId, onSale, pick, selectionOf } from "../src/lib/catalog/variants";

const v = (id: number, color: string, size: string, availableForSale = true): ProductVariant => ({
  id: `gid://shopify/ProductVariant/${id}`,
  title: `${color} / ${size}`,
  availableForSale,
  price: { amount: "34.99", currencyCode: "USD" },
  selectedOptions: [
    { name: "Color", value: color },
    { name: "Size", value: size },
  ],
});

// Black in S, M (M sold out), L; White only in S and M.
const variants = [v(1, "Black", "S"), v(2, "Black", "M", false), v(3, "Black", "L"), v(4, "White", "S"), v(5, "White", "M")];

test("starts on the first variant in stock, or the one in the link", () => {
  assert.equal(initialVariant(variants)?.id, variants[0].id);
  assert.equal(initialVariant([v(9, "Red", "S", false), v(10, "Red", "M")])?.id, "gid://shopify/ProductVariant/10");
  assert.equal(initialVariant(variants, "5")?.id, variants[4].id, "?variant=5 (Shopify's numeric id)");
  assert.equal(initialVariant(variants, "gid://shopify/ProductVariant/3")?.id, variants[2].id);
  assert.equal(initialVariant(variants, "999")?.id, variants[0].id, "an unknown id falls back");
  assert.equal(initialVariant([]), undefined);
});

test("picking an existing combination keeps it, even sold out", () => {
  const black = selectionOf(variants[0]);
  assert.deepEqual(pick(variants, black, "Size", "L"), { Color: "Black", Size: "L" });
  assert.deepEqual(pick(variants, black, "Size", "M"), { Color: "Black", Size: "M" }, "the button then says Sold out");
});

test("picking a colour not made in the current size moves to the closest variant in stock", () => {
  const blackL = selectionOf(variants[2]);
  const next = pick(variants, blackL, "Color", "White");
  assert.equal(next.Color, "White");
  assert.ok(variants.some((x) => matches(x, next) && x.availableForSale), `landed on ${JSON.stringify(next)}`);
});

test("a value is offered as available only if some variant with the other choices is in stock", () => {
  const black = selectionOf(variants[0]);
  assert.equal(isAvailable(variants, black, "Size", "S"), true);
  assert.equal(isAvailable(variants, black, "Size", "M"), false, "Black M is sold out");
  assert.equal(isAvailable(variants, black, "Size", "XL"), false, "not made");
  assert.equal(isAvailable(variants, selectionOf(variants[4]), "Size", "L"), false, "White L does not exist");
});

test("numeric ids and sale prices", () => {
  assert.equal(numericId("gid://shopify/ProductVariant/42"), "42");
  assert.equal(onSale({ amount: "30" }, { amount: "40" }), true);
  assert.equal(onSale({ amount: "40" }, { amount: "40" }), false);
  assert.equal(onSale({ amount: "40" }, { amount: "30" }), false);
  assert.equal(onSale({ amount: "40" }, null), false);
});
