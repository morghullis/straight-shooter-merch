import Image from "next/image";

import { art } from "@/config/art";
import { cn } from "@/lib/cn";

interface LogoProps {
  /** "lockup": figure beside the lettering (header). "full": the composition as drawn (footer). */
  variant?: "lockup" | "full";
  priority?: boolean;
  className?: string;
}

/**
 * The Straight Shooter Shop logo: the pink silhouette and the orange lettering, on a transparent
 * background so it sits on the black header and footer. The width comes from `--logo-w`, so every
 * placement sets one variable instead of juggling sizes.
 */
export function Logo({ variant = "lockup", priority = false, className }: LogoProps) {
  const { src, width, height } = variant === "full" ? art.logoFull : art.logo;
  return (
    <span className={cn("block w-(--logo-w)", className)}>
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        priority={priority}
        sizes="(min-width: 1326px) 15vw, 200px"
        className="block h-auto w-full"
      />
    </span>
  );
}
