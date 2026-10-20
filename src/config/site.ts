/**
 * Single place for every piece of brand copy, navigation and collection tile.
 * Re-skinning the storefront for another brand means editing this file.
 */

export const site = {
  name: "Stephen A's Straight Shooter Merch",
  shortName: "Straight Shooter Merch",
  description:
    "Straight talk. Real fans. Official merch. Hoodies, hats, tees and more from Straight Shooter, The Stephen A. Smith Show, POTUS and The Culture Table.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  currency: "USD",
} as const;

/** Home page content that is not part of the hero or the tiles. */
export const home = {
  featured: { title: "Featured Products", count: 6, cta: { label: "View all", href: "/collections/all" } },
  tilesLabel: "Collections",
  tileCta: "Shop the collection",
} as const;

export const nav = [
  { label: "Shop All", href: "/collections/all" },
  { label: "Straight Shooter", href: "/collections/straight-shooter" },
  { label: "Stephen A. Smith", href: "/collections/stephen-a-smith" },
  { label: "POTUS", href: "/collections/potus" },
  { label: "Culture Table", href: "/collections/culture-table" },
] as const;

export const hero = {
  lines: [
    { text: "Straight Talk.", tone: "light", tracking: "-0.022em" },
    { text: "Real Fans.", tone: "light", tracking: "-0.028em" },
    { text: "Official Merch.", tone: "gold", tracking: "0em" },
  ],
  cta: { label: "Shop All Merch", href: "/collections/all" },
  signature: "Stephen A.",
  ghostWords: [
    "Sports",
    "Politics",
    "Culture",
    "Real Talk",
    "No Filter",
    "Straight",
    "Shooter",
  ],
} as const;

export type TileTheme = "cream" | "dark" | "sand";

export interface CollectionTile {
  handle: string;
  label: string;
  title: string[];
  /** Replaces the plain-text title with the POTUS wordmark. */
  wordmark?: "potus";
  image: string;
  imageAlt: string;
  /** Optional second photo (Culture Table shows a tumbler plus a hoodie). */
  secondaryImage?: string;
  theme: TileTheme;
  /** Extra inline dash after the label (only the first tile has it in the design). */
  inlineDash?: boolean;
  /** Framing of the photo inside its column (Tailwind scale/origin classes). */
  imageClassName?: string;
}

export const collectionTiles: CollectionTile[] = [
  {
    handle: "straight-shooter",
    label: "Straight Shooter",
    title: ["Straight Shooter", "with Stephen A."],
    image: "/images/collections/straight-shooter.webp",
    imageAlt: "Black Blasphemous baseball cap",
    theme: "cream",
    inlineDash: true,
    imageClassName: "scale-[1.12]",
  },
  {
    handle: "stephen-a-smith",
    label: "Stephen A. Smith Show",
    title: ["The Stephen A.", "Smith Show"],
    image: "/images/collections/sas-show.webp",
    imageAlt: "Black Blasphemous hoodie",
    theme: "dark",
    imageClassName: "scale-[1.32] origin-[50%_30%]",
  },
  {
    handle: "potus",
    label: "POTUS",
    title: ["P·O·T·U·S"],
    wordmark: "potus",
    image: "/images/collections/potus.webp",
    imageAlt: "Gray POTUS hoodie worn by a model",
    theme: "dark",
  },
  {
    handle: "culture-table",
    label: "Culture Table",
    title: ["The Culture", "Table"],
    image: "/images/products/culture-table-tumbler.webp",
    imageAlt: "Culture Table insulated tumbler",
    secondaryImage: "/images/products/culture-table-hoodie.webp",
    theme: "sand",
  },
];

export const footerColumns = [
  {
    title: "Shop",
    links: [
      { label: "Shop All", href: "/collections/all" },
      { label: "Straight Shooter", href: "/collections/straight-shooter" },
      { label: "Stephen A. Smith Show", href: "/collections/stephen-a-smith" },
      { label: "POTUS", href: "/collections/potus" },
      { label: "Culture Table", href: "/collections/culture-table" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Search", href: "/search" },
      { label: "My Account", href: "/account" },
      { label: "Shipping & Returns", href: "/account#shipping" },
      { label: "Contact", href: "/account#contact" },
    ],
  },
] as const;

/** DOM id of the footer's last row (copyright + animation switch). The sticky buy bar tucks away when it appears so it never covers it. */
export const FOOTER_END_ID = "footer-end";
