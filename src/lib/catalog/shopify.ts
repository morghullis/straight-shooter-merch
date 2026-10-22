import "server-only";

import { balancedRows } from "@/lib/format";

import type {
  CatalogImage,
  Collection,
  Model3D,
  Money,
  Product,
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
const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-07";
// A private token from the Headless channel (shpat_…) goes in its own header; a public token in the classic one.
const tokenHeader = token?.startsWith("shpat_") ? "Shopify-Storefront-Private-Token" : "X-Shopify-Storefront-Access-Token";

export const isShopifyConfigured = Boolean(domain && token);

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function shopifyFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  if (!domain || !token) {
    throw new Error("Shopify is not configured");
  }

  const res = await fetch(`https://${domain}/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [tokenHeader]: token,
    },
    body: JSON.stringify({ query, variables }),
  });

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
        selectedOptions { name value }
      }
    }
    priceRange { minVariantPrice { amount currencyCode } }
    collections(first: 10) { nodes { handle } }
    media(first: 10) { nodes { ... on Model3d { sources { url mimeType } } } }
    onModel: metafield(namespace: "custom", key: "on_model_image") {
      reference { ... on MediaImage { image { url altText width height } } }
    }
    model3d: metafield(namespace: "custom", key: "model_3d") { reference { ... on GenericFile { url } } }
    model3dHd: metafield(namespace: "custom", key: "model_3d_hd") { reference { ... on GenericFile { url } } }
    model3dShowroom: metafield(namespace: "custom", key: "model_3d_showroom") { reference { ... on GenericFile { url } } }
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

const CART_CREATE_MUTATION = /* GraphQL */ `
  mutation CartCreate($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
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

interface RawProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
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
      selectedOptions: { name: string; value: string }[];
    }[];
  };
  priceRange: { minVariantPrice: Money };
  collections: { nodes: { handle: string }[] };
  media?: { nodes: { sources?: { url: string; mimeType: string }[] }[] };
  onModel?: RawImageRef | null;
  model3d?: RawFileRef | null;
  model3dHd?: RawFileRef | null;
  model3dShowroom?: RawFileRef | null;
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

/**
 * The on-model shot comes from the `custom.on_model_image` field (an image).
 * Without it the card simply has no hover shot: its carousel already shows the product images.
 */
function resolveHoverImage(raw: RawProduct): CatalogImage | null {
  const meta = raw.onModel?.reference?.image;
  return meta ? mapImage(meta, `${raw.title} on a model`) : null;
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
    showroom: raw.model3dShowroom?.reference?.url ?? null,
    ...parseView(raw.model3dView?.value),
  };
}

function mapProduct(raw: RawProduct): Product {
  const hoverImage = resolveHoverImage(raw);
  // Shopify decides what shows: the product's images in the order they have in the admin (the
  // first one is the card's picture). The on-model shot is added at the end when it is not one of
  // them already.
  const photos = raw.images.nodes.map((i) => mapImage(i, raw.title));
  const file = (url: string) => url.split("?")[0];
  const images = hoverImage && !photos.some((p) => file(p.url) === file(hoverImage.url)) ? [...photos, hoverImage] : photos;
  const featuredImage = mapImage(raw.featuredImage ?? raw.images.nodes[0] ?? null, raw.title);

  const variants: ProductVariant[] = raw.variants.nodes.map((v) => ({
    id: v.id,
    title: v.title,
    availableForSale: v.availableForSale,
    price: v.price,
    selectedOptions: v.selectedOptions,
  }));

  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
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
  const image = raw.tileImage?.reference?.image ?? raw.image;
  const secondary = raw.tileImageSecondary?.reference?.image;
  const theme = TILE_THEMES.find((t) => t === raw.tileTheme?.value) ?? null;
  const position = Number.parseInt(raw.position?.value ?? "", 10);
  const tileTitle = raw.tileTitle?.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  return {
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    shortTitle: raw.shortTitle?.value || null,
    position: Number.isFinite(position) ? position : null,
    tile: {
      title: tileTitle?.length ? tileTitle : balancedRows(raw.title),
      image: image ? mapImage(image, raw.title) : null,
      secondaryImage: secondary ? mapImage(secondary, raw.title) : null,
      theme,
    },
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

export async function createShopifyCart(
  lines: { merchandiseId: string; quantity: number }[],
): Promise<string> {
  const data = await shopifyFetch<{
    cartCreate: {
      cart: { checkoutUrl: string } | null;
      userErrors: { message: string }[];
    };
  }>(CART_CREATE_MUTATION, { lines });

  const { cart, userErrors } = data.cartCreate;
  if (!cart || userErrors.length) {
    throw new Error(userErrors.map((e) => e.message).join("; ") || "Could not create cart");
  }
  return cart.checkoutUrl;
}
