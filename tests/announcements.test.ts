// The bar above the navigation says what Shopify says: a collection's own messages, its current discount
// in place of {discount}, and nothing about a discount that has ended.
import assert from "node:assert/strict";
import { test } from "node:test";

import { announcementsOf, listSale } from "../src/lib/catalog/announcements";
import type { Collection, Product, ProductVariant } from "../src/lib/catalog/types";

const usd = (amount: string) => ({ amount, currencyCode: "USD" });
const variant = (price: string, was?: string): ProductVariant => ({
  id: `${price}-${was}`,
  title: "S",
  availableForSale: true,
  price: usd(price),
  compareAtPrice: was ? usd(was) : null,
  selectedOptions: [],
});
const product = (price: string, was?: string, availableForSale = true) => ({ availableForSale, variants: [variant(price, was)] }) as Pick<Product, "availableForSale" | "variants">;
const collection = (handle: string, more: Partial<Collection> = {}): Collection => ({ handle, title: handle, description: "", ...more });

const off10 = product("90", "100");
const off20 = product("80", "100");
const full = product("100");
const texts = (list: { text: string }[]) => list.map((m) => m.text);

test("a list's discount: the same on everything, or up to the biggest", () => {
  assert.deepEqual(listSale([off10, off10]), { percent: 10, upTo: false, all: true });
  assert.deepEqual(listSale([off10, off20]), { percent: 20, upTo: true, all: true });
  assert.deepEqual(listSale([off10, full]), { percent: 10, upTo: true, all: false });
  assert.equal(listSale([full]), null);
  assert.equal(listSale([]), null);
  assert.deepEqual(listSale([off10, product("100", undefined, false)]), { percent: 10, upTo: false, all: true }, "sold-out products do not count");
});

test("a collection's own messages link to it", () => {
  const list = [{ collection: collection("shop-all", { announcements: ["Free shipping on orders of $99 or more"] }), products: [full] }];
  assert.deepEqual(announcementsOf(list, "shop-all"), [{ text: "Free shipping on orders of $99 or more", href: "/collections/shop-all" }]);
});

test("{discount} is the collection's discount now, and the message hides when it ends", () => {
  const hbcu = collection("hbcu-life", { announcements: ["{discount} all HBCU"] });
  assert.deepEqual(texts(announcementsOf([{ collection: hbcu, products: [off10] }], "shop-all")), ["10% off all HBCU"]);
  assert.deepEqual(texts(announcementsOf([{ collection: hbcu, products: [off10, off20] }], "shop-all")), ["Up to 20% off all HBCU"]);
  assert.deepEqual(announcementsOf([{ collection: hbcu, products: [full] }], "shop-all"), [], "no discount, no message (and no made-up one)");
});

test("without its own message, a collection on sale in full announces itself", () => {
  const list = [
    { collection: collection("shop-all"), products: [off10, full] },
    { collection: collection("hbcu-life", { title: "HBCU Life" }), products: [off10] },
    { collection: collection("show", { shortTitle: "The Show" }), products: [off10, full] },
  ];
  assert.deepEqual(announcementsOf(list, "shop-all"), [{ text: "10% off all HBCU Life", href: "/collections/hbcu-life" }]);
});

test("the whole store on sale is one message", () => {
  const list = [
    { collection: collection("shop-all"), products: [off10, off10] },
    { collection: collection("hbcu-life"), products: [off10] },
  ];
  assert.deepEqual(texts(announcementsOf(list, "shop-all")), ["10% off everything"]);
});

test("the same message twice shows once", () => {
  const list = [
    { collection: collection("a", { announcements: ["Free shipping"] }), products: [full] },
    { collection: collection("b", { announcements: ["FREE SHIPPING"] }), products: [full] },
  ];
  assert.equal(announcementsOf(list, "shop-all").length, 1);
});
