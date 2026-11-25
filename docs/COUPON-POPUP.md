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
2. **Keys.** Run `node scripts/set-coupon-keys.mjs` and paste the app's Client ID and Client secret (dev.shopify.com > Apps > Coupon popup > Settings): it checks them with Shopify, keeps them on Netlify (`SHOPIFY_COUPON_CLIENT_ID`, `SHOPIFY_COUPON_CLIENT_SECRET`, production only) and publishes the site again. Without them the popup is off and nothing is saved.
3. **Email.** Shopify > Messaging > Templates: **Welcome code (WELCOME10)** (made with *Code your own*; its code is below). The look of every Messaging email (logo, black, gold buttons) is in Messaging > Settings > Branding.
4. **Flow.** Shopify Flow > Create workflow: trigger *Customer tags added*; conditions *any added tag starts with* `coupon:` and, for a first-order coupon, *customer number of orders* = 0 (a past customer's code would be refused at checkout); action *Send marketing email* (that template). Turn it on and test it with your own address before anything else.

## Each campaign

1. **Discounts > Create discount > Amount off products**, Method: *Discount code* (e.g. `WELCOME10`).
   - **Value:** the percentage or amount.
   - **Applies to:** *Specific collections* > **Coupon eligible** (everything except what is excluded, see below), or the collections or products you want.
   - **Eligibility:** *Customer segments* > **Customers who haven't purchased**, for a first-order coupon (Shopify checks it by email at checkout).
   - **Minimum purchase:** none (or one: it counts only the eligible items).
   - **Maximum discount uses:** tick both: in total = **1** (it counts per code, so each person's works once) and one use per customer. Nobody is shown `WELCOME10` itself.
   - **Combinations:** tick **Product discounts** and **Shipping discounts** here *and* on every automatic discount (both sides are needed): in a mixed cart each item then keeps its own discount. Ticked on one side only, the code would take the automatic one off the other items.
   - **Active dates:** start now; leave *Set end date* unticked for a campaign without end.
2. **Content > Metaobjects > Coupon popup**: an entry with the same code (and, if you like, the texts, a photo and the seconds before it opens), set to **Active**.

**To change it:** open the discount and edit the value, what it applies to, or add an end date; the popup follows within a minute or two, and everyone's codes follow the same rules. **To stop it:** deactivate the discount, or set the popup's entry to Draft (the codes already sent keep working). **A new campaign:** a new discount with another code, and that code in the popup's entry.

**What is already on offer is left out by itself.** *Coupon eligible* is an automatic collection: every product without the tags `auto-discounted` and `no-coupon`, and without a compare-at price. The asset pipeline (`tools/pipeline/coupon-sync.mjs`, in the same GitHub Action) tags `auto-discounted` whatever an automatic discount covers (today HBCU LIFE) and takes it off when that discount ends; leave that tag to it. Until it runs (minutes to a few hours) nothing adds up anyway: Shopify gives one product discount per item, the best one. `ELIGIBLE` in `tools/pipeline/lib/coupon-scope.mjs` holds the rules.

**To exclude something else by hand:** tag it **`no-coupon`** (Products > the product > Tags; for a whole collection, filter by it > select all > Bulk edit > *Add tags*). Take the tag off and it is back. *Coupon eligible* is not published on any channel: keep it so, or it would show in the site's navigation.

> **With an automatic discount already on** (like HBCU 10) Shopify gives one *product* discount per item, the best for the customer: this code adds nothing to items that already have 10% off. To add up on top, use **Amount off order** instead (in *Combinations* tick **Product discounts** on it, and **Order discounts** on the automatic one), but an order discount cannot exclude products.

## The emails

- **Coupon:** the template above, sent by Flow when someone gets their code.
- **Abandoned checkout:** Messaging > Automations > *Recover abandoned checkout* (on), email *You left something on the table*. It goes to whoever typed their email at checkout and did not finish. *Abandoned cart* and *abandoned browse* need Shopify's own Online Store pages, so they cannot see this site.
- **Header art:** Files > `email-code-header`, `email-cart-header`, `straight-shooter-email-logo`.

### The coupon email's code

Change `WELCOME10` to your code when you make a new campaign (a customer may have codes from earlier ones).

```liquid
{% assign code = "" %}{% assign tags = customer.tags | join: "," | split: "," %}{% for tag in tags %}{% if tag contains "coupon:WELCOME10-" %}{% assign code = tag | strip | remove: "coupon:" %}{% endif %}{% endfor %}
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>{{ email.subject }}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden">{{ email.preview_text }}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0c" style="background:#0a0a0c">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="max-width:600px;background:#000000">
<tr><td align="center" style="padding:28px 24px 12px"><a href="https://straightshootershop.com"><img src="https://cdn.shopify.com/s/files/1/0828/6266/9894/files/straight-shooter-email-logo.png" width="220" alt="The Stephen A. Smith Straight Shooter Shop" style="display:block;width:220px;height:auto;border:0"></a></td></tr>
<tr><td><img src="https://cdn.shopify.com/s/files/1/0828/6266/9894/files/email-code-header.jpg" width="600" alt="Your code is in." style="display:block;width:100%;height:auto;border:0;color:#f0ac28;font-size:40px;font-weight:bold"></td></tr>
<tr><td style="padding:24px 28px 0;color:#ffffff;font-size:18px;line-height:1.5">{% if customer.first_name != blank %}<strong>{{ customer.first_name }},</strong> thanks for signing up.{% else %}Thanks for signing up.{% endif %} This code is yours only and it is good for your first order.</td></tr>
<tr><td style="padding:24px 28px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0ac28" style="background:#f0ac28">
<tr><td align="center" style="padding:10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:2px dashed #14110a;padding:20px 8px 22px">
<div style="color:#14110a;font-size:13px;line-height:1;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Your code</div>
<div style="padding-top:12px;color:#14110a;font-family:'Courier New',Courier,monospace;font-size:26px;line-height:1.1;font-weight:bold;letter-spacing:1px">{{ code }}</div>
</td></tr></table>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:28px 28px 0"><a href="https://straightshootershop.com/collections/all" style="display:block;background:#ffffff;color:#000000;padding:18px 24px;font-size:16px;line-height:1;font-weight:bold;letter-spacing:1px;text-transform:uppercase;text-decoration:none">Shop the gear</a></td></tr>
<tr><td style="padding:24px 28px 32px;color:#b5b5b5;font-size:14px;line-height:1.6">Type it in at checkout with this same email. No minimum. One use, first order only. Items already on sale, like the HBCU Life collection, are not included.</td></tr>
<tr><td style="border-top:1px solid #28282c;padding:22px 28px 32px;color:#8c8c8c;font-size:12px;line-height:1.7">{{ shop.name }} &middot; {{ shop.address.address1 }}, {{ shop.address.city }}, {{ shop.address.province }} {{ shop.address.zip }}, {{ shop.address.country }}<br>{{ unsubscribe_link }}</td></tr>
</table>
{{ open_tracking_block }}
</td></tr>
</table>
</body>
</html>
```

## What it does with people's data

Name, email, consent (with its date) and the code, in Shopify Customers; nothing is kept on the site. One code per person and discount. The answer, and how long it takes, is the same for a new address and a known one (the lead is saved right after it; problems are in the function's log as `[coupon]`); an existing customer keeps their name, and someone who unsubscribed is never signed up again. Limits per hour: 5 from one connection, 2 for one email, 300 codes per discount, 3,000 requests in all (stored only as hashes; if they cannot be counted the form says no). Sign-up is single opt-in: the email itself is the proof, since the code only reaches its inbox. Code: `src/lib/coupon`, `src/app/coupon-actions.ts`, `src/components/coupon`.
