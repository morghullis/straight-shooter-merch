/**
 * How the pinned 3D showroom moves. Everything that decides its feel lives here.
 *
 * One gesture = one product. A scroll, a trackpad swipe, a finger swipe or an arrow key changes to the
 * next product, always at the same easy pace, however hard the visitor scrolls: the current product
 * spins on its axis and travels off one side while the next one spins in from the other. The rest of
 * the gesture (a trackpad's inertia, a phone's momentum) is absorbed, so products are never skipped.
 * At the first and the last product the page scrolls on as usual.
 */
export const showroomMotion = {
  /** Page scroll per product, in screens (svh). Only felt when the scroll bar is dragged. */
  pageSvh: 100,
  /** Seconds one change from a product to the next takes. */
  stepSeconds: 1.2,
  /** Seconds the page takes to settle on a product when it arrives at the showroom or stops between two. */
  settleSeconds: 0.7,
  /** Wheel or trackpad travel needed before a gesture changes the product, in px (ignores brushes). */
  wheelMinPx: 4,
  /** Finger travel needed before a swipe changes the product, in px. */
  swipeMinPx: 24,

  /** Turns a product makes on its axis between resting in front and being off the stage. */
  spinTurns: 0.9,
  /** Scale halfway through a change (a product is slightly smaller while it travels). */
  travelScale: 0.94,
  /** Smoothing of the stage on top of the page's own movement (seconds). Small: it must not lag. */
  followSeconds: 0.05,
} as const;
