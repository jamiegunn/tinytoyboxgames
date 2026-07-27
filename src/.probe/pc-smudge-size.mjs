/**
 * HOW BIG IS THE SMUDGE, IN PIXELS?
 *
 * The sliver doctrine's own words were "a 4-pixel strip of brown hugging the
 * screen edge is a smudge". Every metric I have run since states harm as a RATIO
 * -- and a ratio cannot tell a strip of brown across a tenth of the frame from
 * one the size of a full stop. spanFill says my run is mutilated at its worst
 * aspect; it does not say whether anybody can see the mutilation.
 *
 * So: over the continuous sweep, for every aspect where an object is MUTILATED
 * (spanFill < 0.90), how large is the offending residue as a fraction of the
 * whole frame? That is the quantity the player experiences.
 *
 * Same three subjects as before: the accepted rail, the forbidden barrel, and
 * the stowage run.
 */
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { convexHull2D } from '../tests/framework/_footprint.mjs';
const M = await bundleEntry(
  'pc-smudge-size',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
  export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
  export { createRailStowage } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/railStowage/create';
  export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell';
`,
);
const materials = M.createPirateCoveMaterials();
const stowOpts = { materials: { weatheredWood: materials.weatheredWood, shellTrim: materials.shellTrim, rope: materials.rope } };
const worldVerts = (root) => {
  root.updateMatrixWorld(true);
  const out = [];
  const v = new Vector3();
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) out.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  return out;
};
const cameraFor = (a) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', a);
  const c = new PerspectiveCamera(M.SCENE_CAMERA_FOV, a, 0.1, 100);
  c.position.copy(pose.position);
  c.lookAt(pose.target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
const H = 1000,
  CAM = cameraFor(1.0);
const inFront = (p) => -p.clone().applyMatrix4(CAM.matrixWorldInverse).z > 0;
const pixels = (verts) => {
  const pts = [];
  for (const v of verts) {
    if (!inFront(v)) continue;
    const p = v.clone().project(CAM);
    pts.push([(p.x * H) / 2, (p.y * H) / 2]);
  }
  return pts;
};
const clipHalf = (poly, keep) => {
  if (poly.length < 3) return [];
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const ka = keep(a),
      kb = keep(b);
    if (ka >= 0) out.push(a);
    if (ka >= 0 !== kb >= 0) {
      const t = ka / (ka - kb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
};
const area = (poly) => {
  if (poly.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
};
const longAxis = (hull) => {
  let best = { area: Infinity, ux: 1, uz: 0 };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i],
      b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    const ux = (b[0] - a[0]) / len,
      uz = (b[1] - a[1]) / len;
    let u0 = Infinity,
      u1 = -Infinity,
      v0 = Infinity,
      v1 = -Infinity;
    for (const q of hull) {
      const u = q[0] * ux + q[1] * uz,
        w = -q[0] * uz + q[1] * ux;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (w < v0) v0 = w;
      if (w > v1) v1 = w;
    }
    const ar = (u1 - u0) * (v1 - v0);
    if (ar >= best.area) continue;
    best = u1 - u0 >= v1 - v0 ? { area: ar, ux, uz } : { area: ar, ux: -uz, uz: ux };
  }
  return best;
};
const N = 600,
  A0 = 0.4,
  A1 = 1.7778;
const report = (label, verts) => {
  const hull = convexHull2D(pixels(verts));
  const full = area(hull);
  const ax = longAxis(hull);
  const along = (p) => p[0] * ax.ux + p[1] * ax.uz;
  const vClip = clipHalf(
    clipHalf(hull, (p) => p[1] + H / 2),
    (p) => H / 2 - p[1],
  );
  let worstFrac = 0,
    atAspect = 0,
    worstFill = 1,
    worstPx = 0;
  for (let i = 0; i <= N; i++) {
    const aspect = A0 + (A1 - A0) * (i / N);
    const halfW = (H * aspect) / 2;
    const vis = clipHalf(
      clipHalf(vClip, (p) => p[0] + halfW),
      (p) => halfW - p[0],
    );
    const va = area(vis);
    if (va <= 0 || va / full >= 0.999) continue;
    let u0 = Infinity,
      u1 = -Infinity;
    for (const p of vis) {
      const u = along(p);
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
    }
    const span = clipHalf(
      clipHalf(hull, (p) => along(p) - u0),
      (p) => u1 - along(p),
    );
    const sa = area(span);
    const fill = sa > 1e-9 ? Math.min(1, va / sa) : 1;
    if (fill >= 0.9) continue;
    const frameArea = H * halfW * 2;
    const frac = va / frameArea;
    if (frac > worstFrac) {
      worstFrac = frac;
      atAspect = aspect;
      worstFill = fill;
      worstPx = va;
    }
  }
  console.log(
    `  ${label.padEnd(40)} worst MUTILATED residue ${(worstFrac * 100).toFixed(3).padStart(7)}% of frame` +
      `  (${Math.round(worstPx).toString().padStart(6)} px2, spanFill ${(worstFill * 100).toFixed(0).padStart(3)}%, at aspect ${atAspect.toFixed(3)})`,
  );
  return worstFrac;
};
console.log('==== The largest residue the player ever sees while it is MUTILATED (spanFill < 90%)\n');
const shell = M.createSceneShell(new Scene(), { wallHeight: 2, materials });
shell.updateMatrixWorld(true);
let railV = null;
shell.traverse((o) => {
  if (o.name === 'railing_top_starboard_side') {
    const v = new Vector3();
    const pts = [];
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
    railV = pts;
  }
});
const rail = report("ACCEPTED: ship's own starboard rail", railV);
const stow = report(
  'FIX: stowage z -6.5..-0.5 inset 0.50',
  worldVerts(M.createRailStowage(new Scene(), { side: 1, zAft: -6.5, zFwd: -0.5, inset: 0.5 }, stowOpts)),
);
const solved = report(
  'SOLVED: stowage z -7..1.5 inset 0.90',
  worldVerts(M.createRailStowage(new Scene(), { side: 1, zAft: -7, zFwd: 1.5, inset: 0.9 }, stowOpts)),
);
console.log('');
const bar = [];
for (const [x, z] of [
  [3.6, -3.5],
  [4.2, -5.0],
  [3.0, -1.0],
  [2.8, 1.0],
  [4.4, -6.0],
]) {
  bar.push(
    report(`FORBIDDEN: barrel at (${x}, ${z})`, worldVerts(M.createBarrel(new Scene(), { position: new Vector3(x, 0, z), rotY: 0, scale: 1 }, { materials }))),
  );
}
for (const [x, z] of [
  [3.4, -4.0],
  [4.0, -6.0],
]) {
  bar.push(
    report(
      `FORBIDDEN: rope coil at (${x}, ${z})`,
      worldVerts(M.createRopeCoil(new Scene(), { position: new Vector3(x, 0, z), rotY: 0, scale: 1 }, { materials })),
    ),
  );
}
console.log(`\n  accepted rail            ${(rail * 100).toFixed(3)}% of frame`);
console.log(`  stowage as staged        ${(stow * 100).toFixed(3)}%   = ${(stow / Math.max(rail, 1e-12)).toFixed(1)}x the rail`);
console.log(`  stowage solved           ${(solved * 100).toFixed(3)}%   = ${(solved / Math.max(rail, 1e-12)).toFixed(1)}x the rail`);
console.log(`  worst forbidden prop     ${(Math.max(...bar) * 100).toFixed(3)}%   = ${(Math.max(...bar) / Math.max(rail, 1e-12)).toFixed(1)}x the rail`);
