import * as THREE from "three";

const NORMAL_STRENGTH = 0.45;
/** Clamped by the GPU to what it supports. */
const ANISOTROPY = 16;

/**
 * Prepares a loaded glTF scene for the stage: clones it, tunes its materials (no metalness, softer
 * normal map, anisotropic filtering), then returns the scale and offset that fit its longest side to
 * `fit` and centre it on the origin. The models ship with their own smooth normals.
 */
export function normalizeModel(scene: THREE.Object3D, fit: number) {
  const clone = scene.clone(true);

  clone.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    // Cloth, plastic and ceramic are not metal. The generated metalness map has stray bright texels
    // that sparkle under the studio lights, so the roughness map stays and metalness is switched off.
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) continue;
      if (standard.metalness !== 0) {
        standard.metalness = 0;
        standard.metalnessMap = null;
      }
      // The generated normal map is detailed but noisy; at full strength it glitters under hard lights.
      standard.normalScale.setScalar(NORMAL_STRENGTH);
      // Anisotropic filtering keeps the texture crisp on surfaces seen at a grazing angle (a cap's
      // brim); without it the mipmaps smear the tiny embroidery islands of the atlas into white flecks.
      for (const texture of [standard.map, standard.normalMap, standard.roughnessMap]) {
        if (texture) texture.anisotropy = ANISOTROPY;
      }
      standard.needsUpdate = true;
    }
  });

  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = fit / Math.max(size.x, size.y, size.z);

  return { object: clone, scale, offset: center.multiplyScalar(-scale) };
}
