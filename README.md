# Straight Shooter Merch

Headless Shopify storefront built with **Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4**, plus **Motion** for scroll animation and **three.js / react-three-fiber** for 3D.

The top of the home page (header, hero, four collection tiles, featured products) is a measured clone of the reference screenshot: container, spacing, type sizes and colours were taken from it pixel by pixel, and everything animated settles back onto that exact layout. Below it, the page is built around the fans.

It runs out of the box on a demo catalog. Add your Shopify credentials and the same pages read your real products. **How this goes live on Shopify is in [docs/SHOPIFY.md](docs/SHOPIFY.md).**

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## What is on the page

**Scroll motion** (all from `src/components/motion/*`)
- Hero intro in pure CSS, so it plays before hydration: headline wipes in line by line, CTA pops, the signature is written on, the gold bar draws.
- Hero layers drift at different speeds while you scroll, and respond to the pointer on desktop. The show words on the right are a vertical carousel (`GhostRoll`): they rest as the designed stack, then roll up one line at a time; on phones they are a slow horizontal ticker.
- Section titles slide up from behind a mask; cards and tiles reveal with a stagger.
- Two taped catchphrase bands whose speed and direction follow your scroll velocity; they hold still while the pointer is on them.
- A thin gold progress rule at the top of the page.
- **Reduced motion:** the operating system's "reduce motion" setting turns every animation off (CSS and JS); the page then shows the final static layout and the showroom becomes tabs.

**Product cards** are carousels of the same product from several angles (front, three-quarter, sides, back), rendered from its 3D model. Swipe on a phone, arrows on hover on a desktop; only the first picture loads up front, the other angles load lazily and fade in. On desktop hover the first slide also cross-fades to the garment **worn by a model**. In horizontal phone rails the rail keeps the swipe.

**3D showroom** — right after the featured products, all seven products (Meshy models with 8K textures, Ultra 4K geometry and PBR maps) on a concrete wall with a taped title and stickers. While it is pinned it takes the scroll gesture: one gesture (wheel, trackpad, swipe, arrow or page key) moves exactly one product, however hard the scroll, and the rest of the gesture (trackpad inertia) is swallowed (`useStepScroll`). Each change is the same animation on its own clock (`useProductTransition`): the product spins on its axis as it leaves the stage, the next one spins in from the other side and settles. Only the number, name, price and spec text roll to the new product (`TextSwap`); the tape, rules and button stay put. Scrolling down towards the section glides it in on the first product (the cap); from below it glides in on the last one. Above the cap and below the last product the page scrolls normally, so nothing is trapped. You can drag a product to spin it. The models load right after the page itself; the neighbours of the current product are loaded and warmed up (textures uploaded, shaders compiled) while it rests, so a change never stutters. The timings are in `src/config/showroom.ts`. Visitors without WebGL or with reduced motion get a tab version. On the product page the 3D tile uses a detail model (4K texture) on a big screen with a mouse and the light one elsewhere.

**For the fans**
- *Pick your lane*: Sports, Politics and Culture as paper studio-pass tickets with the real show, channel and schedule, a live **ON AIR** stamp (computed in US Eastern time) and a countdown to the next Wednesday show.
- *Which fan are you?* — a paper ballot that recommends products from the real catalog.
- *Join the crew* — a season-pass email sign-up (posts to `FAN_SIGNUP_WEBHOOK`; without it, it says demo mode and saves nothing).

The facts used (show names, channels, times, catchphrases) live in [fans.ts](src/config/fans.ts) with their source noted. Edit them there if a schedule changes.

**Phones are a first-class layout, not a shrunken desktop**: compact sticky header with the full logo, full-screen staggered menu, snap-scroll carousels for the tiles / featured products / tickets / related products, a sticky buy bar on product pages, 44 px touch targets, safe-area insets and `svh` units.

## Big screens (27", 32", ultrawide)

All sizes are in `rem`, and from the reference width (1326 px) up the root font size grows with the viewport (`html` in `globals.css`, capped at 2.6x). The whole page, grids included, scales as one piece: same shape and the same margins as the clone, from a laptop to a 3440 px ultrawide. Below 1326 px nothing changes. Breakpoints stay in viewport pixels and image `sizes` use `vw` above 1326 px so the browser still picks sharp files. New components should size in `rem` (the `Icon` component already does), not `px`.

## Design language

Gaffer tape is the shared surface: the showroom title, the numerals and the gold and ink buttons are strips of tape, except "Shop all merch", which stays the solid gold button of the reference (`.tape-surface` in `globals.css`, `Tape` and `Button`). The torn ends keep their shape and the middle stretches to any size. The new sections are made of print and broadcast ephemera instead of the glow, glass and gradient look common to generated sites: gold gaffer tape, perforated studio-pass tickets with barcodes and stamps, a paper ballot with a hand-drawn X, a concrete wall with stickers. Those pieces were generated with Meshy and live in `public/images/art/`.

## Where things are

Nothing user-facing is hard-coded in components: text, art, models and layout numbers each come from one place.

| Path | What |
| --- | --- |
| `src/config/copy.ts` | **Every UI string** (labels, a11y text, empty states, errors) |
| `src/config/site.ts` | Brand, nav, hero lines, collection tiles |
| `src/config/fans.ts` | Shows, schedules, catchphrases, quiz questions |
| `src/config/art.ts` | Brand graphics (and the logo mark) with their real dimensions |
| `src/config/product-media.ts` | Which angle renders each product has, and in what order |
| `src/config/showroom.ts` | The showroom's pace: scroll per product, how long a change takes, rest after a change |
| `src/config/models.ts` | Which GLB belongs to which product, its fit and resting pose, showroom stickers |
| `src/app/globals.css` | Design tokens (container, header height, hero measurements, card ratio), hero keyframes, motion-off rules |
| `src/components/ui/*` | Reusable primitives: `Button`, `Container`, `Art`, `Tape`, `Carousel`, icons |
| `src/components/motion/*` | `Reveal`, `RevealText`, `ParallaxLayer`, `ScrollHost`, `VelocityMarquee`, scroll progress, motion preference |
| `src/components/home/*` | Hero, strip, featured, showroom, marquee, fan zone, crew band |
| `src/components/product/*` | `ProductCard` + `CardGallery` (angle carousel, lazy, on-model hover), `ProductMedia` (angles / on-model / 3D), `ProductForm` (sticky buy bar) |
| `src/components/brand/Logo.tsx` | The logo mark with its MERCH tag as real text, sized by `--logo-w` |
| `src/components/three/*` | r3f stages, studio lighting, lazy viewer |
| `src/components/layout/*` | Header (mobile menu), nav, footer |
| `src/lib/catalog/*` | Shopify Storefront client, mock catalog, cached data access |
| `src/app/api/revalidate/route.ts` | Shopify webhook receiver (HMAC-verified) |
| `tools/3d/` | Offline scripts: optimise the GLBs, render the angle images from the 8K models, repair a model's front |
| `docs/` | `SHOPIFY.md`, `meshy-assets.json` (what Meshy made and which model won), screenshots |
| `assets-src/` | Original full-size images and GLBs from Meshy (not served) |

## Connect Shopify

Short version (full walkthrough, with the metafield and webhook steps, in [docs/SHOPIFY.md](docs/SHOPIFY.md)):

1. Create a custom app with the Storefront API scopes listed in `.env.example`.
2. Copy `.env.example` to `.env.local` and fill in the store domain and token.
3. Create collections `straight-shooter`, `stephen-a-smith`, `potus`, `culture-table`; tag six products `featured`.
4. Optional: metafield `custom.on_model_image` for the hover photo, a `.glb` as 3D media for the 3D switch. The card carousel uses the product's own images, in order.
5. Add the webhook (`SHOPIFY_WEBHOOK_SECRET`) so changes appear instantly.

## Before you launch

- **Hero photo** (`public/images/hero/hero-photo.webp`) was cut from the reference screenshot (signature removed). It is only 628 × 312, so it looks soft on retina screens. Replace it with the original high-resolution photo and re-tune `object-position` in `Hero.tsx` if needed. You need the rights to use that photograph.
- **Product photos**: the angle renders come from AI-generated 3D models, the on-model photos and the brand graphics are AI mockups made with Meshy. Swap in real photography in Shopify; no code change needed.
- The 3D models are single-photo reconstructions: the back and sides are inferred, and tiny parts of the generated embroidery are imperfect (a few fragments on the cap's brim). The Silhouette Hoodie was made from a back-view photo; its front is repaired to plain black. Fine for a showroom, not for a catalog of record.
- The *Shipping & returns* and *Contact* copy on `/account` is neutral placeholder text.
- Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SHOPIFY_ACCOUNT_URL`, `SHOPIFY_WEBHOOK_SECRET` and `FAN_SIGNUP_WEBHOOK`.

## Known notes

- The browser console shows a `THREE.Clock` deprecation warning. It comes from react-three-fiber with three 0.186, not from this code.
- `npm audit` reports advisories in `eslint-config-next`'s dev-only dependency tree; nothing there ships to the browser.
