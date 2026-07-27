// WHY THE SPREAD FIX FAILED, AND WHAT THE REAL OPPORTUNITY IS.
//
// `pc-spread-sim.mjs` applied the proposed rule -- scale every prop's |x| by
// aspect/0.40, clamp to the deck -- and the headline number did not move:
// landscape deck coverage 4.0% -> 4.0%. In hindsight that is arithmetic, not bad
// luck. COVERAGE IS AREA, AND TRANSLATION PRESERVES AREA. Sliding a barrel from
// x=1 to x=2 does not cover one more square metre of planking. The spread also
// broke CLEAR (barrel3 slid into the cannon) and it moved props on real phones
// (aspect 0.45-0.46, scale 1.13-1.15), so its "identity on narrow screens" safety
// property held only at exactly 0.40, which no shipping device is.
//
// So the deficit is not that the props are in the wrong PLACE. It is that on a
// wide screen the frame reveals deck that NOTHING WAS EVER PUT ON. The wide
// viewport does not crop less; it uncovers more, and the uncovered part is bare.
//
// That reframing suggests an additive fix instead of a translational one, and it
// raises the question this probe answers: HOW MUCH outboard deck does each aspect
// reveal, and how much of it does the current furniture reach? Sized in screen
// pixels, because that is the only currency composition is paid in.
//
// It also tests the claim the additive fix rests on: that a prop standing at
// |x| = 3.5 is not "cropped" on a phone, because the phone's frame does not
// contain that part of the deck AT ALL. If that is true, adding furniture out
// there cannot make any narrow frame worse -- it is invisible, not clipped -- and
// the fix is non-regressive by construction rather than by testing.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-outboard-deck',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
   export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
   export { HULL_Z_AFT, HULL_Z_FWD, hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
   export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
   export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
   export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
   export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
   export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
   export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
   export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
   export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
   export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
   export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
   export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';`,
);
const { hullHalfWidthAt, HULL_Z_AFT, HULL_Z_FWD } = M;
const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 0.75],
  ['viewport 480x854', 480 / 854],
  ['iPhone SE 375x667', 375 / 667],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
];
const materials = M.createPirateCoveMaterials();
const o = { materials };
const B = {
  anchor: (s, p) => M.createAnchor(s, p, o),
  barrel: (s, p) => M.createBarrel(s, p, o),
  ropeCoil: (s, p) => M.createRopeCoil(s, p, o),
  cannon: (s, p) => M.createCannon(s, p, o).root,
  shipWheel: (s, p) => M.createShipWheel(s, p, o).root,
  treasureChest: (s, p) => M.createTreasureChest(s, p, o).root,
};
const PROPS = [];
const add = (k, st) =>
  st.forEach((pl, i) => {
    const r = B[k](new Scene(), pl);
    r.updateMatrixWorld(true);
    const b = new Box3().setFromObject(r);
    PROPS.push({ name: `${k}${st.length > 1 ? i : ''}`, kind: k, pos: pl.position.clone(), hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2 });
  });
add('anchor', M.ANCHOR_STAGING);
add('barrel', M.BARREL_STAGING);
add('ropeCoil', M.ROPE_COIL_STAGING);
add('cannon', M.CANNON_STAGING);
add('shipWheel', M.SHIP_WHEEL_STAGING);
add('treasureChest', M.TREASURE_CHEST_STAGING);

const cameraFor = (a) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', a);
  const c = new PerspectiveCamera(M.SCENE_CAMERA_FOV, a, 0.1, 100);
  c.position.copy(pose.position);
  c.lookAt(pose.target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
const N = 400;
const hitAt = (cam, i, j) => {
  const p = new Vector3(-1 + ((i + 0.5) / N) * 2, -1 + ((j + 0.5) / N) * 2, 0.5).unproject(cam);
  const d = p.sub(cam.position);
  if (d.y >= -1e-9) return null;
  const t = -cam.position.y / d.y;
  return t > 0 ? new Vector3().copy(cam.position).addScaledVector(d, t) : null;
};
const onDeck = (p) => p.z >= HULL_Z_AFT && p.z <= HULL_Z_FWD && Math.abs(p.x) <= hullHalfWidthAt(p.z);

// The current furniture envelope: the largest |x| any prop's footprint reaches.
const ENVELOPE = Math.max(...PROPS.map((p) => Math.abs(p.pos.x) + p.hx));
console.log(`==== the current furniture reaches |x| = ${ENVELOPE.toFixed(2)} on a hull of half-beam 5\n`);

console.log('==== 1. HOW MUCH OF EACH FRAME IS DECK THE FURNITURE NEVER REACHES\n');
console.log('aspect                   deck px%   of that, INBOARD   OUTBOARD (|x|>envelope)   outboard as % of FRAME');
const outboardPx = {};
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  let deck = 0,
    out = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const h = hitAt(cam, i, j);
      if (!h || !onDeck(h)) continue;
      deck++;
      if (Math.abs(h.x) > ENVELOPE) out++;
    }
  outboardPx[label] = out / (N * N);
  console.log(
    `${label.padEnd(24)} ${((deck / (N * N)) * 100).toFixed(1).padStart(7)}%   ${(((deck - out) / deck) * 100).toFixed(1).padStart(15)}%   ${((out / deck) * 100).toFixed(1).padStart(22)}%   ${((out / (N * N)) * 100).toFixed(1).padStart(20)}%`,
  );
}

console.log('\n\n==== 2. THE CLAIM THE ADDITIVE FIX RESTS ON\n');
console.log('For a prop standing at (x, z): is that deck spot inside the frame at all?\n');
const STATIONS = [-5, -3, -1, 1, 3];
const XS = [2.5, 3.0, 3.5, 4.0];
console.log('station   ' + XS.map((x) => `|x|=${x.toFixed(1)}`.padStart(9)).join('') + '     <- "vis" = how many of the nine aspects show that deck point');
for (const z of STATIONS) {
  const cells = XS.map((x) => {
    if (x > hullHalfWidthAt(z)) return '   offship';
    let n = 0;
    for (const [, a] of ASPECTS) {
      const cam = cameraFor(a);
      const v = new Vector3(x, 0, z).project(cam);
      if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) n++;
    }
    return `      ${n}/9`;
  });
  console.log(`z=${z.toString().padStart(3)}     ` + cells.join(''));
}

console.log('\n\n==== 3. WHERE IS THE OUTBOARD DECK, IN SCREEN PIXELS, ON THE WIDE SCREENS\n');
console.log('The bare band the charge measured. Sized by station so a fix knows where to put things.\n');
console.log('aspect                 ' + STATIONS.map((z) => `z=${z}`.padStart(9)).join('') + '   (% of FRAME that is bare outboard deck at that station +-1)');
for (const [label, aspect] of ASPECTS.slice(0, 5)) {
  const cam = cameraFor(aspect);
  const bands = STATIONS.map(() => 0);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const h = hitAt(cam, i, j);
      if (!h || !onDeck(h)) continue;
      if (Math.abs(h.x) <= ENVELOPE) continue;
      STATIONS.forEach((z, k) => {
        if (Math.abs(h.z - z) <= 1) bands[k]++;
      });
    }
  console.log(`${label.padEnd(22)} ` + bands.map((b) => `${((b / (N * N)) * 100).toFixed(2)}%`.padStart(9)).join(''));
}
