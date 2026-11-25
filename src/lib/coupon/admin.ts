import "server-only";

import type { CatalogImage } from "@/lib/catalog/types";

import { termsOf, type CouponOffer } from "./code";

/**
 * The store's Admin API, for the coupon popup only. It has its own app, with no more than it needs
 * (read_discounts, write_discounts, read_customers, write_customers, read_metaobjects), so the site never
 * holds the keys to products, files or orders. Without its credentials the popup is off.
 */
const domain = process.env.SHOPIFY_STORE_DOMAIN;
const clientId = process.env.SHOPIFY_COUPON_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_COUPON_CLIENT_SECRET;
const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";
const TIMEOUT_MS = 8000;

export const isCouponConfigured = Boolean(domain && clientId && clientSecret);

let token: { value: string; until: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId ?? "", client_secret: clientSecret ?? "" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Shopify token exchange failed with ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  token = { value: json.access_token, until: Date.now() + ((json.expires_in ?? 3600) - 120) * 1000 };
  return token.value;
}

async function admin<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  if (!isCouponConfigured) throw new Error("The coupon app is not configured");
  const res = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await accessToken() },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Shopify request failed with ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error("Shopify returned no data");
  return json.data;
}

function check(errors: { message: string }[], what: string) {
  if (errors.length) throw new Error(`${what}: ${errors.map((e) => e.message).join("; ")}`);
}

/** One "Coupon popup" entry (metaobject `coupon_popup`), as typed in Shopify. Only the Admin API can read it. */
export interface CouponPopupEntry {
  id: string;
  /** The code of the discount it offers. It never leaves the server. */
  code: string | null;
  kicker: string | null;
  title: string | null;
  text: string | null;
  button: string | null;
  successTitle: string | null;
  successText: string | null;
  image: CatalogImage | null;
  delay: number;
}

export const POPUPS_QUERY = /* GraphQL */ `
  query CouponPopups {
    metaobjects(type: "coupon_popup", first: 10) {
      nodes {
        id
        capabilities { publishable { status } }
        fields { key value reference { ... on MediaImage { alt image { url width height } } } }
      }
    }
  }
`;

/** The entries set to Active. */
export async function fetchCouponPopups(): Promise<CouponPopupEntry[]> {
  type Field = { key: string; value: string | null; reference?: { alt?: string | null; image?: { url: string; width: number | null; height: number | null } | null } | null };
  const data = await admin<{ metaobjects: { nodes: { id: string; capabilities: { publishable: { status: string } }; fields: Field[] }[] } }>(POPUPS_QUERY, {});
  return data.metaobjects.nodes
    .filter((n) => n.capabilities.publishable.status === "ACTIVE")
    .map((n) => {
      const field = (key: string) => n.fields.find((f) => f.key === key);
      const text = (key: string) => field(key)?.value?.trim() || null;
      const photo = field("image")?.reference;
      const delay = Number.parseInt(text("delay_seconds") ?? "", 10);
      return {
        id: n.id,
        code: text("discount_code"),
        kicker: text("kicker"),
        title: text("title"),
        text: text("text"),
        button: text("button"),
        successTitle: text("success_title"),
        successText: text("success_text"),
        image: photo?.image ? { url: photo.image.url, altText: photo.alt ?? "", width: photo.image.width ?? 1200, height: photo.image.height ?? 900 } : null,
        delay: Number.isFinite(delay) ? Math.min(120, Math.max(2, delay)) : 8,
      };
    });
}

export const DISCOUNT_QUERY = /* GraphQL */ `
  query CouponDiscount($code: String!) {
    codeDiscountNodeByCode(code: $code) {
      id
      codeDiscount {
        ... on DiscountCodeBasic {
          title status startsAt endsAt
          customerGets {
            items { __typename }
            value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount currencyCode } } }
          }
          minimumRequirement {
            ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } }
            ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
          }
        }
        ... on DiscountCodeBxgy { title status startsAt endsAt }
        ... on DiscountCodeFreeShipping { __typename title status startsAt endsAt }
      }
    }
  }
`;

interface RawDiscount {
  __typename?: string;
  title?: string;
  status?: "ACTIVE" | "EXPIRED" | "SCHEDULED";
  startsAt?: string;
  endsAt?: string | null;
  minimumRequirement?: { greaterThanOrEqualToSubtotal?: { amount: string; currencyCode: string }; greaterThanOrEqualToQuantity?: string } | null;
  customerGets?: { items?: { __typename: string }; value?: { percentage?: number; amount?: { amount: string; currencyCode: string } } };
}

export interface CouponDiscount extends CouponOffer {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "SCHEDULED";
}

function labelOf(d: RawDiscount): string {
  const value = d.customerGets?.value;
  if (value?.percentage) return `${Math.round(value.percentage * 100)}% off`;
  if (value?.amount) {
    const n = Number(value.amount.amount);
    return `${new Intl.NumberFormat("en-US", { style: "currency", currency: value.amount.currencyCode, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)} off`;
  }
  return d.__typename === "DiscountCodeFreeShipping" ? "Free shipping" : (d.title ?? "");
}

/** Only of a plain amount off: the others' rules do not fit in a line (their title or the entry's text says them). */
function conditionsOf(d: RawDiscount): string | null {
  if (!d.customerGets) return null;
  return termsOf({
    wholeOrder: d.customerGets.items?.__typename === "AllDiscountItems",
    minAmount: d.minimumRequirement?.greaterThanOrEqualToSubtotal,
    minQuantity: Number(d.minimumRequirement?.greaterThanOrEqualToQuantity ?? 0) || null,
  });
}

/** The discount a code belongs to, as it is in Shopify now; null when there is none. */
export async function fetchCouponDiscount(code: string): Promise<CouponDiscount | null> {
  const { codeDiscountNodeByCode: node } = await admin<{ codeDiscountNodeByCode: { id: string; codeDiscount: RawDiscount } | null }>(DISCOUNT_QUERY, { code });
  const d = node?.codeDiscount;
  if (!node || !d?.status) return null;
  return { id: node.id, status: d.status, label: labelOf(d), terms: conditionsOf(d), startsAt: d.startsAt ?? null, endsAt: d.endsAt ?? null };
}

export const ADD_CODE = /* GraphQL */ `
  mutation AddCouponCode($discountId: ID!, $codes: [DiscountRedeemCodeInput!]!) {
    discountRedeemCodeBulkAdd(discountId: $discountId, codes: $codes) { bulkCreation { id done importedCount failedCount } userErrors { message } }
  }
`;
export const CODE_STATUS = /* GraphQL */ `
  query CouponCodeStatus($id: ID!) { discountRedeemCodeBulkCreation(id: $id) { done importedCount failedCount } }
`;

/** Adds one person's code to the discount and waits until Shopify takes it (the email must never carry a code that does not work). */
export async function addCode(discountId: string, code: string): Promise<void> {
  type Bulk = { id: string; done: boolean; importedCount: number; failedCount: number };
  const { discountRedeemCodeBulkAdd: added } = await admin<{ discountRedeemCodeBulkAdd: { bulkCreation: Bulk | null; userErrors: { message: string }[] } }>(ADD_CODE, {
    discountId,
    codes: [{ code }],
  });
  check(added.userErrors, "coupon code");
  let bulk = added.bulkCreation;
  for (let i = 0; bulk && !bulk.done && i < 10; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const { discountRedeemCodeBulkCreation: now } = await admin<{ discountRedeemCodeBulkCreation: Omit<Bulk, "id"> | null }>(CODE_STATUS, { id: bulk.id });
    bulk = now ? { id: bulk.id, ...now } : null;
  }
  // Not imported because it is already there: an earlier try got through.
  if (bulk?.done && bulk.importedCount < 1 && (await fetchCouponDiscount(code))?.id === discountId) return;
  if (!bulk?.done || bulk.importedCount < 1) throw new Error("coupon code: Shopify did not take it");
}

export const FIND_CUSTOMER = /* GraphQL */ `
  query CouponCustomer($email: String!) {
    customerByIdentifier(identifier: { emailAddress: $email }) { id tags defaultEmailAddress { marketingState } }
  }
`;

export interface KnownCustomer {
  id: string;
  tags: string[];
  subscribed: boolean;
  /** They asked to be left alone. */
  unsubscribed: boolean;
}

export async function findCustomer(email: string): Promise<KnownCustomer | null> {
  const { customerByIdentifier: c } = await admin<{
    customerByIdentifier: { id: string; tags: string[]; defaultEmailAddress: { marketingState: string } | null } | null;
  }>(FIND_CUSTOMER, { email });
  const state = c?.defaultEmailAddress?.marketingState;
  return c && { id: c.id, tags: c.tags, subscribed: state === "SUBSCRIBED", unsubscribed: state === "UNSUBSCRIBED" };
}

export const CREATE_CUSTOMER = /* GraphQL */ `
  mutation CouponLead($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { message } } }
`;
export const CONSENT = /* GraphQL */ `
  mutation CouponConsent($input: CustomerEmailMarketingConsentUpdateInput!) { customerEmailMarketingConsentUpdate(input: $input) { userErrors { message } } }
`;
export const TAG_CUSTOMER = /* GraphQL */ `
  mutation CouponTags($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }
`;

const consent = () => ({ marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN", consentUpdatedAt: new Date().toISOString() });

/**
 * The lead in Shopify: a customer with their name, their consent to marketing emails and their code as a
 * tag. An existing customer keeps their own name (the form proves nothing about who fills it in). The tag goes on last: it is what starts the email in Shopify (docs/COUPON-POPUP.md).
 */
export async function saveLead(lead: { name: string; email: string }, known: KnownCustomer | null, tags: string[]): Promise<void> {
  let id = known?.id;
  if (!known) {
    const { customerCreate } = await admin<{ customerCreate: { customer: { id: string } | null; userErrors: { message: string }[] } }>(CREATE_CUSTOMER, {
      input: { email: lead.email, firstName: lead.name, emailMarketingConsent: consent() },
    });
    check(customerCreate.userErrors, "customer");
    id = customerCreate.customer?.id;
  }
  if (known && !known.subscribed) {
    const { customerEmailMarketingConsentUpdate: r } = await admin<{ customerEmailMarketingConsentUpdate: { userErrors: { message: string }[] } }>(CONSENT, {
      input: { customerId: known.id, emailMarketingConsent: consent() },
    });
    check(r.userErrors, "consent");
  }
  const { tagsAdd } = await admin<{ tagsAdd: { userErrors: { message: string }[] } }>(TAG_CUSTOMER, { id, tags });
  check(tagsAdd.userErrors, "tags");
}
