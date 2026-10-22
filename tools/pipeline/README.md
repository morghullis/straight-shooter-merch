# Asset pipeline

Shopify holds the catalog **and** everything the storefront shows about a product. The site reads each
product's art from its custom fields (namespace `custom`), so a product created in Shopify appears on the
site with the site's look, without touching the code.

| Field | Owner | What the site does with it |
| --- | --- | --- |
| `turntable` (list of images) | product | card carousel and product gallery (renders of the 3D model on sand) |
| `on_model_image` (image) | product | card hover, last photo of the gallery |
| `model_3d`, `model_3d_hd` (GLB files) | product | 3D viewer on the product page (light / detailed) |
| `model_3d_showroom` (GLB, optional) | product | the home showroom (defaults to `model_3d`) |
| `model_3d_view` (JSON `{ "fit": 2.35, "yaw": 0 }`) | product | how the model sits on stage |
| `asset_pipeline` (JSON, private) | product | written by the pipeline: state, attempts, last error |
| `short_title` | collection | name in the navigation and on the home tile |
| `tile_title` (one row per line), `tile_image`, `tile_image_secondary`, `tile_theme` (`cream`/`dark`/`sand`) | collection | the collection's home tile |
| `position` | collection | order in the navigation, footer and home tiles |

**A new product is on sale at once:** as soon as it is published on the Headless channel (with stock) it shows on the site with the photos uploaded to it in Shopify, and can be bought; the pipeline adds its art in the background and the site switches to it when it is ready. The renders and the on-model photo are also added to the product's own media in Shopify, before its photos, so the store and the site show the same pictures (the site's gallery: renders, on-model photo, then the product's other photos, each file once).

Without art a product still shows, with the photos uploaded to it in Shopify; a collection without a tile
photo shows its first product. Product type (`Hoodie`, `Tee`...) is the category the showroom labels with;
the tag `featured` puts a product in the home page's featured row; `showroom` pins it into the 3D showroom and `no-showroom` keeps it out.

## New products: automatic

`generate.mjs` makes a product's art from its first photo in Shopify:

1. Meshy image to image: the product alone, straight on, on a plain background (12 credits)
2. Meshy image to 3D: Meshy 7.1, 8K texture, Ultra geometry, PBR (40 credits)
3. Meshy image to image: an on-model photo for the hover, a generic model (never a real person), unless the product already has `on_model_image` (12 credits)
4. the GLB optimised (web + detail) and its turntable rendered on sand, with `../3d`
5. everything uploaded to Shopify Files and the product's fields filled in

So about **64 credits per product**. It runs in the GitHub Action `.github/workflows/product-assets.yml`:
right away when the storefront's `products/create` webhook arrives, every 30 minutes as a safety net, or by
hand from the Actions tab (to redo a product, give its handle). It skips a product tagged `no-3d`, a
product with no photo yet, and a product that failed 3 times; it stops when Meshy's balance would drop
below `MESHY_MIN_BALANCE` (default 100). Delete a product's `asset_pipeline` field to make it run again.

The Action needs, in the repository settings:

- secrets `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` (the Dev Dashboard app) and `MESHY_API_KEY`
- variable `SHOPIFY_STORE_DOMAIN` (`your-store.myshopify.com`)

And for the immediate start, the site (Netlify) needs `GITHUB_DISPATCH_TOKEN` (a fine-grained token with
*Contents: read and write* on this repository) and `GITHUB_DISPATCH_REPO` (`owner/name`).

## Scripts

Run from this folder with Node 20+, after `npm install` in `../3d` and at the repository root. Locally the
credentials come from `PIPELINE_ENV_FILE` (default `./.env`, ignored by git): `SHOPIFY_STORE_DOMAIN`,
`SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `MESHY_API_KEY`.

| Script | What it does |
| --- | --- |
| `node define-metafields.mjs` | Creates the field definitions above in the store (safe to run again). |
| `node generate.mjs --dry-run` | Lists the products that would be processed. |
| `node generate.mjs [handle ...] [--max n]` | Processes the products without assets (or exactly these). |
| `node generate.mjs <handle> --from-glb file.glb --local out/` | Optimises and renders a GLB into `out/` without Meshy or Shopify: a free test. |
| `node generate.mjs <handle> --from-glb file.glb` | Redoes a product's art from a GLB you made or fixed by hand (no credits). |
| `node import-site-assets.mjs site-assets.json` | Moved the site's existing art into Shopify (done once; `site-assets.json` is what it imported). |
| `node register-webhooks.mjs https://your-site` | Points the store's product and collection webhooks at the site. `--list` shows them. |

The app's Admin access needs: products, files, publications and metafield definitions (read and write).
