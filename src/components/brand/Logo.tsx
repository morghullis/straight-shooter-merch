import Image from "next/image";

import { art } from "@/config/art";
import { cn } from "@/lib/cn";

interface LogoProps {
  priority?: boolean;
  className?: string;
}

/**
 * The Straight Shooter Shop logo (pink silhouette, "The Stephen A. Smith" in white, "Straight
 * Shooter Shop" in orange) on a transparent background, made for the black header and footer. The
 * width comes from `--logo-w`, so every placement sets one variable instead of juggling sizes.
 */
export function Logo({ priority = false, className }: LogoProps) {
  const { src, width, height } = art.logo;
  return (
    <span className={cn("block w-(--logo-w)", className)}>
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        priority={priority}
        sizes="(min-width: 1326px) 20vw, 256px"
        className="block h-auto w-full"
      />
    </span>
  );
}
