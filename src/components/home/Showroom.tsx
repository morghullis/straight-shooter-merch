import { defaultShowroomArt, modelSpecFor, showroomArt } from "@/config/models";
import { getShowroomProducts } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

import { ShowroomExperience } from "./ShowroomExperience";
import type { ShowroomItem } from "./showroom-types";

/** How many products the showroom stages. */
const SHOWROOM_SIZE = 4;

/**
 * Server wrapper: the products shoppers engage with most that have a 3D model (see
 * `getShowroomProducts`), as plain props for the 3D client.
 */
export async function Showroom() {
  const products = await getShowroomProducts(SHOWROOM_SIZE);
  // Each stop is named by its category ("Tee"), or by the product's name when two share one.
  const categories = products.map((p) => p.productType || p.title);
  const labelOf = (i: number) =>
    categories.filter((c) => c === categories[i]).length > 1 ? products[i].title : categories[i];

  const items: ShowroomItem[] = products.flatMap((p, i) => {
    const spec = modelSpecFor(p, "showroom");
    if (!spec) return [];
    const model = { ...spec, label: labelOf(i) };
    return [
      {
        handle: p.handle,
        title: p.title,
        price: formatMoney(p.price.amount, p.price.currencyCode),
        priceAmount: Number(p.price.amount),
        currencyCode: p.price.currencyCode,
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
