import { copy } from "@/config/copy";
import { ANGLE_IMAGE_SIZE, angleUrl, anglesFor } from "@/config/product-media";

import type { CatalogImage, Collection, Product, ProductOption } from "./types";

/**
 * Demo catalog used until `SHOPIFY_STORE_DOMAIN` and
 * `SHOPIFY_STOREFRONT_ACCESS_TOKEN` are set. It mirrors the shape returned by
 * the Shopify mappers so pages never branch on the data source.
 */

const CURRENCY = "USD";

const image = (
  path: string,
  altText: string,
  width = 1536,
  height = 1152,
): CatalogImage => ({ url: path, altText, width, height });

const SIZES = ["S", "M", "L", "XL", "2XL"];

interface Seed {
  handle: string;
  title: string;
  description: string;
  price: number;
  /** On-model shot shown on hover (and last in the product gallery). */
  hover?: CatalogImage;
  collections: string[];
  tags?: string[];
  options?: { name: string; values: string[] }[];
}

function build(seed: Seed, index: number): Product {
  const optionDefs = seed.options ?? [{ name: "Title", values: ["Default Title"] }];

  const options: ProductOption[] = optionDefs.map((o, i) => ({
    id: `mock-option-${index}-${i}`,
    name: o.name,
    values: o.values,
  }));

  // Cartesian product of option values -> variants.
  let combos: { name: string; value: string }[][] = [[]];
  for (const opt of optionDefs) {
    combos = combos.flatMap((prefix) =>
      opt.values.map((value) => [...prefix, { name: opt.name, value }]),
    );
  }

  const variants = combos.map((selectedOptions, v) => ({
    id: `gid://shopify/ProductVariant/${9000 + index * 100 + v}`,
    title: selectedOptions.map((o) => o.value).join(" / "),
    availableForSale: true,
    price: { amount: seed.price.toFixed(2), currencyCode: CURRENCY },
    selectedOptions,
  }));

  // The turntable renders of the 3D model, in carousel order; the on-model photo goes last.
  const angles = anglesFor(seed.handle).map((angle) =>
    image(
      angleUrl(seed.handle, angle),
      copy.product.viewAlt(seed.title, copy.product.angles[angle]),
      ANGLE_IMAGE_SIZE.width,
      ANGLE_IMAGE_SIZE.height,
    ),
  );

  return {
    id: `gid://shopify/Product/${8000 + index}`,
    handle: seed.handle,
    title: seed.title,
    description: seed.description,
    availableForSale: true,
    featuredImage: angles[0],
    hoverImage: seed.hover ?? null,
    images: seed.hover ? [...angles, seed.hover] : angles,
    options,
    variants,
    price: { amount: seed.price.toFixed(2), currencyCode: CURRENCY },
    collections: seed.collections,
    tags: seed.tags ?? [],
  };
}

const seeds: Seed[] = [
  {
    handle: "the-silhouette-hoodie",
    title: "The Silhouette Hoodie",
    description:
      "Heavyweight pullover hoodie in black with the signature silhouette graphic across the back. Brushed fleece interior, double-lined hood and a relaxed boxy fit.",
    price: 70,
    hover: image("/images/products/on-model/the-silhouette-hoodie.webp", "Model wearing the black hoodie from behind, showing the silhouette graphic"),
    collections: ["straight-shooter", "stephen-a-smith"],
    tags: ["hoodie", "featured"],
    options: [{ name: "Size", values: SIZES }],
  },
  {
    handle: "blasphemous-hat",
    title: "Blasphemous Hat",
    description:
      "Structured five-panel cap in black with embroidered BLASPHEMOUS lettering. Adjustable strap, curved brim, one size fits most.",
    price: 35,
    hover: image("/images/products/on-model/blasphemous-hat.webp", "Model wearing the black Blasphemous cap"),
    collections: ["straight-shooter", "stephen-a-smith"],
    tags: ["hat", "featured"],
    options: [{ name: "Color", values: ["Black"] }],
  },
  {
    handle: "stephen-a-smith-hoodie",
    title: "Stephen A. Smith Hoodie",
    description:
      "Midweight black pullover with a gold and orange Straight Shooter mark on the chest. Soft fleece lining, kangaroo pocket and ribbed cuffs.",
    price: 70,
    hover: image("/images/products/on-model/stephen-a-smith-hoodie.webp", "Model wearing the black hoodie with a gold chest logo"),
    collections: ["stephen-a-smith", "straight-shooter"],
    tags: ["hoodie", "featured"],
    options: [{ name: "Size", values: SIZES }],
  },
  {
    handle: "culture-table-tumbler",
    title: "Culture Table Tumbler",
    description:
      "Double-wall insulated tumbler with a matte cream finish, flip-top lid and the Culture Table script logo. Keeps drinks cold for 24 hours and hot for 8.",
    price: 30,
    hover: image("/images/products/on-model/culture-table-tumbler.webp", "Model holding the cream Culture Table tumbler"),
    collections: ["culture-table"],
    tags: ["drinkware", "featured"],
    options: [{ name: "Color", values: ["Cream"] }],
  },
  {
    handle: "culture-table-hoodie",
    title: "Culture Table Hoodie",
    description:
      "Cream pullover hoodie with the burgundy and gold Culture Table script logo. Heavyweight cotton blend with a soft brushed interior.",
    price: 70,
    hover: image("/images/products/on-model/culture-table-hoodie.webp", "Model wearing the cream Culture Table hoodie"),
    collections: ["culture-table"],
    tags: ["hoodie", "featured"],
    options: [{ name: "Size", values: SIZES }],
  },
  {
    handle: "straight-shooter-tee",
    title: "Straight Shooter Tee",
    description:
      "Classic black crew-neck tee with the Straight Shooter mark on the left chest. 100% combed cotton, pre-shrunk and soft from the first wash.",
    price: 35,
    hover: image("/images/products/on-model/straight-shooter-tee.webp", "Model wearing the black Straight Shooter tee"),
    collections: ["straight-shooter"],
    tags: ["tee", "featured"],
    options: [{ name: "Size", values: SIZES }],
  },
  {
    handle: "potus-hoodie",
    title: "POTUS Hoodie",
    description:
      "Heather-gray pullover hoodie with the P·O·T·U·S wordmark across the chest. Midweight fleece, relaxed fit.",
    price: 70,
    hover: image("/images/products/on-model/potus-hoodie.webp", "Model wearing the gray POTUS hoodie"),
    collections: ["potus"],
    tags: ["hoodie"],
    options: [{ name: "Size", values: SIZES }],
  },
];

export const mockProducts: Product[] = seeds.map(build);

export const mockCollections: Collection[] = [
  { handle: "all", title: "Shop All", description: "Every piece of official merch in one place." },
  {
    handle: "straight-shooter",
    title: "Straight Shooter with Stephen A.",
    description: "Hats, hoodies and tees straight from the show.",
  },
  {
    handle: "stephen-a-smith",
    title: "The Stephen A. Smith Show",
    description: "Official merch from The Stephen A. Smith Show.",
  },
  {
    handle: "potus",
    title: "POTUS",
    description: "Politics of the United States, on a hoodie.",
  },
  {
    handle: "culture-table",
    title: "The Culture Table",
    description: "Drinkware and apparel for the table that never stops talking.",
  },
];
