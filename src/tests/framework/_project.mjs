/**
 * Screen-space helpers shared by the Pirate Cove framing probes and tests.
 *
 * WHY PIXELS AND NOT NDC
 * ----------------------
 * NDC hides the thing these measurements are about. A `PerspectiveCamera` holds
 * its VERTICAL fov fixed and varies the horizontal one with aspect, so `ndc.x`
 * scales as `1 / aspect` while a canvas of fixed HEIGHT is `aspect * H` wide.
 * The two cancel exactly: measured worst per-vertex deviation between aspect
 * 0.400 and 1.778 is 2.27e-13 px. Nothing in the frame moves or resizes when the
 * viewport changes shape — only the left and right edges move.
 *
 * That is worth stating as an invariant rather than a convenience, because it
 * means "how does this prop survive narrow screens" is a question about ONE
 * scalar (where the frame edge falls), not about a re-projection per device.
 */

import { Vector3 } from 'three';
import { convexHull2D } from './_footprint.mjs';

/** Canvas height every projection is measured against. Width is `aspect * H`. */
export const CANVAS_H = 1000;

/**
 * Projects an object's world vertices to pixels on a `CANVAS_H`-tall canvas.
 *
 * The eye stands ON the deck, so vertices astern of it project to garbage — NDC
 * is negated and unbounded behind the camera. If any vertex is behind the eye the
 * silhouette is not measurable and this returns null rather than a wrong number.
 *
 * @returns `{ hull, halfW, halfH }` in pixels, or null.
 */
export function projectedHull(cam, verts, aspect) {
  const pts = [];
  const v = new Vector3();
  for (const w of verts) {
    v.copy(w);
    if (-v.clone().applyMatrix4(cam.matrixWorldInverse).z <= 0) return null;
    v.project(cam);
    pts.push([(v.x * aspect * CANVAS_H) / 2, (v.y * CANVAS_H) / 2]);
  }
  if (pts.length < 3) return null;
  return { hull: convexHull2D(pts), halfW: (aspect * CANVAS_H) / 2, halfH: CANVAS_H / 2 };
}

/** Sutherland–Hodgman clip of a convex polygon against `keep(p) >= 0`. */
export function clipBy(poly, keep) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = keep(a);
    const db = keep(b);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Clips a polygon to the frame rectangle. */
export function clipRect(poly, halfW, halfH) {
  let p = poly;
  p = clipBy(p, (q) => halfW - q[0]);
  p = clipBy(p, (q) => q[0] + halfW);
  p = clipBy(p, (q) => halfH - q[1]);
  p = clipBy(p, (q) => q[1] + halfH);
  return p;
}

/** Shoelace area of a polygon, always non-negative. */
export function area(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

/**
 * How much of the frame this object paints, as a fraction of the frame's area.
 *
 * This is a SILHOUETTE measure: it ignores occlusion, so it is an upper bound on
 * what the renderer draws. `.probe/render/diff.mjs` measures the real thing by
 * rendering the frame twice; the two agree in ordering and in where the object
 * disappears, which is all these assertions rest on.
 */
export function frameFraction(cam, verts, aspect) {
  const pj = projectedHull(cam, verts, aspect);
  if (!pj) return 0;
  const vis = area(clipRect(pj.hull, pj.halfW, pj.halfH));
  return vis / (2 * pj.halfW * (2 * pj.halfH));
}

/**
 * How many pixels of a `CANVAS_H`-tall canvas this object paints, in absolute
 * terms rather than as a share of the frame.
 *
 * This, not the fraction, is the quantity that answers "does a narrower screen
 * show LESS of it". Because pixel geometry is aspect-invariant, narrowing the
 * viewport only sweeps the left and right edges inward, so painted pixels can
 * only fall. The FRACTION can rise while the object is disappearing — the frame
 * is shrinking too — and it does: the stowage paints 5.64% of a landscape frame
 * and 7.42% of a tablet one while losing pixels between them.
 */
export function visiblePixels(cam, verts, aspect) {
  const pj = projectedHull(cam, verts, aspect);
  if (!pj) return 0;
  return area(clipRect(pj.hull, pj.halfW, pj.halfH));
}
