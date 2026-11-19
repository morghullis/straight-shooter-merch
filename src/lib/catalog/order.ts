import type { Product } from "./types";

/**
 * How the site orders products. Shopify decides: the order the merchant gives the "Shop All"
 * collection in the admin is the site's order everywhere; these helpers only group or filter it.
 * Pure functions (no fetching), so they are tested on their own (tests/catalog-order.test.ts).
 */

/** Products in Shopify's order (`ordered`), then any listed product missing from it (`all`, its own order). */
export function inShopifyOrder(ordered: Product[], all: Product[]): Product[] {
  if (!ordered.length) return all;
  const seen = new Set(ordered.map((p) => p.handle));
  return [...ordered, ...all.filter((p) => !seen.has(p.handle))];
}

const category = (p: Product) => (p.productType || "other").trim().toLowerCase();

/** Made for women only (Shopify's "Target gender": female, without unisex). */
export function isWomens(p: Product): boolean {
  const a = (p.audience ?? []).map((x) => x.toLowerCase());
  return a.length > 0 && a.every((x) => x.startsWith("women") || x === "female");
}

/**
 * Featured products: the ones tagged `featured`, in Shopify's order, grouped by category (each
 * category where its first product sits in Shopify's order), categories with women's pieces after
 * the rest.
 * Without enough tagged products, every product is taken.
 */
export function featuredOrder(products: Product[], limit: number): Product[] {
  const tagged = products.filter((p) => p.tags.some((t) => t.toLowerCase() === "featured"));
  const pool = tagged.length >= limit ? tagged : products;

  const groups = new Map<string, Product[]>();
  for (const p of pool) {
    const key = category(p);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const ordered = [...groups.values()];
  // A category with any women's piece (crop tops) counts as women's, even where a product's
  // "Target gender" field was left out in Shopify.
  const womens = (g: Product[]) => (g.some(isWomens) ? 1 : 0);
  ordered.sort((a, b) => womens(a) - womens(b)); // stable: Shopify's order otherwise
  return ordered.flat().slice(0, limit);
}

/**
 * The showroom: one product for each of `categories` (Shopify product types, in that order). A
 * product tagged `showroom` stands for its category; otherwise the first in `ranked` (the most
 * engaged-with). Products tagged `no-showroom` or without a 3D model never show.
 */
export function showroomPicks(ranked: Product[], categories: readonly string[]): Product[] {
  const has = (p: Product, tag: string) => p.tags.some((t) => t.toLowerCase() === tag);
  const eligible = ranked.filter((p) => p.model3d && !has(p, "no-showroom"));
  return categories.flatMap((wanted) => {
    const inCategory = eligible.filter((p) => category(p) === wanted.trim().toLowerCase());
    const pick = inCategory.find((p) => has(p, "showroom")) ?? inCategory[0];
    return pick ? [pick] : [];
  });
}
