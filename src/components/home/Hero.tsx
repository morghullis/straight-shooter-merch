import Image from "next/image";

import { Signature } from "@/components/brand/Signature";
import { GhostRoll } from "@/components/home/GhostRoll";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { ScrollHost, ScrollLayer } from "@/components/motion/ScrollHost";
import { Button } from "@/components/ui/Button";
import { hero } from "@/config/site";

const delay = (ms: number) => ({ "--d": ms }) as React.CSSProperties;

/**
 * Desktop (lg+): the 1152 x 312 stage of the reference. Every coordinate comes from the
 * `--hero-*` variables in globals.css. Phones get a photo on top with the headline
 * overlapping its fade, a full-width button and the show words as a quiet line.
 *
 * Motion: a CSS-only intro (headline wipes in line by line, button pops, signature is
 * written on, ghost words slide in), pointer parallax, and a scroll exit where the layers
 * peel away at different speeds. At scroll 0 and pointer rest it is the static design.
 */
export function Hero() {
  return (
    <ScrollHost
      aria-labelledby="hero-title"
      className="relative isolate mx-auto flex max-w-(--container) flex-col overflow-hidden bg-black lg:block lg:h-(--hero-h)"
    >
      {/* Photo: 628 x 312, dropped a little so the cropped top of the head melts into black; fades at the sides on desktop, into the headline on phones */}
      <ScrollLayer
        scale={[1, 1.08]}
        opacity={[1, 0.35]}
        origin="60% 0%"
        className="hero-photo-mask relative z-0 h-[min(84vw,24.375rem)] w-full lg:absolute lg:top-0 lg:left-(--hero-photo-left) lg:h-(--hero-h) lg:w-(--hero-photo-w)"
      >
        <ParallaxLayer depth={6} className="h-full w-full">
          <div className="h-full w-full translate-y-(--hero-photo-drop)">
            <div className="anim-photo relative h-full w-full">
              <Image
                src="/images/hero/hero-photo.webp"
                alt=""
                fill
                priority
                sizes="(min-width: 1326px) 47.4vw, (min-width: 1024px) 628px, 100vw"
                className="object-cover object-[64%_28%] lg:object-center"
              />
            </div>
          </div>
        </ParallaxLayer>
      </ScrollLayer>

      {/* Dark wall behind the ghost words (desktop only) */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 z-[1] hidden w-(--hero-wall-w) bg-[linear-gradient(90deg,transparent_0%,#07070a_30%,#0a0a0c_100%)] lg:block"
      />

      <div className="relative z-[3] -mt-12 px-(--gutter) pb-10 lg:static lg:mt-0 lg:p-0">
        <ScrollLayer
          y={[0, -64]}
          opacity={[1, 0.1]}
          during={[0, 0.85]}
          className="lg:absolute lg:top-(--hero-headline-top) lg:left-(--hero-headline-left) lg:z-[3]"
        >
          <ParallaxLayer depth={3}>
            <h1
              id="hero-title"
              className="font-display text-[clamp(3.25rem,15vw,5.25rem)] leading-[0.82] font-extrabold uppercase [-webkit-text-stroke:0.03125rem_currentColor] [word-spacing:0.04em] lg:text-(length:--hero-headline-size) lg:leading-(--hero-headline-lh)"
            >
              {hero.lines.map((line, i) => (
                <span key={line.text} className="block">
                  <span
                    className={`anim-line block ${line.tone === "gold" ? "shimmer-gold" : "text-[#f4f4f0]"}`}
                    style={{ ...delay(250 + i * 150), letterSpacing: line.tracking }}
                  >
                    {line.text}
                  </span>
                </span>
              ))}
            </h1>
          </ParallaxLayer>
        </ScrollLayer>

        <ScrollLayer
          y={[0, -36]}
          opacity={[1, 0]}
          during={[0, 0.6]}
          className="mt-7 lg:absolute lg:top-(--hero-cta-top) lg:left-(--hero-headline-left) lg:z-[4] lg:mt-0"
        >
          <Button
            href={hero.cta.href}
            size="none"
            arrow
            style={delay(800)}
            className="anim-pop h-12 w-full text-[0.875rem] hover:-translate-y-0.5 sm:w-(--hero-cta-w) lg:h-(--hero-cta-h) lg:text-[0.85625rem] lg:tracking-[0.04em]"
          >
            {hero.cta.label}
          </Button>
        </ScrollLayer>

        {/* Phones: the show words as a slow ticker under the button */}
        <div
          aria-hidden="true"
          className="mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)] lg:hidden"
        >
          <div className="ghost-marquee flex w-max font-nav text-[0.8125rem] font-semibold tracking-[0.18em] text-white/40 uppercase">
            {[0, 1].map((copy) => (
              <ul key={copy} className="flex flex-none gap-5 pr-5">
                {hero.ghostWords.map((word) => (
                  <li key={word} className="flex gap-5 after:text-white/20 after:content-['/']">
                    {word}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop-only flourishes */}
      <ParallaxLayer
        depth={14}
        drift={-22}
        className="pointer-events-none absolute top-(--hero-sig-top) left-(--hero-sig-left) z-[3] hidden lg:block"
      >
        <Signature text={hero.signature} />
      </ParallaxLayer>

      {/* Decoration only: it must never sit between the visitor and the button. */}
      <ParallaxLayer depth={9} drift={-10} className="pointer-events-none absolute inset-0 z-[3] hidden lg:block">
        <div aria-hidden="true">
          <GhostRoll words={hero.ghostWords} className="absolute top-(--hero-ghost-top) left-(--hero-ghost-left)" />
          <span
            style={delay(1250)}
            className="anim-bar absolute top-(--hero-bar-top) left-(--hero-bar-left) h-(--hero-bar-h) w-(--hero-bar-w) bg-gold/90"
          />
        </div>
      </ParallaxLayer>
    </ScrollHost>
  );
}
