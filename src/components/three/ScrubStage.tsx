"use client";

import { ContactShadows, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
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
  /** Position along the products (0 = first, n-1 = last), already holding still on each product. */
  position: MotionValue<number>;
  /** The product closest to the current position. */
  index: number;
  /**
   * Keep every model loaded once it has loaded (desktop). Otherwise only the products around the
   * current one are kept (phones), which saves GPU memory.
   */
  keepAll: boolean;
  /** Render frames only while the section is on screen. */
  active: boolean;
  /** Offset of the products in scene units (desktop leaves room on the left for the copy). */
  offsetX: number;
  offsetY?: number;
  onItemReady?: (index: number) => void;
}

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const SPIN = Math.PI * 2 * cfg.spinTurns;
/** Half the width of a product on stage, in scene units (models are fitted to about 2.4). */
const PRODUCT_HALF = 1.25;

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

/** One smoothing step towards `target` (renderer state, updated once per frame outside React's render). */
function follow(smoothed: MutableRefObject<number>, target: number, dt: number) {
  const k = 1 - Math.exp(-Math.min(dt, 0.1) / cfg.followSeconds);
  smoothed.current += (target - smoothed.current) * k;
  if (Math.abs(target - smoothed.current) < 1e-4) smoothed.current = target;
}

/** Follows the scroll position with a very short smoothing, once per frame, for every product to read. */
function Follower({ position, smoothed }: { position: MotionValue<number>; smoothed: MutableRefObject<number> }) {
  useFrame((_, dt) => follow(smoothed, position.get(), dt));
  return null;
}

/** Horizontal drag adds a yaw that eases back to zero. */
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
  smoothed: MutableRefObject<number>;
  offsetX: number;
  offsetY: number;
  dragYaw: MutableRefObject<number>;
  /** Free the model's GPU memory and loader cache when it leaves the working set (phones). */
  disposeOnLeave: boolean;
  onReady?: (index: number) => void;
}

/**
 * One product. Its pose is a pure function of the scroll position `d` relative to it: at d = 0 it
 * rests in front; as d grows it spins on its axis and travels off to one side, while the next product
 * (d < 0) spins in from the other side. Materials stay opaque, and at most the leaving and the arriving
 * products are drawn, each on its own side of the stage.
 */
function Item({ model, index, smoothed, offsetX, offsetY, dragYaw, disposeOnLeave, onReady }: ItemProps) {
  const { scene } = useGLTF(model.src);
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
  // loading -> uploaded (textures on the GPU) -> warming (one invisible draw) -> ready
  const phase = useRef<"loading" | "uploaded" | "warming" | "ready">("loading");
  const { object, scale, offset } = useMemo(() => normalizeModel(scene, model.fit), [scene, model.fit]);

  // Upload the textures to the GPU while the browser is idle, not in the first frame the product is drawn.
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
    };
  }, [object, gl]);

  useEffect(() => {
    if (!disposeOnLeave) return;
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
  }, [object, model.src, disposeOnLeave]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const x = smoothed.current;
    const d = x - index;

    // On stage while it is the current product or the one just next to it (|d| < 1).
    const onStage = Math.abs(d) < 1;

    // Warm-up: the first draw of a model compiles its shader and uploads its geometry. Do it while the
    // stage is at rest and the product is off stage, at a scale nobody can see.
    if (phase.current === "warming") {
      phase.current = "ready";
      onReady?.(index);
    } else if (phase.current === "uploaded") {
      if (onStage) {
        phase.current = "ready";
        onReady?.(index);
      } else if (Math.abs(x - Math.round(x)) < 0.01) {
        g.visible = true;
        g.position.set(offsetX, offsetY, 0);
        g.scale.setScalar(0.001);
        phase.current = "warming";
        return;
      }
    }

    g.visible = onStage;
    if (!onStage) return;

    // A conveyor: products move at a steady pace with the scroll, spinning on their axis, the leaving
    // one still on its way out on one side while the next one comes in on the other. The distances are
    // chosen so a product is exactly off the stage when its neighbour is at rest (|d| = 1).
    const camera = state.camera as THREE.PerspectiveCamera;
    const visibleHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * (state.size.width / state.size.height);
    const toLeft = visibleHalf + PRODUCT_HALF + offsetX;
    const toRight = visibleHalf + PRODUCT_HALF - offsetX;
    const bob = Math.sin(state.clock.elapsedTime * 1.3 + index) * 0.05;

    g.position.set(offsetX - d * (d >= 0 ? toLeft : toRight), offsetY + bob, 0);
    g.rotation.y = d * SPIN + (Math.abs(d) < 0.001 ? dragYaw.current : dragYaw.current * (1 - Math.min(1, Math.abs(d) * 4)));
    g.scale.setScalar(lerp(1, cfg.travelScale, Math.sin(Math.PI * Math.min(1, Math.abs(d)))));
  });

  return (
    <group ref={group} visible={false}>
      <group rotation={model.rotation} position={offset}>
        <primitive object={object} scale={scale} />
      </group>
    </group>
  );
}

export default function ScrubStage({ models, position, index, keepAll, active, offsetX, offsetY = 0, onItemReady }: ScrubStageProps) {
  const dragYaw = useRef(0);
  const smoothed = useRef(position.get());

  // Working set: the products around the current one (two ahead, so they are ready long before they
  // are needed). On desktop every model that has been loaded once stays loaded, so scrolling never has
  // to load or prepare anything mid-change.
  const near = useMemo(() => [index - 1, index, index + 1, index + 2].filter((i) => i >= 0 && i < models.length), [index, models.length]);
  const [kept, setKept] = useState<number[]>(near);
  const [seenNear, setSeenNear] = useState(near);
  if (seenNear !== near) {
    // The current product changed: update the working set during render (no extra effect pass).
    setSeenNear(near);
    setKept(keepAll ? [...new Set([...kept, ...near])] : near);
  }
  const mounted = useMemo(() => new Set([...kept, ...near]), [kept, near]);

  // Desktop: once a model is ready, start loading the next one still missing, one at a time, in the
  // background, so every product is prepared before the visitor scrolls to it.
  const count = models.length;
  const handleReady = useCallback(
    (i: number) => {
      onItemReady?.(i);
      if (!keepAll) return;
      setKept((prev) => {
        for (let k = 0; k < count; k++) if (!prev.includes(k)) return [...prev, k];
        return prev;
      });
    },
    [onItemReady, keepAll, count],
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
      <Follower position={position} smoothed={smoothed} />
      <DragYaw yawRef={dragYaw} />

      {models.map((model, i) =>
        mounted.has(i) ? (
          <Suspense key={model.src} fallback={null}>
            <Item
              model={model}
              index={i}
              smoothed={smoothed}
              offsetX={offsetX}
              offsetY={offsetY}
              dragYaw={dragYaw}
              disposeOnLeave={!keepAll}
              onReady={handleReady}
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
