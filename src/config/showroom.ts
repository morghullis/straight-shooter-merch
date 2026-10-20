/**
 * How the pinned 3D showroom behaves. Everything that decides its pace lives here.
 *
 * While the showroom is pinned it takes the scroll gesture (wheel, trackpad, swipe, keys): one
 * gesture = one product, never more, however hard the scroll. Each change is the same animation:
 * the product spins on its axis as it leaves the stage, the next one spins in and settles. Above
 * the first product and below the last one the page scrolls normally.
 */
export const showroomMotion = {
  /** Scroll distance per product while the section is pinned, in screens (svh). */
  pageSvh: 100,
  /** Extra scroll after the last product before the section unpins. */
  tailSvh: 40,

  /** Wheel distance (px) that counts as a deliberate gesture. */
  wheelThreshold: 24,
  /** Touch travel (px) that counts as a swipe. */
  swipeThreshold: 40,
  /** A new gesture is only accepted after the wheel has been still this long (swallows trackpad inertia). */
  quietMs: 220,

  /** The product spins out... */
  exitMs: 750,
  /** ...the next one spins in, starting this long before the first one is gone... */
  overlapMs: 380,
  /** ...and settles. */
  enterMs: 950,
  /** Longest wait for the next model to be ready before changing anyway. */
  loadWaitMs: 6000,

  /** Turns the product makes while leaving or arriving. */
  spinTurns: 0.9,
  /** Scale while leaving or arriving (the product is slightly smaller off-centre). */
  travelScale: 0.92,
} as const;
