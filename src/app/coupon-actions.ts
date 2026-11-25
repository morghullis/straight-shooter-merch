"use server";

import { randomBytes } from "node:crypto";

import { headers } from "next/headers";
import { after } from "next/server";

import { copy } from "@/config/copy";
import { getCouponPopup, publicId } from "@/lib/coupon";
import { addCode, fetchCouponDiscount, fetchCouponPopups, findCustomer, isCouponConfigured, saveLead, type CouponDiscount } from "@/lib/coupon/admin";
import { cleanCode, cleanLead, codeTag, existingCode, isOn, personalCode } from "@/lib/coupon/code";
import { allow } from "@/lib/rate-limit";

export type ClaimResult = { ok: true } | { ok: false; field?: "name" | "email" | "consent"; message: string };

const HOUR = 3_600_000;
/** Goes an hour: from one connection, for one email address, new codes of one discount, and requests in all. */
const PER_VISITOR = 5;
const PER_EMAIL = 2;
const NEW_CODES = 300;
const IN_ALL = 3000;

/**
 * Someone asks for the coupon. Everything that could refuse it is decided before their address is looked
 * at; the rest happens after the answer. So the answer, and how long it takes, is the same for everyone
 * and never tells whether an address is a customer's.
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
  // From the cache first: a popup that is off, or made up, costs Shopify nothing.
  const popup = await getCouponPopup();
  if (!popup || popup.texts.id !== input.popup || !isOn(popup, Date.now())) return { ok: false, message: t.ended };
  if (!(await allow("coupon-asked", "all", IN_ALL, HOUR))) return { ok: false, message: t.tooMany };

  let base: string | null;
  let discount: CouponDiscount | null;
  try {
    // Asked of Shopify now: the discount may have ended a second ago.
    const entry = (await fetchCouponPopups()).find((p) => publicId(p.id) === input.popup);
    base = cleanCode(entry?.code);
    discount = base ? await fetchCouponDiscount(base) : null;
  } catch (error) {
    console.error(`[coupon] ${error instanceof Error ? error.message : error}`);
    return { ok: false, message: t.failed };
  }
  if (!base || !discount || discount.status !== "ACTIVE" || !isOn(discount, Date.now())) return { ok: false, message: t.ended };
  if (!(await allow("coupon-email", `${discount.id}:${lead.email}`, PER_EMAIL, HOUR))) return { ok: true };

  const [discountId, prefix] = [discount.id, base];
  after(() => deliver(lead, discountId, prefix));
  return { ok: true };
}

/**
 * Their own code in the discount, then the lead in Shopify (which emails it). Once per person and
 * discount: one code is made, and a second try only does what is left. The code is never sent to the
 * browser, nor written to the log.
 */
async function deliver(lead: { name: string; email: string }, discountId: string, base: string): Promise<void> {
  const code = personalCode(base, randomBytes(8));
  let added = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const known = await findCustomer(lead.email);
      // Someone who unsubscribed is never signed up again by a form that proves nothing about who fills it in.
      if (known && (known.unsubscribed || existingCode(known.tags, base))) return;
      if (!added) {
        if (!(await allow("coupon-new", discountId, NEW_CODES, HOUR))) throw new Error("too many new codes in an hour: paused");
        await addCode(discountId, code);
        added = true;
      }
      await saveLead(lead, known, ["coupon-popup", codeTag(code)]);
      return;
    } catch (error) {
      console.error(`[coupon] delivery, try ${attempt}: ${error instanceof Error ? error.message : error}`);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
