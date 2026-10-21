import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

import { signature as sig } from "./signature-paths";

/** How long the pen takes to write the whole signature (pen lifts included), in ms. */
const WRITE_MS = 2600;
/** A pause where the pen leaves the paper between two strokes. */
const LIFT_MS = 70;
/** Strokes shorter than this (the tick, the full stop) are quick taps. */
const SHORT = 40;

const total = sig.strokes.reduce((sum, s) => sum + s.length, 0);
const speed = total / (WRITE_MS - (sig.strokes.length - 1) * LIFT_MS); // px of ink per ms

/** When each pen stroke starts and how long it lasts (ms after the signature starts). */
const timing = (() => {
  let clock = 0;
  return sig.strokes.map((s, i) => {
    const duration = s.length < SHORT ? 90 : s.length / speed;
    const start = i === 0 ? 0 : clock + LIFT_MS;
    clock = start + duration;
    return { start: Math.round(start), duration: Math.round(duration) };
  });
})();
const writtenAt = Math.max(...timing.map((t) => t.start + t.duration));

/**
 * The real hand signature (the brand's own artwork, not a font), written on as if by the pen: it is
 * revealed along the route the pen takes, stroke after stroke, at the speed of a hand, ending with
 * the flourish and the full stop. The routes come from `tools/signature/build.py`. Size it with a
 * width class; `delay` (ms) is when the pen starts. With reduced motion it is simply there.
 *
 * `id` must be unique on the page (the reveal is an SVG mask).
 */
export function Signature({ id, delay = 0, className }: { id: string; delay?: number; className?: string }) {
  const at = (ms: number) => `${delay + ms}ms`;
  return (
    <div aria-hidden="true" className={cn("pointer-events-none select-none", className)}>
      <svg viewBox={`0 0 ${sig.width} ${sig.height}`} className="block h-auto w-full overflow-visible">
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={sig.width} height={sig.height}>
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
            {/* Once written, the whole signature shows (no edge pixel left behind). */}
            <rect width={sig.width} height={sig.height} fill="#fff" className="sig-settle" style={{ "--at": at(writtenAt) } as CSSProperties} />
          </mask>
        </defs>
        <image href={sig.image} width={sig.width} height={sig.height} mask={`url(#${id})`} />
      </svg>
    </div>
  );
}
