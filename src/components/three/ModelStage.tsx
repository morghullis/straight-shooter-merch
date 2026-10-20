"use client";

import { ContactShadows, Float, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { normalizeModel } from "./normalize";
import { Studio } from "./Studio";

export interface ModelStageProps {
  src: string;
  fit: number;
  rotation: [number, number, number];
  /** Run frames continuously (visible) or stop rendering (off-screen). */
  active: boolean;
  /** Auto-spin and floating. Off when animations are off. */
  animate: boolean;
  onReady?: () => void;
}

/** One model, fitted and centred, with a short entrance. Drag to orbit. */
function Model({ src, fit, rotation, animate, onReady }: Omit<ModelStageProps, "active">) {
  const { scene } = useGLTF(src);
  const group = useRef<THREE.Group>(null);
  const progress = useRef(animate ? 0 : 1);

  const { object, scale, offset } = useMemo(() => normalizeModel(scene, fit), [scene, fit]);

  useEffect(() => {
    onReady?.();
  }, [object, onReady]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + dt * 1.8);
    const eased = 1 - Math.pow(1 - progress.current, 3);
    g.scale.setScalar(0.6 + 0.4 * eased);
    g.rotation.y = (1 - eased) * -1.4;
  });

  return (
    <group ref={group}>
      <Float speed={animate ? 1.6 : 0} rotationIntensity={animate ? 0.18 : 0} floatIntensity={animate ? 0.5 : 0}>
        <group rotation={rotation} position={offset}>
          <primitive object={object} scale={scale} />
        </group>
      </Float>
    </group>
  );
}

export default function ModelStage({ src, fit, rotation, active, animate, onReady }: ModelStageProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.35, 5.6], fov: 30 }}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Studio />

      <Suspense fallback={null}>
        <Model key={src} src={src} fit={fit} rotation={rotation} animate={animate} onReady={onReady} />
      </Suspense>

      <ContactShadows position={[0, -1.7, 0]} opacity={0.6} scale={9} blur={2.8} far={3.6} />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={animate}
        autoRotateSpeed={1.8}
        minPolarAngle={Math.PI / 2.7}
        maxPolarAngle={Math.PI / 1.85}
        makeDefault
      />
    </Canvas>
  );
}
