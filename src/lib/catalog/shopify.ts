import "server-only";

import { balancedRows } from "@/lib/format";

import { cleanDescriptionHtml } from "./description";
import { toConfirm, unitDiscount, type Discounts, type PricedLine } from "./discounts";
import type {
  CatalogImage,
  Collection,
  Model3D,
  Money,
  Product,
  ProductColor,
  ProductDetails,
  ProductVariant,
  TileTheme,
} from "./types";

/**
 * Minimal Shopify Storefront API client. Only used when both env vars are set;
 * otherwise `catalog/index.ts` serves the mock catalog.
 *
 * Everything the storefront shows comes from Shopify: the data (title, price, variants, stock),
 * and the art in the products' and collections' custom fields (namespace `custom`, defined by
 * `tools/pipeline/define-metafields.mjs` and filled by the asset pipeline).
 */

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
// `||`, not `??`: an empty SHOPIFY_API_VERSION (as in .env.example) would make Shopify serve its oldest version.
const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";
// A private token from the Headless channel (shpat_…) goes in its own header; a public token in the classic one.
const tokenHeader = token?.startsWith("shpat_") ? "Shopify-Storefront-Private-Token" : "X-Shopify-Storefront-Access-Token";

export const isShopifyConfigured = Boolean(domain && token);

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

/** Waits before the second and third try when the network or Shopify stumbles. */
const RETRY_AFTER_MS = [250, 900];
/** The longest a "try again later" from Shopify is followed; each try is given up after `TRY_MS`. */
const MAX_WAIT_MS = 2000;
const TRY_MS = 10_000;

/**
 * The request, tried again (`retry`) when it does not get through: no connection, too busy, a server
 * error. Only for requests that change nothing and that no visitor's click can repeat.
 */
async function post(url: string, init: RequestInit, retry: boolean): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const last = !retry || attempt >= RETRY_AFTER_MS.length;
    let wait = RETRY_AFTER_MS[attempt] ?? 0;
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TRY_MS) });
      if (last || (res.status !== 429 && res.status < 500)) return res;
      const asked = Number(res.headers.get("retry-after")) * 1000;
      if (asked > 0) wait = Math.min(Math.max(wait, asked), MAX_WAIT_MS);
      await res.body?.cancel();
    } catch (error) {
      if (last) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

async function shopifyFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  { retry = !query.trimStart().startsWith("mutation") } = {},
): Promise<T> {
  if (!domain || !token) {
    throw new Error("Shopify is not configured");
  }

  const res = await post(`https://${domain}/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [tokenHeader]: token,
    },
    body: JSON.stringify({ query, variables }),
  }, retry);

  if (!res.ok) {
    throw new Error(`Shopify request failed with ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) {
    throw new Error("Shopify returned no data");
  }
  return json.data;
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

const PRODUCT_FIELDS = /* GraphQL */ `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    descriptionHtml
    productType
    availableForSale
    tags
    featuredImage { url altText width height }
    images(first: 20) { nodes { url altText width height } }
    options { id name values }
    variants(first: 100) {
      nodes {
        id
        title
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        image { url altText width height }
        selectedOptions { name value }
      }
    }
    priceRange { minVariantPrice { amount currencyCode } }
    collections(first: 10) {
      nodes {
        handle
        title
        shortTitle: metafield(namespace: "custom", key: "short_title") { value }
        position: metafield(namespace: "custom", key: "position") { value }
      }
    }
    tagline: metafield(namespace: "custom", key: "tagline") { value }
    highlights: metafield(namespace: "custom", key: "highlights") { value }
    material: metafield(namespace: "custom", key: "material") { value }
    fit: metafield(namespace: "custom", key: "fit") { value }
    care: metafield(namespace: "custom", key: "care") { value }
    sizeChart: metafield(namespace: "custom", key: "size_chart") {
      reference { ... on MediaImage { image { url altText width height } } }
    }
    shippingNote: metafield(namespace: "custom", key: "shipping_note") { value }
    audience: metafield(namespace: "shopify", key: "target-gender") {
      references(first: 5) { nodes { ... on Metaobject { label: field(key: "label") { value } } } }
    }
    colorPattern: metafield(namespace: "shopify", key: "color-pattern") {
      references(first: 20) {
        nodes { ... on Metaobject { label: field(key: "label") { value } color: field(key: "color") { value } } }
      }
    }
    media(first: 10) { nodes { ... on Model3d { sources { url mimeType } } } }
    model3d: metafield(namespace: "custom", key: "model_3d") { reference { ... on GenericFile { url } } }
    model3dHd: metafield(namespace: "custom", key: "model_3d_hd") { reference { ... on GenericFile { url } } }
    model3dView: metafield(namespace: "custom", key: "model_3d_view") { value }
  }
`;

const COLLECTION_FIELDS = /* GraphQL */ `
  fragment CollectionFields on Collection {
    handle
    title
    description
    image { url altText width height }
    shortTitle: metafield(namespace: "custom", key: "short_title") { value }
    position: metafield(namespace: "custom", key: "position") { value }
    tileTitle: metafield(namespace: "custom", key: "tile_title") { value }
    tileImage: metafield(namespace: "custom", key: "tile_image") {
      reference { ... on MediaImage { image { url altText width height } } }
    }
    tileImageSecondary: metafield(namespace: "custom", key: "tile_image_secondary") {
      reference { ... on MediaImage { image { url altText width height } } }
    }
    tileTheme: metafield(namespace: "custom", key: "tile_theme") { value }
    announcement: metafield(namespace: "custom", key: "announcement") { value }
    heroImage: metafield(namespace: "custom", key: "hero_image") {
      reference { ... on MediaImage { image { url altText width height } } }
    }
    heroImageMobile: metafield(namespace: "custom", key: "hero_image_mobile") {
      reference { ... on MediaImage { image { url altText width height } } }
    }
    heroTitle: metafield(namespace: "custom", key: "hero_title") { value }
    heroKicker: metafield(namespace: "custom", key: "hero_kicker") { value }
    heroCta: metafield(namespace: "custom", key: "hero_cta") { value }
  }
`;

const PRODUCTS_QUERY = /* GraphQL */ `
  ${PRODUCT_FIELDS}
  query Products($first: Int!, $query: String) {
    products(first: $first, query: $query, sortKey: BEST_SELLING) {
      nodes { ...ProductFields }
    }
  }
`;

const PRODUCT_QUERY = /* GraphQL */ `
  ${PRODUCT_FIELDS}
  query Product($handle: String!) {
    product(handle: $handle) { ...ProductFields }
  }
`;

const COLLECTION_PRODUCTS_QUERY = /* GraphQL */ `
  ${PRODUCT_FIELDS}
  ${COLLECTION_FIELDS}
  query CollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      ...CollectionFields
      products(first: $first) { nodes { ...ProductFields } }
    }
  }
`;

const COLLECTIONS_QUERY = /* GraphQL */ `
  ${COLLECTION_FIELDS}
  query Collections {
    collections(first: 100) { nodes { ...CollectionFields } }
  }
`;

const PRODUCT_HANDLES_QUERY = /* GraphQL */ `
  query ProductHandles($after: String) {
    products(first: 250, after: $after) {
      nodes { handle }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const VARIANTS_QUERY = /* GraphQL */ `
  query Variants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        availableForSale
        price { amount currencyCode }
        image { url altText }
        product { handle title featuredImage { url altText } }
      }
    }
  }
`;

const SELLABLE_VARIANTS_QUERY = /* GraphQL */ `
  query SellableVariants($after: String) {
    products(first: 100, after: $after) {
      nodes { variants(first: 100) { nodes { id availableForSale } } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PRICE_CART_MUTATION = /* GraphQL */ `
  mutation PriceCart($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart {
        lines(first: 250) {
          nodes {
            quantity
            merchandise { ... on ProductVariant { id } }
            cost { subtotalAmount { amount currencyCode } }
            own: discountAllocations(lineLevelOnly: true) { ...Allocation }
            all: discountAllocations(lineLevelOnly: false) { ...Allocation }
          }
        }
      }
    }
  }
  fragment Allocation on CartDiscountAllocation {
    discountedAmount { amount }
    targetType
    sourceDiscountApplication { allocationMethod }
    ... on CartAutomaticDiscountAllocation { title }
    ... on CartCustomDiscountAllocation { title }
    ... on CartCodeDiscountAllocation { code }
  }
`;

const CART_CREATE_MUTATION = /* GraphQL */ `
  mutation CartCreate($lines: [CartLineInput!]!, $buyerIdentity: CartBuyerIdentityInput) {
    cartCreate(input: { lines: $lines, buyerIdentity: $buyerIdentity }) {
      cart { checkoutUrl }
      userErrors { message }
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

interface RawImage {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

interface RawImageRef {
  reference: { image?: RawImage | null } | null;
}

interface RawFileRef {
  reference: { url?: string } | null;
}

interface RawValue {
  value: string;
}

interface RawMetaobjectList {
  references: { nodes: { label?: RawValue | null; color?: RawValue | null }[] } | null;
}

interface RawProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  productType: string;
  availableForSale: boolean;
  tags: string[];
  featuredImage: RawImage | null;
  images: { nodes: RawImage[] };
  options: { id: string; name: string; values: string[] }[];
  variants: {
    nodes: {
      id: string;
      title: string;
      availableForSale: boolean;
      price: Money;
      compareAtPrice?: Money | null;
      image?: RawImage | null;
      selectedOptions: { name: string; value: string }[];
    }[];
  };
  priceRange: { minVariantPrice: Money };
  collections: { nodes: { handle: string; title?: string; shortTitle?: RawValue | null; position?: RawValue | null }[] };
  tagline?: RawValue | null;
  highlights?: RawValue | null;
  material?: RawValue | null;
  fit?: RawValue | null;
  care?: RawValue | null;
  sizeChart?: RawImageRef | null;
  shippingNote?: RawValue | null;
  audience?: RawMetaobjectList | null;
  colorPattern?: RawMetaobjectList | null;
  media?: { nodes: { sources?: { url: string; mimeType: string }[] }[] };
  model3d?: RawFileRef | null;
  model3dHd?: RawFileRef | null;
  model3dView?: RawValue | null;
}

interface RawCollection {
  handle: string;
  title: string;
  description: string;
  image: RawImage | null;
  shortTitle?: RawValue | null;
  position?: RawValue | null;
  tileTitle?: RawValue | null;
  tileImage?: RawImageRef | null;
  tileImageSecondary?: RawImageRef | null;
  tileTheme?: RawValue | null;
  announcement?: RawValue | null;
  heroImage?: RawImageRef | null;
  heroImageMobile?: RawImageRef | null;
  heroTitle?: RawValue | null;
  heroKicker?: RawValue | null;
  heroCta?: RawValue | null;
}

const PLACEHOLDER: CatalogImage = {
  url: "/images/products/blasphemous-hat.webp",
  altText: "",
  width: 1536,
  height: 1152,
};

function mapImage(raw: RawImage | null, fallbackAlt: string): CatalogImage {
  if (!raw) return { ...PLACEHOLDER, altText: fallbackAlt };
  return {
    url: raw.url,
    altText: raw.altText ?? fallbackAlt,
    width: raw.width ?? 1200,
    height: raw.height ?? 900,
  };
}

/** `custom.model_3d_view` is JSON: { "fit": 2.35, "yaw": 0 }. Anything else is ignored. */
function parseView(value: string | undefined): Pick<Model3D, "fit" | "yaw"> {
  try {
    const v = JSON.parse(value ?? "{}") as Record<string, unknown>;
    return {
      fit: typeof v.fit === "number" ? v.fit : undefined,
      yaw: typeof v.yaw === "number" ? v.yaw : undefined,
    };
  } catch {
    return {};
  }
}

/** The 3D model from the custom fields; a GLB added to the product's media in Shopify works too. */
function resolveModel(raw: RawProduct): Model3D | null {
  const src =
    raw.model3d?.reference?.url ??
    raw.media?.nodes.flatMap((m) => m.sources ?? []).find((s) => s.mimeType === "model/gltf-binary")?.url;
  if (!src) return null;
  return {
    src,
    hd: raw.model3dHd?.reference?.url ?? null,
    ...parseView(raw.model3dView?.value),
  };
}

const text = (v: RawValue | null | undefined) => v?.value.trim() || null;
const lines = (v: string | null | undefined) => (v ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** A list field (JSON array of strings) or, for a field made by hand, plain lines. */
function list(v: RawValue | null | undefined): string[] {
  if (!v?.value) return [];
  try {
    const parsed = JSON.parse(v.value) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
  } catch {
    /* not JSON */
  }
  return lines(v.value);
}

/** The product page's extra fields; null when none is filled in. */
function mapDetails(raw: RawProduct): ProductDetails | null {
  const chart = raw.sizeChart?.reference?.image;
  const details: ProductDetails = {
    tagline: text(raw.tagline),
    highlights: list(raw.highlights),
    material: text(raw.material),
    fit: text(raw.fit),
    care: lines(raw.care?.value),
    sizeChart: chart ? mapImage(chart, `${raw.title} size chart`) : null,
    shippingNote: text(raw.shippingNote),
  };
  const empty = !details.tagline && !details.highlights.length && !details.material && !details.fit && !details.care.length && !details.sizeChart && !details.shippingNote;
  return empty ? null : details;
}

/** Shopify's taxonomy says "Female"/"Male"; shoppers read "Women's"/"Men's". */
const AUDIENCE: Record<string, string> = { female: "Women's", male: "Men's", unisex: "Unisex" };

function mapAudience(raw: RawProduct): string[] {
  return (raw.audience?.references?.nodes ?? [])
    .map((n) => n.label?.value?.trim() ?? "")
    .filter(Boolean)
    .map((label) => AUDIENCE[label.toLowerCase()] ?? label);
}

function mapColors(raw: RawProduct): ProductColor[] {
  return (raw.colorPattern?.references?.nodes ?? [])
    .map((n) => ({ label: n.label?.value?.trim() ?? "", hex: /^#[0-9a-f]{3,8}$/i.test(n.color?.value ?? "") ? n.color!.value : null }))
    .filter((c) => c.label);
}

/** The product's show: its first collection that has a place in the navigation (a `position` of 1 or more). */
function collectionLabel(raw: RawProduct): string | null {
  const show = raw.collections.nodes.find((c) => Number.parseInt(c.position?.value ?? "", 10) >= 1);
  return show ? show.shortTitle?.value || show.title || null : null;
}

function mapProduct(raw: RawProduct): Product {
  // Shopify decides what shows: the product's images in the order they have in the admin. The
  // first one is the card's picture and the second one shows when the card is hovered.
  const images = raw.images.nodes.map((i) => mapImage(i, raw.title));
  const hoverImage = images[1] ?? null;
  const featuredImage = mapImage(raw.featuredImage ?? raw.images.nodes[0] ?? null, raw.title);

  const variants: ProductVariant[] = raw.variants.nodes.map((v) => ({
    id: v.id,
    title: v.title,
    availableForSale: v.availableForSale,
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? null,
    image: v.image ? mapImage(v.image, `${raw.title}, ${v.title}`) : null,
    selectedOptions: v.selectedOptions,
  }));

  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    descriptionHtml: cleanDescriptionHtml(raw.descriptionHtml ?? ""),
    details: mapDetails(raw),
    audience: mapAudience(raw),
    colors: mapColors(raw),
    collectionLabel: collectionLabel(raw),
    productType: raw.productType,
    availableForSale: raw.availableForSale,
    featuredImage,
    hoverImage,
    images: images.length ? images : [featuredImage],
    options: raw.options,
    variants,
    price: raw.priceRange.minVariantPrice,
    collections: raw.collections.nodes.map((c) => c.handle),
    tags: raw.tags,
    model3d: resolveModel(raw),
  };
}

const TILE_THEMES: readonly TileTheme[] = ["cream", "dark", "sand"];

function mapCollection(raw: RawCollection): Collection {
  const image = raw.tileImage?.reference?.image;
  const secondary = raw.tileImageSecondary?.reference?.image;
  const theme = TILE_THEMES.find((t) => t === raw.tileTheme?.value) ?? null;
  const position = Number.parseInt(raw.position?.value ?? "", 10);
  const tileTitle = lines(raw.tileTitle?.value);
  const heroImage = raw.heroImage?.reference?.image;
  const heroImageMobile = raw.heroImageMobile?.reference?.image;
  const heroTitle = lines(raw.heroTitle?.value).slice(0, 3);

  return {
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    shortTitle: raw.shortTitle?.value || null,
    position: Number.isFinite(position) ? position : null,
    image: raw.image ? mapImage(raw.image, raw.title) : null,
    tile: {
      title: tileTitle.length ? tileTitle : balancedRows(raw.title),
      image: image ? mapImage(image, raw.title) : null,
      secondaryImage: secondary ? mapImage(secondary, raw.title) : null,
      theme,
    },
    hero: heroImage
      ? {
          image: mapImage(heroImage, raw.title),
          mobileImage: heroImageMobile ? mapImage(heroImageMobile, raw.title) : null,
          kicker: text(raw.heroKicker),
          title: heroTitle.length ? heroTitle : balancedRows(raw.title),
          cta: text(raw.heroCta),
        }
      : null,
    announcements: list(raw.announcement),
  };
}

/* ------------------------------------------------------------------ */
/* Public (server-only) API                                            */
/* ------------------------------------------------------------------ */

export async function fetchProducts(query?: string, first = 50): Promise<Product[]> {
  const data = await shopifyFetch<{ products: { nodes: RawProduct[] } }>(PRODUCTS_QUERY, {
    first,
    query: query || null,
  });
  return data.products.nodes.map(mapProduct);
}

export async function fetchProduct(handle: string): Promise<Product | null> {
  const data = await shopifyFetch<{ product: RawProduct | null }>(PRODUCT_QUERY, { handle });
  return data.product ? mapProduct(data.product) : null;
}

export async function fetchCollectionProducts(
  handle: string,
): Promise<{ collection: Collection; products: Product[] } | null> {
  const data = await shopifyFetch<{
    collection:
      | (RawCollection & { products: { nodes: RawProduct[] } })
      | null;
  }>(COLLECTION_PRODUCTS_QUERY, { handle, first: 100 });

  if (!data.collection) return null;
  const { products, ...collection } = data.collection;
  return { collection: mapCollection(collection), products: products.nodes.map(mapProduct) };
}

/** Every product handle in the store (paginated, capped so a huge store cannot run away). */
export async function fetchProductHandles(max = 5000): Promise<string[]> {
  const handles: string[] = [];
  let after: string | null = null;
  while (handles.length < max) {
    const data: {
      products: { nodes: { handle: string }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
    } = await shopifyFetch(PRODUCT_HANDLES_QUERY, { after });
    handles.push(...data.products.nodes.map((n) => n.handle));
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }
  return handles;
}

/** The collections published on the storefront's sales channel. */
export async function fetchCollections(): Promise<Collection[]> {
  const data = await shopifyFetch<{ collections: { nodes: RawCollection[] } }>(COLLECTIONS_QUERY);
  return data.collections.nodes.map(mapCollection);
}

/** A variant as it is in the store right now (for the cart). */
export interface LiveVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  image: { url: string; altText: string | null } | null;
  handle: string;
  productTitle: string;
}

/** The variants that still exist, by id (a deleted variant is simply missing). */
export async function fetchVariants(ids: string[]): Promise<Map<string, LiveVariant>> {
  const data = await shopifyFetch<{
    nodes: ({
      id: string;
      title: string;
      availableForSale: boolean;
      price: Money;
      image: { url: string; altText: string | null } | null;
      product: { handle: string; title: string; featuredImage: { url: string; altText: string | null } | null };
    } | null)[];
  }>(VARIANTS_QUERY, { ids });
  const live = new Map<string, LiveVariant>();
  for (const n of data.nodes) {
    if (!n?.id) continue;
    live.set(n.id, {
      id: n.id,
      title: n.title,
      availableForSale: n.availableForSale,
      price: n.price,
      image: n.image ?? n.product.featuredImage,
      handle: n.product.handle,
      productTitle: n.product.title,
    });
  }
  return live;
}

/**
 * The store's primary public address (Shopify admin > Settings > Domains), e.g.
 * `https://checkout.example.com`. Shoppers only ever see this one, never the store's .myshopify.com
 * name, which stays behind the scenes for API calls.
 */
export async function fetchPrimaryDomainUrl(): Promise<string> {
  const data = await shopifyFetch<{ shop: { primaryDomain: { url: string } } }>(
    /* GraphQL */ `query PrimaryDomain { shop { primaryDomain { url } } }`,
  );
  return data.shop.primaryDomain.url;
}

interface RawAllocation {
  discountedAmount: { amount: string };
  targetType: string;
  sourceDiscountApplication: { allocationMethod: string } | null;
  title?: string | null;
  code?: string | null;
}

interface RawPricedCart {
  lines: {
    nodes: {
      quantity: number;
      merchandise: { id?: string };
      cost: { subtotalAmount: Money };
      own: RawAllocation[];
      all: RawAllocation[];
    }[];
  };
}

function mapPricedCart(raw: RawPricedCart | null | undefined): PricedLine[] {
  return (raw?.lines.nodes ?? []).flatMap((line) => {
    if (!line.merchandise.id) return [];
    const discount = (a: RawAllocation, lineLevel: boolean) => ({
      title: a.title ?? a.code ?? "",
      amount: Number(a.discountedAmount.amount),
      each: a.sourceDiscountApplication?.allocationMethod === "EACH",
      lineLevel,
    });
    const onGoods = (a: RawAllocation) => a.targetType === "LINE_ITEM";
    const own = line.own.filter(onGoods).map((a) => discount(a, true));
    // `all` also holds the line's share of whole-order discounts: what is left after its own.
    const rest = line.all.filter(onGoods).map((a) => discount(a, false));
    for (const d of own) {
      const at = rest.findIndex((r) => r.title === d.title && r.amount === d.amount);
      if (at >= 0) rest.splice(at, 1);
    }
    return [{
      variantId: line.merchandise.id,
      quantity: line.quantity,
      subtotal: Number(line.cost.subtotalAmount.amount),
      currencyCode: line.cost.subtotalAmount.currencyCode,
      discounts: [...own, ...rest],
    }];
  });
}

/** These lines priced by Shopify in a cart of their own (nothing is bought: the cart is only read, and expires). */
export async function priceCart(lines: { merchandiseId: string; quantity: number }[], retry = false): Promise<PricedLine[]> {
  const data = await shopifyFetch<{ cartCreate: { cart: RawPricedCart | null } | null }>(PRICE_CART_MUTATION, { lines }, { retry });
  return mapPricedCart(data.cartCreate?.cart);
}

/** Several carts, asked for side by side: Shopify runs the mutations of one request one after another. */
async function priceCarts(groups: { merchandiseId: string; quantity: number }[][], atOnce = 20): Promise<PricedLine[][]> {
  const priced: PricedLine[][] = [];
  for (let i = 0; i < groups.length; i += atOnce) {
    priced.push(...(await Promise.all(groups.slice(i, i + atOnce).map((lines) => priceCart(lines, true)))));
  }
  return priced;
}

/** The stickers the asset pipeline made, by discount name (the store's field `discount_stickers`). */
export async function fetchDiscountStickers(): Promise<Record<string, string>> {
  const data = await shopifyFetch<{ shop: { metafield: RawValue | null } }>(
    /* GraphQL */ `query DiscountStickers { shop { metafield(namespace: "custom", key: "discount_stickers") { value } } }`,
  );
  const entries = Object.entries(JSON.parse(data.shop.metafield?.value ?? "{}") as Record<string, { url?: unknown } | null>);
  return Object.fromEntries(
    entries.flatMap(([title, entry]) => (typeof entry?.url === "string" && entry.url.startsWith("https://cdn.shopify.com/") ? [[title, entry.url]] : [])),
  );
}

/** The variants on sale in every listed product, one list per product. */
export async function fetchSellableVariants(maxPages = 10): Promise<string[][]> {
  const products: string[][] = [];
  let after: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const data: {
      products: {
        nodes: { variants: { nodes: { id: string; availableForSale: boolean }[] } }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await shopifyFetch(SELLABLE_VARIANTS_QUERY, { after });
    products.push(...data.products.nodes.map((p) => p.variants.nodes.filter((v) => v.availableForSale).map((v) => v.id)));
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }
  return products;
}

/**
 * What one unit of each variant costs with Shopify's automatic discounts, for the variants that have
 * one (admin > Discounts; Shopify only works them out in a cart). Each product's variants are priced
 * together first (most products have no discount, and one cart settles it), then one variant of each
 * price with a discount is priced alone, so a discount that needs more than one unit, or a bigger
 * order, never shows as the price of one.
 */
export async function fetchDiscounts(products: string[][]): Promise<Discounts> {
  const one = (id: string) => ({ merchandiseId: id, quantity: 1 });
  const together = await priceCarts(products.filter((ids) => ids.length).map((ids) => ids.map(one)));
  const confirm = together.flatMap(toConfirm);
  const alone = await priceCarts(confirm.map(({ variantId }) => [one(variantId)]));
  const discounts: Discounts = {};
  confirm.forEach(({ sameAs }, i) => {
    const found = alone[i]?.[0] && unitDiscount(alone[i][0]);
    if (found) for (const id of sameAs) discounts[id] = found;
  });
  return discounts;
}

/**
 * A Shopify cart with these lines; returns its checkout URL. With the signed-in shopper's Customer
 * Account API token, checkout opens signed in (and the store can follow up an abandoned checkout).
 * If Shopify refuses the token, the cart is made without it: checkout must never fail for that.
 */
export async function createShopifyCart(
  lines: { merchandiseId: string; quantity: number }[],
  customerAccessToken?: string | null,
): Promise<string> {
  const create = async (buyerIdentity: { customerAccessToken: string } | null) => {
    const data = await shopifyFetch<{
      cartCreate: {
        cart: { checkoutUrl: string } | null;
        userErrors: { message: string }[];
      };
    }>(CART_CREATE_MUTATION, { lines, buyerIdentity });
    const { cart, userErrors } = data.cartCreate;
    if (!cart || userErrors.length) {
      throw new Error(userErrors.map((e) => e.message).join("; ") || "Could not create cart");
    }
    return cart.checkoutUrl;
  };

  if (customerAccessToken) {
    try {
      return await create({ customerAccessToken });
    } catch {
      // Fall through to a cart without the shopper: they can still sign in at checkout.
    }
  }
  return create(null);
}

/** One of the store's policies (Shopify admin > Settings > Policies). Body is the editor's HTML. */
export interface ShopPolicy {
  handle: string;
  title: string;
  body: string;
}

/** The store's policies that have a text: returns, shipping, privacy, terms (in that order). */
export async function fetchPolicies(): Promise<ShopPolicy[]> {
  const data = await shopifyFetch<{ shop: Record<string, ShopPolicy | null> }>(
    /* GraphQL */ `query Policies {
      shop {
        refundPolicy { handle title body }
        shippingPolicy { handle title body }
        privacyPolicy { handle title body }
        termsOfService { handle title body }
      }
    }`,
  );
  return Object.values(data.shop).flatMap((p) => (p?.body.trim() ? [p] : []));
}
