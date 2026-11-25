# The coupon popup

A popup that asks for a first name and an email, saves the lead in Shopify and has **Shopify** email a discount code of that person's own. It is on exactly while its discount is on in Shopify, and Shopify validates the code at checkout.

```
visitor fills in the popup
  -> the site adds a code of theirs to your discount       (Shopify: discountRedeemCodeBulkAdd)
  -> saves them as a customer: name, consent, tag coupon:CODE
  -> Shopify Flow sees the tag and sends the email          (Shopify Messaging, template below)
  -> they type it at Shopify's checkout, which validates it
```

**Nothing of this is in the browser.** The codes (the discount's and everyone's) exist only in Shopify and in the email: the site's server asks Shopify, and the page only ever receives "ok" or an error. The popup's entry is closed to the storefront API. The browser keeps one thing, that this popup was closed or answered (no name, no email, no code).

Why a tag: Shopify Messaging can print a customer's **tags** in an email but not their metafields or a generated code ([supported variables](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/shopify-messaging/email/create-email/custom-liquid)). Each code is redeemable `usageLimit` times *per code* ([DiscountCodeBasicInput](https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/DiscountCodeBasicInput)).

## Set it up (once)

1. **App.** dev.shopify.com > Apps > Create app, named *Coupon popup*. Version scopes: `read_discounts`, `write_discounts`, `read_customers`, `write_customers`, `read_metaobjects`, and nothing else. In its API access, request **protected customer data** (name and email; reason: marketing). Release the version and install it on the store. A separate app, so the website never holds the keys to products or orders.
2. **Keys.** On Netlify (Site configuration > Environment variables) add the app's `SHOPIFY_COUPON_CLIENT_ID` and `SHOPIFY_COUPON_CLIENT_SECRET` (mark the secret as secret), then deploy again. Without them the popup is off and nothing is saved.
3. **Email.** Shopify > Messaging > create an email from *Code your own* with the template below, save it as a template.
4. **Flow.** Shopify Flow > Create workflow: trigger *Customer tags added*; condition *any added tag starts with* `coupon:`; action *Send marketing email* (that template). Turn it on and test it with your own address before anything else.

## Each campaign

1. **Discounts > Create discount > Amount off products**, Method: *Discount code* (e.g. `WELCOME10`).
   - **Value:** the percentage or amount.
   - **Applies to:** *Specific collections* > **Coupon eligible** (everything except what is excluded, see below), or the collections or products you want.
   - **Minimum purchase:** optional (counts only the eligible items).
   - **Maximum discount uses:** tick both: in total = **1** (it counts per code, so each person's works once) and one use per customer. Nobody is shown `WELCOME10` itself.
   - **Active dates:** start now; leave *Set end date* unticked for a campaign without end.
2. **Content > Metaobjects > Coupon popup**: an entry with the same code (and, if you like, the texts, a photo and the seconds before it opens), set to **Active**.

**To change it:** open the discount and edit the value, what it applies to, or add an end date; the popup follows within a minute or two, and everyone's codes follow the same rules. **To stop it:** deactivate the discount, or set the popup's entry to Draft (the codes already sent keep working). **A new campaign:** a new discount with another code, and that code in the popup's entry.

**To exclude products:** tag them **`no-coupon`** (Products > the product > Tags). *Coupon eligible* is an automatic collection, "Tag is not equal to no-coupon", so they leave it at once; remove the tag and they are back. A whole collection: Products > filter by collection > select all > Bulk edit > *Add tags*. It is not published on any channel: keep it so, or it would show in the site's navigation.

> **With an automatic discount already on** (like HBCU 10) Shopify gives one *product* discount per item, the best for the customer: this code adds nothing to items that already have 10% off. To add up on top, use **Amount off order** instead (in *Combinations* tick **Product discounts** on it, and **Order discounts** on the automatic one), but an order discount cannot exclude products.

## The email template

Change `WELCOME10` to your code when you make a new campaign (a customer may have codes from earlier ones).

```liquid
{% assign code = "" %}
{% for tag in customer.tags %}
  {% if tag contains "coupon:WELCOME10-" %}{% assign code = tag | remove: "coupon:" %}{% endif %}
{% endfor %}
<body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#f0ab27">
      <tr><td style="background:#0b0b0b;padding:28px;color:#f0ab27;font-size:12px;letter-spacing:2px;text-transform:uppercase">{{ shop.name }}</td></tr>
      <tr><td style="padding:32px 28px;color:#14110a">
        <p style="margin:0;font-size:38px;line-height:1;font-weight:900;text-transform:uppercase">{% if customer.first_name != blank %}{{ customer.first_name }}, your code is in.{% else %}Your code is in.{% endif %}</p>
        <p style="margin:18px 0 0;font-size:16px;line-height:1.5">It is yours only and good for one order. Type it in at checkout.</p>
        <p style="margin:22px 0;padding:16px;border:2px dashed #14110a;font-size:24px;font-weight:700;letter-spacing:2px;text-align:center">{{ code }}</p>
        <p style="margin:0;text-align:center"><a href="https://straightshootershop.com/collections/all" style="display:inline-block;background:#14110a;color:#fff;padding:16px 28px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none">Shop now</a></p>
      </td></tr>
      <tr><td style="background:#0b0b0b;padding:20px 28px;color:#999;font-size:12px">{{ unsubscribe_link }}</td></tr>
    </table>
    {{ open_tracking }}
  </td></tr></table>
</body>
```

## What it does with people's data

Name, email, consent (with its date) and the code, in Shopify Customers; nothing is kept on the site. One code per person and discount. The answer, and how long it takes, is the same for a new address and a known one (the lead is saved right after it; problems are in the function's log as `[coupon]`); an existing customer keeps their name, and someone who unsubscribed is never signed up again. Limits per hour: 5 from one connection, 2 for one email, 300 codes per discount, 3,000 requests in all (stored only as hashes; if they cannot be counted the form says no). Sign-up is single opt-in: the email itself is the proof, since the code only reaches its inbox. Code: `src/lib/coupon`, `src/app/coupon-actions.ts`, `src/components/coupon`.
