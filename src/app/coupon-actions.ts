"use server";

import { randomBytes } from "node:crypto";

import { headers } from "next/headers";

import { fetchCouponPopups } from "@/lib/catalog/shopify";
import { copy } from "@/config/copy";
import { addCode, fetchCouponDiscount, findCustomer, isCouponConfigured, saveLead } from "@/lib/coupon/admin";
import { cleanCode, cleanLead, codeTag, existingCode, isOn, personalCode } from "@/lib/coupon/code";
import { allow } from "@/lib/rate-limit";

export type ClaimResult = { ok: true } | { ok: false; field?: "name" | "email" | "consent"; message: string };

const HOUR = 3_600_000;
/** Goes an hour: from one connection, for one email address, and new codes of one discount (a flood of emails stops there). */
const PER_VISITOR = 5;
const PER_EMAIL = 2;
const NEW_CODES = 300;

/**
 * Someone asks for the coupon: their own code is added to the discount in Shopify, they are saved as a
 * customer with the code as a tag, and Shopify emails it. The answer is the same for everyone, new or
 * not, so it never tells whether an address is a customer's.
 */
export async function claimCoupon(input: { popup: string; name: string; email: string; consent: boolean; company: string }): Promise<ClaimResult> {
  const t = copy.coupon.errors;
  // Honeypot: people never see this field.
  if (input.company) return { ok: true };
  const lead = cleanLead(input);
  if ("wrong" in lead) return { ok: false, field: lead.wrong, message: lead.wrong === "name" ? t.name : t.email };
  if (input.consent !== true) return { ok: false, field: "consent", message: t.consent };
  if (!isCouponConfigured) return { ok: false, message: t.ended };

  // Only the address Netlify itself sees: the other headers are whatever the sender writes. Without it, everyone shares one count.
  const visitor = (await headers()).get("x-nf-client-connection-ip") ?? "unknown";
  if (!(await allow("coupon-visitor", visitor, PER_VISITOR, HOUR))) return { ok: false, message: t.tooMany };

  try {
    // Asked of Shopify now, not of the cache: the discount may have ended a second ago.
    const entry = (await fetchCouponPopups()).find((p) => p.id === input.popup);
    const base = cleanCode(entry?.code);
    const discount = base ? await fetchCouponDiscount(base) : null;
    if (!base || !discount || discount.status !== "ACTIVE" || !isOn(discount, Date.now())) return { ok: false, message: t.ended };

    // The form does not prove whose address it is, so from here on the answer is always the same, an
    // address gets one email per discount, and someone who unsubscribed is never signed up again by it.
    if (!(await allow("coupon-email", `${discount.id}:${lead.email}`, PER_EMAIL, HOUR))) return { ok: true };
    const known = await findCustomer(lead.email);
    if (known && (known.unsubscribed || existingCode(known.tags, base))) return { ok: true };

    // Counted last and per discount: only codes really made use it up, so bad requests cannot close the offer.
    if (!(await allow("coupon-new", discount.id, NEW_CODES, HOUR))) {
      console.error("[coupon] too many new codes in an hour: paused");
      return { ok: false, message: t.failed };
    }
    const code = personalCode(base, randomBytes(8));
    await addCode(discount.id, code);
    await saveLead(lead, known, ["coupon-popup", codeTag(code)]);
    return { ok: true };
  } catch (error) {
    console.error(`[coupon] ${error instanceof Error ? error.message : error}`);
    return { ok: false, message: t.failed };
  }
}
