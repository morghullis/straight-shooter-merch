import { navStart } from "@/config/site";
import { getCollections } from "@/lib/catalog";

export interface NavLink {
  label: string;
  href: string;
}

/**
 * The primary navigation: Home, Shop all, then every collection published on the storefront, in
 * the order of their `position` in Shopify, named by their short title. A collection added in
 * Shopify shows up here (and in the footer and on the home page) without touching the code.
 */
export async function getNavLinks(): Promise<NavLink[]> {
  const collections = (await getCollections()).filter((c) => c.handle !== "all");
  return [...navStart, ...collections.map((c) => ({ label: c.shortTitle || c.title, href: `/collections/${c.handle}` }))];
}
