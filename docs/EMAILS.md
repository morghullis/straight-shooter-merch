# Shopify's own emails

Order and account emails (Settings > Notifications > Customer notifications) carry the site's look: black frame, the logo, a header picture per email, the content on a cream card, gold buttons. Changed in these templates: Order confirmation, Shipping confirmation, Shipping update, Out for delivery, Delivered, Order canceled, Order refund, Customer account welcome.

Each template got two additions, nothing else changed (so Shopify's own content and logic stay):

1. **Styles**, at the end of its `<style>` block, starting with `/* straight-shooter brand */` (backgrounds, cream `.content__cell` and `.section__cell`, gold `.button__cell`, black `.footer`).
2. **A header picture**, a row just before `<table class="row content">`, with the image from Shopify Files:

| Email | Picture (Files) |
|---|---|
| Order confirmation | `email-order-confirmed.jpg` |
| Shipping confirmation | `email-order-shipped.jpg` |
| Shipping update | `email-tracking-update.jpg` |
| Out for delivery | `email-out-for-delivery.jpg` |
| Delivered | `email-delivered.jpg` |
| Order canceled | `email-order-canceled.jpg` |
| Order refund | `email-refund.jpg` |
| Customer account welcome | `email-welcome.jpg` |

*Revert to default* on a template takes it back to Shopify's plain look. The logo and the accent colour of all of them are in Settings > Notifications > Customize email templates.

Marketing emails (coupon, abandoned checkout) are in Shopify Messaging: see COUPON-POPUP.md. Contact messages: CONTACT.md.
