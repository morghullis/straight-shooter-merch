# The coupon popup

A popup that asks for a first name and an email, saves the lead in Shopify and has **Shopify** email a discount code of that person's own. It is on exactly while its discount is on in Shopify, and Shopify validates the code at checkout.

```
visitor fills in the popup
  -> the site adds a code of theirs to your discount       (Shopify: discountRedeemCodeBulkAdd)
  -> saves them as a customer: name, consent, tag coupon:CODE
  -> Shopify Flow sees the tag and sends the email          (Shopify Messaging, template below)
  -> the email's button opens straightshootershop.com/?coupon=CODE
  -> the code sits in the cart, Shopify says if it applies, checkout opens with it in
```

Why a tag: Shopify Messaging can print a customer's **tags** in an email but not their metafields or a generated code ([supported variables](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/shopify-messaging/email/create-email/custom-liquid)). Each code is redeemable `usageLimit` times *per code* ([DiscountCodeBasicInput](https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/DiscountCodeBasicInput)).

## Set it up (once)

1. **App.** dev.shopify.com > Apps > Create app, named *Coupon popup*. Version scopes: `read_discounts`, `write_discounts`, `read_customers`, `write_customers`, and nothing else. In its API access, request **protected customer data** (name and email; reason: marketing). Release the version and install it on the store. A separate app, so the website never holds the keys to products or orders.
2. **Keys.** On Netlify (Site configuration > Environment variables) add the app's `SHOPIFY_COUPON_CLIENT_ID` and `SHOPIFY_COUPON_CLIENT_SECRET` (mark the secret as secret), then deploy again. Without them the popup is off and nothing is saved.
3. **Email.** Shopify > Messaging > create an email from *Code your own* with the template below, save it as a template.
4. **Flow.** Shopify Flow > Create workflow: trigger *Customer tags added*; condition *any added tag starts with* `coupon:`; action *Send marketing email* (that template). Turn it on and test it with your own address before anything else.

## Each campaign

1. **Discounts > Create discount**, with a **code** (e.g. `WELCOME10`), its start and end dates. *Maximum discount uses*: **limit number of times this discount can be used in total = 1** (it counts per code, so each person's works once) and **limit to one use per customer**. Nobody is shown `WELCOME10` itself.
2. **Content > Metaobjects > Coupon popup > Add entry**: the code, and, if you like, the texts, a photo and the seconds before it opens. Set it to **Active**.

That is all: it appears at the start date and goes at the end date. To stop it sooner, set the entry to Draft or deactivate the discount. Texts left empty use the site's (`copy.coupon`).

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
        <p style="margin:18px 0 0;font-size:16px;line-height:1.5">It is yours only and good for one order.</p>
        <p style="margin:22px 0;padding:16px;border:2px dashed #14110a;font-size:24px;font-weight:700;letter-spacing:2px;text-align:center">{{ code }}</p>
        <p style="margin:0;text-align:center"><a href="https://straightshootershop.com/?coupon={{ code }}" style="display:inline-block;background:#14110a;color:#fff;padding:16px 28px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none">Shop with my code</a></p>
      </td></tr>
      <tr><td style="background:#0b0b0b;padding:20px 28px;color:#999;font-size:12px">{{ unsubscribe_link }}</td></tr>
    </table>
    {{ open_tracking }}
  </td></tr></table>
</body>
```

## What it does with people's data

Name, email, consent (with its date) and the code, in Shopify Customers; nothing is kept on the site. One code per person and discount. The answer is the same for a new address and a known one; an existing customer keeps their name, and someone who unsubscribed is never signed up again. Limits per hour: 5 from one connection, 2 for one email, 300 new codes per discount (stored only as hashes; if they cannot be counted the form says no). Sign-up is single opt-in: the email itself is the proof, since the code only reaches its inbox. Code: `src/lib/coupon`, `src/app/coupon-actions.ts`, `src/components/coupon`.
