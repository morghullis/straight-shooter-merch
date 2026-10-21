/**
 * How the pinned 3D showroom moves. Everything that decides its feel lives here.
 *
 * The showroom moves WITH the scroll (it is never a canned animation that ignores the hand): each
 * product rests in front for part of the scroll, then the products move like a conveyor: the current
 * one spins on its axis and travels off one side while the next one spins in from the other. If the scroll stops halfway through a change,
 * the page glides on to the nearer product, so the stage never stays between two.
 */
export const showroomMotion = {
  /** Scroll distance per product, in screens (svh). */
  pageSvh: 110,
  /**
   * Share of each product's scroll during which it stays at rest, facing the camera. The change to
   * the next product happens in the rest. The first and last products also get this much scroll
   * before and after them, so the cap is always seen at rest first.
   */
  rest: 0.25,

  /** When the scroll has been still this long halfway through a change... */
  snapIdleMs: 140,
  /** ...the page glides to the nearer product (towards the way it was going) in this many seconds. */
  snapSeconds: 0.9,

  /** Turns a product makes on its axis between resting in front and being off the stage. */
  spinTurns: 0.9,
  /** Scale halfway through a change (a product is slightly smaller while it travels). */
  travelScale: 0.94,
  /** Extra smoothing of the stage on top of the page's smooth scroll (seconds). Small: the stage must not lag the hand. */
  followSeconds: 0.06,
} as const;
