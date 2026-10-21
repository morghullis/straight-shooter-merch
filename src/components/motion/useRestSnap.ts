"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef, type RefObject } from "react";

interface RestSnapOptions {
  /** The tall, pinned section. */
  section: RefObject<HTMLElement | null>;
  /** Number of resting points (products). */
  count: number;
  /** Scroll per product, in svh. */
  pageSvh: number;
  /** Scroll before the first and after the last product, in products. */
  lead: number;
  /** Share of each product's scroll that counts as resting on it (on each side). */
  rest: number;
  /** How long the scroll must be still before gliding. */
  idleMs: number;
  /** Duration of the glide, in seconds. */
  seconds: number;
  enabled: boolean;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * When the scroll stops halfway through a change between two products, glide the page on to the
 * nearer product, favouring the direction the visitor was scrolling. The page is never forced while
 * the visitor is scrolling or touching it; any new input takes over from the glide.
 */
export function useRestSnap(options: RestSnapOptions) {
  const lenis = useLenis();
  const opts = useRef(options);
  const smooth = useRef(lenis);
  useEffect(() => {
    opts.current = options;
    smooth.current = lenis;
  });

  useEffect(() => {
    if (!options.enabled) return;
    let timer: number | undefined;
    let lastY = window.scrollY;
    let direction = 1;
    let touching = false;
    let gliding = false;

    const check = () => {
      if (touching || gliding) return;
      const el = opts.current.section.current;
      if (!el) return;
      const { count, pageSvh, lead, rest, seconds } = opts.current;
      const page = (pageSvh * window.innerHeight) / 100;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const x = (window.scrollY - top) / page - lead; // position along the products, unrested
      if (x <= 0 || x >= count - 1) return; // before the first or after the last product: resting
      const base = Math.floor(x);
      const f = x - base;
      if (f <= rest + 0.01 || f >= 1 - rest - 0.01) return; // already resting on a product
      const target = direction > 0 ? base + 1 : base;
      const y = top + (target + lead) * page;

      gliding = true;
      const done = () => {
        gliding = false;
      };
      if (smooth.current && !smooth.current.isStopped) {
        smooth.current.scrollTo(y, { duration: seconds, easing: easeInOutCubic, onComplete: done });
      } else {
        window.scrollTo({ top: y, behavior: "smooth" });
        window.setTimeout(done, seconds * 1000 + 200);
      }
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, opts.current.idleMs);
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastY) direction = y > lastY ? 1 : -1;
      lastY = y;
      if (!gliding) schedule();
    };
    const takeOver = () => {
      // The visitor scrolls again: the glide (if any) gives way.
      gliding = false;
    };
    const onTouchStart = () => {
      touching = true;
      gliding = false;
      window.clearTimeout(timer);
    };
    const onTouchEnd = () => {
      touching = false;
      schedule();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", takeOver, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", takeOver);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [options.enabled]);
}
