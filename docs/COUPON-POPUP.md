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

Plain, like a personal letter (few images): Gmail is less likely to file it under Promotions, though marketing emails from Shopify Messaging can still land there. **Editing it in Messaging puts it back to Draft and nothing is sent until *Set to active*: edit and reactivate at once.** If runs failed meanwhile, Flow > Recent runs > each failed run > *Retry* sends those people their code.

Shopify only takes it with `<!DOCTYPE html>` on the first line (the code that reads the tag goes inside the body). Change `WELCOME10` to your code, in the template **and** in the Flow's email, when you make a new campaign (a customer may have codes from earlier ones).

```liquid
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ email.subject }}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#14110a;-webkit-text-size-adjust:100%">
{% assign code = "" %}{% assign tags = customer.tags | join: "," | split: "," %}{% for tag in tags %}{% if tag contains "coupon:WELCOME10-" %}{% assign code = tag | strip | remove: "coupon:" %}{% endif %}{% endfor %}
<div style="display:none;max-height:0;overflow:hidden">{{ email.preview_text }}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff">
<tr><td align="center" style="padding:28px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
<tr><td style="font-size:16px;line-height:1.6">
<p style="margin:0 0 16px">Hi {% if customer.first_name != blank %}{{ customer.first_name }}{% else %}there{% endif %},</p>
<p style="margin:0 0 16px">Thanks for joining the Straight Shooter Shop. Here is your personal code for <strong>10% off your first order</strong>:</p>
<p style="margin:0 0 16px;padding:14px 16px;border-left:4px solid #f0ac28;background:#fbf6e9;font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:bold;letter-spacing:1px">{{ code }}</p>
<p style="margin:0 0 16px">Type it in at checkout with this same email. No minimum. It works once, on your first order. Items already on sale, like the HBCU Life collection, are not included.</p>
<p style="margin:0 0 24px"><a href="https://straightshootershop.com/collections/all" style="color:#14110a;font-weight:bold">Shop the official merch &rarr;</a></p>
<p style="margin:0">Talk soon,<br>The Straight Shooter Shop team</p>
</td></tr>
<tr><td style="padding-top:32px;border-top:1px solid #eeeeee;font-size:12px;line-height:1.6;color:#888888">{{ shop.name }} &middot; {{ shop.address.address1 }}, {{ shop.address.city }}, {{ shop.address.province }} {{ shop.address.zip }}<br>{{ unsubscribe_link }}</td></tr>
</table>
{{ open_tracking_block }}
</td></tr>
</table>
</body>
</html>

```

## What it does with people's data

Name, email, consent (with its date) and the code, in Shopify Customers; nothing is kept on the site. One code per person and discount. The answer, and how long it takes, is the same for a new address and a known one (the lead is saved right after it; problems are in the function's log as `[coupon]`); an existing customer keeps their name, and someone who unsubscribed is never signed up again. Limits per hour: 5 from one connection, 2 for one email, 300 codes per discount, 3,000 requests in all (stored only as hashes; if they cannot be counted the form says no). Sign-up is single opt-in: the email itself is the proof, since the code only reaches its inbox. Code: `src/lib/coupon`, `src/app/coupon-actions.ts`, `src/components/coupon`.
