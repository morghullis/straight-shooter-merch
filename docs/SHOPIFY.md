# Running this storefront on Shopify

**The way: headless.** This Next.js app is the storefront (hosted on Netlify) and Shopify is the backend. Nothing about the design, the scroll motion or the 3D showroom is rebuilt in Liquid.

| Shopify does | This app does |
| --- | --- |
| Products, variants, prices, inventory, categories (product type), collections | Every page you see: header, hero, strip, cards, showroom, fan zone |
| Each product's art, in its custom fields: turntable renders, on-model photo, 3D models | Scroll animation, hover on-model cards, 3D viewer and showroom |
| Cart + hosted checkout (payments, taxes, shipping, discount codes) | Cart drawer, then a redirect to Shopify's checkout |
| Orders, customers, emails, admin | Fast cached pages, kept fresh by webhooks |

Nothing about a product or a collection is written in the code: create it in Shopify and the site shows it, with its look. New products get their 3D model, turntable and on-model photo made automatically (see [tools/pipeline/README.md](../tools/pipeline/README.md)).

**Trade-offs, honestly.** The Shopify theme editor and theme app embeds (reviews widgets, some pop-ups) do not render here, because there is no theme. Layout and copy are edited in code (`src/config/*`). Checkout is Shopify's own hosted page.

---

## 1. Access

Two credentials, both from the store's admin:

1. **Storefront (the site reads the catalog and creates carts):** Sales channels → **Headless** (add it from the Shopify App Store) → **Create storefront** → *Storefront API tokens*: copy the **private access token** (`shpat_…`). In *Storefront API permissions* enable `unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory`, `unauthenticated_read_product_tags`, `unauthenticated_read_checkouts`, `unauthenticated_write_checkouts`. Put it in `.env.local` (never in `.env.example`, which is committed):

   ```bash
   SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
   SHOPIFY_STOREFRONT_ACCESS_TOKEN=shpat_...
   ```

   A private token is sent as `Shopify-Storefront-Private-Token`, a public one as `X-Shopify-Storefront-Access-Token`; `src/lib/catalog/shopify.ts` picks the header. Only products and collections published on the Headless channel exist for the site.

2. **Admin (the asset pipeline writes the art):** at dev.shopify.com create an app (custom apps can no longer be made under *Develop apps*), give its version the Admin scopes for products, files, publications and metafield definitions (read and write), release it and install it on the store. Its **Client ID** and **Client secret** go in the pipeline's environment (`tools/pipeline/.env` locally, GitHub secrets for the Action).

With the storefront variables empty the app runs on the demo catalog.

## 2. The custom fields

`node tools/pipeline/define-metafields.mjs` creates them (once). Each field is described in [tools/pipeline/README.md](../tools/pipeline/README.md). In short:

- **Products:** `turntable` (the carousel), `on_model_image` (the hover), `model_3d` / `model_3d_hd` / `model_3d_showroom` (GLBs), `model_3d_view` (framing). The pipeline fills them for new products; you can also upload your own photos into them in the admin. A product without them still shows, with its own photos.
- **Collections:** `short_title` (navigation), `tile_title`, `tile_image`, `tile_image_secondary`, `tile_theme` (home tile), `position` (order). A collection without them still shows, named by its title, with its first product as the tile photo.
- **Product type** is the category ("Hoodie", "Tee"). The tag **`featured`** puts a product in the home page's featured row (six; with fewer tagged, the first six products).

**Stock:** products track inventory (the store's own have 100-200 per variant, the site's products 100). A product with no stock left shows as sold out and cannot be bought.

The **navigation, footer and home tiles** list every collection published on the Headless channel, by `position`; the strip under the hero then turns through every product too. To hide one from the site, unpublish it from that channel. The **showroom** shows the four products shoppers engage with most (page views and adds to the cart over the last month, counted by the site in Netlify Blobs), among those with a 3D model; until there is data it uses Shopify's best-selling order. Tag a product `showroom` to pin it there, `no-showroom` to keep it out.

## 3. Keep the site fresh: webhooks

Catalog reads are cached for an hour; webhooks make changes show at once and start the pipeline for new products.

1. `node tools/pipeline/register-webhooks.mjs https://<your-domain>` registers `products/*`, `collections/*` and `inventory_levels/update` to `https://<your-domain>/api/revalidate` (once the site is deployed).
2. Set `SHOPIFY_WEBHOOK_SECRET` on the site to the app's client secret (Shopify signs app webhooks with it).

[`src/app/api/revalidate/route.ts`](../src/app/api/revalidate/route.ts) verifies the HMAC signature (constant-time compare), revalidates the matching cache tags with stale-while-revalidate, and on `products/create` asks GitHub to run the asset pipeline for that product (`GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_REPO`).

## 4. Deploy (Netlify)

1. Environment variables on the site (see `.env.example`): `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`, optionally `GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_REPO`, `FAN_SIGNUP_WEBHOOK`.
2. GitHub repository settings for the pipeline Action: secrets `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `MESHY_API_KEY`; variable `SHOPIFY_STORE_DOMAIN`.
3. Deploy, then register the webhooks (step 3).

## 5. How the cart works

The cart lives in the browser. **Checkout** runs a server action that creates a Shopify cart (`cartCreate`) and redirects to its `checkoutUrl`. Payment, tax, shipping rates, discounts and order emails are all Shopify's.

## What to know before launch

- The angle renders come from AI-generated 3D models and the on-model photos are AI mockups (see [meshy-assets.json](meshy-assets.json)); the pipeline makes the same for new products. Replace any of them with real photography in the product's fields in Shopify; nothing in code changes.
- A 3D model made from one photo infers the sides it never saw. Check a new product's renders in Shopify; to redo them from a fixed GLB: `node tools/pipeline/generate.mjs <handle> --from-glb fixed.glb`.
