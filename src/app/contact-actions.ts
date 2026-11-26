"use server";

import { headers } from "next/headers";

import { copy } from "@/config/copy";
import { sendToShopify } from "@/lib/contact/admin";
import { cleanMessage } from "@/lib/contact/message";
import { isCouponConfigured } from "@/lib/coupon/admin";
import { allow } from "@/lib/rate-limit";

export type ContactState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | {
      status: "error";
      field?: "name" | "email" | "topic" | "order" | "message";
      message: string;
    };

const HOUR = 3_600_000;

/** A message for customer service. It goes to Shopify, which emails the team (docs/CONTACT.md). */
export async function sendContact(
  _prev: ContactState,
  form: FormData,
): Promise<ContactState> {
  const t = copy.contact.errors;
  // Honeypot: a box people never see.
  if (form.has("extra")) return { status: "sent", email: "" };
  const m = cleanMessage({
    name: form.get("name"),
    email: form.get("email"),
    topic: form.get("topic"),
    order: form.get("order"),
    message: form.get("message"),
  });
  if ("wrong" in m)
    return { status: "error", field: m.wrong, message: t[m.wrong] };
  if (!isCouponConfigured) return { status: "error", message: t.failed };

  const visitor =
    (await headers()).get("x-nf-client-connection-ip") ?? "unknown";
  if (
    !(await allow("contact-visitor", visitor, 5, HOUR)) ||
    !(await allow("contact-email", m.email, 3, HOUR)) ||
    !(await allow("contact-all", "all", 300, HOUR))
  ) {
    return { status: "error", message: t.tooMany };
  }
  try {
    await sendToShopify(m);
  } catch (error) {
    // Tried once more: Shopify stumbles now and then.
    try {
      await new Promise((r) => setTimeout(r, 1200));
      await sendToShopify(m);
    } catch {
      console.error(
        `[contact] ${error instanceof Error ? error.message : error}`,
      );
      return { status: "error", message: t.failed };
    }
  }
  return { status: "sent", email: m.email };
}
