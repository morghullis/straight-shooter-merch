/**
 * Brand artwork generated with Meshy (stamps, tape, screen-print illustrations and
 * textures). Dimensions are the real file sizes so images reserve their space.
 */

export interface ArtAsset {
  src: string;
  width: number;
  height: number;
}

export const art = {
  // The logo: pink silhouette, "The Stephen A. Smith" in white, "Straight Shooter Shop" in orange,
  // made for a dark background (source: assets-src/brand/2026-11-silhouette/logo-v2-original.webp,
  // transparent already; cropped to the artwork).
  logo: { src: "/images/brand/logo-stephen-a.webp", width: 1824, height: 1068 },
  tape: { src: "/images/art/tape-gold.webp", width: 1505, height: 262 },
  stampOnAir: { src: "/images/art/stamp-on-air.webp", width: 700, height: 424 },
  stampBlasphemous: { src: "/images/art/stamp-blasphemous.webp", width: 700, height: 312 },
  stickerOfficial: { src: "/images/art/sticker-official.webp", width: 600, height: 604 },
  mic: { src: "/images/art/art-mic.webp", width: 394, height: 805 },
  capitol: { src: "/images/art/art-capitol.webp", width: 800, height: 788 },
  table: { src: "/images/art/art-table.webp", width: 800, height: 776 },
  paper: { src: "/images/art/tex-paper.webp", width: 1200, height: 896 },
  concrete: { src: "/images/art/tex-concrete.webp", width: 1376, height: 768 },
} as const satisfies Record<string, ArtAsset>;

export type ArtKey = keyof typeof art;

/**
 * The cart flame: a flame printed with a worn rubber stamp (Meshy, round 4), white on transparent, and
 * its bright core as a second mask. Used as CSS masks (see `.cart-flame` in globals.css). 128px.
 */
export const flameArt = {
  body: "/images/icons/flame.webp",
  core: "/images/icons/flame-core.webp",
} as const;
