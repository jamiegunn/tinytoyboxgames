/**
 * For every outboard store, at every shipping aspect: is it WHOLLY in frame,
 * WHOLLY out of frame, or STRADDLING an edge?
 *
 * Straddling is the only bad answer. A prop wholly out of frame is deck the
 * device never shows; a prop wholly in frame is furniture. A prop sliced by the
 * screen edge is a clipped prop, and that is worse than absent.
 */
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-store-clip',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { OUTBOARD_STORE_BARREL_STAGING, OUTBOARD_STORE_ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/outboardStores';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
  export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
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
const build = (name, make, p) => {
  const root = make(new Scene(), p, opts);
  root.updateMatrixWorld(true);
  const b = new Box3().setFromObject(root);
  return { name, pos: p.position.clone(), hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2, yMin: b.min.y, yMax: b.max.y };
};
const STORES = [
  ...M.OUTBOARD_STORE_BARREL_STAGING.map((p, i) => build(`storeBarrel${i}`, M.createBarrel, p)),
  ...M.OUTBOARD_STORE_ROPE_COIL_STAGING.map((p, i) => build(`storeRope${i}`, M.createRopeCoil, p)),
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
const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
const status = (cam, p) => {
  let inN = 0,
    tot = 0,
    worstX = 0,
    worstY = 0;
  for (const x of [p.pos.x - p.hx, p.pos.x + p.hx])
    for (const y of [p.yMin, p.yMax])
      for (const z of [p.pos.z - p.hz, p.pos.z + p.hz]) {
        tot++;
        const v = new Vector3(x, y, z);
        if (!inFront(cam, v)) continue; // astern: counts as out
        v.project(cam);
        worstX = Math.max(worstX, Math.abs(v.x));
        worstY = Math.max(worstY, Math.abs(v.y));
        if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) inN++;
      }
  return { s: inN === tot ? 'IN' : inN === 0 ? 'out' : 'CLIP', inN, tot, worstX, worstY };
};

console.log('==== STORE FRAMING STATUS  (IN = wholly in frame, out = wholly outside, CLIP = sliced by an edge)\n');
const hdr = 'aspect'.padEnd(24) + STORES.map((s) => s.name.padStart(13)).join('');
console.log(hdr);
for (const [label, a] of ASPECTS) {
  const cam = cameraFor(a);
  console.log(
    label.padEnd(24) +
      STORES.map((p) => {
        const r = status(cam, p);
        return (r.s === 'CLIP' ? `CLIP ${r.inN}/${r.tot}` : r.s).padStart(13);
      }).join(''),
  );
}

console.log('\n==== WORST |ndc.x| PER STORE (how far past the edge, 1.0 = exactly the edge)\n');
console.log(hdr);
for (const [label, a] of ASPECTS) {
  const cam = cameraFor(a);
  console.log(label.padEnd(24) + STORES.map((p) => status(cam, p).worstX.toFixed(3).padStart(13)).join(''));
}
