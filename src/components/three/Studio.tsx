"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Procedural studio lighting shared by every 3D stage. The reflections come from
 * light panels built in code, so nothing is downloaded and nothing needs a licence.
 */
export function Studio() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} />
      <directionalLight position={[-4, 2, -3]} intensity={1.5} color="#ffcf86" />
      <directionalLight position={[4, 1.5, -4]} intensity={1.6} color="#ffffff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3.2} position={[0, 5, -3]} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={2.2} position={[-5, 1, 2]} rotation={[0, Math.PI / 2.4, 0]} scale={[6, 4, 1]} color="#ffd9a0" />
        <Lightformer form="rect" intensity={1.8} position={[5, 1, 2]} rotation={[0, -Math.PI / 2.4, 0]} scale={[6, 4, 1]} color="#ffffff" />
        <Lightformer form="ring" intensity={1.4} position={[0, -2, 4]} scale={4} color="#f0ac28" />
      </Environment>
    </>
  );
}
