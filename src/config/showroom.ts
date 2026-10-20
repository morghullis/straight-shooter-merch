/**
 * How the pinned 3D showroom behaves. Everything that decides its pace lives here.
 *
 * The scroll never drives the picture directly. It only decides WHICH product should be shown;
 * a small state machine (`useSequencedChange`) performs every change the same way, at the same
 * speed, however fast the visitor scrolls: the current product leaves, the next one arrives, and
 * only one is ever on stage.
 */
export const showroomMotion = {
  /** Scroll distance spent on each product, in screens (svh). */
  pageSvh: 100,
  /** Extra scroll after the last product, so the section does not unpin the moment it is reached. */
  tailSvh: 40,
  /** A product only gives way after the scroll is this far (in products) past the halfway point. */
  hysteresis: 0.12,

  /** The scroll has to be still this long before a change starts... */
  calmMs: 140,
  /** ...unless a change has been waiting this long (slow, continuous scrolling). */
  maxWaitMs: 900,
  /** The product leaves (fast, ease-in) ... */
  outMs: 480,
  /** ...and the next one arrives (slower, ease-out). */
  inMs: 900,
  /** After a change nothing else may start for this long: the product gets to be seen. */
  dwellMs: 700,
  /** Longest the stage waits for a model to finish loading before showing it anyway. */
  loadWaitMs: 6000,

  /** Scrolling through a product's page turns it by this many radians in total (half each way). */
  yawRange: 0.9,
  /** How quickly that turn follows the scroll, per second. */
  yawEase: 5,
  /** While leaving or arriving the product drifts this far sideways (scene units) and turns this much (radians). */
  slideUnits: 0.9,
  slideYaw: 0.5,
  /** Scale of the product at the moment it is invisible. */
  hiddenScale: 0.9,
} as const;
