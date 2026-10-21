import type { CSSProperties, ReactNode } from "react";

import { art } from "@/config/art";
import { cn } from "@/lib/cn";

export type TapeTone = "gold" | "ink" | "paper";

const tones: Record<TapeTone, string> = {
  gold: "text-[#14110a]",
  ink: "tape-ink text-white",
  paper: "tape-paper text-[#14110a]",
};

/**
 * A strip of gaffer tape (Meshy artwork) with whatever you put on it printed into it (the ink takes
 * the tape's creases and grain, see `.tape-print`). The torn ends keep their shape and the middle
 * stretches to fit the content (see `.tape-surface` in globals.css).
 */
export function Tape({
  children,
  className,
  tone = "gold",
}: {
  children: ReactNode;
  className?: string;
  tone?: TapeTone;
}) {
  return (
    <div
      style={{ "--tape": `url(${art.tape.src})` } as CSSProperties}
      className={cn("tape-surface inline-block py-2.5 [--tape-end:1.6rem] sm:[--tape-end:2.1rem]", tones[tone], className)}
    >
      <div className="tape-print">{children}</div>
    </div>
  );
}
