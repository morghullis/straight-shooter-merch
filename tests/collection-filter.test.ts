// The collection page's search, filters and sort: built from the products as they are in Shopify,
// and kept in the link.
import assert from "node:assert/strict";
import { test } from "node:test";

import { activeCount, applyFilters, facetsOf, filtersFromParams, filtersToParams, inColor, NO_FILTERS, type Filters } from "../src/lib/catalog/filter";
import type { Product, ProductVariant } from "../src/lib/catalog/types";

const img = { url: "https://cdn.example/x.png", altText: "", width: 1, height: 1 };
const variant = (id: string, color: string | null, size: string | null, availableForSale = true, amount = "30"): ProductVariant => ({
  id,
  title: [color, size].filter(Boolean).join(" / "),
  availableForSale,
  price: { amount, currencyCode: "USD" },
  selectedOptions: [...(color ? [{ name: "Color", value: color }] : []), ...(size ? [{ name: "Size", value: size }] : [])],
});
const product = (handle: string, type: string, variants: ProductVariant[], extra: Partial<Product> = {}): Product => {
  const colors = [...new Set(variants.map((v) => v.selectedOptions.find((o) => o.name === "Color")?.value).filter(Boolean))] as string[];
  const sizes = [...new Set(variants.map((v) => v.selectedOptions.find((o) => o.name === "Size")?.value).filter(Boolean))] as string[];
  return {
    id: handle,
    handle,
    title: handle.replace(/-/g, " "),
    description: "",
    productType: type,
    availableForSale: variants.some((v) => v.availableForSale),
    featuredImage: img,
    images: [img],
    options: [
      ...(colors.length ? [{ id: `${handle}-c`, name: "Color", values: colors }] : []),
      ...(sizes.length ? [{ id: `${handle}-s`, name: "Size", values: sizes }] : []),
    ],
    variants,
    price: { amount: String(Math.min(...variants.map((v) => Number(v.price.amount)))), currencyCode: "USD" },
    collections: [],
    tags: [],
    ...extra,
  };
};

const tee = product("blasphemous-tee", "Tee", [variant("t1", "Black", "S"), variant("t2", "Black", "M", false), variant("t3", "White", "XL")], {
  colors: [{ label: "Black", hex: "#000000" }, { label: "White", hex: "#ffffff" }],
  collectionLabel: "Stephen A. Smith",
  description: "Bold lettering, like a hoodie's",
  tags: ["featured", "hoodie"],
  audience: ["Unisex"],
});
const hoodie = product("blasphemous-hoodie", "Hoodie", [variant("h1", "Black", "M", true, "60"), variant("h2", "Black", "L", true, "64")]);
const hat = product("blasphemous-hat", "Hat", [variant("c1", null, null, true, "35")], { colors: [{ label: "Black", hex: "#000000" }] });
const tumbler = product("culture-tumbler", "Drinkware", [variant("d1", "White", null, false, "29.99")], { title: "Culture Table Café Tumbler" });
const all = [tee, hoodie, hat, tumbler];
const f = (patch: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...patch });
const handles = (list: Product[]) => list.map((p) => p.handle);

test("facets come from the products: types in Shopify order, colours with swatches, sizes S to XL", () => {
  const facets = facetsOf(all);
  assert.deepEqual(facets.types, ["Tee", "Hoodie", "Hat", "Drinkware"]);
  assert.deepEqual(facets.colors.map((c) => [c.label, c.hex]), [["Black", "#000000"], ["White", "#ffffff"]]);
  assert.deepEqual(facets.sizes, ["S", "M", "L", "XL"]);
});

test("no filters: everything, in Shopify's order", () => {
  assert.deepEqual(handles(applyFilters(all, NO_FILTERS)), ["blasphemous-tee", "blasphemous-hoodie", "blasphemous-hat", "culture-tumbler"]);
});

test("search: every word must match the name, category, show, colour or audience, ignoring case and accents", () => {
  assert.deepEqual(handles(applyFilters(all, f({ q: "BLASPHEMOUS hoodie" }))), ["blasphemous-hoodie"]);
  assert.deepEqual(handles(applyFilters(all, f({ q: "hoodie" }))), ["blasphemous-hoodie"], "not the tee tagged or described as hoodie");
  assert.deepEqual(handles(applyFilters(all, f({ q: "stephen" }))), ["blasphemous-tee"], "by its show");
  assert.deepEqual(handles(applyFilters(all, f({ q: "cafe" }))), ["culture-tumbler"], "accents ignored");
  assert.deepEqual(handles(applyFilters(all, f({ q: "white" }))), ["blasphemous-tee", "culture-tumbler"], "by colour");
  assert.deepEqual(handles(applyFilters(all, f({ q: "unisex tee" }))), ["blasphemous-tee"], "by audience and category");
  assert.deepEqual(handles(applyFilters(all, f({ q: "nothing-like-this" }))), []);
});

test("category, colour and size combine on real variants", () => {
  assert.deepEqual(handles(applyFilters(all, f({ types: ["Tee", "Hat"] }))), ["blasphemous-tee", "blasphemous-hat"]);
  assert.deepEqual(handles(applyFilters(all, f({ colors: ["White"] }))), ["blasphemous-tee", "culture-tumbler"]);
  assert.deepEqual(handles(applyFilters(all, f({ colors: ["Black"] }))), ["blasphemous-tee", "blasphemous-hoodie", "blasphemous-hat"], "the hat by its category colour");
  assert.deepEqual(handles(applyFilters(all, f({ colors: ["White"], sizes: ["S"] }))), [], "the tee is white only in XL");
  assert.deepEqual(handles(applyFilters(all, f({ sizes: ["M"] }))), ["blasphemous-tee", "blasphemous-hoodie"]);
});

test("in stock only: the variant itself must be available", () => {
  assert.deepEqual(handles(applyFilters(all, f({ inStock: true }))), ["blasphemous-tee", "blasphemous-hoodie", "blasphemous-hat"]);
  assert.deepEqual(handles(applyFilters(all, f({ inStock: true, sizes: ["M"] }))), ["blasphemous-hoodie"], "the tee's M is sold out");
});

test("sort by price and name; Shopify's order by default", () => {
  assert.deepEqual(handles(applyFilters(all, f({ sort: "price-asc" }))), ["culture-tumbler", "blasphemous-tee", "blasphemous-hat", "blasphemous-hoodie"]);
  assert.deepEqual(handles(applyFilters(all, f({ sort: "price-desc" }))), ["blasphemous-hoodie", "blasphemous-hat", "blasphemous-tee", "culture-tumbler"]);
  assert.deepEqual(handles(applyFilters(all, f({ sort: "title" })))[0], "blasphemous-hat");
});

test("filters round-trip through the link, and bad values are ignored", () => {
  const chosen = f({ q: "tee", types: ["Tee"], colors: ["Black", "White"], sizes: ["M"], inStock: true, sort: "price-desc" });
  const params = filtersToParams(chosen);
  assert.equal(params.toString(), "q=tee&type=Tee&color=Black%2CWhite&size=M&stock=1&sort=price-desc");
  assert.deepEqual(filtersFromParams(params), chosen);
  assert.equal(filtersToParams(NO_FILTERS).toString(), "", "a clean page has a clean address");
  assert.deepEqual(filtersFromParams(new URLSearchParams("sort=evil&stock=yes")), NO_FILTERS);
  assert.equal(filtersFromParams(new URLSearchParams(`q=${"x".repeat(500)}`)).q.length, 80);
  assert.equal(activeCount(chosen), 5);
});

test("filtered by colour, a card shows and opens that colour", () => {
  const white = { url: "https://cdn.example/white.png?v=2", altText: "white", width: 1, height: 1 };
  const shirt = { ...tee, images: [img, { ...white, url: "https://cdn.example/white.png?v=1" }], variants: tee.variants.map((v) => (v.id === "t3" ? { ...v, image: white } : v)) };
  const { product, variantId } = inColor(shirt, ["White"]);
  assert.equal(variantId, "t3");
  assert.equal(product.featuredImage.url, white.url);
  assert.equal(product.images.length, 2, "the same picture is not shown twice");
  assert.deepEqual(inColor(shirt, []), { product: shirt, variantId: null }, "no colour filter: unchanged");
  assert.equal(inColor(hoodie, ["White"]).variantId, null, "not made in white: unchanged");
});

