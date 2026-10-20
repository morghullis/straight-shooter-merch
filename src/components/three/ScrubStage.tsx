"use client";

import { ContactShadows, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

import { showroomMotion as cfg } from "@/config/showroom";

import { normalizeModel } from "./normalize";
import { Studio } from "./Studio";

export interface ScrubModel {
  src: string;
  fit: number;
  rotation: [number, number, number];
}

interface ScrubStageProps {
  models: ScrubModel[];
  /** The product on stage. Only this one is drawn. */
  activeIndex: number;
  /** The product the stage last rested on: the loaded neighbours are chosen around it (see useSequencedChange). */
  anchorIndex: number;
  /** The product the scroll wants next: it is loaded ahead so it is ready when its turn comes. */
  wantedIndex: number;
  /** Scroll position along the products (0 = first, n-1 = last). Turns the active product a little. */
  position: MotionValue<number>;
  /** 1 = shown, 0 = hidden. The stage fades as a whole (CSS), this only scales the product. */
  reveal: MotionValue<number>;
  /** Side of the stage the product is leaving to or arriving from (-1..1). */
  slide: MotionValue<number>;
  /** Render frames only while the section is on screen. */
  active: boolean;
  /** Offset of the product in scene units (desktop leaves room on the left for the copy). */
  offsetX: number;
  offsetY?: number;
  onItemReady?: (index: number) => void;
  onItemGone?: (index: number) => void;
}

const clamp = THREE.MathUtils.clamp;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** Runs `fn` when the browser is idle (soon at the latest), so heavy uploads never land mid-frame. */
function whenIdle(fn: () => void) {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(fn, { timeout: 500 });
  else window.setTimeout(fn, 60);
}

function texturesOf(object: THREE.Object3D): THREE.Texture[] {
  const found = new Set<THREE.Texture>();
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if ((value as THREE.Texture | null)?.isTexture) found.add(value as THREE.Texture);
    }
  });
  return [...found];
}

/** Pulls the camera back on narrow canvases so the widest model always fits. */
function CameraRig() {
  useFrame(({ camera, size }) => {
    const z = clamp((5.6 / (size.width / size.height)) * 0.82, 6.4, 11);
    if (Math.abs(camera.position.z - z) < 0.01) return;
    camera.position.z = z;
    camera.updateProjectionMatrix();
  });
  return null;
}

/** Horizontal drag adds a yaw that eases back to zero, so scroll stays in charge. */
function DragYaw({ yawRef }: { yawRef: MutableRefObject<number> }) {
  const element = useThree((s) => s.gl.domElement);
  const dragging = useRef(false);

  useEffect(() => {
    let lastX = 0;
    const down = (e: PointerEvent) => {
      dragging.current = true;
      lastX = e.clientX;
      element.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      yawRef.current += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const up = () => {
      dragging.current = false;
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
    };
  }, [element, yawRef]);

  useFrame((_, dt) => {
    if (!dragging.current) yawRef.current *= Math.exp(-dt * 0.9);
  });
  return null;
}

interface ItemProps {
  model: ScrubModel;
  index: number;
  isActive: boolean;
  position: MotionValue<number>;
  reveal: MotionValue<number>;
  slide: MotionValue<number>;
  offsetX: number;
  offsetY: number;
  dragYaw: MutableRefObject<number>;
  onReady?: (index: number) => void;
  onGone?: (index: number) => void;
}

/**
 * One product. It is drawn only while it is the active one, so two products are never on stage
 * together. While it leaves or arrives it drifts to the side and turns a little; the fade itself is
 * done on the whole canvas, which keeps the materials opaque (no sorting artefacts on cloth).
 */
function Item({ model, index, isActive, position, reveal, slide, offsetX, offsetY, dragYaw, onReady, onGone }: ItemProps) {
  const { scene } = useGLTF(model.src);
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  const wasActive = useRef(false);
  // loading -> uploaded (textures on the GPU) -> warming (one invisible draw) -> ready
  const phase = useRef<"loading" | "uploaded" | "warming" | "ready">("loading");
  const { object, scale, offset } = useMemo(() => normalizeModel(scene, model.fit), [scene, model.fit]);

  // Upload the textures to the GPU now, one at a time while the browser is idle, instead of in the
  // first frame the product is drawn (that upload is what makes a change stutter).
  useEffect(() => {
    const textures = texturesOf(object);
    let cancelled = false;
    let next = 0;
    const step = () => {
      if (cancelled) return;
      if (next < textures.length) {
        gl.initTexture(textures[next++]);
        whenIdle(step);
      } else {
        phase.current = "uploaded";
      }
    };
    phase.current = "loading";
    whenIdle(step);
    return () => {
      cancelled = true;
      onGone?.(index);
    };
  }, [object, gl, index, onGone]);

  // When the product leaves the stage's working set, free its GPU memory and drop it from the loader cache.
  useEffect(() => {
    const src = model.src;
    return () => {
      object.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          for (const value of Object.values(material)) if ((value as THREE.Texture | null)?.isTexture) (value as THREE.Texture).dispose();
          material.dispose();
        }
      });
      useGLTF.clear(src);
    };
  }, [object, model.src]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;

    // Warm-up: the first time a model is drawn the GPU compiles its shader and uploads its geometry,
    // which blocks the page for a moment. Do that one draw early, at a point nobody can see it:
    // while the stage is invisible or at rest, never while a product is leaving or arriving.
    if (!isActive && phase.current !== "ready") {
      const r = reveal.get();
      const quiet = r < 0.02 || (r > 0.999 && Math.abs(slide.get()) < 0.001);
      if (phase.current === "uploaded" && quiet) {
        g.visible = true;
        g.position.set(offsetX, offsetY, 0);
        g.scale.setScalar(0.001);
        phase.current = "warming";
        return;
      }
      if (phase.current === "warming") {
        g.visible = false;
        phase.current = "ready";
        onReady?.(index);
        return;
      }
    }

    g.visible = isActive;
    if (isActive && phase.current === "uploaded") {
      // It became the active one before it was warmed: this frame draws it anyway.
      phase.current = "ready";
      onReady?.(index);
    }
    if (!isActive) {
      wasActive.current = false;
      return;
    }

    // Scrolling through this product's page turns it a little, and clamps at the page edges, so a
    // hard scroll can never spin it fast.
    const page = clamp(position.get() - index, -0.5, 0.5);
    const wantYaw = page * cfg.yawRange;
    if (!wasActive.current) yaw.current = wantYaw;
    else yaw.current += (wantYaw - yaw.current) * (1 - Math.exp(-dt * cfg.yawEase));
    wasActive.current = true;

    const shown = easeOut(clamp(reveal.get(), 0, 1));
    const side = slide.get();
    const bob = Math.sin(state.clock.elapsedTime * 1.3 + index) * 0.05;
    g.position.set(offsetX + side * cfg.slideUnits, offsetY + bob, 0);
    g.rotation.y = yaw.current + side * cfg.slideYaw + dragYaw.current;
    g.scale.setScalar(THREE.MathUtils.lerp(cfg.hiddenScale, 1, shown));
  });

  return (
    <group ref={group} visible={false}>
      <group rotation={model.rotation} position={offset}>
        <primitive object={object} scale={scale} />
      </group>
    </group>
  );
}

export default function ScrubStage({
  models,
  activeIndex,
  anchorIndex,
  wantedIndex,
  position,
  reveal,
  slide,
  active,
  offsetX,
  offsetY = 0,
  onItemReady,
  onItemGone,
}: ScrubStageProps) {
  const dragYaw = useRef(0);

  // Working set: the one on stage, the one the scroll wants, and the neighbours of the product the stage
  // last RESTED on. The neighbours only change once a change is over, never in the middle of one.
  const mounted = useMemo(
    () => new Set([anchorIndex - 1, anchorIndex, anchorIndex + 1, activeIndex, wantedIndex].filter((i) => i >= 0 && i < models.length)),
    [anchorIndex, activeIndex, wantedIndex, models.length],
  );

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.35, 6.4], fov: 30 }}
      frameloop={active ? "always" : "never"}
      style={{ touchAction: "pan-y" }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Studio />
      <CameraRig />
      <DragYaw yawRef={dragYaw} />

      {models.map((model, i) =>
        mounted.has(i) ? (
          <Suspense key={model.src} fallback={null}>
            <Item
              model={model}
              index={i}
              isActive={i === activeIndex}
              position={position}
              reveal={reveal}
              slide={slide}
              offsetX={offsetX}
              offsetY={offsetY}
              dragYaw={dragYaw}
              onReady={onItemReady}
              onGone={onItemGone}
            />
          </Suspense>
        ) : null,
      )}

      <group position={[offsetX, offsetY, 0]}>
        <ContactShadows position={[0, -1.7, 0]} opacity={0.7} scale={8} blur={2.6} far={3.6} />
      </group>
    </Canvas>
  );
}
