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

const STORE_TEE_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
const CROP_TEE_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

const seeds: Seed[] = [
  // The store's products (same handles, titles and prices as on Shopify). Like ours: the garment alone,
  // rendered from its 3D model (Meshy, made from the store's photos), and the store's on-model photo on hover.
  {
    handle: "hoodie",
    title: "Blasphemous! Hoodie",
    description:
      "That's just BLASPHEMOUS! A clean, minimalist hoodie with BLASPHEMOUS in bold type across the chest and the signature silhouette graphic on the upper chest. Adjustable drawstring hood. Wear it bold. Wear it unapologetically.",
    price: 54.99,
    hover: image("/images/products/on-model/hoodie.webp", "Man wearing the black Blasphemous! hoodie", 1121, 914),
    collections: ["straight-shooter", "stephen-a-smith"],
    tags: ["hoodie", "blasphemous", "featured"],
    options: [
      { name: "Color", values: ["Black", "White"] },
      { name: "Size", values: STORE_TEE_SIZES },
    ],
  },
  {
    handle: "blasphemous-t-shirt",
    title: "Blasphemous! T Shirt",
    description:
      "That's just BLASPHEMOUS! A clean, minimalist tee with BLASPHEMOUS in bold type across the chest and the signature silhouette graphic on the upper chest. Black or white. Wear it bold. Wear it unapologetically.",
    price: 34.99,
    hover: image("/images/products/on-model/blasphemous-t-shirt.webp", "Man wearing the black Blasphemous! tee", 1121, 914),
    collections: ["straight-shooter", "stephen-a-smith"],
    tags: ["tee", "blasphemous", "featured"],
    options: [
      { name: "Color", values: ["Black", "White"] },
      { name: "Size", values: STORE_TEE_SIZES },
    ],
  },
  {
    handle: "i-would-date-the-bus-driver",
    title: "I Would Date The Bus Driver",
    description:
      "Women's graphic crop tee. A little flirty, a little bold: \"I would date the bus driver\" in script and bold type with a heart, printed on the back, and The Culture Table logo on the front. Cropped, relaxed fit.",
    price: 34.99,
    hover: image("/images/products/on-model/i-would-date-the-bus-driver.webp", "Woman wearing the black crop tee, seen from behind: I would date the bus driver", 967, 788),
    collections: ["culture-table"],
    tags: ["tee", "crop", "featured"],
    options: [
      { name: "Color", values: ["Black", "White"] },
      { name: "Size", values: CROP_TEE_SIZES },
    ],
  },
  {
    handle: "i-m-not-above-an-edible",
    title: "I’m not above an Edible",
    description:
      "Women's graphic crop tee. Sweet, bold and a little rebellious: \"I'm not above an Edible\" in pink, white and gold lettering with candy details on the back, The Culture Table logo on the front.",
    price: 34.99,
    hover: image("/images/products/on-model/i-m-not-above-an-edible.webp", "Woman wearing the black crop tee, seen from behind: I'm not above an Edible", 1200, 979),
    collections: ["culture-table"],
    tags: ["tee", "crop", "featured"],
    options: [
      { name: "Color", values: ["Black", "White"] },
      { name: "Size", values: CROP_TEE_SIZES },
    ],
  },
  {
    handle: "theres-right-theres-wrongs-theres-reality",
    title: "There's Right, There's Wrongs & There's REALITY",
    description:
      "Women's graphic crop tee. Three perspectives, one reality: \"There's Right, There's Wrong & There's REALITY\" in flowing script and serif lettering, in soft pink, teal and cream, printed on the back; The Culture Table logo on the front.",
    price: 34.99,
    hover: image("/images/products/on-model/theres-right-theres-wrongs-theres-reality.webp", "Woman wearing the white crop tee, seen from behind: There's Right, There's Wrong & There's Reality", 1024, 835),
    collections: ["culture-table"],
    tags: ["tee", "crop", "featured"],
    options: [
      { name: "Color", values: ["Black", "White"] },
      { name: "Size", values: CROP_TEE_SIZES },
    ],
  },

  // Our own line (3D renders for the cards, the showroom and the product page).
  {
    handle: "the-silhouette-hoodie",
    title: "The Silhouette Hoodie",
    description:
      "Heavyweight pullover hoodie in black with the signature silhouette graphic across the back. Brushed fleece interior, double-lined hood and a relaxed boxy fit.",
    price: 70,
    hover: image("/images/products/on-model/the-silhouette-hoodie.webp", "Man wearing the black hoodie, seen from behind, showing the silhouette graphic", 819, 668),
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
    tags: ["hat"],
    options: [{ name: "Color", values: ["Black"] }],
  },
  {
    handle: "stephen-a-smith-hoodie",
    title: "Stephen A. Smith Hoodie",
    description:
      "Midweight black pullover with a gold and orange Straight Shooter mark on the chest. Soft fleece lining, kangaroo pocket and ribbed cuffs.",
    price: 70,
    hover: image("/images/products/on-model/stephen-a-smith-hoodie.webp", "Man wearing the black hoodie with the Stephen A. Smith chest logo", 819, 668),
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
    tags: ["drinkware"],
    options: [{ name: "Color", values: ["Cream"] }],
  },
  {
    handle: "culture-table-hoodie",
    title: "Culture Table Hoodie",
    description:
      "Cream pullover hoodie with the burgundy and gold Culture Table script logo. Heavyweight cotton blend with a soft brushed interior.",
    price: 70,
    hover: image("/images/products/on-model/culture-table-hoodie.webp", "The Culture Table hoodie with the tumbler, tote and tee on a table", 1200, 979),
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
    tags: ["tee"],
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
