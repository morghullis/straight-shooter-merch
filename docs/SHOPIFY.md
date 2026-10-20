# Taking this design to Shopify

**The way: headless.** This Next.js app stays the storefront (hosted on Vercel) and Shopify is the backend. Nothing about the design, the scroll motion or the 3D showroom has to be rebuilt in Liquid, so the live store looks exactly like the clone.

| Shopify does | This app does |
| --- | --- |
| Products, variants, prices, inventory | Every page you see: header, hero, strip, cards, showroom, fan zone |
| Collections and tags | Scroll animation, hover on-model cards, 3D viewer |
| Cart + hosted checkout (payments, taxes, shipping, discount codes) | Cart drawer, then a redirect to Shopify's checkout |
| Orders, customers, emails, admin, apps for fulfilment | Fast cached pages, kept fresh by webhooks |

Why this and not a Liquid theme: scroll-scrubbed 3D (three.js / react-three-fiber), the pinned showroom, the parallax hero and the React component library cannot live inside a Liquid theme without rewriting them as theme JavaScript, and even then you lose the design fidelity. Headless keeps 100% of it.

**Trade-offs, honestly.** The Shopify theme editor and theme app embeds (reviews widgets, some pop-ups) do not render here, because there is no theme. Content you edit in Shopify (products, images, collections, prices) shows up; layout and copy are edited in code (`src/config/*`). Checkout is Shopify's own hosted page, as on any headless store.

---

## 1. Create the Storefront API access

1. Shopify admin → **Settings → Apps and sales channels → Develop apps → Create an app**.
2. **Configure Storefront API scopes** and enable:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_inventory`
   - `unauthenticated_read_product_tags`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_checkouts`
3. Install the app and copy the **Storefront API access token**.
4. In the project: `cp .env.example .env.local` and set

```bash
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=...
```

With these empty the app runs on the demo catalog, so you can build and review before the store is ready.

## 2. Set up the catalog the design expects

**Collections** (handles must match):

| Handle | Used by |
| --- | --- |
| `straight-shooter` | Tile 1 and nav |
| `stephen-a-smith` | Tile 2 and nav |
| `potus` | Tile 3 and nav |
| `culture-table` | Tile 4 and nav |

**Home grid:** tag the products you want in "Featured" with the tag `featured`. The grid shows six (`home.featured.count` in `src/config/site.ts`); with fewer than six tagged it falls back to the first six products.

**Product images: the card carousel.** Upload each product's pictures in the order you want them swiped. Image #1 is what the card shows at rest (the garment on its own); the card turns up to six of the product's images into a carousel of angles (swipe on a phone, arrows on hover on a desktop, only the first picture loads up front and the rest load lazily). The demo catalog uses six renders of the 3D model per product (front, two three-quarter views, two sides, back), generated with `tools/3d`; upload your own renders or photos the same way.

**On-model hover image.** On desktop hover, the first slide fades to the garment worn by a model. It comes from a product metafield; without it the card simply has no hover shot (it never borrows a carousel image):

- Settings → **Custom data → Products → Add definition**
- Name: `On-model image`
- Namespace and key: `custom.on_model_image`
- Type: **File** (images only)
- Access: tick **Storefronts** (otherwise the Storefront API will not return it)

Then upload the on-model photo into that field on each product. The product page gallery shows the on-model photo too, after the angles.

Phones and touch screens never show the hover image. In horizontal rails on a phone (home, related products) the rail owns the swipe, so those cards keep their first picture; in the collection and search grids a card swipes through its angles.

**3D model.** Open the product → **Media → Add → 3D model** and upload a `.glb`. The product page then shows a **Photo / 3D** switch automatically. Upload the detail model (`public/models/<name>-hd.glb`, 1–4 MB, 4K texture): Shopify serves one file per product and the page shows it on every device. The demo catalog ships two versions of each model (a light one for phones and the showroom, a detail one for the product page on a big screen); the pair is mapped in `src/config/models.ts` by product handle, and `tools/3d/optimize.mjs` makes both from the original 8K GLB.

## 3. Keep the site fresh: the webhook

Pages are cached with `'use cache'` (catalog reads for an hour). So a price change shows up instantly instead of after an hour, Shopify tells the site when something changes:

1. Set a secret in the project: `SHOPIFY_WEBHOOK_SECRET=...`. Use the value Shopify shows under **Settings → Notifications → Webhooks** ("Your webhooks will be signed with ...").
2. In the same screen create JSON webhooks pointing to `https://<your-domain>/api/revalidate` for:
   `products/create`, `products/update`, `products/delete`, `collections/create`, `collections/update`, `collections/delete`, `inventory_levels/update`.

[`src/app/api/revalidate/route.ts`](../src/app/api/revalidate/route.ts) verifies the HMAC signature on every call (constant-time compare), then revalidates the matching cache tags (`products`, `product:<handle>`, `collections`) with stale-while-revalidate, so visitors never wait.

## 4. Deploy

1. Push the repo to GitHub and import it in **Vercel**.
2. Add the environment variables (see `.env.example`): `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`, optionally `NEXT_PUBLIC_SHOPIFY_ACCOUNT_URL` and `FAN_SIGNUP_WEBHOOK`.
3. Point your domain at Vercel. (Keep the old Shopify storefront on a subdomain, or password-protect it, so shoppers land on this one.)
4. Customer accounts: set `NEXT_PUBLIC_SHOPIFY_ACCOUNT_URL` to your store's customer account login. The account page links there.

## 5. How the cart works

The cart lives in the browser. **Checkout** runs a server action that creates a Shopify cart (`cartCreate`) and redirects to its `checkoutUrl`. Payment, tax, shipping rates, discounts and order emails are all Shopify's.

## What to swap before launch

- The angle renders come from AI-generated 3D models, and the on-model photos are AI mockups (see [meshy-assets.json](meshy-assets.json)). Replace them with real product photography in the Shopify admin; nothing in code changes.
- The Silhouette Hoodie's model was built from a back-view photo, so its front is a plain black surface (repaired by `tools/3d/repair-front.mjs`). Photograph or model the real front before launch.
- The hero photograph is 628 × 312 px (cut from the reference screenshot). Replace it with the original high-resolution file.
