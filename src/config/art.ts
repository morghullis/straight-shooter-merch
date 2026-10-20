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
  logoMark: { src: "/images/brand/logo-mark.webp", width: 680, height: 600 },
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
