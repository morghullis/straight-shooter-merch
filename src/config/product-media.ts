/**
 * Product photography. Every product has a turntable of renders (the Meshy 3D model shot from
 * several angles, see docs/meshy-assets.json) plus an optional on-model photo. Cards show the
 * turntable as a carousel; the product page adds the on-model shot and the live 3D view.
 */

export type AngleName =
  | "front"
  | "quarter-right"
  | "side-right"
  | "back"
  | "side-left"
  | "quarter-left"
  | "quarter-back-right"
  | "quarter-back-left";

/** One full turn, in the order a visitor swipes through it. */
const TURNTABLE: readonly AngleName[] = ["front", "quarter-right", "side-right", "back", "side-left", "quarter-left"];

/** Back first: products whose graphic is on the back (The Silhouette Hoodie, the Culture Table crop tees). */
const BACK_FIRST: readonly AngleName[] = ["back", "quarter-back-right", "side-right", "front", "side-left", "quarter-back-left"];

/** Products whose first photo is not the front. */
const ANGLE_OVERRIDES: Record<string, readonly AngleName[]> = {
  "the-silhouette-hoodie": BACK_FIRST,
  "i-would-date-the-bus-driver": BACK_FIRST,
  "i-m-not-above-an-edible": BACK_FIRST,
  "theres-right-theres-wrongs-theres-reality": BACK_FIRST,
};

export const ANGLE_IMAGE_SIZE = { width: 1500, height: 1223 } as const;

export const anglesFor = (handle: string): readonly AngleName[] => ANGLE_OVERRIDES[handle] ?? TURNTABLE;

export const angleUrl = (handle: string, angle: AngleName) => `/images/products/angles/${handle}/${angle}.webp`;
