import Image from "next/image";

import { art } from "@/config/art";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";

interface LogoProps {
  priority?: boolean;
  className?: string;
}

/**
 * The Straight Shooter mark with its MERCH tag. The mark is an image; the tag (an orange rule
 * and silver lettering) is real text, so it stays sharp and readable at header size. The width
 * comes from `--logo-w`, so every placement sets one variable instead of juggling sizes.
 */
export function Logo({ priority = false, className }: LogoProps) {
  const { src, width, height } = art.logoMark;
  return (
    <span className={cn("block w-(--logo-w)", className)}>
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        priority={priority}
        sizes="(min-width: 1326px) 7.5vw, (min-width: 1024px) 100px, 64px"
        className="block h-auto w-full"
      />
      <span aria-hidden="true" className="mt-[5%] flex items-center gap-[6%]">
        <span className="h-[0.1875rem] flex-1 rounded-[1px] bg-[linear-gradient(90deg,#e8651b,#f0ac28)]" />
        <span className="text-silver font-nav text-[length:max(0.53125rem,calc(var(--logo-w)*0.125))] leading-none font-semibold tracking-[0.05em] uppercase [filter:drop-shadow(0_1px_0_rgba(0,0,0,0.9))]">
          {copy.header.logoTag}
        </span>
      </span>
    </span>
  );
}
