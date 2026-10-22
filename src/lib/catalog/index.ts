import { cacheLife, cacheTag } from "next/cache";

import { isSafeHandle, normalizeQuery } from "@/lib/format";
import { getPopularity } from "@/lib/popularity";

import { allCollection, mockCollections, mockProducts } from "./mock";
import {
  fetchCollectionProducts,
  fetchCollections,
  fetchProduct,
  fetchProductHandles,
  fetchProducts,
  isShopifyConfigured,
} from "./shopify";
import type { Collection, Product } from "./types";

export type { Collection, Product } from "./types";

/**
 * Data access used by every page. All functions are cached with the Cache
 * Components model; call `revalidateTag("products")` (e.g. from a Shopify
 * webhook route) to refresh after catalog changes.
 *
 * Anything keyed by a value from the URL (a product or collection handle, a search
 * term) is checked or normalised BEFORE it reaches a cache entry or Shopify, so random
 * URLs cannot create unbounded cache entries or upstream requests.
 */

/** Every product handle in the catalog. */
async function getProductHandles(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  if (isShopifyConfigured) return fetchProductHandles();
  return mockProducts.map((p) => p.handle);
}

export async function isKnownProduct(handle: string): Promise<boolean> {
  return isSafeHandle(handle) && (await getProductHandles()).includes(handle);
}

async function isKnownCollection(handle: string): Promise<boolean> {
  return isSafeHandle(handle) && (await getCollections()).some((c) => c.handle === handle);
}

export async function getProducts(opts: { collection?: string } = {}): Promise<Product[]> {
  const collection = opts.collection ?? "all";
  if (collection !== "all" && !(await isKnownCollection(collection))) return [];
  return getProductsIn(collection);
}

async function getProductsIn(collection: string): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  if (isShopifyConfigured) {
    if (!collection || collection === "all") return fetchProducts();
    const result = await fetchCollectionProducts(collection);
    return result?.products ?? [];
  }

  if (!collection || collection === "all") return mockProducts;
  return mockProducts.filter((p) => p.collections.includes(collection));
}

export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  const all = await getProducts();
  const featured = all.filter((p) => p.tags.includes("featured"));
  return (featured.length >= limit ? featured : all).slice(0, limit);
}

const hasTag = (p: Product, tag: string) => p.tags.some((t) => t.toLowerCase() === tag);

/**
 * The showroom's products, among those with a 3D model: the ones tagged `showroom` in Shopify
 * first, then the ones shoppers engage with most (page views and adds to the cart over the last
 * month, see `popularity.ts`). Tagged `no-showroom` never shows. Ties, and the time before there is
 * any data, keep the catalog's own order (best selling, with Shopify).
 */
export async function getShowroomProducts(limit = 4): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products", "popularity");

  const [all, popularity] = await Promise.all([getProducts(), getPopularity()]);
  return all
    .filter((p) => p.model3d && !hasTag(p, "no-showroom"))
    .map((p, i) => ({ p, i, pinned: hasTag(p, "showroom") ? 1 : 0, score: popularity.get(p.handle) ?? 0 }))
    .sort((a, b) => b.pinned - a.pinned || b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map(({ p }) => p);
}

export async function getProduct(handle: string): Promise<Product | null> {
  if (!(await isKnownProduct(handle))) return null;
  return getKnownProduct(handle);
}

async function getKnownProduct(handle: string): Promise<Product | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("products", `product:${handle}`);

  if (isShopifyConfigured) return fetchProduct(handle);
  return mockProducts.find((p) => p.handle === handle) ?? null;
}

/** "Shop all", then the store's collections by their `position` (then title). */
export async function getCollections(): Promise<Collection[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("collections");

  if (!isShopifyConfigured) return mockCollections;
  const remote = (await fetchCollections()).filter((c) => c.handle !== "all");
  remote.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.title.localeCompare(b.title));
  return [allCollection, ...remote];
}

export async function getCollection(handle: string): Promise<Collection | null> {
  if (handle !== "all" && !(await isKnownCollection(handle))) return null;
  return getKnownCollection(handle);
}

async function getKnownCollection(handle: string): Promise<Collection | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("collections", `collection:${handle}`);

  if (handle === "all") return allCollection;

  if (isShopifyConfigured) {
    const result = await fetchCollectionProducts(handle);
    return result?.collection ?? null;
  }
  return mockCollections.find((c) => c.handle === handle) ?? null;
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = normalizeQuery(query);
  if (!q) return [];
  return searchNormalized(q);
}

async function searchNormalized(q: string): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");

  if (isShopifyConfigured) return fetchProducts(q, 24);

  const needle = q;
  return mockProducts.filter(
    (p) =>
      p.title.toLowerCase().includes(needle) ||
      p.description.toLowerCase().includes(needle) ||
      p.tags.some((t) => t.toLowerCase().includes(needle)),
  );
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  const all = await getProducts();
  const others = all.filter((p) => p.handle !== product.handle);
  const sameCollection = others.filter((p) =>
    p.collections.some((c) => product.collections.includes(c)),
  );
  const rest = others.filter((p) => !sameCollection.includes(p));
  return [...sameCollection, ...rest].slice(0, limit);
}
