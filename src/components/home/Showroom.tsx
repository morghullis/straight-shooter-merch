import { copy } from "@/config/copy";
import { defaultShowroomArt, modelSpecFor, showroomArt } from "@/config/models";
import { getShowroomProducts } from "@/lib/catalog";
import { percentOff, saleOf } from "@/lib/catalog/discounts";
import { listPrice } from "@/lib/catalog/variants";
import { formatMoney } from "@/lib/format";

import { ShowroomExperience } from "./ShowroomExperience";
import type { ShowroomItem } from "./showroom-types";

/**
 * Server wrapper: the most engaged-with product of each category that has a 3D model (see
 * `getShowroomProducts`), as plain props for the 3D client.
 */
export async function Showroom() {
  const products = await getShowroomProducts();
  // Each stop is named by its category ("Tee"); a product without one goes by its name.
  const categories = products.map((p) => p.productType || p.title);
  const labelOf = (i: number) =>
    categories.filter((c) => c === categories[i]).length > 1 ? products[i].title : categories[i];

  const items: ShowroomItem[] = products.flatMap((p, i) => {
    const spec = modelSpecFor(p, "showroom");
    if (!spec) return [];
    const model = { ...spec, label: labelOf(i) };
    const { price, compareAt } = listPrice(p);
    const sticker = compareAt ? saleOf(p)?.sticker : null;
    return [
      {
        handle: p.handle,
        title: p.title,
        price: formatMoney(price.amount, price.currencyCode),
        priceAmount: Number(price.amount),
        currencyCode: price.currencyCode,
        was: compareAt ? formatMoney(compareAt.amount, compareAt.currencyCode) : undefined,
        sale: compareAt ? copy.product.percentOff(percentOff(price, compareAt)) : undefined,
        sticker: compareAt && sticker ? { src: sticker, percent: percentOff(price, compareAt) } : undefined,
        href: `/products/${p.handle}`,
        image: p.featuredImage.url,
        imageAlt: p.featuredImage.altText || p.title,
        model,
        art: showroomArt[p.handle] ?? defaultShowroomArt,
      },
    ];
  });

  if (items.length === 0) return null;
  return <ShowroomExperience items={items} />;
}
