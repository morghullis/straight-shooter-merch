"use client";

import { useLenis } from "lenis/react";
import { useMotionValue, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, type RefObject } from "react";

import { isPageScrollLocked, lockPageScroll } from "@/lib/scroll-lock";

interface PagerOptions {
  /** The tall section that pins its frame while the products change. */
  section: RefObject<HTMLElement | null>;
  /** The pinned, screen-tall frame inside the section. */
  frame: RefObject<HTMLElement | null>;
  /** Number of products. */
  count: number;
  /** Seconds one change from a product to the next takes. */
  stepSeconds: number;
  /** Seconds the page takes to settle on a product when it arrives at the showroom or stops between two. */
  settleSeconds: number;
  /** Wheel or trackpad travel a gesture needs before it changes the product, in px. */
  wheelMinPx: number;
  /** Finger travel a swipe needs before it changes the product, in px. */
  swipeMinPx: number;
  enabled: boolean;
}

/** Even acceleration and deceleration, no peak of speed: easy to follow with the eye. */
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
/** Carries on with the speed the page already has, then settles. */
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Wheel events further apart than this start a new gesture, unless they read as the same inertia... */
const GESTURE_GAP_MS = 200;
/** ...and further apart than this, always. */
const GESTURE_PAUSE_MS = 900;
const SCROLL_KEYS: Record<string, 1 | -1> = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function ignoresKeys(target: EventTarget | null, key: string) {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  if (el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return true;
  // Space presses a focused button or link.
  return key === " " && Boolean(el.closest("button, a, [role=button]"));
}

/**
 * One gesture moves the showroom by exactly one product, at a set, easy pace, however hard the visitor
 * scrolls or swipes. While the showroom is pinned:
 *
 * - a wheel or trackpad gesture, a swipe, or an arrow / page key starts one change to the next (or
 *   previous) product; the rest of that gesture, the trackpad's inertia included, is absorbed;
 * - a new gesture the same way during the second half of a change queues one more product, so
 *   deliberate scrolling is never ignored, and still no product is skipped;
 * - at the first and the last product a gesture outwards scrolls the page on, so the visitor can leave;
 * - arriving from above or below, even with a hard fling, the page settles on the first (or last)
 *   product, so the first look is always a product at rest.
 *
 * The change is an eased scroll of the page itself, so the stage, the scroll bar and the page stay in
 * step. Returns the position along the products (0 = first, count - 1 = last) as a motion value, and
 * `goTo` for the rail.
 */
export function useProductPager(options: PagerOptions) {
  const lenis = useLenis();
  const position = useMotionValue(0);
  const opts = useRef(options);
  const smooth = useRef(lenis);
  const goToRef = useRef<(i: number) => void>(() => {});
  useEffect(() => {
    opts.current = options;
    smooth.current = lenis;
  });

  const { enabled, section, frame } = options;

  useEffect(() => {
    if (!enabled) return;

    // ---- Where each product rests on the page ----
    const geo = { top: 0, page: 1, end: 0 };
    const last = () => opts.current.count - 1;
    const measure = () => {
      const s = section.current;
      const f = frame.current;
      if (!s || !f) return false;
      const travel = Math.max(0, s.offsetHeight - f.offsetHeight);
      geo.top = s.getBoundingClientRect().top + window.scrollY;
      geo.page = last() > 0 ? travel / last() : 1;
      geo.end = geo.top + travel;
      return geo.page > 0;
    };
    const xAt = (y: number) => (y - geo.top) / geo.page;
    const yOf = (i: number) => geo.top + i * geo.page;
    const inside = (y: number) => y >= geo.top - 1 && y <= geo.end + 1;
    const atRest = (y: number) => Math.abs(xAt(y) - Math.round(xAt(y))) < 0.004;
    const valid = (i: number) => i >= 0 && i <= last();
    /** The product a gesture in `dir` goes to. Between two products, the one ahead. */
    const nextFrom = (y: number, dir: number) => {
      const x = xAt(y);
      return (dir > 0 ? Math.floor(x + 0.02) : Math.ceil(x - 0.02)) + dir;
    };
    const publish = () => position.set(clamp(xAt(window.scrollY), 0, last()));

    // ---- A change: an eased scroll of the page ----
    let anim: { raf: number; start: number; seconds: number; dir: number } | null = null;
    let animEndedAt = -Infinity;
    let queued = 0;

    const scrollTo = (to: number, seconds: number, ease: (t: number) => number, onDone?: () => void) => {
      if (anim) cancelAnimationFrame(anim.raf);
      // The smooth-scroll layer may still be gliding from the last wheel event: stop it where it is.
      const l = smooth.current;
      if (l && !l.isStopped) l.scrollTo(window.scrollY, { immediate: true, force: true });
      const from = window.scrollY;
      const finish = () => {
        anim = null;
        animEndedAt = performance.now();
        onDone?.();
      };
      if (Math.abs(to - from) < 1) {
        anim = null;
        finish();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / (seconds * 1000));
        window.scrollTo({ top: from + (to - from) * ease(p), behavior: "instant" });
        if (p < 1 && anim) anim.raf = requestAnimationFrame(tick);
        else if (p >= 1) finish();
      };
      anim = { raf: requestAnimationFrame(tick), start, seconds, dir: Math.sign(to - from) };
    };
    const progress = () => (anim ? (performance.now() - anim.start) / (anim.seconds * 1000) : 1);

    const step = (target: number) => {
      if (!valid(target)) return;
      scrollTo(yOf(target), opts.current.stepSeconds, easeInOutSine, () => {
        // A gesture made during the change asked for one more product.
        const dir = queued;
        queued = 0;
        if (dir && measure()) step(target + dir);
      });
    };
    /** Move one product from where the page is now, the way the visitor asked. */
    const stepFromHere = (dir: number) => {
      if (anim) {
        // During the second half of a change, a new gesture the same way queues one more product.
        if (anim.dir === dir && progress() >= 0.5) queued = dir;
        return;
      }
      if (measure()) step(nextFrom(window.scrollY, dir));
    };
    const settleOn = (target: number, ease = easeInOutSine) => {
      const distance = Math.abs(yOf(target) - window.scrollY) / window.innerHeight;
      const seconds = clamp(opts.current.settleSeconds * (0.5 + distance), 0.35, opts.current.settleSeconds * 1.4);
      scrollTo(yOf(target), seconds, ease);
    };

    goToRef.current = (i: number) => {
      if (!measure() || !valid(i)) return;
      queued = 0;
      const distance = Math.abs(i - xAt(window.scrollY));
      scrollTo(yOf(i), opts.current.stepSeconds * (1 + 0.3 * Math.max(0, distance - 1)), easeInOutSine);
    };

    const swallow = (e: Event) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    };

    // ---- Wheel and trackpad ----
    // A gesture is a burst of wheel events. Trackpads keep sending decaying events (inertia) after the
    // fingers leave; those belong to the same gesture. A new gesture is a change of direction, a fresh
    // push during the inertia (the speed grows again) or a pause that is not just the inertia going on.
    // Speeds are per frame, so events the browser merged while it was busy (one big delta after a
    // long gap) read as what they are: the same inertia, not a new push.
    const wheel = { lastT: -Infinity, dir: 0, peak: 0, trough: 0, decayed: false, sum: 0, spent: false };
    const isNewWheelGesture = (t: number, delta: number) => {
      const gap = t - wheel.lastT;
      const speed = (Math.abs(delta) * 16) / Math.max(16, Math.min(gap, 1000));
      const dir = Math.sign(delta);
      const inertiaGoingOn = wheel.decayed && speed <= wheel.trough * 1.5;
      const fresh =
        dir !== wheel.dir ||
        gap > GESTURE_PAUSE_MS ||
        (gap > GESTURE_GAP_MS && !inertiaGoingOn) ||
        (wheel.decayed && speed > wheel.trough * 2 + 4);
      if (fresh) {
        Object.assign(wheel, { peak: speed, trough: speed, decayed: false, sum: 0, spent: false });
      } else {
        wheel.peak = Math.max(wheel.peak, speed);
        if (!wheel.decayed && speed < wheel.peak * 0.6) {
          wheel.decayed = true;
          wheel.trough = speed;
        } else if (wheel.decayed) {
          wheel.trough = Math.min(wheel.trough, speed);
        }
      }
      wheel.lastT = t;
      wheel.dir = dir;
      wheel.sum += Math.abs(delta);
      return fresh;
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || isPageScrollLocked()) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 100 / 6 : e.deltaMode === 2 ? window.innerHeight : 1);
      if (dy === 0 || Math.abs(e.deltaX) > Math.abs(dy)) return;
      const fresh = isNewWheelGesture(e.timeStamp, dy);
      const dir = Math.sign(dy);
      if (!measure()) return;

      if (anim) {
        // The page belongs to the change that is running.
        swallow(e);
        if (fresh) {
          wheel.spent = true;
          stepFromHere(dir);
        }
        return;
      }
      if (wheel.spent) {
        // The rest of a gesture that already moved a product.
        swallow(e);
        return;
      }

      const y = window.scrollY;
      if (inside(y)) {
        if (!valid(nextFrom(y, dir))) return; // first or last product: the page scrolls on
        swallow(e);
        if (wheel.sum < opts.current.wheelMinPx) return;
        wheel.spent = true;
        stepFromHere(dir);
        return;
      }

      // Outside the showroom: catch the page as it reaches it.
      const l = smooth.current;
      const projected = (l && !l.isStopped ? l.targetScroll : y) + dy;
      if (dir > 0 && y < geo.top && projected >= geo.top - 1) {
        swallow(e);
        wheel.spent = true;
        settleOn(0, easeOutCubic);
      } else if (dir < 0 && y > geo.end && projected <= geo.end + 1) {
        swallow(e);
        wheel.spent = true;
        settleOn(last(), easeOutCubic);
      }
    };

    // ---- Touch ----
    // Inside the showroom a vertical swipe never scrolls the page itself: it starts one change. At the
    // first and the last product a swipe outwards scrolls the page as usual.
    let touching = false;
    let touchEndedAt = -Infinity;
    /** Set when a swipe carried the page into the showroom: the product it must settle on. */
    let entry: number | null = null;
    const touch = { active: false, x0: 0, y0: 0, dx: 0, dy: 0, startY: 0, decided: false, capture: false, stepped: false };

    const onTouchStart = (e: TouchEvent) => {
      touching = true;
      entry = null;
      if (e.touches.length !== 1 || isPageScrollLocked()) {
        touch.active = false;
        return;
      }
      const p = e.touches[0];
      Object.assign(touch, { active: true, x0: p.clientX, y0: p.clientY, dx: 0, dy: 0, startY: window.scrollY, decided: false, capture: false, stepped: false });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touch.active) return;
      const p = e.touches[0];
      touch.dx = p.clientX - touch.x0;
      touch.dy = touch.y0 - p.clientY; // > 0: the finger goes up, towards the next product
      if (!touch.decided) {
        if (touch.dy === 0) return;
        touch.decided = true;
        touch.capture = Boolean(anim) || (measure() && inside(window.scrollY) && valid(nextFrom(window.scrollY, Math.sign(touch.dy))));
      }
      if (!touch.capture) return;
      swallow(e);
      if (touch.stepped || Math.abs(touch.dy) < opts.current.swipeMinPx || Math.abs(touch.dy) <= Math.abs(touch.dx)) return;
      touch.stepped = true;
      stepFromHere(Math.sign(touch.dy));
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touching = false;
        touchEndedAt = performance.now();
      }
      if (!touch.active) return;
      touch.active = false;
      if (touch.capture) {
        // A short, quick flick still counts.
        if (!touch.stepped && Math.abs(touch.dy) >= 10 && Math.abs(touch.dy) > Math.abs(touch.dx)) stepFromHere(Math.sign(touch.dy));
        return;
      }
      // The page followed the finger. If it came into the showroom, it settles on the product it
      // reached first, never on one further in.
      if (measure() && inside(window.scrollY) && !inside(touch.startY)) entry = touch.startY < geo.top ? 0 : last();
      requestAnimationFrame(settle);
    };

    // ---- Keys ----
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isPageScrollLocked() || ignoresKeys(e.target, e.key)) return;
      const dir = e.key === " " ? (e.shiftKey ? -1 : 1) : SCROLL_KEYS[e.key];
      if (!dir || !measure() || !inside(window.scrollY)) return;
      if (anim) {
        e.preventDefault();
        if (!e.repeat) stepFromHere(dir);
        return;
      }
      if (!valid(nextFrom(window.scrollY, dir))) return;
      e.preventDefault();
      stepFromHere(dir);
    };

    // ---- Anything else that moves the page: momentum after a swipe, the scroll bar, find in page ----
    let lastY = window.scrollY;
    let direction = 1;
    let idle: number | undefined;

    /** Stops the browser's own momentum scrolling where it is. */
    const halt = () => {
      const release = lockPageScroll();
      requestAnimationFrame(() => requestAnimationFrame(release));
    };

    /** If the page has come to rest between two products, glide on to one of them. */
    function settle() {
      if (anim || touching || !measure()) return;
      const y = window.scrollY;
      if (!inside(y) || atRest(y)) {
        entry = null;
        return;
      }
      const x = xAt(y);
      const target = entry ?? clamp(direction > 0 ? Math.ceil(x - 0.15) : Math.floor(x + 0.15), 0, last());
      entry = null;
      settleOn(target);
    }

    const onScroll = () => {
      const y = window.scrollY;
      const prev = lastY;
      if (y !== prev) direction = y > prev ? 1 : -1;
      lastY = y;
      if (!measure()) return;
      publish();
      if (anim || touching || performance.now() - animEndedAt < 120) return;

      // Momentum from a swipe: stop on the first (or last) product instead of sliding through several.
      if (performance.now() - touchEndedAt < 2500) {
        if (entry === null && prev < geo.top - 1 && y >= geo.top - 1) entry = 0;
        if (entry === null && prev > geo.end + 1 && y <= geo.end + 1) entry = last();
        if (inside(y) && (entry !== null || !atRest(y))) {
          halt();
          settle();
          return;
        }
      }
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, 180);
    };

    const onResize = () => {
      if (anim || !measure()) return;
      publish();
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, 180);
    };

    measure();
    publish();
    const active = { capture: true, passive: false } as const;
    const passive = { capture: true, passive: true } as const;
    window.addEventListener("wheel", onWheel, active);
    window.addEventListener("touchstart", onTouchStart, passive);
    window.addEventListener("touchmove", onTouchMove, active);
    window.addEventListener("touchend", onTouchEnd, passive);
    window.addEventListener("touchcancel", onTouchEnd, passive);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const observer = new ResizeObserver(onResize);
    if (section.current) observer.observe(section.current);

    return () => {
      if (anim) cancelAnimationFrame(anim.raf);
      window.clearTimeout(idle);
      observer.disconnect();
      window.removeEventListener("wheel", onWheel, active);
      window.removeEventListener("touchstart", onTouchStart, passive);
      window.removeEventListener("touchmove", onTouchMove, active);
      window.removeEventListener("touchend", onTouchEnd, passive);
      window.removeEventListener("touchcancel", onTouchEnd, passive);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      goToRef.current = () => {};
    };
  }, [enabled, position, section, frame]);

  const goTo = useCallback((i: number) => goToRef.current(i), []);
  return { position: position as MotionValue<number>, goTo };
}
