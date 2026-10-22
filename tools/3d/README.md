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
| `perforate-cap.mjs <in.glb> <out.glb>` | The Blasphemous cap (round 6): rebuilds the patch of the back where Meshy invented a scribble (texture, geometry and stored normals), repaints the side and back panels as plain fabric and lays the laser-perforated holes of the real cap over them, one staggered grid per panel, keeping the side labels. Output: `assets-src/round6/models/hat-v2-8k-perforated.glb`. |

`lib/optimize.mjs` and `lib/turntable.mjs` are the same steps as functions; the asset pipeline
(`../pipeline`, which makes new products' art automatically) uses them: it renders the **front and the
back** only (`FRONT_BACK`, or `BACK_FRONT` for a graphic on the back). The renderer uses software GL,
so it also runs on a CI machine without a GPU.

`products.json` holds the camera and the angle-to-yaw map per product. Meshy models face +Z, so yaw 0
is the front.

The originals are in `assets-src/round3/models/`, `assets-src/round5/models/` and `assets-src/round6/models/` (not served). `round6/models/hat-v2-8k-perforated.glb` is not in git: `perforate-cap.mjs` rebuilds it, byte for byte, from `hat-v2-8k-final.glb`. Meshy download links expire after a few
days, so keep those files.
