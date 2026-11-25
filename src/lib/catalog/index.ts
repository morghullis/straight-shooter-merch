import { cacheLife, cacheTag } from "next/cache";

import { catalogOrder, home } from "@/config/site";
import { isSafeHandle, normalizeQuery } from "@/lib/format";
import { getPopularity } from "@/lib/popularity";

import { announcementsOf, listSale, type Announcement, type Sale } from "./announcements";
import { withDiscounts, type Discounts } from "./discounts";
import { allCollection, mockCollections, mockProducts } from "./mock";
import { searchText } from "./filter";
import { featuredOrder, inShopifyOrder, showroomPicks } from "./order";
import { rankSearch, toSearchItem, type SearchItem } from "./search";
import {
  fetchCollectionProducts,
  fetchCollections,
  fetchDiscounts,
  fetchDiscountStickers,
  fetchProduct,
  fetchProductHandles,
  fetchProducts,
  fetchSellableVariants,
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

/**
 * What each discounted variant costs today with Shopify's automatic discounts. When Shopify cannot
 * say, the usual prices show (never less than what checkout would charge).
 */
export async function getDiscounts(): Promise<Discounts> {
  "use cache";
  cacheTag("discounts", "products");

  if (!isShopifyConfigured) {
    cacheLife("catalog");
    return {};
  }
  try {
    const [discounts, stickers] = await Promise.all([fetchSellableVariants().then(fetchDiscounts), fetchDiscountStickers().catch(() => ({}) as Record<string, string>)]);
    for (const d of Object.values(discounts)) d.sticker = stickers[d.title] ?? null;
    cacheLife("catalog");
    return discounts;
  } catch (error) {
    // Asked again soon: this answer is only a stand-in.
    cacheLife({ stale: 30, revalidate: 10, expire: 86400 });
    console.warn(`[discounts] usual prices shown: ${error instanceof Error ? `${error.message} (${String(error.cause ?? "no cause")})` : error}`);
    return {};
  }
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
  cacheTag("collections", "products", "discounts", `collection:${handle}`);

  if (isShopifyConfigured) {
    const [data, discounts] = await Promise.all([fetchCollectionProducts(handle).catch(() => null), getDiscounts()]);
    return data && { ...data, products: data.products.map((p) => withDiscounts(p, discounts)) };
  }
  const collection = mockCollections.find((c) => c.handle === handle);
  return collection ? { collection, products: mockProducts.filter((p) => p.collections.includes(handle)) } : null;
}

/** Every listed product in Shopify's order: the "Shop All" collection as sorted in the admin, then anything not in it. */
async function getAllProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products", "collections", "discounts");

  if (!isShopifyConfigured) return mockProducts;
  const [ordered, everything, discounts] = await Promise.all([getCollectionData(catalogOrder.collection), fetchProducts(), getDiscounts()]);
  return inShopifyOrder(ordered?.products ?? [], everything.map((p) => withDiscounts(p, discounts)));
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
  cacheTag("products", "discounts", `product:${handle}`);

  const product = await fetchProduct(handle);
  if (!product) return null;
  // An unlisted product is not in the store's listings, so its discounts are asked for here.
  const sellable = product.variants.filter((v) => v.availableForSale).map((v) => v.id);
  return withDiscounts(product, await fetchDiscounts([sellable]).catch(() => ({})));
}

async function getKnownProduct(handle: string): Promise<Product | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products", "discounts", `product:${handle}`);

  if (isShopifyConfigured) {
    const [product, discounts] = await Promise.all([fetchProduct(handle), getDiscounts()]);
    return product && withDiscounts(product, discounts);
  }
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

/** The discounts on now: the products each covers, and a photo of one (the asset pipeline makes their stickers from it, and keeps those products out of the coupons). */
export async function getActiveDiscounts(): Promise<{ title: string; image: string; products: string[] }[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("products", "discounts");

  const found = new Map<string, { image: string; products: Set<string> }>();
  for (const p of await getProducts()) {
    for (const v of p.variants) {
      if (!v.discount?.title) continue;
      const entry = found.get(v.discount.title) ?? { image: (v.image ?? p.featuredImage).url, products: new Set<string>() };
      entry.products.add(p.handle);
      found.set(v.discount.title, entry);
    }
  }
  return [...found].map(([title, { image, products }]) => ({ title, image, products: [...products] }));
}

/** The messages of the bar above the navigation, from Shopify (see announcements.ts). */
export async function getAnnouncements(): Promise<Announcement[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("collections", "products", "discounts");

  const collections = (await getCollections()).filter((c) => c.handle !== "all");
  const list = await Promise.all(collections.map(async (collection) => ({ collection, products: await getProductsIn(collection.handle) })));
  return announcementsOf(list, catalogOrder.collection);
}

/** The collections with a slide in the home hero, in their order, with the discount they have now. */
export async function getHeroSlides(): Promise<{ collection: Collection; sale: Sale | null }[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("collections", "products", "discounts");

  const collections = (await getCollections()).filter((c) => c.hero);
  return Promise.all(collections.map(async (collection) => ({ collection, sale: listSale(await getProductsIn(collection.handle)) })));
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
