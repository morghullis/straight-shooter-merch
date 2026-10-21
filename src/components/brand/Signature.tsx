import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

import { signature as sig } from "./signature-paths";

/** How long the pen takes to write the whole signature (pen lifts included), in ms. */
const WRITE_MS = 2100;
/** A pause where the pen leaves the paper between two longer strokes. */
const LIFT_MS = 35;
/** Strokes shorter than this (dots, tips) are added while the pen is still on its way. */
const SHORT = 20;

const total = sig.strokes.reduce((sum, s) => sum + s.length, 0);
const lifts = sig.strokes.filter((s) => s.length >= SHORT).length * LIFT_MS;
const speed = total / (WRITE_MS - lifts); // units per ms

/** When each pen stroke starts and how long it lasts (ms after the signature starts). */
const timing = (() => {
  let clock = 0;
  return sig.strokes.map((s) => {
    const duration = Math.max(70, s.length / speed);
    const short = s.length < SHORT;
    const start = short ? Math.max(0, clock - duration * 0.6) : clock + LIFT_MS;
    clock = short ? Math.max(clock, start + duration) : start + duration;
    return { start: Math.round(start), duration: Math.round(duration) };
  });
})();
const writtenAt = Math.max(...timing.map((t) => t.start + t.duration));

const [vx, vy, vw, vh] = sig.viewBox;
const em = (units: number) => `${units / sig.unitsPerEm}em`;

/**
 * The hand signature, written on as if by a pen: the letters (set in the signature font) appear
 * along the path a pen would take, stroke after stroke, then the long crossbar is drawn through the
 * "A.". The pen paths come from `tools/signature/build.cjs`. Size it with `font-size` and colour it
 * with `color`; `delay` (ms) is when the pen starts. With reduced motion it is simply there.
 *
 * `id` must be unique on the page (the reveal is an SVG mask).
 */
export function Signature({ id, delay = 0, className }: { id: string; delay?: number; className?: string }) {
  const at = (ms: number) => `${delay + ms}ms`;
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative select-none", className)}
      style={{ width: em(sig.advance), height: "1em" }}
    >
      <svg
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        className="absolute overflow-visible"
        style={{ left: em(vx), top: em(sig.baselineFromTop + vy), width: em(vw), height: em(vh) }}
      >
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x={vx} y={vy} width={vw} height={vh}>
            {sig.strokes.map((s, i) => (
              <path
                key={i}
                d={s.d}
                fill="none"
                stroke="#fff"
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${s.length} ${s.length + 1}`}
                className="sig-pen"
                style={{ "--len": s.length, "--at": at(timing[i].start), "--for": `${timing[i].duration}ms` } as CSSProperties}
              />
            ))}
            {/* Once written, the whole signature shows (no tip left behind). */}
            <rect x={vx} y={vy} width={vw} height={vh} fill="#fff" className="sig-settle" style={{ "--at": at(writtenAt) } as CSSProperties} />
          </mask>
        </defs>
        <path d={sig.fill} fill="currentColor" mask={`url(#${id})`} />
        <rect
          x={sig.crossbar.x1}
          y={sig.crossbar.y - 0.7}
          width={sig.crossbar.x2 - sig.crossbar.x1}
          height={1.4}
          fill="currentColor"
          className="sig-bar"
          style={{ "--at": at(writtenAt - 120) } as CSSProperties}
        />
      </svg>
    </div>
  );
}
