// Shopify decides the order of products on the site: these check that the helpers keep its order
// and only group or filter it (featured by category with women's last, the showroom's three pieces).
import assert from "node:assert/strict";
import { test } from "node:test";

import { featuredOrder, inShopifyOrder, isWomens, showroomPicks } from "../src/lib/catalog/order";
import type { Product } from "../src/lib/catalog/types";

const img = { url: "https://cdn.example/x.png", altText: "", width: 1, height: 1 };
const product = (handle: string, productType: string, extra: Partial<Product> = {}): Product => ({
  id: handle,
  handle,
  title: handle,
  description: "",
  productType,
  availableForSale: true,
  featuredImage: img,
  images: [img],
  options: [],
  variants: [],
  price: { amount: "1", currencyCode: "USD" },
  collections: [],
  tags: ["featured"],
  model3d: { src: "https://cdn.example/x.glb" },
  ...extra,
});

const handles = (list: Product[]) => list.map((p) => p.handle);

test("Shopify's order first, then products missing from it", () => {
  const all = [product("c", "Tee"), product("a", "Tee"), product("b", "Tee"), product("new", "Tee")];
  const ordered = [product("a", "Tee"), product("b", "Tee"), product("c", "Tee")];
  assert.deepEqual(handles(inShopifyOrder(ordered, all)), ["a", "b", "c", "new"]);
  assert.deepEqual(handles(inShopifyOrder([], all)), ["c", "a", "b", "new"], "no ordering collection: keep the fallback order");
});

test("featured: grouped by category in Shopify's order, women's categories last", () => {
  const women = { audience: ["Women's"] };
  const list = [
    product("crop-1", "Crop Tee", women),
    product("tee-1", "Tee", { audience: ["Unisex"] }),
    product("hoodie-1", "Hoodie"),
    product("tee-2", "Tee"),
    product("crop-2", "Crop Tee"), // its "Target gender" left out in Shopify: still with the crop tops
    product("hat-1", "Hat", { tags: [] }),
  ];
  // Five tagged: enough for five, so the untagged hat stays out.
  assert.deepEqual(handles(featuredOrder(list, 5)), ["tee-1", "tee-2", "hoodie-1", "crop-1", "crop-2"]);
  assert.deepEqual(handles(featuredOrder(list, 3)), ["tee-1", "tee-2", "hoodie-1"]);
  // Six wanted, five tagged: every product, still grouped, women's last.
  assert.deepEqual(handles(featuredOrder(list, 6)), ["tee-1", "tee-2", "hoodie-1", "hat-1", "crop-1", "crop-2"]);
});

test("featured: not enough tagged products takes every product", () => {
  const list = [product("a", "Tee", { tags: [] }), product("b", "Hat", { tags: [] }), product("c", "Tee")];
  assert.deepEqual(handles(featuredOrder(list, 3)), ["a", "c", "b"]);
});

test("women's means made for women only, not unisex", () => {
  assert.equal(isWomens(product("a", "Tee", { audience: ["Women's"] })), true);
  assert.equal(isWomens(product("a", "Tee", { audience: ["Female"] })), true);
  assert.equal(isWomens(product("a", "Tee", { audience: ["Women's", "Unisex"] })), false);
  assert.equal(isWomens(product("a", "Tee", { audience: [] })), false);
  assert.equal(isWomens(product("a", "Tee")), false);
});

test("showroom: one per type in the given order; pinned beats engagement; no-showroom and no 3D never show", () => {
  const ranked = [
    product("tee-popular", "Tee"),
    product("crop", "Crop Tee"),
    product("hoodie-hidden", "Hoodie", { tags: ["no-showroom"] }),
    product("hoodie", "Hoodie"),
    product("tee-pinned", "Tee", { tags: ["showroom"] }),
    product("hat-no-3d", "Hat", { model3d: null }),
    product("hat", "Hat"),
    product("tumbler", "Drinkware"),
  ];
  assert.deepEqual(handles(showroomPicks(ranked, ["Hoodie", "Hat", "Tee"])), ["hoodie", "hat", "tee-pinned"]);
  assert.deepEqual(handles(showroomPicks(ranked, ["Hoodie", "Mug"])), ["hoodie"], "a type with no product is skipped");
});
