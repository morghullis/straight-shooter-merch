// The store search ranks the best match first and agrees everywhere (header instant results and
// the /search page use the same functions).
import assert from "node:assert/strict";
import { test } from "node:test";

import { highlight, matchScore, queryWords, rankSearch, toSearchItem } from "../src/lib/catalog/search";
import type { Product } from "../src/lib/catalog/types";

const img = { url: "https://cdn.example/x.png", altText: "", width: 1, height: 1 };
const product = (handle: string, title: string, productType: string, extra: Partial<Product> = {}): Product => ({
  id: handle,
  handle,
  title,
  description: "",
  productType,
  availableForSale: true,
  featuredImage: img,
  images: [img],
  options: [],
  variants: [],
  price: { amount: "34.99", currencyCode: "USD" },
  collections: [],
  tags: [],
  ...extra,
});

const catalog = [
  product("blasphemous-tee", "Blasphemous! T Shirt", "Tee", { collectionLabel: "Stephen A. Smith", tags: ["hoodie"] }),
  product("stay-off", "Stay Off The WEED - T Shirt", "Tee", { collectionLabel: "Stephen A. Smith" }),
  product("hoodie", "Blasphemous! Hoodie", "Hoodie", { collectionLabel: "Stephen A. Smith" }),
  product("edible", "I’m not above an Edible", "Crop Tee", { collectionLabel: "Culture Table", audience: ["Women's"] }),
  product("tumbler", "Culture Table Tumbler", "Drinkware", { collectionLabel: "Culture Table" }),
];
const items = catalog.map((p) => toSearchItem(p));
const handles = (list: { handle: string }[]) => list.map((i) => i.handle);
const search = (q: string) => handles(rankSearch(items, q, (i) => ({ title: i.title, text: i.text })));

test("every word must match; a tag alone never does", () => {
  assert.deepEqual(search("hoodie"), ["hoodie"], "the tee tagged hoodie stays out");
  assert.deepEqual(search("blasphemous hoodie"), ["hoodie"]);
  assert.deepEqual(search("nothing like this"), []);
  assert.deepEqual(search("   "), []);
});

test("best match first: title start, then a title word, then elsewhere; ties keep Shopify's order", () => {
  // "culture": the tumbler's title starts with it; the edible crop only has it in its show.
  assert.deepEqual(search("culture"), ["tumbler", "edible"]);
  // "tee": the category of both tees (no title word starts with it), in Shopify order.
  assert.deepEqual(search("tee"), ["blasphemous-tee", "stay-off", "edible"]);
  // "t shirt": both titles contain the words.
  assert.deepEqual(search("shirt"), ["blasphemous-tee", "stay-off"]);
  assert.ok(matchScore("Blasphemous! Hoodie", "blasphemous! hoodie hoodie", queryWords("blas")) > matchScore("Culture Table Tumbler", "culture table tumbler blasphemous", queryWords("blas")));
});

test("matching ignores case and accents", () => {
  assert.deepEqual(search("EDIBLE"), ["edible"]);
  assert.deepEqual(search("women"), ["edible"], "by audience");
});

test("search entries carry the show and Women's label, price and picture", () => {
  const edible = items.find((i) => i.handle === "edible");
  assert.equal(edible?.label, "Culture Table · Women's");
  assert.equal(edible?.price.amount, "34.99");
  assert.equal(edible?.image.alt, "I’m not above an Edible");
});

test("highlight marks the typed words, case-insensitively, and is safe with symbols", () => {
  assert.deepEqual(highlight("Blasphemous! Hoodie", "hood"), [
    { text: "Blasphemous! ", match: false },
    { text: "Hood", match: true },
    { text: "ie", match: false },
  ]);
  assert.deepEqual(highlight("Stay Off", ""), [{ text: "Stay Off", match: false }]);
  assert.doesNotThrow(() => highlight("A (B) C", "(b) [x"));
});
