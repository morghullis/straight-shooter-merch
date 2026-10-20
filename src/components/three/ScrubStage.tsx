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
  /** The product arriving or at rest. */
  activeIndex: number;
  /** The product spinning out during a change. */
  leavingIndex: number | null;
  /** A product being prepared for the next change (loaded ahead). */
  preparingIndex: number | null;
  /** The product the stage last rested on: its neighbours are kept loaded. */
  anchorIndex: number;
  /** +1 towards later products, -1 towards earlier ones. */
  direction: number;
  /** 0..1 progress of the leaving product's exit. */
  exit: MotionValue<number>;
  /** 0..1 progress of the active product's arrival (1 = at rest). */
  enter: MotionValue<number>;
  /** Render frames only while the section is on screen. */
  active: boolean;
  /** Offset of the product in scene units (desktop leaves room on the left for the copy). */
  offsetX: number;
  offsetY?: number;
  onItemReady?: (index: number) => void;
  onItemGone?: (index: number) => void;
}

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const SPIN = Math.PI * 2 * cfg.spinTurns;

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

type Role = "active" | "leaving" | "idle";

interface ItemProps {
  model: ScrubModel;
  index: number;
  role: Role;
  direction: number;
  exit: MotionValue<number>;
  enter: MotionValue<number>;
  /** No change is running: a hidden product may do its warm-up draw now. */
  quiet: boolean;
  offsetX: number;
  offsetY: number;
  dragYaw: MutableRefObject<number>;
  onReady?: (index: number) => void;
  onGone?: (index: number) => void;
}

/**
 * One product. At rest it sits in front, facing the camera. When it leaves it spins on its axis and
 * travels off the stage; the next product travels in from the other side, spinning, and settles
 * facing the camera. Materials stay opaque the whole time.
 */
function Item({ model, index, role, direction, exit, enter, quiet, offsetX, offsetY, dragYaw, onReady, onGone }: ItemProps) {
  const { scene } = useGLTF(model.src);
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
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

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    // Warm-up: the first time a model is drawn the GPU compiles its shader and uploads its geometry,
    // which blocks the page for a moment. Do that one draw early, while no change is running.
    if (role === "idle" && phase.current !== "ready") {
      // Quiet: no change running, or the leaving product is already off the stage.
      if (phase.current === "uploaded" && (quiet || exit.get() >= 0.97)) {
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
    if (role !== "idle" && phase.current === "uploaded") {
      phase.current = "ready";
      onReady?.(index);
    }

    g.visible = role !== "idle";
    if (role === "idle") return;

    // How far off the stage a product has to travel to be fully out of view.
    const camera = state.camera as THREE.PerspectiveCamera;
    const visibleWidth = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * (state.size.width / state.size.height);
    const away = visibleWidth / 2 + 1.6 + Math.abs(offsetX);
    const bob = Math.sin(state.clock.elapsedTime * 1.3 + index) * 0.05;

    if (role === "leaving") {
      const t = clamp(exit.get(), 0, 1);
      g.position.set(offsetX - direction * t * away, offsetY + bob, 0);
      g.rotation.y = direction * t * SPIN;
      g.scale.setScalar(lerp(1, cfg.travelScale, t));
      return;
    }

    // Arriving (enter < 1) or at rest (enter = 1).
    const t = clamp(enter.get(), 0, 1);
    g.position.set(offsetX + direction * (1 - t) * away, offsetY + bob, 0);
    g.rotation.y = -direction * (1 - t) * SPIN + dragYaw.current;
    g.scale.setScalar(lerp(cfg.travelScale, 1, t));
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
  leavingIndex,
  preparingIndex,
  anchorIndex,
  direction,
  exit,
  enter,
  active,
  offsetX,
  offsetY = 0,
  onItemReady,
  onItemGone,
}: ScrubStageProps) {
  const dragYaw = useRef(0);
  const quiet = leavingIndex === null;

  // Working set: what is on stage, what is being prepared, and the neighbours of the product the
  // stage last RESTED on (so loading never lands in the middle of a change).
  const mounted = useMemo(
    () =>
      new Set(
        [anchorIndex - 1, anchorIndex, anchorIndex + 1, activeIndex, leavingIndex ?? -1, preparingIndex ?? -1].filter(
          (i) => i >= 0 && i < models.length,
        ),
      ),
    [anchorIndex, activeIndex, leavingIndex, preparingIndex, models.length],
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
              // The leaving product is still the active one until the next starts arriving: leaving wins.
              role={i === leavingIndex ? "leaving" : i === activeIndex ? "active" : "idle"}
              direction={direction}
              exit={exit}
              enter={enter}
              quiet={quiet}
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
