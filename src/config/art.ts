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
  // The official logo, cut out of its black background (source: assets-src/brand).
  logo: { src: "/images/brand/logo-official.webp", width: 1374, height: 552 },
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
