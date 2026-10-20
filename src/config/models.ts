import type { ArtKey } from "./art";

/**
 * 3D models (Meshy image-to-3D, optimised with gltf-transform) keyed by product handle.
 * `rotation` is the resting pose in radians; `fit` is the size of the longest side
 * in scene units, so every model reads at a similar scale on the stage.
 */
export interface ModelSpec {
  /** Web GLB: 2K base colour, light enough for phones and the showroom. */
  src: string;
  /** Detail GLB (4K base colour, 2K normal map) for the product page on a big screen with a mouse. */
  hd?: string;
  label: string;
  fit: number;
  rotation: [number, number, number];
}

export const models: Record<string, ModelSpec> = {
  "blasphemous-hat": { src: "/models/hat.glb", hd: "/models/hat-hd.glb", label: "Cap", fit: 2.45, rotation: [0, 0.5, 0] },
  "straight-shooter-tee": { src: "/models/tee.glb", hd: "/models/tee-hd.glb", label: "Tee", fit: 2.3, rotation: [0, 0, 0] },
  "the-silhouette-hoodie": { src: "/models/silhouette.glb", hd: "/models/silhouette-hd.glb", label: "Silhouette", fit: 2.35, rotation: [0, Math.PI - 0.4, 0] },
  "stephen-a-smith-hoodie": { src: "/models/sas.glb", hd: "/models/sas-hd.glb", label: "Show hoodie", fit: 2.35, rotation: [0, 0, 0] },
  "potus-hoodie": { src: "/models/potus.glb", hd: "/models/potus-hd.glb", label: "POTUS", fit: 2.35, rotation: [0, 0, 0] },
  "culture-table-hoodie": { src: "/models/hoodie.glb", hd: "/models/hoodie-hd.glb", label: "Table hoodie", fit: 2.35, rotation: [0, 0, 0] },
  "culture-table-tumbler": { src: "/models/tumbler.glb", hd: "/models/tumbler-hd.glb", label: "Tumbler", fit: 2.4, rotation: [0, 0, 0] },
};

/** Brand artwork stuck onto each product's stage in the showroom (positions are Tailwind classes). */
export const showroomArt: Record<string, { art: ArtKey; className: string }> = {
  "blasphemous-hat": { art: "stampBlasphemous", className: "left-[6%] top-[40%] w-[8.75rem] -rotate-6 opacity-90 invert lg:right-[16%] lg:left-auto lg:top-[22%] lg:w-[15rem]" },
  "straight-shooter-tee": { art: "stickerOfficial", className: "right-[8%] top-[44%] w-[5.75rem] rotate-12 lg:right-[27%] lg:top-[13%] lg:w-[8.125rem]" },
  "the-silhouette-hoodie": { art: "stickerOfficial", className: "right-[6%] top-[44%] w-[5.75rem] rotate-12 lg:right-[12%] lg:top-[16%] lg:w-[8.125rem]" },
  "stephen-a-smith-hoodie": { art: "stickerOfficial", className: "right-[6%] top-[46%] w-[5.75rem] -rotate-6 lg:right-[10%] lg:top-auto lg:bottom-[30%] lg:w-[8.125rem]" },
  "potus-hoodie": { art: "stickerOfficial", className: "right-[6%] top-[46%] w-[5.75rem] rotate-6 lg:right-[24%] lg:top-[14%] lg:w-[8.125rem]" },
  "culture-table-hoodie": { art: "stickerOfficial", className: "right-[6%] top-[46%] w-[6rem] -rotate-12 lg:right-[18%] lg:top-auto lg:bottom-[28%] lg:w-[8.125rem]" },
  "culture-table-tumbler": { art: "stickerOfficial", className: "right-[6%] top-[42%] w-[5.75rem] rotate-6 lg:right-[7%] lg:top-[46%] lg:w-[8.125rem]" },
};

/** Order of the products in the showroom. */
export const showroomOrder = [
  "blasphemous-hat",
  "straight-shooter-tee",
  "the-silhouette-hoodie",
  "stephen-a-smith-hoodie",
  "potus-hoodie",
  "culture-table-hoodie",
  "culture-table-tumbler",
] as const;

const DEFAULT_SPEC: Omit<ModelSpec, "src"> = { label: "3D", fit: 2.6, rotation: [0, 0, 0] };

/** Spec for a product: the curated one if we have it, otherwise defaults around a remote GLB. */
export function modelSpecFor(handle: string, remoteSrc?: string | null): ModelSpec | null {
  const curated = models[handle];
  if (curated) return curated;
  return remoteSrc ? { ...DEFAULT_SPEC, src: remoteSrc } : null;
}
