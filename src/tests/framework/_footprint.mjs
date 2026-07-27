/**
 * Footprint helpers shared by the Pirate Cove composition probes and tests.
 *
 * WHY NOT AXIS-ALIGNED BOXES
 * --------------------------
 * Every earlier probe in this scene modelled a prop as an axis-aligned box
 * around its staging position. That is exact for a barrel and badly wrong for
 * anything lying on a slant: the rail stowage runs as a chord from (4.03, -6.5)
 * to (3.22, -0.5), so its true width across the run is 0.84 while its AABB is
 * 1.41 wide. Measured with boxes it "overhangs the rail" at a station where it
 * is not, and its elongation reads 4.3 : 1 instead of 7.2 : 1. Both numbers were
 * artefacts of the model, and both would have been believed.
 *
 * So footprints here are CONVEX HULLS of the object's real mesh vertices in
 * world space. Nothing is re-derived, nothing is guessed, and the same shape
 * answers "is it on deck", "does it clash", and "does this deck pixel stand
 * under furniture".
 */

import { Vector3 } from 'three';

/**
 * Every world-space vertex of every mesh under a root, plus its vertical extent.
 *
 * @param root - An Object3D whose world matrices are already updated.
 * @returns `{ pts: Array<[x, z]>, yMin, yMax }`.
 */
export function worldFootprintPoints(root) {
  const pts = [];
  let yMin = Infinity;
  let yMax = -Infinity;
  const v = new Vector3();
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      pts.push([v.x, v.z]);
      if (v.y < yMin) yMin = v.y;
      if (v.y > yMax) yMax = v.y;
    }
  });
  return { pts, yMin, yMax };
}

/** Andrew's monotone chain. Returns the hull counter-clockwise, no repeated endpoint. */
export function convexHull2D(points) {
  if (points.length < 3) return points.slice();
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (src) => {
    const out = [];
    for (const q of src) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half(p.slice().reverse())];
}

/** Is `(x, z)` inside a counter-clockwise convex hull? Boundary counts as inside. */
export function pointInHull(hull, x, z) {
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < -1e-9) return false;
  }
  return true;
}

/**
 * Minimum-area enclosing rectangle of a convex hull, by rotating calipers over
 * every edge direction.
 *
 * This is how elongation is measured: a chord run must be scored on its own axis,
 * not on the world axes it happens to lie across.
 *
 * @returns `{ length, width }` with `length >= width`.
 */
export function minAreaRect(hull) {
  let best = { length: Infinity, width: Infinity, area: Infinity };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const q of hull) {
      const u = q[0] * ux + q[1] * uz;
      const w = -q[0] * uz + q[1] * ux;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (w < v0) v0 = w;
      if (w > v1) v1 = w;
    }
    const du = u1 - u0;
    const dv = v1 - v0;
    const area = du * dv;
    if (area < best.area) best = { length: Math.max(du, dv), width: Math.min(du, dv), area };
  }
  return { length: best.length, width: best.width };
}

/** Bounding interval of a hull on the world x and z axes, for cheap rejection. */
export function hullBounds(hull) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const [x, z] of hull) {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  return { xMin, xMax, zMin, zMax };
}

/** Do two convex hulls overlap? Separating-axis test over both edge normals. */
export function hullsOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const nx = -(q[1] - p[1]);
      const nz = q[0] - p[0];
      let aMin = Infinity;
      let aMax = -Infinity;
      let bMin = Infinity;
      let bMax = -Infinity;
      for (const [x, z] of a) {
        const d = x * nx + z * nz;
        if (d < aMin) aMin = d;
        if (d > aMax) aMax = d;
      }
      for (const [x, z] of b) {
        const d = x * nx + z * nz;
        if (d < bMin) bMin = d;
        if (d > bMax) bMax = d;
      }
      if (aMax < bMin - 1e-9 || bMax < aMin - 1e-9) return false;
    }
  }
  return true;
}
