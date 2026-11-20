import { isColorOption, productColors } from "./colors";
import type { Product, ProductColor } from "./types";

/**
 * Searching, filtering and sorting a collection page. Everything comes from the products as they are
 * in Shopify: the categories are their product types, the colours and sizes their options, the
 * default order Shopify's. Pure functions, tested in tests/collection-filter.test.ts.
 */

export const SORTS = ["shopify", "price-asc", "price-desc", "title"] as const;
export type SortKey = (typeof SORTS)[number];

export interface Filters {
  q: string;
  types: string[];
  colors: string[];
  sizes: string[];
  inStock: boolean;
  sort: SortKey;
}

export const NO_FILTERS: Filters = { q: "", types: [], colors: [], sizes: [], inStock: false, sort: "shopify" };

export interface Facets {
  types: string[];
  colors: ProductColor[];
  sizes: string[];
}

const isSizeOption = (name: string) => name.toLowerCase() === "size";
const SIZE_ORDER = ["xxs", "xs", "s", "m", "l", "xl", "2xl", "xxl", "3xl", "xxxl", "4xl", "5xl", "6xl"];
const sizeRank = (size: string) => {
  const i = SIZE_ORDER.indexOf(size.trim().toLowerCase());
  return i < 0 ? SIZE_ORDER.length : i;
};

/** Lowercase, without accents, for matching "Tee" with "tee" and "Café" with "cafe". */
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const unique = <T>(list: T[], key: (item: T) => string) => {
  const seen = new Set<string>();
  return list.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** What can be filtered on, from the products themselves (in the order they first appear; sizes S to XXL). */
export function facetsOf(products: Product[]): Facets {
  const types = unique(
    products.map((p) => p.productType.trim()).filter(Boolean),
    (t) => t.toLowerCase(),
  );
  const colors = unique(products.flatMap(productColors), (c) => c.label.toLowerCase());
  const sizes = unique(
    products.flatMap((p) => p.options.filter((o) => isSizeOption(o.name)).flatMap((o) => o.values)),
    (s) => s.toLowerCase(),
  ).sort((a, b) => sizeRank(a) - sizeRank(b));
  return { types, colors, sizes };
}

/**
 * What the search box looks in: the name, the category, the show, the colours and who it is for.
 * Not tags or descriptions: tags are for running the store (a tee tagged "hoodie" would come up
 * for "hoodie") and descriptions mention other pieces.
 */
export function searchText(p: Product): string {
  return normalize([p.title, p.productType, p.collectionLabel ?? "", ...(p.audience ?? []), ...productColors(p).map((c) => c.label)].join(" "));
}

const valueOf = (variant: Product["variants"][number], isOption: (name: string) => boolean) =>
  variant.selectedOptions.find((o) => isOption(o.name))?.value.toLowerCase();

/**
 * Whether the product has a variant with one of the wanted colours and sizes (and in stock when
 * asked). A product without a Color option matches on its category field's colours.
 */
function hasVariant(p: Product, f: Filters): boolean {
  const colors = new Set(f.colors.map((c) => c.toLowerCase()));
  const sizes = new Set(f.sizes.map((s) => s.toLowerCase()));
  const hasColorOption = p.options.some((o) => isColorOption(o.name));
  if (colors.size && !hasColorOption && !productColors(p).some((c) => colors.has(c.label.toLowerCase()))) return false;

  return p.variants.some((v) => {
    if (f.inStock && !v.availableForSale) return false;
    if (colors.size && hasColorOption && !colors.has(valueOf(v, isColorOption) ?? "")) return false;
    if (sizes.size && !sizes.has(valueOf(v, isSizeOption) ?? "")) return false;
    return true;
  });
}

export function applyFilters(products: Product[], f: Filters): Product[] {
  const words = normalize(f.q).split(/\s+/).filter(Boolean);
  const types = new Set(f.types.map((t) => t.toLowerCase()));

  const kept = products.filter((p) => {
    if (types.size && !types.has(p.productType.trim().toLowerCase())) return false;
    if (words.length) {
      const text = searchText(p);
      if (!words.every((w) => text.includes(w))) return false;
    }
    if (f.inStock || f.colors.length || f.sizes.length) return hasVariant(p, f);
    return true;
  });

  const price = (p: Product) => Number(p.price.amount);
  switch (f.sort) {
    case "price-asc":
      return [...kept].sort((a, b) => price(a) - price(b));
    case "price-desc":
      return [...kept].sort((a, b) => price(b) - price(a));
    case "title":
      return [...kept].sort((a, b) => a.title.localeCompare(b.title));
    default:
      return kept; // Shopify's order
  }
}

export const activeCount = (f: Filters) => f.types.length + f.colors.length + f.sizes.length + (f.inStock ? 1 : 0);

const list = (value: string | null) => (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []);

/** Filters from a collection link (`?q=hoodie&type=Tee,Hoodie&color=Black&size=M&stock=1&sort=price-asc`). */
export function filtersFromParams(params: URLSearchParams): Filters {
  const sort = params.get("sort");
  return {
    q: (params.get("q") ?? "").slice(0, 80),
    types: list(params.get("type")),
    colors: list(params.get("color")),
    sizes: list(params.get("size")),
    inStock: params.get("stock") === "1",
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : "shopify",
  };
}

/** The link's query for these filters: only what is set, so a clean page has a clean address. */
export function filtersToParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.types.length) params.set("type", f.types.join(","));
  if (f.colors.length) params.set("color", f.colors.join(","));
  if (f.sizes.length) params.set("size", f.sizes.join(","));
  if (f.inStock) params.set("stock", "1");
  if (f.sort !== "shopify") params.set("sort", f.sort);
  return params;
}

/**
 * With colours filtered, a card shows the product in the first of them: that variant's picture
 * first, and its link opening on that variant. Products without such a variant stay as they are.
 */
export function inColor(p: Product, colors: string[]): { product: Product; variantId: string | null } {
  if (!colors.length) return { product: p, variantId: null };
  const wanted = colors.map((c) => c.toLowerCase());
  const variant = wanted
    .map((c) => p.variants.find((v) => valueOf(v, isColorOption) === c && v.availableForSale) ?? p.variants.find((v) => valueOf(v, isColorOption) === c))
    .find(Boolean);
  if (!variant) return { product: p, variantId: null };
  const image = variant.image;
  if (!image) return { product: p, variantId: variant.id };
  const base = (url: string) => url.split("?")[0];
  const rest = p.images.filter((i) => base(i.url) !== base(image.url));
  return { product: { ...p, featuredImage: image, images: [image, ...rest] }, variantId: variant.id };
}

