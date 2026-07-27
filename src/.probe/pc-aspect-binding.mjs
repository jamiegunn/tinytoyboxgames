// WHICH aspect is pinning the staging, and what does it cost the others?
//
// `pc-beam-headroom.mjs` showed the props stand at 75-96% of the widest |x|
// available to them, so the centreline huddle is not a placement mistake. At the
// near stations the binding rule is IN FRAME, not ON DECK: at z -5 the deck
// allows |x| 4.32 and the frame allows 0.96. So the deck is not too narrow --
// the FRAME is, and only on some aspects.
//
// The staging solve required every prop in frame at ALL NINE aspects, which
// means the layout is the INTERSECTION of nine framings. This measures what each
// aspect would allow on its own, so the cost of that intersection is a number.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-aspect-binding',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
   export { hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
   export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';`,
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
const camFor = (aspect) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};
const materials = M.createPirateCoveMaterials();
const s = new Scene();
const barrel = M.createBarrel(s, { position: new Vector3(0, 0, 0), rotY: 0, scale: 1 }, { materials });
barrel.updateMatrixWorld(true);
const bb = new Box3().setFromObject(barrel);
const hx = (bb.max.x - bb.min.x) / 2,
  hz = (bb.max.z - bb.min.z) / 2;

const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
const fits = (cam, x, z) => {
  const box = new Box3(new Vector3(x - hx, bb.min.y, z - hz), new Vector3(x + hx, bb.max.y, z + hz));
  for (const cx of [box.min.x, box.max.x])
    for (const cy of [box.min.y, box.max.y])
      for (const cz of [box.min.z, box.max.z]) {
        const p = new Vector3(cx, cy, cz);
        if (!inFront(cam, p)) return false;
        p.project(cam);
        if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1) return false;
      }
  return true;
};
const limitFor = (cam, z) => {
  if (!fits(cam, 0, z)) return 0;
  let lo = 0,
    hi = 8;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(cam, mid, z)) lo = mid;
    else hi = mid;
  }
  return lo;
};

const STATIONS = [-5, -3, -1, 1, 3, 5];
console.log('Widest |x| each aspect ALONE would allow a barrel, by station:\n');
console.log('aspect                  ' + STATIONS.map((z) => `z=${String(z).padStart(3)}`).join('   '));
const per = {};
for (const [label, aspect] of ASPECTS) {
  const cam = camFor(aspect);
  per[label] = STATIONS.map((z) => limitFor(cam, z));
  console.log(label.padEnd(24) + per[label].map((v) => v.toFixed(2).padStart(5)).join('   '));
}
const intersection = STATIONS.map((_, i) => Math.min(...ASPECTS.map(([l]) => per[l][i])));
console.log('\n' + 'ALL NINE (what ships)'.padEnd(24) + intersection.map((v) => v.toFixed(2).padStart(5)).join('   '));

console.log('\nWho binds each station, and by how much:\n');
console.log('station   binding aspect            allows   next-worst allows   landscape allows   landscape gives up');
STATIONS.forEach((z, i) => {
  const sorted = ASPECTS.map(([l]) => ({ l, v: per[l][i] })).sort((a, b) => a.v - b.v);
  const land = per['landscape 1280x720'][i];
  console.log(
    `${String(z).padStart(6)}   ${sorted[0].l.padEnd(24)} ${sorted[0].v.toFixed(2).padStart(6)}   ${sorted[1].v.toFixed(2).padStart(17)}   ${land.toFixed(2).padStart(16)}   ${(land - sorted[0].v).toFixed(2).padStart(16)} units per side`,
  );
});

const bindCount = {};
STATIONS.forEach((z, i) => {
  const sorted = ASPECTS.map(([l]) => ({ l, v: per[l][i] })).sort((a, b) => a.v - b.v);
  bindCount[sorted[0].l] = (bindCount[sorted[0].l] ?? 0) + 1;
});
console.log('\nstations bound by each aspect: ' + JSON.stringify(bindCount));

const landTot = STATIONS.reduce((a, _, i) => a + per['landscape 1280x720'][i], 0);
const intTot = intersection.reduce((a, b) => a + b, 0);
console.log(`\nSummed across these stations, landscape could use ${landTot.toFixed(2)} of half-width per side;`);
console.log(
  `the all-nine intersection uses ${intTot.toFixed(2)}. Landscape surrenders ${(((landTot - intTot) / landTot) * 100).toFixed(0)}% of its own usable width`,
);
console.log('so that one 360x900 phone can see the same props without panning.');
