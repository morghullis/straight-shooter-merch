import { home } from "@/config/site";
import { getCollections, getProducts, getProductsByEngagement } from "@/lib/catalog";
import type { CatalogImage, Product } from "@/lib/catalog/types";
import { balancedRows } from "@/lib/format";

import { RotatingStrip, type StripTile } from "./RotatingStrip";

const pic = (image: CatalogImage | null | undefined, fallbackAlt: string) =>
  image ? { url: image.url, alt: image.altText || fallbackAlt } : null;

/**
 * The tiles under the hero, from the store. The first three only turn between the products of the
 * lead collection (The Stephen A. Smith Show, in its Shopify order); the last one turns between the
 * collections and every other product (its on-model photo, its collection's name). A collection
 * without its own tile photo (custom field `tile_image`) shows its most viewed product, so the tile
 * always shows something that is on sale (its own Shopify image only when it has no products).
 */
export async function CollectionStrip() {
  const { collection: leadHandle, slots } = home.stripLead;
  const [collections, products, byEngagement, leadProducts] = await Promise.all([
    getCollections(),
    getProducts(),
    getProductsByEngagement(),
    getProducts({ collection: leadHandle }),
  ]);
  const stores = collections.filter((c) => c.handle !== "all");
  const nameOf = new Map(stores.map((c) => [c.handle, c.shortTitle || c.title]));

  const collectionTiles: StripTile[] = stores.map((c) => {
    const image = c.tile?.image ?? byEngagement.find((p) => p.collections.includes(c.handle))?.featuredImage ?? c.image;
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

  const productTile = (p: Product, label?: string): StripTile => ({
    key: `product:${p.handle}`,
    href: `/products/${p.handle}`,
    label: label ?? p.collections.map((h) => nameOf.get(h)).find(Boolean) ?? p.productType ?? "",
    title: balancedRows(p.title),
    image: pic(p.hoverImage ?? p.featuredImage, p.title),
    cta: home.tileProductCta,
  });

  // Lead tiles need enough products to fill their slots and still turn; otherwise all tiles mix.
  const leadName = nameOf.get(leadHandle);
  const lead = leadProducts.length > slots ? leadProducts.map((p) => productTile(p, leadName)) : [];
  const leadSet = new Set(lead.map((t) => t.key));
  const rest = [...collectionTiles, ...products.map((p) => productTile(p)).filter((t) => !leadSet.has(t.key))];

  return <RotatingStrip tiles={[...lead, ...rest]} leadTiles={lead.length} leadSlots={lead.length ? slots : 0} label={home.tilesLabel} />;
}
