import "server-only";

import {
  admin,
  check,
  CREATE_CUSTOMER,
  findCustomer,
  TAG_CUSTOMER,
} from "@/lib/coupon/admin";

import {
  CONTACT_TAG,
  contactTag,
  messageText,
  type ContactMessage,
} from "./message";

const KEEP = /* GraphQL */ `
  mutation ContactMessage($m: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $m) {
      userErrors {
        message
      }
    }
  }
`;
const UNTAG = /* GraphQL */ `
  mutation ContactUntag($id: ID!, $tags: [String!]!) {
    tagsRemove(id: $id, tags: $tags) {
      userErrors {
        message
      }
    }
  }
`;

/**
 * A message for customer service, kept in Shopify: on the customer (made if new, without signing them up
 * to anything), in the field custom.contact_message, and a new tag contact:<time>. Shopify Flow sees the
 * tag and emails the team (docs/CONTACT.md). The last message is the one the email prints.
 */
export async function sendToShopify(m: ContactMessage): Promise<void> {
  const at = new Date();
  const known = await findCustomer(m.email);
  let id = known?.id;
  if (!id) {
    const { customerCreate } = await admin<{
      customerCreate: {
        customer: { id: string } | null;
        userErrors: { message: string }[];
      };
    }>(CREATE_CUSTOMER, {
      input: { email: m.email, firstName: m.name },
    });
    check(customerCreate.userErrors, "customer");
    id = customerCreate.customer?.id;
  }
  if (!id) throw new Error("customer: Shopify returned none");

  const { metafieldsSet } = await admin<{
    metafieldsSet: { userErrors: { message: string }[] };
  }>(KEEP, {
    m: [
      {
        ownerId: id,
        namespace: "custom",
        key: "contact_message",
        type: "multi_line_text_field",
        value: messageText(m, at),
      },
    ],
  });
  check(metafieldsSet.userErrors, "message");

  // Only the newest contact tag stays, so the customer's tags do not fill up.
  const old = (known?.tags ?? []).filter((t) => t.startsWith(CONTACT_TAG));
  if (old.length) {
    const { tagsRemove } = await admin<{
      tagsRemove: { userErrors: { message: string }[] };
    }>(UNTAG, { id, tags: old });
    check(tagsRemove.userErrors, "tags");
  }
  const { tagsAdd } = await admin<{
    tagsAdd: { userErrors: { message: string }[] };
  }>(TAG_CUSTOMER, { id, tags: ["contact-form", contactTag(at)] });
  check(tagsAdd.userErrors, "tags");
}
