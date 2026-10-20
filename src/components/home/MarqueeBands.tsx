"use client";

import { useState } from "react";

import { VelocityMarquee } from "@/components/motion/VelocityMarquee";
import { Art, textureStyle } from "@/components/ui/Art";
import { cn } from "@/lib/cn";

interface BandProps {
  phrases: string[];
  tone: "paper" | "gold";
  speed: number;
  paused: boolean;
  className?: string;
}

/** One printed band: paper or gold stock, black condensed type, slashes between phrases. */
function Band({ phrases, tone, speed, paused, className }: BandProps) {
  return (
    <div
      className={cn(
        "relative -mx-[4%] w-[108%] text-[#111]",
        tone === "paper" ? "bg-cream" : "bg-gold",
        className,
      )}
    >
      {/* Paper grain on top of the flat colour */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-45 mix-blend-multiply"
        style={textureStyle("paper")}
      />
      <VelocityMarquee speed={speed} paused={paused} className="relative py-2">
        {phrases.map((phrase, i) => (
          <span key={`${phrase}-${i}`} className="flex flex-none items-center whitespace-nowrap">
            <span className="px-5 font-display text-[clamp(3.375rem,8vw,6.5rem)] leading-[1.02] font-extrabold uppercase sm:px-8">
              {phrase}
            </span>
            <span aria-hidden="true" className="font-display text-[clamp(3.375rem,8vw,6.5rem)] leading-[1.02] font-extrabold text-black/35">
              /
            </span>
          </span>
        ))}
      </VelocityMarquee>
    </div>
  );
}

interface MarqueeBandsProps {
  phrases: string[];
  label: string;
}

/** The two taped catchphrase bands. They hold still while the pointer or keyboard focus is on them. */
export function MarqueeBands({ phrases, label }: MarqueeBandsProps) {
  const [hovering, setHovering] = useState(false);
  const paused = hovering;

  return (
    <section
      aria-label={label}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={() => setHovering(false)}
      className="relative my-16 overflow-x-clip py-10"
    >
      <p className="sr-only">{phrases.join(". ")}.</p>

      <div className="relative z-[1] -rotate-[1.4deg]">
        <Band phrases={phrases} tone="paper" speed={3} paused={paused} />
      </div>
      <div className="relative z-[2] -mt-3 rotate-[1.1deg]">
        <Band phrases={[...phrases].reverse()} tone="gold" speed={-3.6} paused={paused} className="[&_span]:text-[clamp(2.5rem,5.6vw,4.5rem)]" />
      </div>

      {/* A real stamp, pressed onto the paper band */}
      <div aria-hidden="true" className="pointer-events-none absolute top-6 right-[5%] z-[3] hidden w-[11.875rem] -rotate-6 mix-blend-multiply md:block">
        <Art name="stampBlasphemous" sizes="(min-width: 1326px) 15.1vw, 200px" className="h-auto w-full opacity-80" />
      </div>

    </section>
  );
}
