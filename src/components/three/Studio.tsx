"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Procedural studio lighting shared by every 3D stage, set like a product photo studio: one large
 * soft box in front, a softer fill on the other side, a strip above and behind for the outline, all
 * neutral white. Big, soft, mostly reflected light keeps the cloth matte and even; small hard lights
 * would draw a bright line on every fold and lump. Built in code: nothing is downloaded or licensed.
 */
export function Studio() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[2.5, 4, 5]} intensity={0.9} />
      <directionalLight position={[-3, 3, -4]} intensity={0.7} />
      <Environment resolution={256} frames={1}>
        {/* Key: a large soft box, front left, above. */}
        <Lightformer form="rect" intensity={2.4} position={[-3.5, 2.5, 4]} scale={[7, 6, 1]} target={[0, 0, 0]} />
        {/* Fill: front right, weaker, so the shadow side keeps its detail. */}
        <Lightformer form="rect" intensity={1.1} position={[4, 1, 3.5]} scale={[6, 6, 1]} target={[0, 0, 0]} />
        {/* Strip above and behind: separates the outline from the dark backdrop. */}
        <Lightformer form="rect" intensity={1.6} position={[0, 4.5, -4]} scale={[10, 2.5, 1]} target={[0, 0, 0]} />
        {/* Floor bounce: lifts the hem and the underside a little. */}
        <Lightformer form="rect" intensity={0.5} position={[0, -4, 1]} scale={[10, 4, 1]} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}
