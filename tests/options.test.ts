// An option made in Shopify gets its look by itself: photos when each value has its own, dots for
// colours (by name when Shopify has no swatch), text for the rest.
import assert from "node:assert/strict";
import { test } from "node:test";

import { colorByName, isColorOption, productColors } from "../src/lib/catalog/colors";
import { optionPhotos, valuePhoto } from "../src/lib/catalog/options";
import type { Product, ProductVariant } from "../src/lib/catalog/types";

const photo = (name: string) => ({ url: `https://cdn.example/${name}.jpg`, altText: name, width: 1, height: 1 });
const variant = (options: Record<string, string>, image?: string): ProductVariant => ({
  id: JSON.stringify(options),
  title: Object.values(options).join(" / "),
  availableForSale: true,
  price: { amount: "1", currencyCode: "USD" },
  image: image ? photo(image) : null,
  selectedOptions: Object.entries(options).map(([name, value]) => ({ name, value })),
});
const product = (options: Record<string, string[]>, variants: ProductVariant[], more: Partial<Product> = {}) =>
  ({ options: Object.entries(options).map(([name, values]) => ({ id: name, name, values })), variants, ...more }) as Product;

const quotes = product({ Size: ["S", "M"], Quote: ["Rise", "Legacy"] }, [
  variant({ Size: "S", Quote: "Rise" }, "rise"),
  variant({ Size: "M", Quote: "Rise" }, "rise"),
  variant({ Size: "S", Quote: "Legacy" }, "legacy"),
  variant({ Size: "M", Quote: "Legacy" }, "legacy"),
]);

test("an option whose values each have their own photo shows the photos", () => {
  const photos = optionPhotos(quotes, { Size: "S", Quote: "Rise" }, "Quote");
  assert.deepEqual([...(photos ?? [])].map(([v, p]) => [v, p.url]), [
    ["Rise", "https://cdn.example/rise.jpg"],
    ["Legacy", "https://cdn.example/legacy.jpg"],
  ]);
});

test("sizes share a photo, so they stay text", () => {
  assert.equal(optionPhotos(quotes, { Size: "S", Quote: "Rise" }, "Size"), null);
});

test("a value without a photo, or a single value, stays text", () => {
  const some = product({ Design: ["A", "B"] }, [variant({ Design: "A" }, "a"), variant({ Design: "B" })]);
  assert.equal(optionPhotos(some, { Design: "A" }, "Design"), null);
  const one = product({ Design: ["A"] }, [variant({ Design: "A" }, "a")]);
  assert.equal(optionPhotos(one, { Design: "A" }, "Design"), null);
});

test("the photo follows the other choices", () => {
  const p = product({ Color: ["Black", "White"], Design: ["A", "B"] }, [
    variant({ Color: "Black", Design: "A" }, "black-a"),
    variant({ Color: "Black", Design: "B" }, "black-b"),
    variant({ Color: "White", Design: "A" }, "white-a"),
    variant({ Color: "White", Design: "B" }, "white-b"),
  ]);
  assert.equal(valuePhoto(p.variants, { Color: "White", Design: "A" }, "Design", "B")?.altText, "white-b");
  assert.equal(optionPhotos(p, { Color: "White", Design: "A" }, "Color"), null, "colours have their dots");
});

test("a colour Shopify has no swatch for goes by its name", () => {
  assert.equal(colorByName("Navy"), "#1b2a49");
  assert.equal(colorByName("Heather Navy"), "#1b2a49");
  assert.equal(colorByName("Black/White"), colorByName("Black"));
  assert.equal(colorByName("Tie dye"), null);
  assert.equal(colorByName("Geometric"), null);
  assert.ok(isColorOption("Color") && isColorOption(" colour ") && !isColorOption("Size"));
  const p = product({ Color: ["White", "Navy"] }, [], { colors: [{ label: "White", hex: "#FFFFFF" }, { label: "Geometric", hex: null }] });
  assert.deepEqual(productColors(p), [
    { label: "White", hex: "#FFFFFF" },
    { label: "Navy", hex: "#1b2a49" },
  ]);
});
