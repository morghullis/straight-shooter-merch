import "server-only";

import type {
  CatalogImage,
  Collection,
  Money,
  Product,
  ProductVariant,
} from "./types";

/**
 * Minimal Shopify Storefront API client. Only used when both env vars are set;
 * otherwise `catalog/index.ts` serves the mock catalog.
 */

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-07";

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
      "X-Shopify-Storefront-Access-Token": token,
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
    availableForSale
    tags
    featuredImage { url altText width height }
    images(first: 10) { nodes { url altText width height } }
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
  query CollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      handle
      title
      description
      products(first: $first) { nodes { ...ProductFields } }
    }
  }
`;

const COLLECTIONS_QUERY = /* GraphQL */ `
  query Collections {
    collections(first: 20) { nodes { handle title description } }
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

interface RawProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
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
  onModel?: { reference: { image: RawImage | null } | null } | null;
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
 * The on-model shot comes from the `custom.on_model_image` product metafield (file type: image).
 * Without it the card simply has no hover shot: its carousel already shows the product images.
 */
function resolveHoverImage(raw: RawProduct): CatalogImage | null {
  const meta = raw.onModel?.reference?.image;
  return meta ? mapImage(meta, `${raw.title} on a model`) : null;
}

function mapProduct(raw: RawProduct): Product {
  const images = raw.images.nodes.map((i) => mapImage(i, raw.title));
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
    availableForSale: raw.availableForSale,
    featuredImage,
    hoverImage: resolveHoverImage(raw),
    images: images.length ? images : [featuredImage],
    options: raw.options,
    variants,
    price: raw.priceRange.minVariantPrice,
    collections: raw.collections.nodes.map((c) => c.handle),
    tags: raw.tags,
    model:
      raw.media?.nodes
        .flatMap((m) => m.sources ?? [])
        .find((s) => s.mimeType === "model/gltf-binary")?.url ?? null,
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
      | (Collection & { products: { nodes: RawProduct[] } })
      | null;
  }>(COLLECTION_PRODUCTS_QUERY, { handle, first: 100 });

  if (!data.collection) return null;
  const { products, ...collection } = data.collection;
  return { collection, products: products.nodes.map(mapProduct) };
}

export async function fetchCollections(): Promise<Collection[]> {
  const data = await shopifyFetch<{ collections: { nodes: Collection[] } }>(COLLECTIONS_QUERY);
  return data.collections.nodes;
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
