# Straight Shooter Merch

Headless Shopify storefront built with **Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4**, plus **Motion** for scroll animation and **three.js / react-three-fiber** for 3D.

The top of the home page (header, hero, four collection tiles, featured products) is a measured clone of the reference screenshot: container, spacing, type sizes and colours were taken from it pixel by pixel, and everything animated settles back onto that exact layout. Below it, the page is built around the fans.

It runs out of the box on a demo catalog. Add your Shopify credentials and the same pages read your real store: products, collections and every product's art (turntable renders, on-model photo, 3D models) come from Shopify, so a product created there shows on the site with its look, and new products get their 3D model, front and back views and hover photo made automatically, redone when a photo is added ([tools/pipeline](tools/pipeline/README.md)). **How this runs on Shopify is in [docs/SHOPIFY.md](docs/SHOPIFY.md); what went wrong, the guards that now prevent it and what to do if production breaks are in [docs/INCIDENTS.md](docs/INCIDENTS.md).**

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## What is on the page

**Scroll motion** (all from `src/components/motion/*`). Mouse wheels and trackpads get inertial smooth scrolling (Lenis, `SmoothScroll`), so the page and every scroll-linked effect glide; touch keeps the device's own scrolling. Overlays (cart, menu) pause it through one shared lock (`src/lib/scroll-lock.ts`).
- Hero intro in pure CSS, so it plays before hydration: headline wipes in line by line, CTA pops, the gold bar draws, and **the real signature** (the brand's own artwork, `assets-src/signature/`) is written on as if by the pen, stroke after stroke along the route the pen takes, on phones too, over the photo just above the headline. The image itself is never redrawn, only revealed, so no detail changes. The pen routes are in `tools/signature/build.py` (snapped onto the centre of the ink; `Signature`, `signature-paths.ts`).
- On desktop the dark wall behind the show words runs on to the right edge of the screen and melts into the header and the page (no box edges).
- Hero layers drift at different speeds while you scroll, and respond to the pointer on desktop. The show words on the right are a vertical carousel (`GhostRoll`): they rest as the designed stack, then roll up one line at a time; on phones they are a slow horizontal ticker.
- Section titles slide up from behind a mask; cards and tiles reveal with a stagger.
- Two taped catchphrase bands whose speed and direction follow your scroll velocity; they hold still while the pointer is on them.
- A thin gold progress rule at the top of the page.
- **Reduced motion:** the operating system's "reduce motion" setting turns every animation off (CSS and JS); the page then shows the final static layout and the showroom becomes tabs.

**The store's products.** The store (kvh0hd-f0.myshopify.com) holds all twelve products: its own five (Blasphemous! Hoodie and T Shirt, and the three Culture Table crop tees) and the seven made for this site, published only on its Headless channel. The site shows each product as it is in Shopify: its images in their admin order (the first is the card's picture and **the second shows on hover**; the pipeline puts the front and back views of its 3D model and its on-model photo first, the crop tees show their printed back first) and the GLBs for the 3D viewer from its custom fields. Change or reorder the images in Shopify and the site follows at once. Where Meshy invented the side it never saw, `tools/3d/project-front.mjs` put the real one on (the Culture Table front of the crop tees, the Edible back). None of the store's page design is copied.

**The strip under the hero** shows four tiles in the reference design, drawn from the store: its collections, then every product (its on-model photo, its collection's name, *Shop it*). Every few seconds a random tile rolls up like a cube and shows the next one, so the strip walks through the whole store; it holds still under the pointer or keyboard focus, off screen and with reduced motion, and the pictures to come are loaded before they turn (`RotatingStrip`).

**Product cards** are carousels of the product's images in their Shopify order (front and back views of its 3D model, then its photos). Swipe on a phone, arrows on hover on a desktop; only the first picture loads up front, the other angles load lazily and fade in. On desktop hover the first slide cross-fades to the product's **second image** (the garment worn by a model, where the pipeline puts it). In horizontal phone rails the rail keeps the swipe.

**3D showroom** — right after the featured products, the most viewed product of each category (Shopify's product type; product page views and adds to the cart over the last month, counted by the site in Netlify Blobs: `src/lib/popularity.ts`, `/api/track`) among those with a 3D model, categories in the order of their product's engagement, up to six; before there is any data, Shopify's best-selling order. Each uses its showroom model from Shopify (`model_3d_showroom`: the four original light Meshy models for the cap, tee, hoodie and tumbler, otherwise the web model), on a concrete wall with a taped title and stickers; the rail names each stop by its category. In Shopify, the tag `showroom` makes a product its category's pick and `no-showroom` keeps one out. **One gesture = one product** (`useProductPager`): a scroll, trackpad swipe, finger swipe or arrow key spins the current product on its axis and carries it off one side while the next one spins in from the other (`ScrubStage`), always at the same easy pace however hard the visitor scrolls. The rest of the gesture (trackpad inertia, phone momentum) is absorbed, so no product is ever skipped; a new gesture during the second half of a change queues the next product. Arriving from above or below, even with a hard fling, the page stops on the first (or last) product at rest; at the first and last product the page scrolls on as usual. The price sits on the tape like a cash-register display (big dollars, raised cents) and its digit wheels spin to the next price on every change, cents first (`PriceRoll`); the name rolls to the new one (`TextSwap`); the tape and the button stay put. No spec list; on phones no number rail either (desktop keeps the named rail). Drag a product to spin it. On phones the product is framed in the free space between the title and the price tape. All the models stay loaded once downloaded (one after the other, the first product first), on phones too, so going back never waits. The feel (pace, thresholds, spin) is set in `src/config/showroom.ts`. Visitors without WebGL or with reduced motion get a tab version.

**For the fans**
- *Pick your lane*: Sports, Politics and Culture as paper studio-pass tickets with the real show, channel and schedule, a live **ON AIR** stamp (computed in US Eastern time) and a countdown to the next Wednesday show.
- *Which fan are you?* — a paper ballot that recommends products from the real catalog.
- *Join the crew* — a season-pass email sign-up (posts to `FAN_SIGNUP_WEBHOOK`; without it, it says demo mode and saves nothing).

The facts used (show names, channels, times, catchphrases) live in [fans.ts](src/config/fans.ts) with their source noted. Edit them there if a schedule changes.

**Phones are a first-class layout, not a shrunken desktop**: compact sticky header with the full logo, full-screen staggered menu, snap-scroll carousels for the tiles / featured products / tickets / related products, a sticky buy bar on product pages, 44 px touch targets, safe-area insets and `svh` units.

## Big screens (27", 32", ultrawide)

All sizes are in `rem`, and from the reference width (1326 px) up the root font size grows with the viewport (`html` in `globals.css`, capped at 2.6x). The whole page, grids included, scales as one piece: same shape and the same margins as the clone, from a laptop to a 3440 px ultrawide. Below 1326 px nothing changes. Breakpoints stay in viewport pixels and image `sizes` use `vw` above 1326 px so the browser still picks sharp files. New components should size in `rem` (the `Icon` component already does), not `px`.

## Design language

Gaffer tape is the shared surface: the showroom title, the price and every gold or ink button ("Shop all merch" included) are strips of tape that behave like real buttons: they lift and straighten under the pointer, press down on click and show a focus ring (`.tape-surface` in `globals.css`, `Tape` and `Button`). The torn ends keep their shape and the middle stretches to any size. What is printed on the tape is pressed into it (`.tape-print`): solid ink with a light lip and an upper shade (a debossed groove), a faint unevenness of ink, and the tape's creases catching the light over the letters.

The header icons are thin and quiet, with the brand in the details: search is a scope with a gold dead-centre (the Straight Shooter crosshair), the menu ends in the hero's short gold bar (`HeaderIcons`). With something in the cart, the count burns on a small stamped flame that flickers (`CartFlame`, Meshy); an empty cart shows nothing. The new sections are made of print and broadcast ephemera instead of the glow, glass and gradient look common to generated sites: gold gaffer tape, perforated studio-pass tickets with barcodes and stamps, a paper ballot with a hand-drawn X, a concrete wall with stickers. Those pieces were generated with Meshy and live in `public/images/art/`.

## Where things are

Nothing user-facing is hard-coded in components: text, art, models and layout numbers each come from one place.

| Path | What |
| --- | --- |
| `src/config/copy.ts` | **Every UI string** (labels, a11y text, empty states, errors) |
| `src/config/site.ts` | Brand, the fixed start of the nav (Home, Shop all), hero lines, footer help links |
| `src/config/fans.ts` | Shows, schedules, catchphrases, quiz questions |
| `src/config/art.ts` | Brand graphics (and the official logo) with their real dimensions |
| `src/config/product-media.ts` | The demo catalog's angle renders and their order |
| `src/config/showroom.ts` | The showroom's pace: how long a change takes, how long the page takes to settle, gesture thresholds, spin |
| `src/config/models.ts` | How a product's 3D model sits on a stage (`modelSpecFor`), the showroom stickers, and the demo catalog's GLBs |
| `src/app/globals.css` | Design tokens (container, header height, hero measurements, card ratio), hero keyframes, motion-off rules |
| `src/components/ui/*` | Reusable primitives: `Button`, `Container`, `Art`, `Tape`, `Carousel`, icons |
| `src/components/motion/*` | `Reveal`, `RevealText`, `ParallaxLayer`, `ScrollHost`, `VelocityMarquee`, `SmoothScroll`, `useProductPager` (one gesture = one product), scroll progress, motion preference |
| `src/components/home/*` | Hero, strip, featured, showroom, marquee, fan zone, crew band |
| `src/components/product/*` | `ProductCard` + `CardGallery` (angle carousel, lazy, on-model hover), `ProductMedia` (angles / on-model / 3D), `ProductForm` (sticky buy bar) |
| `src/components/brand/Logo.tsx` | The official Straight Shooter Shop logo (cut out of its black background, source in `assets-src/brand/`), sized by `--logo-w`; the tab and home-screen icons (`src/app/icon.png`, `apple-icon.png`, `favicon.ico`) are its S |
| `src/components/three/*` | r3f stages, studio lighting, lazy viewer |
| `src/components/layout/*` | Header (mobile menu), nav, footer |
| `src/lib/catalog/*` | Shopify Storefront client (data and the art in the custom fields), mock catalog, cached data access, showroom ranking |
| `src/lib/navigation.ts` | Nav, footer and home tiles from the store's collections |
| `src/lib/popularity.ts`, `src/app/api/track/route.ts` | Product views and adds to the cart, counted per day (Netlify Blobs) |
| `src/app/api/revalidate/route.ts` | Shopify webhook receiver (HMAC-verified); starts the asset pipeline for new products |
| `tools/pipeline/`, `.github/workflows/product-assets.yml` | The asset pipeline: Meshy 3D model, front and back views and on-model hover photo for new products (and products given a new photo), uploaded to Shopify |
| `tools/3d/` | Optimise the GLBs, render the front and back views from the original models, repair a model (also used by the pipeline) |
| `tools/signature/` | `build.py`: the pen route that writes the real hero signature on (Python, numpy + Pillow) |
| `docs/` | `SHOPIFY.md`, `meshy-assets.json` (what Meshy made and which model won), screenshots |
| `assets-src/` | Original full-size images and GLBs from Meshy (not served) |

## Connect Shopify

Short version (full walkthrough in [docs/SHOPIFY.md](docs/SHOPIFY.md), the art fields and the pipeline in [tools/pipeline/README.md](tools/pipeline/README.md)):

1. Headless channel → a storefront → its private Storefront token in `.env.local` with the store domain.
2. A Dev Dashboard app with Admin access for the pipeline; `node tools/pipeline/define-metafields.mjs` creates the custom fields.
3. Create products and collections in Shopify; publish them on the Headless channel. New products get their art automatically (the GitHub Action needs its secrets).
4. Deploy, then `node tools/pipeline/register-webhooks.mjs https://<your-domain>` and set `SHOPIFY_WEBHOOK_SECRET`.

## Before you launch

- **Hero photo** (`public/images/hero/hero-photo.webp`, 1611 × 851) is cut from the store's own hero banner (`assets-src/hero/store-banner-original.jpg`), with the signature printed on it taken out (filled from the wall around it), so the page can write the real signature on top. The whole head is in frame now. For an even sharper hero, use the original photo file. You need the rights to use that photograph.
- **Product photos**: the angle renders come from AI-generated 3D models, the on-model photos and the brand graphics are AI mockups made with Meshy (and the pipeline makes the same for new products). Swap in real photography in the product's fields in Shopify; no code change needed.
- The 3D models are single-photo reconstructions: the back and sides are inferred, and tiny parts of the generated embroidery are imperfect (a few fragments on the cap's brim). The Silhouette Hoodie was made from a back-view photo; its front is repaired to plain black. Fine for a showroom, not for a catalog of record.
- The *Shipping & returns* and *Contact* copy on `/account` is neutral placeholder text.
- Set `NEXT_PUBLIC_SITE_URL`, `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` (customer accounts, see [docs/SHOPIFY.md](docs/SHOPIFY.md#6-customer-accounts)) and `FAN_SIGNUP_WEBHOOK`.

## Known notes

- The browser console shows a `THREE.Clock` deprecation warning. It comes from react-three-fiber with three 0.186, not from this code.
- `npm audit` reports advisories in `eslint-config-next`'s dev-only dependency tree; nothing there ships to the browser.
