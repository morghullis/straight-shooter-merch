# Asset pipeline

Shopify holds the catalog **and** everything the storefront shows about a product. The site reads each
product's art from its custom fields (namespace `custom`), so a product created in Shopify appears on the
site with the site's look, without touching the code.

| Field | Owner | What the site does with it |
| --- | --- | --- |
| `turntable` (list of images) | product | a record of the views the pipeline made, front and back (they are also added to the product's images, which is what the site shows) |
| `on_model_image` (image) | product | card hover, last photo of the gallery |
| `model_3d`, `model_3d_hd` (GLB files) | product | 3D viewer on the product page (light / detailed) |
| `model_3d_showroom` (GLB, optional) | product | the home showroom (defaults to `model_3d`) |
| `model_3d_view` (JSON `{ "fit": 2.35, "yaw": 0 }`) | product | how the model sits on stage |
| `asset_pipeline` (JSON, private) | product | written by the pipeline: state, the merchant photos it started from, the images it made, attempts, last error |
| `short_title` | collection | name in the navigation and on the home tile |
| `tile_title` (one row per line), `tile_image`, `tile_image_secondary`, `tile_theme` (`cream`/`dark`/`sand`) | collection | the collection's home tile |
| `position` | collection | order in the navigation, footer and home tiles |

**What the site shows is the product in Shopify:** its images in the order they have in the admin (the first one is the card's picture, the first six its carousel), its title, price, variants and stock. Change, add, remove or reorder the images in Shopify and the site follows at once (the products webhook refreshes it). **A new product is on sale at once:** as soon as it is published on the Headless channel (with stock) it shows with its own photos and can be bought; the pipeline adds its front and back views and its on-model photo in the background, placed first among its images, and the site shows them when they are ready. Reorder or delete them in Shopify like any image.

Without art a product still shows, with the photos uploaded to it in Shopify; a collection without a tile
photo shows its first product. Product type (`Hoodie`, `Tee`...) is the category the showroom labels with;
the tag `featured` puts a product in the home page's featured row. The 3D showroom shows the most viewed product of each category; `showroom` makes a product its category's pick and `no-showroom` keeps it out.

## New and changed products: automatic

`generate.mjs` makes a product's art from its own photos in Shopify:

1. Meshy image to image: the product alone, straight on, on a plain background, from its photos (up to 4: the main one and any just added) (12 credits)
2. Meshy image to 3D: Meshy 7.1, 8K texture, Ultra geometry, PBR (40 credits)
3. Meshy image to image: the on-model photo shown on hover, a generic model (never a real person) (12 credits)
4. the GLB optimised (web + detail) and rendered on sand **from the front and the back only**, with `../3d`; a product tagged `back-print` (graphic on the back) shows its back first and faces the 3D viewer with its back
5. everything uploaded to Shopify Files: the views and the on-model photo lead the product's images, the images of an earlier run are taken off the product (they stay in Files) and the fields are filled in

So about **64 credits per product**. A product runs when:

- it is new (has photos and no 3D model yet);
- **a photo is added to it**: the pipeline records which of the merchant's photos it used (its own images do not count), so a new one makes it redo the product with it;
- it is tagged **`regenerate-assets`** (the tag is removed when done).

Editing a title, price, stock or description never spends credits, and removing a photo does not
trigger a run. A product tagged `no-3d` is left alone, as is one that failed 3 times with the same
photos (add a photo or the tag to retry). The pipeline stops when Meshy's balance would drop below
`MESHY_MIN_BALANCE` (default 100).

It runs in the GitHub Action `.github/workflows/product-assets.yml`: every 10 minutes it takes a quick
look at the store (plain Node, nothing installed, no credits) and only installs the 3D tools and calls
Meshy when a product needs it; the storefront's products webhook can start that look right away; and by
hand from the Actions tab (give handles to redo exactly those products).

The Action needs, in the repository settings:

- secrets `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` (the Dev Dashboard app) and `MESHY_API_KEY`
- variable `SHOPIFY_STORE_DOMAIN` (`your-store.myshopify.com`)

Optional, for the immediate look instead of within 10 minutes: the site (Netlify) needs
`GITHUB_DISPATCH_TOKEN` (a fine-grained token with *Contents: read and write* on this repository) and
`GITHUB_DISPATCH_REPO` (`owner/name`).

## Scripts

Run from this folder with Node 20+, after `npm install` in `../3d` and at the repository root. Locally the
credentials come from `PIPELINE_ENV_FILE` (default `./.env`, ignored by git): `SHOPIFY_STORE_DOMAIN`,
`SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `MESHY_API_KEY`.

| Script | What it does |
| --- | --- |
| `node define-metafields.mjs` | Creates the field definitions above in the store (safe to run again). |
| `node generate.mjs --dry-run` | Lists every product and what the pipeline would do with it. |
| `node generate.mjs --check` | Counts the products that need a run (what the Action does every 10 minutes; needs no 3D tools). |
| `node generate.mjs [handle ...] [--max n]` | Processes the products that need it (or exactly these). |
| `node generate.mjs <handle> --from-glb file.glb --local out/` | Optimises and renders a GLB into `out/` without Meshy or Shopify: a free test. |
| `node generate.mjs <handle> --from-glb file.glb` | Redoes a product's art from a GLB you made or fixed by hand (no credits). |
| `node import-site-assets.mjs site-assets.json` | Moved the site's existing art into Shopify (done once; `site-assets.json` is what it imported). |
| `node register-webhooks.mjs https://your-site` | Points the store's product and collection webhooks at the site. `--list` shows them. |

The app's Admin access needs: products, files, publications and metafield definitions (read and write).
