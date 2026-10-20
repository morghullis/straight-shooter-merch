"use client";

import { useEffect, useRef, type RefObject } from "react";

interface StepScrollOptions {
  /** The tall section whose pinned range is paged. */
  section: RefObject<HTMLElement | null>;
  /** Number of pages (products). */
  count: number;
  /** Height of one page, in svh. */
  pageSvh: number;
  /** Extra scroll after the last page while the section is still pinned, in svh. */
  tailSvh: number;
  /** The page currently shown. */
  getIndex: () => number;
  /** Move one page. Return false to refuse (e.g. the current page is not shown yet). */
  onStep: (direction: 1 | -1) => boolean;
  /** The page arrives at the section from above (+1) or below (-1): show the first or last page. */
  onEnter: (from: 1 | -1) => void;
  /** True while a page change is still animating: no new step is accepted. */
  isBusy: () => boolean;
  wheelThreshold: number;
  swipeThreshold: number;
  quietMs: number;
  enabled: boolean;
}

const KEYS_NEXT = new Set(["ArrowDown", "PageDown", " "]);
/** How close (in screens) the section must be for a gesture towards it to glide it into place. */
const APPROACH = 0.85;
const KEYS_PREV = new Set(["ArrowUp", "PageUp"]);

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * Pages a pinned section: while the page is inside the section's pinned range, one scroll gesture
 * (a wheel or trackpad burst, a swipe, an arrow or page key) moves exactly one page, and the rest of
 * the gesture (trackpad inertia, a long swipe) is swallowed. At the first page scrolling up, and at
 * the last page scrolling down, the page scrolls on normally, so nothing is ever trapped.
 *
 * The page's scroll position is kept on the current page, so the sticky stage, the progress bar and
 * the browser's own scrolling stay consistent.
 */
export function useStepScroll(options: StepScrollOptions) {
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });

  useEffect(() => {
    if (!options.enabled) return;

    let locked = false;
    let lastInput = 0;
    let wheelSum = 0;
    let touchStartY: number | null = null;
    let touchStepped = false;
    let releaseTimer: number | undefined;
    let prevY = window.scrollY;
    let glideTarget: number | null = null;

    const geometry = () => {
      const el = opts.current.section.current;
      if (!el) return null;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const page = (opts.current.pageSvh * window.innerHeight) / 100;
      const tail = (opts.current.tailSvh * window.innerHeight) / 100;
      // Within this distance of the section, a gesture towards it glides the page in (magnetic entry).
      const approach = window.innerHeight * APPROACH;
      return { top, page, tail, approach, end: top + (opts.current.count - 1) * page };
    };
    type Geometry = NonNullable<ReturnType<typeof geometry>>;
    const inRange = (y: number, g: Geometry) => y >= g.top - 1 && y <= g.end + 1;
    /** Where a gesture in this direction belongs to the showroom. */
    const captures = (y: number, direction: 1 | -1, g: Geometry) =>
      direction > 0 ? y >= g.top - g.approach && y <= g.end + 1 : y >= g.top - 1 && y <= g.end + g.tail + g.approach;

    // Keep the page on the current product so every boundary decision is exact.
    const alignTo = (index: number) => {
      const g = geometry();
      if (g) window.scrollTo({ top: g.top + index * g.page, behavior: "instant" });
    };
    const glideTo = (y: number) => {
      glideTarget = y;
      window.scrollTo({ top: y, behavior: "smooth" });
    };

    const scheduleRelease = () => {
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(function check() {
        const quiet = performance.now() - lastInput >= opts.current.quietMs;
        // A glide-in counts as busy until the page has arrived.
        if (glideTarget !== null && Math.abs(window.scrollY - glideTarget) < 2) glideTarget = null;
        if (quiet && !opts.current.isBusy() && glideTarget === null) {
          locked = false;
          wheelSum = 0;
        } else {
          releaseTimer = window.setTimeout(check, 60);
        }
      }, opts.current.quietMs);
    };

    const lockFor = (at: number) => {
      locked = true;
      lastInput = Math.max(lastInput, at);
      scheduleRelease();
    };

    /**
     * Shared decision for every input. Returns true when the event must not scroll the page.
     * `at` is the event's own time stamp: when the page is busy, queued events arrive late but
     * still belong to the same gesture.
     */
    const handle = (direction: 1 | -1, magnitude: number, threshold: number, at: number): boolean => {
      const g = geometry();
      const y = window.scrollY;
      if (!g || !captures(y, direction, g)) return false;
      lastInput = Math.max(lastInput, at);
      if (locked) return true; // the rest of the gesture that already moved a page (or glided in)

      // Arriving: glide the section into place on its first (from above) or last (from below) page.
      if (direction > 0 && y < g.top - 1) {
        opts.current.onEnter(1);
        glideTo(g.top);
        lockFor(at);
        return true;
      }
      if (direction < 0 && y > g.end + 1) {
        opts.current.onEnter(-1);
        glideTo(g.end);
        lockFor(at);
        return true;
      }

      const index = opts.current.getIndex();
      const leaving = (direction < 0 && index === 0) || (direction > 0 && index === opts.current.count - 1);
      if (leaving) return false; // first page going up, last page going down: scroll the page normally
      wheelSum += magnitude;
      if (Math.abs(wheelSum) < threshold) return true;
      wheelSum = 0;
      if (opts.current.onStep(direction)) alignTo(index + direction);
      lockFor(at);
      return true;
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; // pinch-zoom, sideways scroll
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!delta) return;
      if (handle(delta > 0 ? 1 : -1, delta, opts.current.wheelThreshold, e.timeStamp)) e.preventDefault();
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? null;
      touchStepped = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY === null) return;
      const dy = touchStartY - (e.touches[0]?.clientY ?? touchStartY);
      if (!dy) return;
      const direction = dy > 0 ? 1 : -1;
      if (touchStepped) {
        // The rest of a swipe that already moved a page.
        lastInput = Math.max(lastInput, e.timeStamp);
        e.preventDefault();
        return;
      }
      const before = locked;
      const handled = handle(direction, Math.abs(dy) >= opts.current.swipeThreshold ? direction * 2 : 0, 1, e.timeStamp);
      if (handled) {
        e.preventDefault();
        if (!before && locked) touchStepped = true;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      touchStartY = null;
      lastInput = Math.max(lastInput, e.timeStamp);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      const next = KEYS_NEXT.has(e.key) && !(e.key === " " && e.shiftKey);
      const prev = KEYS_PREV.has(e.key) || (e.key === " " && e.shiftKey);
      if (!next && !prev) return;
      // Holding a key repeats it: that is still one gesture.
      if (e.repeat) {
        const g = geometry();
        if (g && locked && captures(window.scrollY, next ? 1 : -1, g)) {
          lastInput = Math.max(lastInput, e.timeStamp);
          e.preventDefault();
        }
        return;
      }
      if (handle(next ? 1 : -1, next ? 1 : -1, 1, e.timeStamp)) e.preventDefault();
    };

    // Entering the pinned range without a gesture (scrollbar, Home/End, a link): show the first page
    // when coming from above and the last one from below.
    const onScroll = () => {
      const g = geometry();
      const y = window.scrollY;
      if (g && inRange(y, g) && !locked) {
        if (prevY < g.top - 1) opts.current.onEnter(1);
        else if (prevY > g.end + 1) opts.current.onEnter(-1);
      }
      prevY = y;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(releaseTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [options.enabled]);
}
