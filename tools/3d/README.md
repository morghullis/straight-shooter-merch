# 3D tools

Offline scripts that turn the Meshy models into what the storefront ships. Nothing here runs in the
storefront build (`tools/**` is ignored by ESLint and has its own `package.json`).

```bash
cd tools/3d && npm install
```

| Script | What it does |
| --- | --- |
| `optimize.mjs <in.glb> <outDir> <name>` | Writes `<name>.glb` (60k triangles, 2K base colour, 1K normal and roughness, for phones and the showroom) and `<name>-hd.glb` (160k triangles, 4K base colour, 2K normal, for the product page on a big screen). The simplified mesh is shaded with normals recomputed from its own faces (`lib/smooth-normals.mjs`: the dense mesh's fine normals would show as flecks). Meshopt compressed, WebP textures. Copy both to `public/models/`. |
| `render.mjs <modelsDir> [handle...]` | Renders each product's turntable (6 angles, see `products.json`) from the **original 8K GLBs** with Three.js in headless Chrome, on the same sand colour as the product cards, and writes WebP files to `public/images/products/angles/<handle>/`. |
| `project-front.mjs <in.glb> <out.glb> <photo.png> <+z\|-z>` | Puts a real photo of one side (the garment alone, straight on) onto the side of a model that Meshy invented, keeps the fabric plain around the print, evens out the normal map there and the roughness map everywhere (Meshy makes printed areas shinier, which shows as a ghost). Used for the crop tees (their fronts, and the Edible back). |
| `repair-front.mjs <in.glb> <out.glb>` | Paints the invented front of a model whose only input photo was the back (used for The Silhouette Hoodie): base colour, normal and roughness maps are flattened on every front-facing triangle. |
| `print-garment.mjs <blank.glb> <print.png> <outDir> <name> [--color --width --top --standoff]` | Dresses a plain white garment model with a product: tints it to the garment's colour (the blank's fold shading kept underneath) and projects the print straight from the front onto the front of the garment, into a new 4K colour texture, so the print follows the folds, stays as sharp as its file and never stands off the cloth (image-to-3D of a printed garment turns the print into relief and blurs it). Matte cloth (no roughness/metal map). Writes `<name>.glb` / `<name>-hd.glb` via `lib/optimize.mjs`, for the product's `model_3d` / `model_3d_hd`. The blanks (tee, women's crop tee, hoodie: Meshy 7.1 image-to-3D, Ultra geometry, of print-free images) are in `assets-src/blanks/2026-11/`; the prints, cut out of the product photos by `assets-src/prints/extract-from-photos.py`, and each product's colour and placement (`garments.txt`: name, blank, print, colour, width, top) are in `assets-src/prints/`. A print file made by the designer (larger than the 250-350 px a photo holds) can replace its cut-out as is. |
| `build-tumbler.mjs <logo.png> <outDir>` | Builds the Culture Table tumbler in code instead of image-to-3D (which made its logo stand off the cup like a badge): the real 20 oz profile turned as a surface of revolution (clear lid, brushed-steel bands, powder-coated body) with the logo, cut out of the white tumbler's photo (`assets-src/brand/tumbler/`), projected onto the body from the front. Writes `culture-table-tumbler.glb` (2K print) and `-hd.glb` (4K), under 0.5 MB, for the product's `model_3d` / `model_3d_hd` in Shopify. |
| `perforate-cap.mjs <in.glb> <out.glb>` | The Blasphemous cap (round 6): rebuilds the patch of the back where Meshy invented a scribble (texture, geometry and stored normals), repaints the side and back panels as plain fabric and lays the laser-perforated holes of the real cap over them, one staggered grid per panel, keeping the side labels. Output: `assets-src/round6/models/hat-v2-8k-perforated.glb`. |

`lib/optimize.mjs` and `lib/turntable.mjs` are the same steps as functions; the asset pipeline
(`../pipeline`, which makes new products' art automatically) uses them: it renders the **front and the
back** only (`FRONT_BACK`, or `BACK_FRONT` for a graphic on the back). The renderer uses software GL,
so it also runs on a CI machine without a GPU.

`products.json` holds the camera and the angle-to-yaw map per product. Meshy models face +Z, so yaw 0
is the front.

The originals are in `assets-src/round3/models/`, `assets-src/round5/models/` and `assets-src/round6/models/` (not served). `round6/models/hat-v2-8k-perforated.glb` is not in git: `perforate-cap.mjs` rebuilds it, byte for byte, from `hat-v2-8k-final.glb`. Meshy download links expire after a few
days, so keep those files.
