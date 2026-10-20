"use client";

import { useInView } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { copy } from "@/config/copy";
import { useWebGL } from "@/lib/browser";

// Three.js is heavy: it only downloads once a viewer is about to scroll into view.
const ModelStage = dynamic(() => import("./ModelStage"), { ssr: false });

interface ModelViewerProps {
  src: string;
  fit: number;
  rotation: [number, number, number];
  /** Product photo shown when WebGL is unavailable. */
  fallbackImage: string;
  fallbackAlt: string;
  className?: string;
}

/** Lazy, interactive 3D view with a photo fallback. Drag to rotate. Give it a positioned, sized className. */
export function ModelViewer({ src, fit, rotation, fallbackImage, fallbackAlt, className = "" }: ModelViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const animate = useMotionEnabled();
  const webgl = useWebGL();
  const seen = useInView(ref, { once: true, margin: "300px 0px" });
  const visible = useInView(ref, { margin: "0px" });
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const ready = readySrc === src;

  return (
    <div ref={ref} className={className}>
      {webgl && seen ? (
        <div className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing">
          <ModelStage
            src={src}
            fit={fit}
            rotation={rotation}
            active={visible}
            animate={animate}
            onReady={() => setReadySrc(src)}
          />
        </div>
      ) : null}

      {/* Loading shimmer, or the photo when WebGL is not available */}
      {!webgl ? (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="relative h-full w-full max-w-[35rem] overflow-hidden rounded-[0.375rem] bg-sand">
            <Image src={fallbackImage} alt={fallbackAlt} fill sizes="(min-width: 1326px) 42.2vw, 560px" className="object-cover" />
          </div>
        </div>
      ) : (
        <div
          aria-hidden={ready}
          className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
        >
          <span className="relative grid h-10 w-10 place-items-center">
            <span className="absolute inset-0 rounded-full border border-gold [animation:pulse-ring_1.6s_ease-out_infinite]" />
            <span className="h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="sr-only">{copy.showroom.loading3d}</span>
        </div>
      )}
    </div>
  );
}
