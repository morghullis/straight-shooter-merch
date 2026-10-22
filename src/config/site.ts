/**
 * Single place for the brand copy and the fixed links. The catalog itself (products,
 * collections, their art and order) comes from Shopify. Re-skinning the storefront for
 * another brand means editing this file.
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
  tilesLabel: "Collections and products",
  tileCta: "Shop the collection",
  tileProductCta: "Shop it",
} as const;

/**
 * The navigation starts with these; every collection published on the storefront follows, by its
 * `position` in Shopify (see `getNavLinks`).
 */
export const navStart = [
  { label: "Home", href: "/" },
  { label: "Shop All", href: "/collections/all" },
] as const;

export const hero = {
  lines: [
    { text: "Straight Talk.", tone: "light", tracking: "-0.022em" },
    { text: "Real Fans.", tone: "light", tracking: "-0.028em" },
    { text: "Official Merch.", tone: "gold", tracking: "0em" },
  ],
  cta: { label: "Shop All Merch", href: "/collections/all" },
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

/** The footer's "Shop" column lists the navigation (without Home); then this one. */
export const footerShopTitle = "Shop";
export const footerHelp = {
  title: "Help",
  links: [
    { label: "Search", href: "/search" },
    { label: "My Account", href: "/account" },
    { label: "Shipping & Returns", href: "/account#shipping" },
    { label: "Contact", href: "/account#contact" },
  ],
} as const;

/** DOM id of the footer's last row (copyright + animation switch). The sticky buy bar tucks away when it appears so it never covers it. */
export const FOOTER_END_ID = "footer-end";
