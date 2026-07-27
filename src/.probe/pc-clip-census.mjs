/**
 * Does the SHIPPED scene already clip props at the frame edge?
 *
 * Round 4's test asserts "a prop half in frame is clipped, which is worse than
 * absent". Before I move any new prop to satisfy that rule, I have to know
 * whether the rule describes the scene that already ships, or whether I made it
 * up. If the existing furniture clips too, the rule is invented.
 *
 * Also sweeps aspect CONTINUOUSLY, because a browser window is not one of nine
 * values. If a prop is IN at some aspect and out at a narrower one, there is an
 * aspect between them where it CLIPS -- by the intermediate value theorem, not
 * by bad staging.
 */
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-clip-census',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
  export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
  export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
  export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
  export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
  export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
  export { OUTBOARD_STORE_BARREL_STAGING, OUTBOARD_STORE_ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/outboardStores';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
  export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
  export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
  export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
  export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
  export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';
`,
);

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
const B = {
  anchor: (s, p) => M.createAnchor(s, p, opts),
  barrel: (s, p) => M.createBarrel(s, p, opts),
  ropeCoil: (s, p) => M.createRopeCoil(s, p, opts),
  cannon: (s, p) => M.createCannon(s, p, opts).root,
  shipWheel: (s, p) => M.createShipWheel(s, p, opts).root,
  treasureChest: (s, p) => M.createTreasureChest(s, p, opts).root,
};
const build = (name, kind, p) => {
  const root = B[kind](new Scene(), p);
  root.updateMatrixWorld(true);
  const b = new Box3().setFromObject(root);
  return { name, kind, pos: p.position.clone(), hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2, yMin: b.min.y, yMax: b.max.y };
};
const g = (kind, st, pre) => st.map((p, i) => build(`${pre ?? kind}${st.length > 1 ? i : ''}`, kind, p));
const EXISTING = [
  ...g('anchor', M.ANCHOR_STAGING),
  ...g('barrel', M.BARREL_STAGING),
  ...g('ropeCoil', M.ROPE_COIL_STAGING),
  ...g('cannon', M.CANNON_STAGING),
  ...g('shipWheel', M.SHIP_WHEEL_STAGING),
  ...g('treasureChest', M.TREASURE_CHEST_STAGING),
];
const STORES = [...g('barrel', M.OUTBOARD_STORE_BARREL_STAGING, 'storeBarrel'), ...g('ropeCoil', M.OUTBOARD_STORE_ROPE_COIL_STAGING, 'storeRope')];

const cameraFor = (a) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', a);
  const c = new PerspectiveCamera(M.SCENE_CAMERA_FOV, a, 0.1, 100);
  c.position.copy(pose.position);
  c.lookAt(pose.target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
const corners = (p) => {
  const out = [];
  for (const x of [p.pos.x - p.hx, p.pos.x + p.hx])
    for (const y of [p.yMin, p.yMax]) for (const z of [p.pos.z - p.hz, p.pos.z + p.hz]) out.push(new Vector3(x, y, z));
  return out;
};
const status = (cam, p) => {
  let inN = 0;
  const cs = corners(p);
  for (const c of cs) {
    if (!inFront(cam, c)) continue;
    const v = c.clone().project(cam);
    if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) inN++;
  }
  return inN === cs.length ? 'IN' : inN === 0 ? 'out' : 'CLIP';
};

console.log('==== 1. DOES THE ALREADY-SHIPPED FURNITURE CLIP? (the 10 props that were here before round 4)\n');
console.log('aspect'.padEnd(24) + 'IN'.padStart(5) + 'CLIP'.padStart(6) + 'out'.padStart(5) + '   which ones clip');
for (const [label, a] of ASPECTS) {
  const cam = cameraFor(a);
  const by = { IN: [], CLIP: [], out: [] };
  for (const p of EXISTING) by[status(cam, p)].push(p.name);
  console.log(
    label.padEnd(24) +
      String(by.IN.length).padStart(5) +
      String(by.CLIP.length).padStart(6) +
      String(by.out.length).padStart(5) +
      '   ' +
      (by.CLIP.join(' ') || '-'),
  );
}

console.log('\n==== 2. CONTINUOUS ASPECT SWEEP: at how many aspects between 0.40 and 1.78 does SOMETHING clip?\n');
const N = 140;
let anyClip = 0,
  clipFreeAspects = [];
for (let i = 0; i <= N; i++) {
  const a = 0.4 + (1.7778 - 0.4) * (i / N);
  const cam = cameraFor(a);
  const c = [...EXISTING, ...STORES].filter((p) => status(cam, p) === 'CLIP').length;
  if (c > 0) anyClip++;
  else clipFreeAspects.push(a.toFixed(3));
}
console.log(`  aspects sampled: ${N + 1}`);
console.log(`  aspects where at least one prop is sliced by an edge: ${anyClip}  (${((anyClip / (N + 1)) * 100).toFixed(1)}%)`);
console.log(`  aspects where NOTHING clips: ${clipFreeAspects.length}${clipFreeAspects.length ? '  -> ' + clipFreeAspects.slice(0, 12).join(' ') : ''}`);

console.log('\n==== 3. SAME SWEEP, EXISTING FURNITURE ONLY (was the pre-round-4 scene clip-free?)\n');
let e = 0;
const eFree = [];
for (let i = 0; i <= N; i++) {
  const a = 0.4 + (1.7778 - 0.4) * (i / N);
  const cam = cameraFor(a);
  const c = EXISTING.filter((p) => status(cam, p) === 'CLIP').length;
  if (c > 0) e++;
  else eFree.push(a.toFixed(3));
}
console.log(`  aspects where at least one SHIPPED prop is sliced: ${e}  (${((e / (N + 1)) * 100).toFixed(1)}%)`);
console.log(`  aspects where nothing shipped clips: ${eFree.length}`);

console.log('\n==== 4. HOW BIG IS THE SLIVER? screen area of each store, % of frame, at the aspects where it clips\n');
const GRID = 200;
const frameFrac = (cam, p) => {
  // fraction of the frame covered by this prop's projected box
  let lo = [Infinity, Infinity],
    hi = [-Infinity, -Infinity],
    any = false;
  for (const c of corners(p)) {
    if (!inFront(cam, c)) continue;
    const v = c.clone().project(cam);
    any = true;
    lo = [Math.min(lo[0], v.x), Math.min(lo[1], v.y)];
    hi = [Math.max(hi[0], v.x), Math.max(hi[1], v.y)];
  }
  if (!any) return 0;
  const w = Math.max(0, Math.min(hi[0], 1) - Math.max(lo[0], -1));
  const h = Math.max(0, Math.min(hi[1], 1) - Math.max(lo[1], -1));
  return (w * h) / 4;
};
console.log('aspect'.padEnd(24) + STORES.map((s) => s.name.slice(-11).padStart(13)).join(''));
for (const [label, a] of ASPECTS) {
  const cam = cameraFor(a);
  console.log(
    label.padEnd(24) +
      STORES.map((p) => {
        const st = status(cam, p);
        const f = frameFrac(cam, p) * 100;
        return (st === 'out' ? '-' : `${st === 'CLIP' ? '~' : ''}${f.toFixed(2)}%`).padStart(13);
      }).join(''),
  );
}
