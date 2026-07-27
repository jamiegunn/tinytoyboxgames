/**
 * SOLVING THE STOWAGE RUN, INSTEAD OF AUTHORING IT AND HOPING.
 * ===========================================================
 *
 * `.probe/pc-stowage-sliver.mjs` scored the first staging of the rail stowage
 * against the two things this scene has already judged, and the fix lost:
 *
 *   mean spanFill   worst   below 90%      projected elongation   angle to edge
 *   ------------------------------------------------------------------------
 *   ACCEPTED  the ship's own side rails
 *     98.6%          98.1%    0.0%              27.5 : 1              66 deg
 *   THE FIX   spar stowage, z -6.5 .. -0.5, inset 0.5
 *     80.6%           3.4%   45.6%               5.5 : 1              42 deg
 *   FORBIDDEN a barrel at the run's own centroid
 *     49.7%           0.1%   12.6%                ~1 : 1               --
 *
 * The fix sits between its two controls. It is better than the barrel and it is
 * not the rail, so "it behaves like the rails, which nobody calls a defect" was
 * not yet true. I stated the rule in WORLD terms -- 6.05 x 0.84, 7.2 : 1 -- and
 * the property that actually protects the rails is on SCREEN: a silhouette five
 * times more elongated than mine, meeting the vertical frame edge 24 degrees
 * closer to square-on, so the edge shortens it instead of shaving along it.
 *
 * TWO FACTS THAT MAKE THIS SOLVABLE CHEAPLY
 * -----------------------------------------
 * 1. In PIXEL space the scene is aspect-invariant. A PerspectiveCamera holds
 *    vertical fov fixed, so ndc.x scales as 1/aspect while a canvas of fixed
 *    height is aspect * H wide -- the two cancel exactly. Changing aspect does
 *    not redraw anything; it only moves the left and right frame edges. Section
 *    0 asserts this rather than assuming it, and section 2 exploits it: every
 *    candidate is projected ONCE and swept against moving frame edges.
 * 2. So the whole continuous aspect sweep is a sweep of one scalar, the frame
 *    half-width, and a 601-point sweep over a 200-candidate grid is seconds.
 *
 * WHAT IS SOLVED FOR
 * ------------------
 * Hard constraints first, exactly as `shipWheel.ts` demands of every placement
 * in this scene: ON DECK (the true footprint hull inside the hull outline) and
 * CLEAR (no overlap with any existing furniture). Then, among survivors, the
 * screen-space behaviour: worst-case spanFill over the continuous aspect sweep,
 * because the worst case is what a real window lands on.
 */
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { convexHull2D, hullsOverlap, worldFootprintPoints } from '../tests/framework/_footprint.mjs';

const M = await bundleEntry(
  'pc-stowage-solve',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
  export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
  export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
  export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
  export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
  export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
  export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
  export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
  export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
  export { createRailStowage } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/railStowage/create';
  export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
  export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
  export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';
  export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell';
`,
);

const materials = M.createPirateCoveMaterials();
const opts = { materials };
const stowOpts = {
  materials: { weatheredWood: materials.weatheredWood, shellTrim: materials.shellTrim, rope: materials.rope },
};

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

const B = {
  anchor: (s, p) => M.createAnchor(s, p, opts),
  barrel: (s, p) => M.createBarrel(s, p, opts),
  ropeCoil: (s, p) => M.createRopeCoil(s, p, opts),
  cannon: (s, p) => M.createCannon(s, p, opts).root,
  shipWheel: (s, p) => M.createShipWheel(s, p, opts).root,
  treasureChest: (s, p) => M.createTreasureChest(s, p, opts).root,
};
const g = (kind, st) =>
  st.map((p) => {
    const root = B[kind](new Scene(), p);
    root.updateMatrixWorld(true);
    return convexHull2D(worldFootprintPoints(root).pts);
  });
const EXISTING_HULLS = [
  ...g('anchor', M.ANCHOR_STAGING),
  ...g('barrel', M.BARREL_STAGING),
  ...g('ropeCoil', M.ROPE_COIL_STAGING),
  ...g('cannon', M.CANNON_STAGING),
  ...g('shipWheel', M.SHIP_WHEEL_STAGING),
  ...g('treasureChest', M.TREASURE_CHEST_STAGING),
];

const cameraFor = (a) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', a);
  const c = new PerspectiveCamera(M.SCENE_CAMERA_FOV, a, 0.1, 100);
  c.position.copy(pose.position);
  c.lookAt(pose.target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
const CANVAS_H = 1000;
const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
/** Pixel-space projection on a canvas of fixed HEIGHT. Aspect-invariant -- asserted below. */
const pixels = (cam, verts, aspect) => {
  const halfW = (CANVAS_H * aspect) / 2;
  const pts = [];
  for (const v of verts) {
    if (!inFront(cam, v)) continue;
    const p = v.clone().project(cam);
    pts.push([p.x * halfW, (p.y * CANVAS_H) / 2]);
  }
  return pts;
};

console.log('==== 0. ASSERT: pixel-space geometry is aspect-invariant');
{
  const runProbe = { side: 1, zAft: -6.5, zFwd: -0.5, inset: 0.5 };
  const verts = worldVerts(M.createRailStowage(new Scene(), runProbe, stowOpts));
  const a1 = pixels(cameraFor(0.4), verts, 0.4);
  const a2 = pixels(cameraFor(1.7778), verts, 1.7778);
  let worst = 0;
  for (let i = 0; i < a1.length; i++) worst = Math.max(worst, Math.hypot(a1[i][0] - a2[i][0], a1[i][1] - a2[i][1]));
  console.log(`  worst per-vertex pixel deviation between aspect 0.400 and 1.778: ${worst.toExponential(2)} px`);
  console.log(`  ${worst < 1e-6 ? 'INVARIANT -- the sweep is a sweep of the frame edge alone.' : 'NOT INVARIANT -- the rest of this probe is unsound.'}\n`);
  if (!(worst < 1e-6)) process.exit(1);
}

const CAM = cameraFor(1.0);

const clipHalf = (poly, keep) => {
  if (poly.length < 3) return [];
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ka = keep(a);
    const kb = keep(b);
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
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
};
const longAxis = (hull) => {
  let best = { area: Infinity, ux: 1, uz: 0, elong: 1 };
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
    const ar = (u1 - u0) * (v1 - v0);
    if (ar >= best.area) continue;
    const du = u1 - u0;
    const dv = v1 - v0;
    best = du >= dv ? { area: ar, ux, uz, elong: du / Math.max(dv, 1e-9) } : { area: ar, ux: -uz, uz: ux, elong: dv / Math.max(du, 1e-9) };
  }
  return best;
};

const HALF_H = CANVAS_H / 2;
const N = 600;
const A0 = 0.4;
const A1 = 1.7778;

/** Sweep one pre-projected silhouette against every frame width. */
const sweep = (hull) => {
  const full = area(hull);
  if (full <= 0) return null;
  const ax = longAxis(hull);
  const along = (p) => p[0] * ax.ux + p[1] * ax.uz;
  const vClip = clipHalf(
    clipHalf(hull, (p) => p[1] + HALF_H),
    (p) => HALF_H - p[1],
  );
  let worst = 1;
  let sum = 0;
  let partial = 0;
  let below90 = 0;
  for (let i = 0; i <= N; i++) {
    const aspect = A0 + (A1 - A0) * (i / N);
    const halfW = (CANVAS_H * aspect) / 2;
    const vis = clipHalf(
      clipHalf(vClip, (p) => p[0] + halfW),
      (p) => halfW - p[0],
    );
    const va = area(vis);
    if (va <= 0) continue;
    if (va / full >= 0.999) continue;
    partial++;
    let u0 = Infinity;
    let u1 = -Infinity;
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
    sum += fill;
    if (fill < worst) worst = fill;
    if (fill < 0.9) below90++;
  }
  const angle = (Math.acos(Math.min(1, Math.abs(ax.uz))) * 180) / Math.PI;
  return {
    elong: ax.elong,
    angle,
    worst,
    mean: partial ? sum / partial : 1,
    below90: below90 / (N + 1),
    partial: partial / (N + 1),
  };
};

console.log('==== 1. THE TWO CONTROLS, measured the same way');
const shell = M.createSceneShell(new Scene(), { wallHeight: 2, materials });
shell.updateMatrixWorld(true);
let railHull = null;
shell.traverse((o) => {
  if (o.name === 'railing_top_starboard_side') {
    const v = new Vector3();
    const pts = [];
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
    railHull = convexHull2D(pixels(CAM, pts, 1.0));
  }
});
const railScore = sweep(railHull);
const show = (label, s) =>
  console.log(
    `  ${label.padEnd(38)} elong ${s.elong.toFixed(1).padStart(5)} : 1   angle ${s.angle.toFixed(0).padStart(3)} deg` +
      `   worst spanFill ${(s.worst * 100).toFixed(1).padStart(5)}%   mean ${(s.mean * 100).toFixed(1)}%   below90 ${(s.below90 * 100).toFixed(1)}%`,
  );
show("ACCEPTED: ship's own starboard rail", railScore);
{
  const c = { position: new Vector3(3.6, 0, -3.5), rotY: 0, scale: 1 };
  const bh = convexHull2D(pixels(CAM, worldVerts(B.barrel(new Scene(), c)), 1.0));
  show('FORBIDDEN: a barrel out at (3.6, -3.5)', sweep(bh));
}
show(
  'ROUND 4 DRAFT: z -6.5..-0.5, inset 0.50',
  (() => {
    const verts = worldVerts(M.createRailStowage(new Scene(), { side: 1, zAft: -6.5, zFwd: -0.5, inset: 0.5 }, stowOpts));
    return sweep(convexHull2D(pixels(CAM, verts, 1.0)));
  })(),
);

console.log('\n==== 2. SOLVE: every feasible run, scored on worst-case spanFill');
console.log('     ON DECK  every footprint vertex inside the hull outline');
console.log('     CLEAR    no overlap with any existing furniture footprint\n');

const onDeck = (hull) => {
  for (const [x, z] of hull) {
    const half = M.hullHalfWidthAt(z);
    if (half === null || Math.abs(x) > half - 0.05) return false;
  }
  return true;
};

const candidates = [];
for (let zAft = -9; zAft <= -1; zAft += 0.5) {
  for (let zFwd = zAft + 4; zFwd <= 9; zFwd += 0.5) {
    for (const inset of [0.45, 0.55, 0.7, 0.9]) {
      const run = { side: 1, zAft, zFwd, inset };
      const root = M.createRailStowage(new Scene(), run, stowOpts);
      root.updateMatrixWorld(true);
      const fp = worldFootprintPoints(root);
      if (!fp.pts.length) continue;
      const hull = convexHull2D(fp.pts);
      if (!onDeck(hull)) continue;
      if (EXISTING_HULLS.some((h) => hullsOverlap(hull, h))) continue;
      const s = sweep(convexHull2D(pixels(CAM, worldVerts(root), 1.0)));
      if (!s) continue;
      candidates.push({ run, ...s });
    }
  }
}
console.log(`  ${candidates.length} runs are ON DECK and CLEAR.\n`);
candidates.sort((a, b) => b.worst - a.worst || b.elong - a.elong);
console.log('  zAft   zFwd  inset   len   elong    angle   worst   mean   below90');
for (const c of candidates.slice(0, 14)) {
  console.log(
    `  ${c.run.zAft.toFixed(1).padStart(5)} ${c.run.zFwd.toFixed(1).padStart(6)} ${c.run.inset.toFixed(2).padStart(6)}` +
      `  ${(c.run.zFwd - c.run.zAft).toFixed(1).padStart(4)}  ${c.elong.toFixed(1).padStart(5)}:1  ${c.angle.toFixed(0).padStart(4)}deg` +
      `  ${(c.worst * 100).toFixed(1).padStart(6)}% ${(c.mean * 100).toFixed(1).padStart(6)}% ${(c.below90 * 100).toFixed(1).padStart(7)}%`,
  );
}

console.log('\n==== 3. HOW THE BEST RUN COMPARES WITH THE RAIL IT LIES BESIDE');
const best = candidates[0];
if (best) {
  show("ACCEPTED: ship's own starboard rail", railScore);
  show(`SOLVED:   z ${best.run.zAft} .. ${best.run.zFwd}, inset ${best.run.inset}`, best);
  console.log(`\n  worst-case gap to the accepted precedent: ${((railScore.worst - best.worst) * 100).toFixed(1)} points of spanFill`);
}
