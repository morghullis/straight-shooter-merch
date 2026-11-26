# The contact form

`/contact` (linked from the footer). A message goes to Shopify, which emails customer service at **instakolor@gmail.com**. Nothing is kept on the site.

```
someone writes on /contact
  -> the site finds the customer by email in Shopify, or makes one (not signed up to any marketing)
  -> keeps the message in the customer's field "Contact message" (custom.contact_message, private)
  -> adds a new tag contact:<date-time> (and contact-form)
  -> Shopify Flow "Contact form to customer service" sees the tag and emails the team
```

It uses the same app and keys as the coupon popup (`SHOPIFY_COUPON_CLIENT_ID` / `_SECRET`, see COUPON-POPUP.md); without them the form says it cannot send. Limits per hour: 5 messages from one connection, 3 for one email, 300 in all. The field "Contact message" is closed to the storefront.

**To answer:** the email has a *Reply to …* button (it opens a reply to the customer's address) and a link to their page in Shopify. The customer's page keeps their last message.

**To send the emails to someone else:** Shopify Flow > *Contact form to customer service* > *Send internal email* > To.

## The email (Flow > Send internal email > Message)

```liquid
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#14110a">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a6a1f">Contact form · straightshootershop.com</p>
<h2 style="margin:0 0 16px;font-size:22px">{{ customer.firstName | escape }} {{ customer.lastName | escape }} wrote to us</h2>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6"><strong>Email:</strong> {{ customer.email }}{% if customer.phone %}<br><strong>Phone:</strong> {{ customer.phone }}{% endif %}</p>
<div style="margin:0 0 20px;padding:14px 16px;border-left:4px solid #f0ac28;background:#faf6ea;font-size:15px;line-height:1.6;white-space:pre-wrap">{{ customer.contactMessage.value | escape }}</div>
<p style="margin:0 0 20px"><a href="mailto:{{ customer.email }}?subject=Re:%20your%20message%20to%20Straight%20Shooter" style="display:inline-block;background:#14110a;color:#ffffff;padding:12px 20px;font-weight:bold;text-decoration:none">Reply to {{ customer.firstName | escape }}</a></p>
<p style="margin:0;font-size:12px;color:#777">Their customer page in Shopify: https://admin.shopify.com/store/straight-shooter-merch-store/customers/{{ customer.legacyResourceId }}</p>
</div>
```
