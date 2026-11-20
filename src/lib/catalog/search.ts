import { normalize, searchText } from "./filter";
import { isWomens } from "./order";
import type { Money, Product } from "./types";
import { listPrice } from "./variants";

/**
 * The store search (header box and /search page): the same fields as a collection's search box
 * (name, category, show, colours, audience), ranked so the best match comes first. Pure, tested in
 * tests/search.test.ts.
 */

/** What the instant results need of a product: small, so the whole store loads at once. */
export interface SearchItem {
  handle: string;
  title: string;
  /** The show, and "Women's" for women's pieces ("Culture Table · Women's"). */
  label: string;
  productType: string;
  /** The lowest price; `from` when other options cost more. */
  price: Money;
  from: boolean;
  image: { url: string; alt: string };
  /** Normalised text the query is matched against. */
  text: string;
}

export function toSearchItem(p: Product, womensLabel = "Women's"): SearchItem {
  const { price, from } = listPrice(p);
  return {
    handle: p.handle,
    title: p.title,
    label: [p.collectionLabel, isWomens(p) ? womensLabel : null].filter(Boolean).join(" · "),
    productType: p.productType,
    price,
    from,
    image: { url: p.featuredImage.url, alt: p.featuredImage.altText || p.title },
    text: searchText(p),
  };
}

export const queryWords = (q: string) => normalize(q).split(/\s+/).filter(Boolean);

/**
 * How well a title and its searchable text match the words: 0 = no match (some word is missing).
 * A title starting with the first word beats a word in the title starting with it, beats the words
 * being somewhere in the title, beats a match on the other fields only.
 */
export function matchScore(title: string, text: string, words: string[]): number {
  if (!words.length || !words.every((w) => text.includes(w))) return 0;
  const t = normalize(title);
  const titleWords = t.split(/[^a-z0-9]+/).filter(Boolean);
  if (t.startsWith(words[0])) return 4;
  if (words.every((w) => titleWords.some((tw) => tw.startsWith(w)))) return 3;
  if (words.every((w) => t.includes(w))) return 2;
  return 1;
}

/** The matches, best first; equally good ones keep the store's (Shopify's) order. */
export function rankSearch<T>(list: T[], q: string, fields: (item: T) => { title: string; text: string }): T[] {
  const words = queryWords(q);
  return list
    .map((item, i) => ({ item, i, score: matchScore(fields(item).title, fields(item).text, words) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.item);
}

/** Splits a title into plain and matching parts, for highlighting the typed words. */
export function highlight(title: string, q: string): { text: string; match: boolean }[] {
  const words = q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return [{ text: title, match: false }];
  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  return title
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({ text: part, match: words.some((w) => new RegExp(`^${w}$`, "i").test(part)) }));
}
