/**
 * The contact form's rules, without any network: what a message may hold and how it is kept in Shopify.
 * Pure, tested in tests/contact.test.ts.
 */
import { cleanLead } from "../coupon/code";

export const TOPICS = {
  order: "An order",
  products: "Sizes and products",
  returns: "Returns and exchanges",
  other: "Something else",
} as const;
export type Topic = keyof typeof TOPICS;

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
const ORDER = /^#?[A-Za-z0-9-]{3,20}$/;

export interface ContactMessage {
  name: string;
  email: string;
  topic: Topic;
  order: string | null;
  message: string;
}

/** The form's fields, cleaned; or which one is wrong. */
export function cleanMessage(input: {
  name: unknown;
  email: unknown;
  topic: unknown;
  order: unknown;
  message: unknown;
}):
  ContactMessage | { wrong: "name" | "email" | "topic" | "order" | "message" } {
  const lead = cleanLead(input);
  if ("wrong" in lead) return lead;
  const topic =
    typeof input.topic === "string" && Object.hasOwn(TOPICS, input.topic)
      ? (input.topic as Topic)
      : null;
  if (!topic) return { wrong: "topic" };
  const orderText = typeof input.order === "string" ? input.order.trim() : "";
  if (orderText && !ORDER.test(orderText)) return { wrong: "order" };
  // Line breaks stay; other control characters go.
  const message =
    typeof input.message === "string"
      ? input.message
          .replace(/\r\n?/g, "\n")
          .replace(/[^\P{C}\n]/gu, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
      : "";
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX)
    return { wrong: "message" };
  return {
    ...lead,
    topic,
    order: orderText ? `#${orderText.replace(/^#/, "")}` : null,
    message,
  };
}

/** What the customer service reads (kept on the customer in Shopify, printed in the email). */
export function messageText(m: ContactMessage, at: Date): string {
  return [
    `Topic: ${TOPICS[m.topic]}`,
    `Order: ${m.order ?? "-"}`,
    `Sent: ${at.toISOString().replace("T", " ").slice(0, 16)} UTC`,
    "",
    m.message,
  ].join("\n");
}

/** The tag that starts the email in Shopify Flow: a new one for every message. */
export const CONTACT_TAG = "contact:";
export const contactTag = (at: Date) =>
  `${CONTACT_TAG}${at.toISOString().replace(/\D/g, "").slice(0, 14)}`;
