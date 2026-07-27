/**
 * Evaluate the rail stowage against everything that killed the discrete draft,
 * using TRUE convex-hull footprints off the real meshes (see
 * `tests/framework/_footprint.mjs` for why axis-aligned boxes lie about a chord).
 */
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { convexHull2D, hullBounds, hullsOverlap, minAreaRect, pointInHull, worldFootprintPoints } from '../tests/framework/_footprint.mjs';

const M = await bundleEntry(
  'pc-stowage-eval',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { HULL_Z_AFT, HULL_Z_FWD, hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
  export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
  export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
  export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
  export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
  export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
  export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
  export { RAIL_STOWAGE_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/railStowage';
  export { createRailStowage } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/railStowage/create';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
  export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
  export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
  export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
  export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
  export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';
`,
);
const { hullHalfWidthAt, HULL_Z_AFT, HULL_Z_FWD } = M;
const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 768 / 1024],
  ['viewport 480x854', 480 / 854],
  ['iPhone SE 375x667', 375 / 667],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
];
const materials = M.createPirateCoveMaterials();
const opts = { materials };
const mk = (name, kind, root) => {
  root.updateMatrixWorld(true);
  const { pts, yMin, yMax } = worldFootprintPoints(root);
  const hull = convexHull2D(pts);
  return { name, kind, hull, yMin, yMax, b: hullBounds(hull), rect: minAreaRect(hull) };
};
const B = {
  anchor: (p) => M.createAnchor(new Scene(), p, opts),
  barrel: (p) => M.createBarrel(new Scene(), p, opts),
  ropeCoil: (p) => M.createRopeCoil(new Scene(), p, opts),
  cannon: (p) => M.createCannon(new Scene(), p, opts).root,
  shipWheel: (p) => M.createShipWheel(new Scene(), p, opts).root,
  treasureChest: (p) => M.createTreasureChest(new Scene(), p, opts).root,
};
const g = (kind, st, pre) => st.map((p, i) => mk(`${pre ?? kind}${st.length > 1 ? i : ''}`, kind, B[kind](p)));
const EXISTING = [
  ...g('anchor', M.ANCHOR_STAGING),
  ...g('barrel', M.BARREL_STAGING),
  ...g('ropeCoil', M.ROPE_COIL_STAGING),
  ...g('cannon', M.CANNON_STAGING),
  ...g('shipWheel', M.SHIP_WHEEL_STAGING),
  ...g('treasureChest', M.TREASURE_CHEST_STAGING),
];
const STOW = M.RAIL_STOWAGE_STAGING.map((run, i) => mk(`stowage${i}`, 'railStowage', M.createRailStowage(new Scene(), run, { materials })));

console.log("==== 1. ELONGATION, on the object's own axis (min-area rectangle)\n");
for (const p of [...STOW, ...EXISTING])
  console.log(`  ${p.name.padEnd(15)} ${p.rect.length.toFixed(2)} x ${p.rect.width.toFixed(2)}   ${(p.rect.length / p.rect.width).toFixed(1)} : 1`);

console.log('\n==== 2. ON DECK AND CLEAR, against the real footprint\n');
let feas = true;
for (const p of STOW) {
  let worst = -Infinity,
    worstZ = 0;
  for (const [x, z] of p.hull) {
    const hw = hullHalfWidthAt(z);
    const over = hw === null ? Infinity : Math.abs(x) - hw;
    if (over > worst) {
      worst = over;
      worstZ = z;
    }
  }
  const clash = EXISTING.filter((q) => hullsOverlap(p.hull, q.hull)).map((q) => q.name);
  const onEnds = p.b.zMin >= HULL_Z_AFT && p.b.zMax <= HULL_Z_FWD;
  const okp = worst <= 0 && onEnds && !clash.length;
  if (!okp) feas = false;
  console.log(
    `  ${p.name}  worst overhang ${worst.toFixed(3)} (at z ${worstZ.toFixed(2)})  z ${p.b.zMin.toFixed(2)}..${p.b.zMax.toFixed(2)}  clash ${clash.join(',') || 'none'}  ${okp ? 'ok' : 'FAIL'}`,
  );
}
const envelope = Math.max(...EXISTING.map((q) => Math.max(Math.abs(q.b.xMin), Math.abs(q.b.xMax))));
console.log(
  `  existing furniture envelope |x| = ${envelope.toFixed(2)}; stowage inboard edge |x| = ${Math.min(...STOW.map((p) => Math.min(...p.hull.map(([x]) => Math.abs(x))))).toFixed(2)}`,
);
console.log(`  feasibility: ${feas ? 'PASS' : 'FAIL'}`);

const cameraFor = (a) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', a);
  const c = new PerspectiveCamera(M.SCENE_CAMERA_FOV, a, 0.1, 100);
  c.position.copy(pose.position);
  c.lookAt(pose.target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
const GRID = 260;
const occupancy = (cam, props) => {
  let deck = 0,
    cov = 0;
  const cP = new Array(GRID).fill(false),
    cD = new Array(GRID).fill(false);
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      const q = new Vector3(-1 + ((i + 0.5) / GRID) * 2, -1 + ((j + 0.5) / GRID) * 2, 0.5).unproject(cam);
      const d = q.sub(cam.position);
      if (d.y >= -1e-9) continue;
      const t = -cam.position.y / d.y;
      if (t <= 0) continue;
      const h = new Vector3().copy(cam.position).addScaledVector(d, t);
      const hw = hullHalfWidthAt(h.z);
      if (hw === null || Math.abs(h.x) > hw) continue;
      deck++;
      cD[i] = true;
      for (const p of props)
        if (h.x >= p.b.xMin && h.x <= p.b.xMax && h.z >= p.b.zMin && h.z <= p.b.zMax && pointInHull(p.hull, h.x, h.z)) {
          cov++;
          cP[i] = true;
          break;
        }
    }
  let run = 0,
    worst = 0;
  for (let i = 0; i < GRID; i++) {
    if (cD[i] && !cP[i]) {
      run++;
      worst = Math.max(worst, run);
    } else run = 0;
  }
  return { covered: deck ? cov / deck : 0, band: worst / GRID };
};
console.log('\n==== 3. THE GAIN: deck coverage and widest bare column of planking\n');
console.log('aspect'.padEnd(24) + 'covered'.padStart(17) + 'bare band'.padStart(20));
for (const [label, a] of ASPECTS) {
  const cam = cameraFor(a);
  const b = occupancy(cam, EXISTING),
    af = occupancy(cam, [...EXISTING, ...STOW]);
  console.log(
    label.padEnd(24) +
      `${(b.covered * 100).toFixed(1)}% -> ${(af.covered * 100).toFixed(1)}%`.padStart(17) +
      `${(b.band * 100).toFixed(1)}% -> ${(af.band * 100).toFixed(1)}%`.padStart(20),
  );
}

const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
const legibility = (cam, p) => {
  let lo = [Infinity, Infinity],
    hi = [-Infinity, -Infinity],
    any = false;
  for (const [x, z] of p.hull)
    for (const y of [p.yMin, p.yMax]) {
      const c = new Vector3(x, y, z);
      if (!inFront(cam, c)) continue;
      c.project(cam);
      any = true;
      lo = [Math.min(lo[0], c.x), Math.min(lo[1], c.y)];
      hi = [Math.max(hi[0], c.x), Math.max(hi[1], c.y)];
    }
  if (!any) return 0;
  const tot = (hi[0] - lo[0]) * (hi[1] - lo[1]);
  if (tot <= 0) return 0;
  const w = Math.max(0, Math.min(hi[0], 1) - Math.max(lo[0], -1)),
    h = Math.max(0, Math.min(hi[1], 1) - Math.max(lo[1], -1));
  return (w * h) / tot;
};
console.log('\n==== 4. WHAT A CUT LEAVES: visible fraction of each run\n');
console.log('aspect'.padEnd(24) + STOW.map((s) => s.name.padStart(12)).join(''));
for (const [label, a] of ASPECTS) {
  const cam = cameraFor(a);
  console.log(label.padEnd(24) + STOW.map((p) => `${(legibility(cam, p) * 100).toFixed(0)}%`.padStart(12)).join(''));
}

console.log('\n==== 5. VISIBLE RUN LENGTH when cut — does it still read as a run?\n');
console.log('  (world length of stowage still inside the frame, of 6.08 total)');
for (const [label, a] of ASPECTS) {
  const cam = cameraFor(a);
  const p = STOW[1];
  let lo = Infinity,
    hi = -Infinity;
  for (let t = 0; t <= 200; t++) {
    const f = t / 200,
      z = p.b.zMin + (p.b.zMax - p.b.zMin) * f;
    const x = p.hull.reduce((acc, q) => acc, 0);
    // walk the run centreline: interpolate between the two extreme hull points
    const zA = p.b.zMin,
      zB = p.b.zMax;
    const xA = p.hull.filter(([, zz]) => Math.abs(zz - zA) < 0.3).reduce((s, q, _, arr) => s + q[0] / arr.length, 0);
    const xB = p.hull.filter(([, zz]) => Math.abs(zz - zB) < 0.3).reduce((s, q, _, arr) => s + q[0] / arr.length, 0);
    const cx = xA + (xB - xA) * f;
    const v = new Vector3(cx, (p.yMin + p.yMax) / 2, z);
    if (!inFront(cam, v)) continue;
    v.project(cam);
    if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) {
      lo = Math.min(lo, f);
      hi = Math.max(hi, f);
    }
  }
  const vis = hi >= lo ? (hi - lo) * (p.b.zMax - p.b.zMin) : 0;
  console.log(`  ${label.padEnd(24)} ${vis.toFixed(2)} units visible`);
}
