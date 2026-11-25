"use client";

import { animate, motion, useAnimationFrame, useInView, useMotionValue, useTransform, wrap, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { useCallback, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";

export interface HeroSlideContent {
  id: string;
  /** Read out and shown as the tick's name. */
  title: string;
  content: ReactNode;
}

/** How long a slide stays. */
const STAY_MS = 7000;
/** The slide itself: a slow start, a long run-out. */
const SLIDE = { duration: 1.15, ease: [0.62, 0.02, 0.16, 1] as const };
/** After a drag, the rest of the way. */
const SETTLE = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };
/** Pixels a finger moves before it counts as a swipe. */
const SLOP = 8;

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * The home hero as an endless carousel. `position` counts slides travelled and never wraps; each slide
 * stands at its shortest distance from it, so the last one is followed by the first in both
 * directions. Swipe or drag, the ticks and the arrow keys move it; it moves on by itself after a while,
 * and waits while the pointer or the focus is on it, while it is off screen, and until the next
 * slide's photo is ready. With animations off nothing moves by itself and slides change at once.
 */
export function HeroCarousel({ slides }: { slides: HeroSlideContent[] }) {
  const n = slides.length;
  const motionOn = useMotionEnabled();
  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { amount: 0.35 });
  const position = useMotionValue(0);
  const stay = useMotionValue(0);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const target = useRef(0);
  const running = useRef<AnimationPlaybackControls | null>(null);

  const goTo = useCallback(
    (to: number, how: { duration: number; ease: readonly [number, number, number, number] } = SLIDE) => {
      target.current = to;
      stay.set(0);
      setIndex(mod(to, n));
      running.current?.stop();
      if (!motionOn) {
        position.set(to);
        return;
      }
      running.current = animate(position, to, { duration: how.duration, ease: [...how.ease] });
    },
    [motionOn, n, position, stay],
  );

  /** The way to a slide that is shortest around the loop. */
  const goToSlide = (i: number) => {
    const ahead = mod(i - target.current, n);
    if (ahead === 0) return;
    goTo(target.current + (ahead <= n / 2 ? ahead : ahead - n));
  };

  const drag = useRef<{ id: number; x: number; y: number; from: number; active: boolean; lastX: number; lastT: number; speed: number } | null>(null);
  const dragged = useRef(false);

  useAnimationFrame((_, delta) => {
    if (!motionOn || held || !inView || drag.current?.active || document.hidden) return;
    const next = Math.min(1, stay.get() + Math.min(delta, 100) / STAY_MS);
    stay.set(next);
    if (next < 1) return;
    const coming = frame.current?.querySelectorAll<HTMLElement>("[data-hero-slide]")[mod(target.current + 1, n)];
    const photos = coming ? [...coming.querySelectorAll("img")] : [];
    if (photos.length && photos.every((img) => img.complete)) goTo(target.current + 1);
  });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragged.current = false;
    if (e.button !== 0 || !e.isPrimary) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: position.get(), active: false, lastX: e.clientX, lastT: e.timeStamp, speed: 0 };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null; // the page is scrolling
        return;
      }
      if (Math.abs(dx) < SLOP || Math.abs(dx) < Math.abs(dy)) return;
      d.active = true;
      dragged.current = true;
      running.current?.stop();
      d.from = position.get();
      d.x = e.clientX;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.speed = 0.6 * d.speed + 0.4 * ((e.clientX - d.lastX) / dt);
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    const width = e.currentTarget.clientWidth || 1;
    // Never past the neighbours: a wild drag still shows one slide after the other.
    position.set(d.from + Math.max(-1, Math.min(1, -dx / width)));
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    const moved = position.get() - target.current;
    const flick = Math.abs(d.speed) > 0.35 ? -Math.sign(d.speed) : 0;
    const step = flick || (Math.abs(moved) > 0.22 ? Math.sign(moved) : 0);
    goTo(target.current + step, SETTLE);
  };

  // A drag is not a click on whatever is under it.
  const onClickCapture = (e: MouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") goTo(target.current + 1);
    else if (e.key === "ArrowLeft") goTo(target.current - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={frame}
      role="region"
      aria-roledescription="carousel"
      aria-label={copy.hero.label}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHeld(false)}
      onFocus={(e) => e.target.matches(":focus-visible") && setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
      onKeyDown={onKeyDown}
      className="relative grid overflow-hidden bg-black"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className="grid touch-pan-y [grid-area:1/1]"
      >
        {slides.map((slide, i) => (
          <Slide key={slide.id} at={i} count={n} position={position} active={i === index} label={copy.hero.slide(i + 1, n, slide.title)}>
            {slide.content}
          </Slide>
        ))}
      </div>

      {/* Where we are: one tick per slide, filling up as the slide's time runs. */}
      <div className="pointer-events-none z-[6] flex items-end justify-center self-end [grid-area:1/1] lg:justify-start lg:pb-1 lg:pl-[calc(max(0px,(100%-var(--container))/2)+var(--hero-headline-left)-0.375rem)]">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            aria-label={copy.hero.goTo(slide.title)}
            aria-current={i === index ? "true" : undefined}
            onClick={() => goToSlide(i)}
            className="group pointer-events-auto flex h-9 items-center px-1.5 focus-visible:outline-offset-[-0.25rem] lg:h-8"
          >
            <span
              className={cn(
                "relative block h-[0.1875rem] overflow-hidden rounded-full shadow-[0_0_0.5rem_0.125rem_rgba(0,0,0,0.55)] transition-[width,background-color] duration-500 ease-out",
                i === index ? "w-10 bg-white/45" : "w-5 bg-white/55 group-hover:bg-white",
              )}
            >
              {i === index && <Fill stay={stay} full={!motionOn} />}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Fill({ stay, full }: { stay: MotionValue<number>; full: boolean }) {
  return <motion.span style={full ? undefined : { scaleX: stay }} className="absolute inset-0 block origin-left bg-gold" />;
}

function Slide({ at, count, position, active, label, children }: { at: number; count: number; position: MotionValue<number>; active: boolean; label: string; children: ReactNode }) {
  const offset = useTransform(position, (p) => wrap(-count / 2, count / 2, at - p));
  const x = useTransform(offset, (o) => `${o * 100}%`);
  const visibility = useTransform(offset, (o) => (Math.abs(o) >= 0.999 ? "hidden" : "visible"));
  // For the photo inside: it travels a little less than its slide and comes up out of the dark.
  const shift = useTransform(offset, (o) => `${o * -16}%`);
  const light = useTransform(offset, (o) => (Math.abs(o) > 0.97 ? 0 : 1 - Math.abs(o) * 0.75));

  return (
    <motion.div
      data-hero-slide={active ? "active" : "idle"}
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={active ? undefined : true}
      inert={!active}
      style={{ x, visibility, "--slide-shift": shift, "--slide-light": light } as Record<string, unknown>}
      className="min-w-0 [grid-area:1/1]"
    >
      {children}
    </motion.div>
  );
}
