import { copy } from "@/config/copy";

import { saleOf } from "./discounts";
import type { Collection, Product } from "./types";

/**
 * The messages of the bar above the navigation. They come from Shopify: each collection's "Top bar
 * messages" (custom field `announcement`), and, for a collection without any, its discount when
 * everything in it has one. Pure functions, tested in tests/announcements.test.ts.
 */

export interface Announcement {
  text: string;
  href: string;
}

export interface Sale {
  percent: number;
  /** Not the same on everything. */
  upTo: boolean;
  /** The sticker of the biggest discount, when it has one. */
  sticker: string | null;
}

/** Where a message says how much is off. */
const DISCOUNT = "{discount}";

type ForSale = Pick<Product, "availableForSale" | "variants">;

/** How much is off in a list of products; null when nothing is. `all` when every product on sale has something off. */
export function listSale(products: ForSale[]): (Sale & { all: boolean }) | null {
  const sales = products.filter((p) => p.availableForSale).map(saleOf);
  const found = sales.filter((s) => s !== null);
  if (!found.length) return null;
  const percent = Math.max(...found.map((s) => s.percent));
  const all = found.length === sales.length;
  const sticker = found.find((s) => s.percent === percent)?.sticker ?? null;
  return { percent, upTo: !all || found.some((s) => s.upTo || s.percent !== percent), sticker, all };
}

const discountText = (sale: Sale) => copy.product.percentOff(sale.percent, sale.upTo);

/** A collection's own messages, `{discount}` filled in; one that names a discount hides when there is none. */
function ownMessages(collection: Collection, sale: Sale | null): string[] {
  return (collection.announcements ?? []).flatMap((text) => {
    if (!text.includes(DISCOUNT)) return [text];
    return sale ? [text.replaceAll(DISCOUNT, discountText(sale))] : [];
  });
}

/**
 * Every message, in the collections' order. `everything` is the handle of the collection with the whole
 * store: when all of it is on sale that is the one message, instead of one per collection.
 */
export function announcementsOf(list: { collection: Collection; products: ForSale[] }[], everything: string): Announcement[] {
  const sales = new Map(list.map(({ collection, products }) => [collection.handle, listSale(products)]));
  const storeSale = sales.get(everything)?.all ?? false;

  const messages = list.flatMap(({ collection }) => {
    const sale = sales.get(collection.handle) ?? null;
    const href = `/collections/${collection.handle}`;
    const own = ownMessages(collection, sale);
    if (own.length || collection.announcements?.length) return own.map((text) => ({ text, href }));
    if (!sale?.all) return [];
    if (collection.handle === everything) return [{ text: copy.announcements.everything(discountText(sale)), href }];
    return storeSale ? [] : [{ text: copy.announcements.collection(discountText(sale), collection.shortTitle || collection.title), href }];
  });
  return messages.filter((m, i) => messages.findIndex((o) => o.text.toLowerCase() === m.text.toLowerCase()) === i);
}
