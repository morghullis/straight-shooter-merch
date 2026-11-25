/**
 * The coupon popup's rules, without any network: what a code looks like, what a discount reads as, when
 * the popup is on. Pure, tested in tests/coupon.test.ts.
 */

/** What the shopper sees of a discount with a code, read from Shopify. */
export interface CouponOffer {
  /** "10% off", "$10 off", "Free shipping" or the discount's own name. */
  label: string;
  startsAt: string | null;
  endsAt: string | null;
}

/** Any Shopify code the site passes on (typed by the shopper or taken from the email's link). */
const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,59}$/;
export const cleanCode = (value: unknown): string | null => {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return CODE.test(code) ? code : null;
};

/** No 0/O, 1/I/L: it may be read from a phone and typed on a laptop. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const RANDOM = 8;

/** A code of one person's own inside the discount: "WELCOME10-7KQM2XRP". `bytes` are random. */
export function personalCode(base: string, bytes: Uint8Array): string {
  const tail = Array.from(bytes.slice(0, RANDOM), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${base.slice(0, 24)}-${tail}`;
}

/** How the code is kept on the customer in Shopify: the email reads it from their tags. Tags hold 40 characters. */
export const CODE_TAG = "coupon:";
export const codeTag = (code: string) => `${CODE_TAG}${code}`;

/** The code a customer already has from this discount, if any. */
export function existingCode(tags: string[], base: string): string | null {
  const prefix = codeTag(`${base.slice(0, 24)}-`).toLowerCase();
  const tag = tags.find((t) => t.toLowerCase().startsWith(prefix));
  return tag ? tag.slice(CODE_TAG.length).toUpperCase() : null;
}

/** On between its dates, exactly as set in Shopify. */
export function isOn(offer: Pick<CouponOffer, "startsAt" | "endsAt">, now: number): boolean {
  const from = offer.startsAt ? Date.parse(offer.startsAt) : -Infinity;
  const to = offer.endsAt ? Date.parse(offer.endsAt) : Infinity;
  return now >= from && now < to;
}

/** "2d 4h", "5h 12m", "8m": the time left, or null when it has no end (or has ended). */
export function timeLeft(endsAt: string | null, now: number): string | null {
  if (!endsAt) return null;
  const minutes = Math.floor((Date.parse(endsAt) - now) / 60_000);
  if (!(minutes > 0)) return null;
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;
const NAME_MAX = 50;

/** The form's fields, cleaned; or which one is wrong. */
export function cleanLead(input: { name: unknown; email: unknown }): { name: string; email: string } | { wrong: "name" | "email" } {
  const name = typeof input.name === "string" ? input.name.replace(/[\p{C}<>]/gu, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "";
  if (name.length < 2 || !/\p{L}/u.test(name) || /https?:|www\./i.test(name)) return { wrong: "name" };
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return { wrong: "email" };
  return { name, email };
}
