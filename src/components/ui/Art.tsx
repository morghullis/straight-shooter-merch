import Image from "next/image";

import { art, type ArtKey } from "@/config/art";

interface ArtProps {
  name: ArtKey;
  className?: string;
  /** Decorative by default. */
  alt?: string;
  sizes?: string;
  priority?: boolean;
}

/** One brand illustration, stamp or sticker from `config/art.ts`. */
export function Art({ name, className, alt = "", sizes = "(min-width: 1326px) 22.6vw, 300px", priority }: ArtProps) {
  const asset = art[name];
  return (
    <Image
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={alt}
      sizes={sizes}
      priority={priority}
      className={className}
      draggable={false}
    />
  );
}

/** Inline style that paints a texture from `config/art.ts` (paper, concrete). */
export function textureStyle(name: Extract<ArtKey, "paper" | "concrete">, size = "cover") {
  return { backgroundImage: `url(${art[name].src})`, backgroundSize: size } as const;
}
