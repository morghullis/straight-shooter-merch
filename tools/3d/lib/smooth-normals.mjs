// Smooth vertex normals from the faces of a (simplified) mesh. Meshy's dense meshes carry fine
// dimples in their normals; once the mesh is simplified, one of those tilted normals can end up
// shading a whole triangle, which shows as a light or dark fleck. Recomputing them from the
// simplified faces removes the flecks. Vertices at the same position (texture seams) share their
// normal, so seams do not show, while faces meeting at more than CREASE_DEG keep a hard edge.
const CREASE_DEG = 60;

/** A glTF-Transform transform: `await doc.transform(smoothNormals())`. */
export function smoothNormals({ creaseDeg = CREASE_DEG } = {}) {
  const cosLimit = Math.cos((creaseDeg * Math.PI) / 180);
  return (doc) => {
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const posAttr = prim.getAttribute("POSITION"), nrmAttr = prim.getAttribute("NORMAL"), indices = prim.getIndices();
        if (!posAttr || !nrmAttr || !indices) continue;
        const pos = posAttr.getArray(), idx = indices.getArray(), nv = pos.length / 3;
        // Face normals (area-weighted, i.e. not normalised) and, per vertex, the faces using it.
        const fn = new Float64Array(idx.length);
        const own = Array.from({ length: nv }, () => []);
        for (let t = 0; t < idx.length; t += 3) {
          const a = idx[t], b = idx[t + 1], c = idx[t + 2];
          const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
          const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
          fn[t] = uy * vz - uz * vy; fn[t + 1] = uz * vx - ux * vz; fn[t + 2] = ux * vy - uy * vx;
          own[a].push(t); own[b].push(t); own[c].push(t);
        }
        // Vertices sharing a position.
        const groups = new Map();
        for (let v = 0; v < nv; v++) {
          const k = `${pos[v * 3]},${pos[v * 3 + 1]},${pos[v * 3 + 2]}`;
          (groups.get(k) ?? groups.set(k, []).get(k)).push(v);
        }
        const out = new Float32Array(nv * 3);
        const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
        for (const vs of groups.values()) {
          const faces = [...new Set(vs.flatMap((v) => own[v]))];
          for (const v of vs) {
            // Reference: the faces of this very vertex; then every face at this position within the crease angle.
            let rx = 0, ry = 0, rz = 0;
            for (const t of own[v]) { rx += fn[t]; ry += fn[t + 1]; rz += fn[t + 2]; }
            const ref = unit(rx, ry, rz);
            let sx = 0, sy = 0, sz = 0;
            for (const t of faces) {
              const f = unit(fn[t], fn[t + 1], fn[t + 2]);
              if (f[0] * ref[0] + f[1] * ref[1] + f[2] * ref[2] < cosLimit) continue;
              sx += fn[t]; sy += fn[t + 1]; sz += fn[t + 2];
            }
            const n = sx || sy || sz ? unit(sx, sy, sz) : ref;
            out[v * 3] = n[0]; out[v * 3 + 1] = n[1]; out[v * 3 + 2] = n[2];
          }
        }
        // A fresh accessor: the old one may be shared with other primitives.
        nrmAttr.setArray(out);
      }
    }
  };
}
