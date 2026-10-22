import { home } from "@/config/site";
import { getCollections, getProducts } from "@/lib/catalog";
import type { CatalogImage } from "@/lib/catalog/types";
import { balancedRows } from "@/lib/format";

import { RotatingStrip, type StripTile } from "./RotatingStrip";

const pic = (image: CatalogImage | null | undefined, fallbackAlt: string) =>
  image ? { url: image.url, alt: image.altText || fallbackAlt } : null;

/**
 * The tiles under the hero, from the store: its collections first, then every product (its on-model
 * photo, its collection's name). Four show at a time and turn, one by one, to the next.
 */
export async function CollectionStrip() {
  const [collections, products] = await Promise.all([getCollections(), getProducts()]);
  const stores = collections.filter((c) => c.handle !== "all");
  const nameOf = new Map(stores.map((c) => [c.handle, c.shortTitle || c.title]));

  const collectionTiles: StripTile[] = stores.map((c) => {
    const image = c.tile?.image ?? products.find((p) => p.collections.includes(c.handle))?.featuredImage;
    return {
      key: `collection:${c.handle}`,
      href: `/collections/${c.handle}`,
      label: c.shortTitle || c.title,
      title: c.tile?.title.length ? c.tile.title : [c.title],
      image: pic(image, c.title),
      secondaryImage: pic(c.tile?.secondaryImage, c.title),
      theme: c.tile?.theme ?? null,
      cta: home.tileCta,
    };
  });

  const productTiles: StripTile[] = products.map((p) => ({
    key: `product:${p.handle}`,
    href: `/products/${p.handle}`,
    label: p.collections.map((h) => nameOf.get(h)).find(Boolean) ?? p.productType ?? "",
    title: balancedRows(p.title),
    image: pic(p.hoverImage ?? p.featuredImage, p.title),
    cta: home.tileProductCta,
  }));

  return <RotatingStrip tiles={[...collectionTiles, ...productTiles]} label={home.tilesLabel} />;
}
