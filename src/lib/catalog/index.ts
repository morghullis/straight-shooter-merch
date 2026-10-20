import { cacheLife, cacheTag } from "next/cache";

import { mockCollections, mockProducts } from "./mock";
import {
  fetchCollectionProducts,
  fetchCollections,
  fetchProduct,
  fetchProducts,
  isShopifyConfigured,
} from "./shopify";
import type { Collection, Product } from "./types";

export type { Collection, Product } from "./types";

/**
 * Data access used by every page. All functions are cached with the Cache
 * Components model; call `revalidateTag("products")` (e.g. from a Shopify
 * webhook route) to refresh after catalog changes.
 */

export async function getProducts(opts: { collection?: string } = {}): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  const { collection } = opts;

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

export async function getProduct(handle: string): Promise<Product | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("products", `product:${handle}`);

  if (isShopifyConfigured) return fetchProduct(handle);
  return mockProducts.find((p) => p.handle === handle) ?? null;
}

export async function getCollections(): Promise<Collection[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("collections");

  if (isShopifyConfigured) {
    const remote = await fetchCollections();
    return [mockCollections[0], ...remote.filter((c) => c.handle !== "all")];
  }
  return mockCollections;
}

export async function getCollection(handle: string): Promise<Collection | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("collections", `collection:${handle}`);

  if (handle === "all") return mockCollections[0];

  if (isShopifyConfigured) {
    const result = await fetchCollectionProducts(handle);
    return result?.collection ?? null;
  }
  return mockCollections.find((c) => c.handle === handle) ?? null;
}

export async function searchProducts(query: string): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");

  const q = query.trim().slice(0, 80);
  if (!q) return [];

  if (isShopifyConfigured) return fetchProducts(q, 24);

  const needle = q.toLowerCase();
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
