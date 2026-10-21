import { showroomArt, showroomModels, showroomOrder } from "@/config/models";
import { getProduct } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

import { ShowroomExperience } from "./ShowroomExperience";
import type { ShowroomItem } from "./showroom-types";

/** Server wrapper: resolves the catalog data, then hands plain props to the 3D client. */
export async function Showroom() {
  const products = await Promise.all(showroomOrder.map((handle) => getProduct(handle)));

  const items: ShowroomItem[] = products.flatMap((p) => {
    if (!p || !showroomModels[p.handle]) return [];
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
        model: showroomModels[p.handle],
        art: showroomArt[p.handle],
      },
    ];
  });

  if (items.length === 0) return null;
  return <ShowroomExperience items={items} />;
}
