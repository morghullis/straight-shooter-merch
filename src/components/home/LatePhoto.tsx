"use client";

import Image from "next/image";
import { useState } from "react";

import { useAfterLoad, useMediaQuery } from "@/lib/browser";
import type { CatalogImage } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

/**
 * A photo that is not on screen yet (a later hero slide): asked for once the page has loaded and the
 * browser is idle, so it never competes with the first paint, and only on the screens it is for.
 */
export function LatePhoto({ image, sizes, className, media }: { image: CatalogImage; sizes: string; className?: string; media: string }) {
  const ready = useAfterLoad();
  const here = useMediaQuery(media);
  const [loaded, setLoaded] = useState(false);
  if (!ready || !here) return null;
  return (
    <Image
      src={image.url}
      alt={image.altText}
      fill
      loading="eager"
      fetchPriority="low"
      sizes={sizes}
      draggable={false}
      onLoad={() => setLoaded(true)}
      className={cn("transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", className)}
    />
  );
}
