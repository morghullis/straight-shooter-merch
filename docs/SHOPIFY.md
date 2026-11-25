# Running this storefront on Shopify

**The way: headless.** This Next.js app is the storefront (hosted on Netlify) and Shopify is the backend. Nothing about the design, the scroll motion or the 3D showroom is rebuilt in Liquid.

| Shopify does | This app does |
| --- | --- |
| Products, variants, prices, inventory, categories (product type), collections | Every page you see: header, hero, strip, cards, showroom, fan zone |
| Each product's pictures (its images, in their admin order), on-model photo and 3D models | Scroll animation, hover on-model cards, 3D viewer and showroom |
| Cart + hosted checkout (payments, taxes, shipping, discount codes) | Cart drawer, then a redirect to Shopify's checkout |
| Orders, customers, emails, admin | Fast cached pages, kept fresh by webhooks |

Nothing about a product or a collection is written in the code: create it in Shopify and the site shows it, with its look. New products get their 3D model, front and back views and on-model hover photo made automatically, and a product is redone when a photo is added to it (see [tools/pipeline/README.md](../tools/pipeline/README.md)).

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

- **Products:** the product's own images are the carousel and gallery, in their admin order (first = card picture, **second = the picture shown on hover**); `on_model_image` (a record of the pipeline's on-model photo), `model_3d` / `model_3d_hd` / `model_3d_showroom` (GLBs), `model_3d_view` (framing). The pipeline fills them for new products; you can also upload your own photos into them in the admin. A product without them still shows, with its own photos.
- **Collections:** `short_title` (navigation), `tile_title`, `tile_image`, `tile_image_secondary`, `tile_theme` (home tile), `position` (order). A collection without them still shows, named by its title, with its first product as the tile photo. `announcement`, `hero_image`, `hero_image_mobile`, `hero_title`, `hero_kicker`, `hero_cta`: see *The bar and the hero* below.
- **Product page fields** (pinned on every product's admin page, new ones included): `tagline` (line under the name), `highlights` (key points under Add to cart), `material`, `fit`, `care` (one per line), `size_chart` (picture), `shipping_note` (first line of Shipping & returns). Each block shows on the site only once its field is filled in, already styled; empty fields show nothing. The **description** shows as written in the editor (headings, paragraphs, lists, bold, links; colours, fonts and anything else are cleaned out).
- **Shopify's category fields** (Products > the product > Category) are used too: *Target gender* gives "Made for" and the "Women's" label (women's pieces go last in Featured), *Color* gives the colour dots on cards and in Details.
- **Product type** is the category ("Hoodie", "Tee"). The tag **`featured`** puts a product in the home page's featured row (six; with fewer tagged, every product).

**How fast changes show:** a product saved in the admin shows on the site within seconds (webhook). Anything Shopify sends no webhook for (a discount that starts or ends by date, a field filled by an app, a collection's manual order) shows within a minute or two of visits (the `catalog` cache profile in `next.config.ts`).

**Discounts:** an **automatic discount** (Discounts > Create discount > *Amount off products*, Method: *Automatic discount*) shows everywhere by itself: the discounted price, the usual one struck through and a "10% off" label on the cards, the product page, the search, the Showroom and the cart. Shopify works out every amount: automatic discounts are not part of a product's price, so the site asks a Shopify cart what each variant costs (`fetchDiscounts` in `src/lib/catalog/shopify.ts`, `src/lib/catalog/discounts.ts`) and calculates nothing itself. What shows where:

- *Amount off products*, automatic: on the product everywhere, and in the cart.
- *Buy X get Y*, a minimum quantity or amount, *Amount off order*: in the cart, as soon as it applies (a single unit does not have that price).
- *Discount codes*: in the cart (*Have a discount code?*) or at checkout; a link with `?coupon=CODE` brings one. The popup that emails each person their own: [COUPON-POPUP.md](COUPON-POPUP.md). For a price everyone sees, use Method: *Automatic discount*.
- A **compare-at price** on the variant (Products > the product > Pricing) shows as a sale too, with no discount needed.

Each discount gets its own **sticker** automatically (Meshy, 9 credits; the percentage is live text on it): see [tools/pipeline/README.md](../tools/pipeline/README.md#discount-stickers-automatic). Until it is ready, and if it cannot be made, the plain label shows.

For new products, set the discount to a collection instead of to products: what joins the collection gets it.

**Order: Shopify decides.** The order you give the **Shop All** collection (Products > Collections > Shop All > Sort: Manually, drag) is the order of every list on the site; a listed product not in Shop All comes after. Featured Products takes the `featured` products in that order, grouped by category (each category where its first product sits), women's categories last. The strip under the hero: its first three tiles only turn between the products of **The Stephen A. Smith Show** collection (its own manual order); the fourth turns between the collections and everything else (`home.stripLead` in `src/config/site.ts`).

**Stock:** products track inventory (the store's own have 100-200 per variant, the site's products 100). A product with no stock left shows as sold out and cannot be bought.

The **navigation, footer and home tiles** list every collection published on the Headless channel, by `position`; the strip under the hero then turns through every product too. To hide one from the site, unpublish it from that channel. The **showroom** shows three pieces, in this order: a Hoodie, a Hat and a Tee (product types; `home.showroomTypes` in `src/config/site.ts`). For each, the product tagged `showroom`, otherwise the most viewed one with a 3D model (page views and adds to the cart over the last month, counted by the site in Netlify Blobs). Tag a product `no-showroom` to keep it out.

**The bar and the hero** (Products > Collections > the collection > Metafields):

- **Top bar messages** (`announcement`, one per entry): the strip above the navigation, an endless loop. Each message links to its collection; put store-wide ones on **Shop All**. `{discount}` is replaced by the collection's discount at that moment ("{discount} all HBCU" shows as "10% off all HBCU") and the message hides by itself when the discount ends. A collection with everything on sale and no message of its own announces itself ("10% off all HBCU Life").
- **Hero slide photo** (`hero_image`): the collection gets a slide in the home hero, after the brand's own, in an endless carousel (swipe, drag, ticks, arrow keys; it moves on every 7 s and waits under the pointer). A wide photo **without text**: the title (`hero_title`, up to three rows, the last one gold), the label (`hero_kicker`), the button (`hero_cta`) and the current discount are live text. `hero_image_mobile` is optional (phones; otherwise the centre of the wide photo). Clear the photo to take the slide off.

**Options** get their look from what Shopify has for them: a value with its own photo (the variant's image) for every value shows the photos (printed quotes, designs); colours show a dot, from Shopify's category field "Color" or from the colour's name; everything else is text.

**Navigation:** Home, then the collections by `position` (Shop All is 0, so it comes first).

**Collection pages** have a search box, filters and sort, all built from the products: categories are product types, colours and sizes are the products' options (with the swatch of Shopify's category field "Color"), "In stock only" looks at each variant. The search looks at the name, category, show, colours and audience (not tags or descriptions). The default order is Shopify's; the choice stays in the link (`?q=…&type=…&color=…&size=…&stock=1&sort=…`). Filtered by a colour, cards show and open that colour.

**Photos:** cards and the product gallery are square and show every photo whole, so square photos fill them best. A colour that Shopify sells needs its own photo linked to its variants (Shopify > the product > the variant > image); a variant without one keeps the photo already shown.

**Variants** on the product page: picking a colour shows its picture (the variant's image in Shopify) and the price follows the variant (sizes may cost more; a compare-at price above the price shows as a sale). A combination Shopify does not have moves to the closest one in stock; sold-out values are struck through. The link keeps the choice (`?variant=…`), and the cart line shows the chosen colour's picture.

## 3. Keep the site fresh: webhooks

Catalog reads are cached and refresh by themselves within a minute or two; webhooks make changes show at once and start the pipeline for new products.

1. `node tools/pipeline/register-webhooks.mjs https://<your-domain>` registers `products/*`, `collections/*` and `inventory_levels/update` to `https://<your-domain>/api/revalidate` (once the site is deployed), and `discounts/*` when the app has the `read_discounts` scope (dev.shopify.com > the app > a new version with the scope > Release, then approve it on the store; without it a discount shows within a minute or two instead of at once).
2. Set `SHOPIFY_WEBHOOK_SECRET` on the site to the app's client secret (Shopify signs app webhooks with it).

[`src/app/api/revalidate/route.ts`](../src/app/api/revalidate/route.ts) verifies the HMAC signature (constant-time compare), revalidates the matching cache tags with stale-while-revalidate, and on `products/create` asks GitHub to run the asset pipeline for that product (`GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_REPO`).

## 4. Deploy (Netlify)

1. Environment variables on the site (see `.env.example`): `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`, optionally `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` (step 6), `GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_REPO`, `FAN_SIGNUP_WEBHOOK`.
2. GitHub repository settings for the pipeline Action: secrets `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `MESHY_API_KEY`; variable `SHOPIFY_STORE_DOMAIN`.
3. The site is linked to the GitHub repository: a push to `main` builds and publishes it, a pull request gets a deploy preview and runs CI (`.github/workflows/ci.yml`); *Site health* checks production after every push and twice an hour. If production breaks, follow [INCIDENTS.md](INCIDENTS.md#if-production-breaks). `netlify.toml` declares the Next.js runtime (`@netlify/plugin-nextjs`, pinned in `package.json`): Git builds need it.
4. Deploy, then register the webhooks (step 3).

## 5. How the cart works

The cart lives in the browser. **Checkout** runs a server action that creates a Shopify cart (`cartCreate`) and redirects to its `checkoutUrl`. While the drawer is open, Shopify totals the cart too (`refreshCart` in `src/app/actions.ts`), so every automatic discount shows on its line and in the total before checkout; until it answers, the drawer shows the catalog's own discounted prices. Payment, tax, shipping rates, discounts and order emails are all Shopify's. A signed-in shopper's cart carries their Customer Account API token (`buyerIdentity.customerAccessToken`), so checkout opens signed in; if Shopify refuses the token, the cart is made without it.

## 6. Customer accounts

The store uses Shopify's **new customer accounts**: no passwords, the shopper enters their email and gets a code; a new email creates the account. "My Account" (header, menu, footer) leads to `/account`:

- **Connected** (`SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` set): *Sign in* / *Create account* go to Shopify's sign-in page and back to `/account` signed in (Customer Account API, OAuth 2.0 with PKCE: `src/lib/customer-account.ts`, routes `/account/login`, `/account/authorize`, `/account/refresh`, `/account/logout`). The page shows the shopper's name and orders (with Shopify's tracking page), *Manage account* (addresses and details on Shopify, through `/account/manage`), and *Sign out*. The tokens stay in an httpOnly cookie.
- **Not connected**: the same buttons open Shopify's hosted account pages, through `/account/manage`.

`/account/manage` asks Shopify for the store's primary domain and sends the shopper to its `/account`, so the site never links to the store's `.myshopify.com` name.

To connect it, in the Shopify admin: **Sales channels → Headless → (your storefront) → Customer Account API settings**:

1. **Client type**: Public.
2. **Application setup → Edit**: *Callback URI(s)* `https://<site>/account/authorize`; *JavaScript origin(s)* `https://<site>`; *Logout URI* `https://<site>/account`.
3. Copy the **Client ID** (Credentials) into `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` on Netlify and redeploy. (A Confidential client also needs `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET`.)

Shopify only accepts HTTPS callbacks, so sign-in works on the deployed site (not on localhost, nor on deploy previews unless their URL is added).

**Reminders** (abandoned checkout and others) are Shopify's own automations: **Marketing → Automations** (for example *Abandoned checkout*). They reach shoppers who left checkout after giving their email, or who were signed in.

## 7. Your own domain

One domain, two jobs (live since 2026-11-17 UTC with `straightshootershop.com`, registered at GoDaddy):

| Address | Serves | DNS (at the registrar) | Where it is set up |
| --- | --- | --- | --- |
| `straightshootershop.com` | this site | `A @ 75.2.60.5` (Netlify) | Netlify → Domain management (custom domain, HTTPS by Let's Encrypt) |
| `www.straightshootershop.com` | forwards to the one above | `CNAME www <site>.netlify.app` | Netlify (domain alias) |
| `checkout.straightshootershop.com` | Shopify checkout, order status, Shopify's pages | `CNAME checkout shops.myshopify.com` | Shopify → Settings → Domains, **Primary** |
| `stephenasmithshop.com` (+ `www`) | the link handed out: forwards to `straightshootershop.com`, same path (301) | `A @ 75.2.60.5`, `CNAME www stephenasmithshop.com` | Netlify (domain aliases) + redirect rules in `netlify.toml` |

Another domain that should lead to the shop: add it (and its `www`) as domain aliases on Netlify, add its redirect rules to `netlify.toml` and its address to `REDIRECT_DOMAINS` in `.github/workflows/site-health.yml`, then point its DNS at Netlify. Netlify's redirect works on `https://` links too, unlike a registrar's plain forwarding.

Shopify's checkout and emails use the store's primary domain, so making `checkout.` primary is what keeps the `.myshopify.com` name out of sight. Shoppers never see it on the site either: the health check fails if a page shows it.

Moving the site to a new address, in this order (each step keeps the site working):

1. Connect `checkout.<domain>` in Shopify, make it **Primary**, and check that a checkout from the site opens there.
2. At the registrar: `A @` → `75.2.60.5`, `CNAME www` → `<site>.netlify.app`. Leave Shopify's `checkout` and verification records alone.
3. Netlify: add the domain and `www` as an alias; HTTPS follows within minutes.
4. Shopify → Settings → Domains: **delete** the domain and `www` there (only the connection: the domain stays at the registrar). Shopify then shows "Invalid DNS" until they are gone; never press *Connect automatically*, it would point the domain back at Shopify.
5. Webhooks: `node tools/pipeline/register-webhooks.mjs https://<domain>` (it removes the ones on the old address; Shopify refuses webhooks to a domain still connected to the store, hence step 4 first).
6. Customer Account API (section 6): add `https://<domain>/account/authorize`, origin `https://<domain>` and logout `https://<domain>/account`; set `NEXT_PUBLIC_SITE_URL=https://<domain>` on Netlify and redeploy.
7. `node scripts/check-site.mjs https://<domain>`, a sign-in, and a checkout.

## What to know before launch

- The angle renders come from AI-generated 3D models and the on-model photos are AI mockups (see [meshy-assets.json](meshy-assets.json)); the pipeline makes the same for new products. Replace any of them with real photography in the product's fields in Shopify; nothing in code changes.
- A 3D model made from one photo infers the sides it never saw. Check a new product's renders in Shopify; to redo them from a fixed GLB: `node tools/pipeline/generate.mjs <handle> --from-glb fixed.glb`.
