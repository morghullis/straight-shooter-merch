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

/** A box on the stage, as fractions of its width and height: centre (x, y from the top left) and size. */
export interface StageSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ScrubStageProps {
  models: ScrubModel[];
  /** Position along the products (0 = first, n-1 = last). */
  position: MotionValue<number>;
  /** The product closest to the current position. */
  index: number;
  /** Render frames only while the section is on screen. */
  active: boolean;
  /**
   * Where a product rests on screen. Without it, products rest `offsetX` / `offsetY` scene units from
   * the centre and the camera keeps a set distance (desktop).
   */
  slot?: StageSlot | null;
  offsetX?: number;
  offsetY?: number;
  onItemReady?: (index: number) => void;
}

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const SPIN = Math.PI * 2 * cfg.spinTurns;
/** Half the width of a product on stage, in scene units (models are fitted to about 2.4). */
const PRODUCT_HALF = 1.25;
const CAMERA_Y = 0.35;
const FOV = 30;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/** The products' resting point in the scene, worked out from the canvas size every frame. */
interface Framing {
  x: number;
  y: number;
}

/** How far the camera stands: with a slot, far enough for a product to fit it both ways. */
function cameraDistance(size: { width: number; height: number }, slot: StageSlot | null | undefined) {
  const aspect = size.width / Math.max(1, size.height);
  if (!slot) return clamp((5.6 / aspect) * 0.82, 6.4, 11);
  const box = PRODUCT_HALF * 2;
  return clamp(Math.max(box / (2 * TAN * slot.h), box / (2 * TAN * slot.w * aspect)), 6.4, 30);
}

const ndc = new THREE.Vector3();
/** The point on the products' plane (z = 0) that the camera shows at (sx, sy), fractions from the top left. */
function pointAt(camera: THREE.Camera, sx: number, sy: number): Framing {
  ndc.set(2 * sx - 1, 1 - 2 * sy, 0.5).unproject(camera).sub(camera.position);
  const t = -camera.position.z / ndc.z;
  return { x: camera.position.x + ndc.x * t, y: camera.position.y + ndc.y * t };
}

/** Whenever the browser is idle (soon at the latest), so heavy uploads never land mid-frame. */
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

/** One smoothing step towards `target` (renderer state, updated once per frame outside React's render). */
function follow(smoothed: MutableRefObject<number>, target: number, dt: number) {
  const k = 1 - Math.exp(-Math.min(dt, 0.1) / cfg.followSeconds);
  smoothed.current += (target - smoothed.current) * k;
  if (Math.abs(target - smoothed.current) < 1e-4) smoothed.current = target;
}

/**
 * Once per frame, before the products: follows the scroll position (with a very short smoothing),
 * frames the camera and moves the shadow under the resting point.
 */
function Director({
  position,
  smoothed,
  framingRef,
  slot,
  offsetX,
  offsetY,
  shadow,
}: {
  position: MotionValue<number>;
  smoothed: MutableRefObject<number>;
  framingRef: MutableRefObject<Framing>;
  slot: StageSlot | null | undefined;
  offsetX: number;
  offsetY: number;
  shadow: MutableRefObject<THREE.Group | null>;
}) {
  useFrame(({ camera, size }, dt) => {
    follow(smoothed, position.get(), dt);
    const z = cameraDistance(size, slot);
    if (Math.abs(camera.position.z - z) > 0.001) {
      camera.position.z = z;
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    const rest = slot ? pointAt(camera, slot.x, slot.y) : { x: offsetX, y: offsetY };
    framingRef.current = rest;
    shadow.current?.position.set(rest.x, rest.y, 0);
  }, -1);
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
  framingRef: MutableRefObject<Framing>;
  dragYaw: MutableRefObject<number>;
  /** The model has downloaded and is parsed. */
  onLoaded: (index: number) => void;
  /** The model has been drawn once and can come on stage without a hitch. */
  onReady?: (index: number) => void;
}

/**
 * One product. Its pose is a pure function of the position `d` relative to it: at d = 0 it rests in
 * front; as d grows it spins on its axis and travels off one side, while the next product (d < 0)
 * spins in from the other side. Materials stay opaque, and at most the leaving and the arriving
 * products are drawn, each on its own side of the stage.
 */
function Item({ model, index, smoothed, framingRef, dragYaw, onLoaded, onReady }: ItemProps) {
  const { scene } = useGLTF(model.src);
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
  // loading -> uploaded (textures on the GPU) -> warming (one invisible draw) -> ready
  const phase = useRef<"loading" | "uploaded" | "warming" | "ready">("loading");
  const { object, scale, offset } = useMemo(() => normalizeModel(scene, model.fit), [scene, model.fit]);

  useEffect(() => onLoaded(index), [onLoaded, index]);

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

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const x = smoothed.current;
    const d = x - index;
    const { x: restX, y: restY } = framingRef.current;

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
        g.position.set(restX, restY, 0);
        g.scale.setScalar(0.001);
        phase.current = "warming";
        return;
      }
    }

    g.visible = onStage;
    if (!onStage) return;

    // A conveyor: the products move together, spinning on their axis, the leaving one on its way out
    // on one side while the next one comes in on the other. The distances are chosen so a product is
    // just off the stage when its neighbour is at rest (|d| = 1).
    const camera = state.camera as THREE.PerspectiveCamera;
    const visibleHalf = TAN * camera.position.z * (state.size.width / state.size.height);
    const toLeft = visibleHalf + PRODUCT_HALF + restX;
    const toRight = visibleHalf + PRODUCT_HALF - restX;
    const bob = Math.sin(state.clock.elapsedTime * 1.3 + index) * 0.05;

    g.position.set(restX - d * (d >= 0 ? toLeft : toRight), restY + bob, 0);
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

export default function ScrubStage({ models, position, index, active, slot, offsetX = 0, offsetY = 0, onItemReady }: ScrubStageProps) {
  const dragYaw = useRef(0);
  const smoothed = useRef(position.get());
  const framingRef = useRef<Framing>({ x: offsetX, y: offsetY });
  const shadow = useRef<THREE.Group>(null);

  // Models download one after the other, from the first product on, so the one in front comes first;
  // the current product and the next one are always among them. Once loaded, a model stays loaded.
  const [loaded, setLoaded] = useState(0);
  const mountedUpTo = Math.max(loaded, index + 1);
  const handleLoaded = useCallback((i: number) => setLoaded((n) => Math.max(n, i + 1)), []);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, CAMERA_Y, 6.4], fov: FOV }}
      frameloop={active ? "always" : "never"}
      style={{ touchAction: "pan-y" }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Studio />
      <Director position={position} smoothed={smoothed} framingRef={framingRef} slot={slot} offsetX={offsetX} offsetY={offsetY} shadow={shadow} />
      <DragYaw yawRef={dragYaw} />

      {models.map((model, i) =>
        i <= mountedUpTo ? (
          <Suspense key={model.src} fallback={null}>
            <Item
              model={model}
              index={i}
              smoothed={smoothed}
              framingRef={framingRef}
              dragYaw={dragYaw}
              onLoaded={handleLoaded}
              onReady={onItemReady}
            />
          </Suspense>
        ) : null,
      )}

      <group ref={shadow}>
        <ContactShadows position={[0, -1.7, 0]} opacity={0.7} scale={8} blur={2.6} far={3.6} />
      </group>
    </Canvas>
  );
}
