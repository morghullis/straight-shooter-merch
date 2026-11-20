import { cacheLife, cacheTag } from "next/cache";

import { catalogOrder, home } from "@/config/site";
import { isSafeHandle, normalizeQuery } from "@/lib/format";
import { getPopularity } from "@/lib/popularity";

import { allCollection, mockCollections, mockProducts } from "./mock";
import { searchText } from "./filter";
import { featuredOrder, inShopifyOrder, showroomPicks } from "./order";
import { rankSearch, toSearchItem, type SearchItem } from "./search";
import {
  fetchCollectionProducts,
  fetchCollections,
  fetchProduct,
  fetchProductHandles,
  fetchProducts,
  isShopifyConfigured,
} from "./shopify";
import type { Collection, Product } from "./types";

export type { Collection, Product, ProductColor, ProductDetails } from "./types";

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
  cacheLife("catalog");
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

/**
 * One collection and its products, in one request to Shopify. Everything about a collection (its
 * page, its products, the site's order) reads from this single cached answer: two cached functions
 * asking Shopify for the same thing at once would wait on each other (Next refuses a cached
 * function awaiting a request started by another).
 */
async function getCollectionData(handle: string): Promise<{ collection: Collection; products: Product[] } | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag("collections", "products", `collection:${handle}`);

  if (isShopifyConfigured) return fetchCollectionProducts(handle).catch(() => null);
  const collection = mockCollections.find((c) => c.handle === handle);
  return collection ? { collection, products: mockProducts.filter((p) => p.collections.includes(handle)) } : null;
}

/** Every listed product in Shopify's order: the "Shop All" collection as sorted in the admin, then anything not in it. */
async function getAllProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products", "collections");

  if (!isShopifyConfigured) return mockProducts;
  const [ordered, everything] = await Promise.all([getCollectionData(catalogOrder.collection), fetchProducts()]);
  return inShopifyOrder(ordered?.products ?? [], everything);
}

async function getProductsIn(collection: string): Promise<Product[]> {
  if (!collection || collection === "all") return getAllProducts();
  return (await getCollectionData(collection))?.products ?? [];
}

export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products");

  // Tagged `featured` in Shopify, in Shopify's order, grouped by category, women's last.
  return featuredOrder(await getProducts(), limit);
}

/**
 * Every listed product, the ones shoppers engage with most first: page views and adds to the cart
 * over the last month (see `popularity.ts`). Ties, and the time before there is any data, keep the
 * catalog's own order (best selling, with Shopify).
 */
export async function getProductsByEngagement(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products", "popularity");

  const [all, popularity] = await Promise.all([getProducts(), getPopularity()]);
  return all
    .map((p, i) => ({ p, i, score: popularity.get(p.handle) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ p }) => p);
}

/**
 * The showroom's products: one per product type in `home.showroomTypes` (hoodie, cap, tee), in that
 * order, among those with a 3D model. A product tagged `showroom` in Shopify stands for its type;
 * otherwise the one shoppers engage with most. One tagged `no-showroom` never shows.
 */
export async function getShowroomProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products", "popularity");

  return showroomPicks(await getProductsByEngagement(), home.showroomTypes);
}

export async function getProduct(handle: string): Promise<Product | null> {
  if (!isSafeHandle(handle)) return null;
  if (await isKnownProduct(handle)) return getKnownProduct(handle);
  // Not in the listings: it may still be "unlisted" in Shopify (hidden from collections and search
  // but open by its link), so ask the store. The answer is only kept for minutes, so random URLs
  // cannot pile up cache entries.
  return isShopifyConfigured ? getUnlistedProduct(handle) : null;
}

async function getUnlistedProduct(handle: string): Promise<Product | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products", `product:${handle}`);

  return fetchProduct(handle);
}

async function getKnownProduct(handle: string): Promise<Product | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products", `product:${handle}`);

  if (isShopifyConfigured) return fetchProduct(handle);
  return mockProducts.find((p) => p.handle === handle) ?? null;
}

/** "Shop all", then the store's collections by their `position` (then title). */
export async function getCollections(): Promise<Collection[]> {
  "use cache";
  cacheLife("catalog");
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
  if (handle === "all") return allCollection;
  return (await getCollectionData(handle))?.collection ?? null;
}

/**
 * The store search (the /search page): every listed product matching all the words in its name,
 * category, show, colours or audience, best match first; the header's instant results use the same
 * ranking (lib/catalog/search.ts), so both always agree.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const q = normalizeQuery(query);
  if (!q) return [];
  return rankSearch(await getProducts(), q, (p) => ({ title: p.title, text: searchText(p) }));
}

/** Every listed product as a small search entry, for the header's instant results. */
export async function getSearchIndex(): Promise<SearchItem[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products", "collections");

  return (await getProducts()).map((p) => toSearchItem(p));
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products");

  const all = await getProducts();
  const others = all.filter((p) => p.handle !== product.handle);
  const sameCollection = others.filter((p) =>
    p.collections.some((c) => product.collections.includes(c)),
  );
  const rest = others.filter((p) => !sameCollection.includes(p));
  return [...sameCollection, ...rest].slice(0, limit);
}
