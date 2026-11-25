// The site never works out a discount: it shows what Shopify's cart says. These are the cases that
// would put a wrong price on a page (a discount that needs more than one unit, one for the whole order,
// one that only covers some variants, a product already on sale).
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  estimateOf,
  percentOff,
  quoteOf,
  saleOf,
  toConfirm,
  unitDiscount,
  withDiscounts,
  type LineDiscount,
  type PricedLine,
} from "../src/lib/catalog/discounts";
import type { Product, ProductVariant } from "../src/lib/catalog/types";
import { listPrice } from "../src/lib/catalog/variants";

const usd = (amount: string) => ({ amount, currencyCode: "USD" });
const off = (amount: number, more: Partial<LineDiscount> = {}): LineDiscount => ({ title: "HBCU 10", amount, each: true, lineLevel: true, ...more });
const line = (id: string, subtotal: number, discounts: LineDiscount[] = [], quantity = 1): PricedLine => ({
  variantId: id,
  quantity,
  subtotal,
  currencyCode: "USD",
  discounts,
});
const variant = (id: string, price: string, more: Partial<ProductVariant> = {}): ProductVariant => ({
  id,
  title: id,
  availableForSale: true,
  price: usd(price),
  selectedOptions: [{ name: "Size", value: id }],
  ...more,
});
const product = (variants: ProductVariant[]) => ({ handle: "hoodie", title: "Hoodie", price: variants[0].price, variants }) as Product;

test("a discount on every unit is the price of one", () => {
  assert.deepEqual(unitDiscount(line("a", 34.99, [off(3.49)])), { price: usd("31.50"), title: "HBCU 10" });
  assert.deepEqual(unitDiscount(line("a", 69.98, [off(6.99)], 2)), { price: usd("31.50"), title: "HBCU 10" }, "two units, per unit");
  assert.equal(unitDiscount(line("a", 34.99)), null);
  assert.equal(unitDiscount(line("a", 34.99, [off(0)])), null);
});

test("a discount on the order, or a one-off amount across the cart, is not the price of one unit", () => {
  assert.equal(unitDiscount(line("a", 34.99, [off(3.49, { lineLevel: false })])), null, "order discount");
  assert.equal(unitDiscount(line("a", 34.99, [off(10, { each: false })])), null, "$10 off once, shared by the cart");
});

test("a discount bigger than the price never goes below zero", () => {
  assert.equal(unitDiscount(line("a", 5, [off(8)]))?.price.amount, "0.00");
});

test("variants with the same price and discount are confirmed with one of them", () => {
  const groups = toConfirm([line("s", 59.99, [off(5.99)]), line("m", 59.99, [off(5.99)]), line("4xl", 66.99, [off(6.69)]), line("kid", 59.99)]);
  assert.deepEqual(groups, [
    { variantId: "s", sameAs: ["s", "m"] },
    { variantId: "4xl", sameAs: ["4xl"] },
  ]);
});

test("the product gets the discounted prices, its usual ones as the 'was' price", () => {
  const p = withDiscounts(product([variant("s", "59.99"), variant("4xl", "66.99")]), {
    s: { price: usd("54.00"), title: "HBCU 10" },
    "4xl": { price: usd("60.30"), title: "HBCU 10" },
  });
  assert.deepEqual(p.price, usd("54.00"));
  assert.deepEqual(p.variants[0].compareAtPrice, usd("59.99"));
  assert.deepEqual(p.variants[0].discount, { title: "HBCU 10", regular: usd("59.99") });
  assert.deepEqual(listPrice(p), { price: usd("54.00"), from: true, compareAt: usd("59.99") });
  assert.deepEqual(saleOf(p), { percent: 10, upTo: false });
});

test("applying the discounts twice changes nothing more", () => {
  const discounts = { s: { price: usd("54.00"), title: "HBCU 10" } };
  const once = withDiscounts(product([variant("s", "59.99")]), discounts);
  assert.equal(withDiscounts(once, discounts), once);
});

test("a product without discounts stays as it is", () => {
  const p = product([variant("s", "59.99")]);
  assert.equal(withDiscounts(p, {}), p);
  assert.equal(withDiscounts(p, { other: { price: usd("1.00"), title: "X" } }), p);
  assert.equal(saleOf(p), null);
});

test("only some variants discounted: the label says up to", () => {
  const p = withDiscounts(product([variant("s", "40.00"), variant("m", "40.00")]), { m: { price: usd("30.00"), title: "Size M" } });
  assert.deepEqual(saleOf(p), { percent: 25, upTo: true });
  assert.deepEqual(listPrice(p), { price: usd("30.00"), from: true, compareAt: usd("40.00") });
});

test("a compare-at price and a discount add up: the 'was' price is Shopify's compare-at", () => {
  const p = withDiscounts(product([variant("s", "40.00", { compareAtPrice: usd("50.00") })]), { s: { price: usd("36.00"), title: "Extra 10" } });
  assert.deepEqual(p.variants[0].compareAtPrice, usd("50.00"));
  assert.deepEqual(p.variants[0].discount?.regular, usd("40.00"), "the cart's subtotal is the price without the discount, not the compare-at");
  assert.deepEqual(saleOf(p), { percent: 28, upTo: false });
});

test("a compare-at price alone is a sale too", () => {
  assert.deepEqual(saleOf(product([variant("s", "40.00", { compareAtPrice: usd("50.00") })])), { percent: 20, upTo: false });
  assert.equal(saleOf(product([variant("s", "40.00", { compareAtPrice: usd("40.00") })])), null);
  assert.equal(percentOff(usd("10"), usd("0")), 0);
});

test("the cart: line discounts on their lines, the order's on the total", () => {
  const quote = quoteOf([
    line("hat", 69.98, [off(6.99), off(3.15, { title: "WELCOME", lineLevel: false, each: false })], 2),
    line("mug", 20, [off(1, { title: "WELCOME", lineLevel: false, each: false })]),
  ]);
  assert.deepEqual(quote.lines, {
    hat: { subtotal: 69.98, total: 62.99, discounts: ["HBCU 10"] },
    mug: { subtotal: 20, total: 20, discounts: [] },
  });
  assert.equal(quote.subtotal, 89.98);
  assert.deepEqual(quote.discounts, [
    { title: "HBCU 10", amount: 6.99 },
    { title: "WELCOME", amount: 4.15 },
  ]);
  assert.equal(quote.total, 78.84);
});

test("a line Shopify splits (buy one, get one) shows as one", () => {
  const quote = quoteOf([line("tee", 35), line("tee", 35, [off(35, { title: "BOGO" })])]);
  assert.deepEqual(quote.lines.tee, { subtotal: 70, total: 35, discounts: ["BOGO"] });
  assert.equal(quote.total, 35);
});

test("before Shopify answers, the cart shows the catalog's own prices", () => {
  const quote = estimateOf([
    { variantId: "hat", quantity: 2, price: 31.5, regular: 34.99, discount: "HBCU 10", currency: "USD" },
    { variantId: "mug", quantity: 1, price: 20, currency: "USD" },
  ]);
  assert.deepEqual(quote.lines.hat, { subtotal: 69.98, total: 63, discounts: ["HBCU 10"] });
  assert.deepEqual(quote.discounts, [{ title: "HBCU 10", amount: 6.98 }]);
  assert.equal(quote.total, 83);
  assert.equal(estimateOf([]).total, 0);
});
