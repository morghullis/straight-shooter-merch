import Image from "next/image";

import { art } from "@/config/art";
import { cn } from "@/lib/cn";

interface LogoProps {
  priority?: boolean;
  className?: string;
}

/**
 * The official Straight Shooter Shop logo (the S over the lettering), cut out of its black
 * background so it sits on the black header and footer. The width comes from `--logo-w`, so every
 * placement sets one variable instead of juggling sizes.
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
        sizes="(min-width: 1326px) 15vw, 200px"
        className="block h-auto w-full"
      />
    </span>
  );
}
