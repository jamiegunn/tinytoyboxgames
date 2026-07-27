// SIMULATE THE ADDITIVE FIX.
//
// Three candidate fixes have now been measured, and two are dead:
//
//   CAMERA (close in on wide screens) -- DEAD. `pc-frame-budget.mjs`: the frame is
//     height-limited at ALL NINE aspects with an identical worst |ndc.y| of 0.911
//     set by the mast top, because a PerspectiveCamera holds VERTICAL fov fixed
//     and varies horizontal fov with aspect. Distance is a scalar and shrinks both
//     axes together, so the axis with 83% slack is held hostage by the axis with
//     9%. Cap 10.2%, worth 6% relative coverage on landscape. Round 2 was right.
//
//   TRANSLATION (spread props outboard per aspect) -- DEAD. `pc-spread-sim.mjs`:
//     coverage is AREA and translation preserves area, so landscape went 4.0% ->
//     4.0%. It also broke CLEAR and moved props on every real phone.
//
//   ADDITION (furnish the deck the wide frame uncovers) -- what this tests.
//     `pc-outboard-deck.mjs` sized the opportunity and, more importantly, proved
//     the safety property: deck at |x|=3.5 is inside the frame on 3 of 9 aspects
//     at z=-5 and 3 of 9 at z=-3. On a phone that deck is NOT CROPPED, it is
//     NOT IN THE FRAME AT ALL. So furniture placed there cannot make a narrow
//     frame worse -- there is nothing there to make worse. The fix is
//     non-regressive by construction rather than by testing, which is the only
//     kind of non-regressive I trust.
//
// The rule this encodes, and which the fix will make explicit in code:
//
//   REACHABLE props (anything a child can tap) must project inside NDC at EVERY
//     shipping aspect. Non-negotiable: an interaction a phone cannot reach is an
//     interaction that does not exist for that player.
//   SCENERY need only be in frame WHERE ITS DECK IS IN FRAME. Requiring scenery
//     to be visible on a screen that cannot see the planking it stands on is not
//     a composition constraint, it is a category error -- and it is the specific
//     error that made the layout the intersection of nine framings.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-outboard-sim',
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
const mk = (name, kind, x, z, extra = {}) => {
  const pl = { position: new Vector3(x, 0, z), ...extra };
  const r = B[kind](new Scene(), pl);
  r.updateMatrixWorld(true);
  const b = new Box3().setFromObject(r);
  return { name, kind, pos: pl.position.clone(), hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2, yMin: b.min.y, yMax: b.max.y };
};
const CURRENT = [];
const add = (k, st) => st.forEach((pl, i) => CURRENT.push(mk(`${k}${st.length > 1 ? i : ''}`, k, pl.position.x, pl.position.z, pl)));
add('anchor', M.ANCHOR_STAGING);
add('barrel', M.BARREL_STAGING);
add('ropeCoil', M.ROPE_COIL_STAGING);
add('cannon', M.CANNON_STAGING);
add('shipWheel', M.SHIP_WHEEL_STAGING);
add('treasureChest', M.TREASURE_CHEST_STAGING);

// CANDIDATE OUTBOARD STORES. All scenery, all in the near quarters where
// `pc-outboard-deck.mjs` found the bare pixels: z=-5 holds 5.92% of the landscape
// frame as bare outboard planking and z=-3 another 2.99%. Ship's stores lashed
// along the rails is the idiom; this is not clutter in the focal area, it is
// furniture on the periphery of the wide frames, which is precisely the surface
// that is currently empty.
const PROPOSED = [
  mk('storeBarrel_p0', 'barrel', -3.3, -4.4),
  mk('storeBarrel_p1', 'barrel', -2.95, -3.2),
  mk('storeRope_p0', 'ropeCoil', -3.55, -5.6),
  mk('storeBarrel_s0', 'barrel', 3.35, -5.0),
  mk('storeBarrel_s1', 'barrel', 3.05, -3.8),
  mk('storeRope_s0', 'ropeCoil', 3.5, -2.4),
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
const N = 400;
const hitAt = (cam, i, j) => {
  const p = new Vector3(-1 + ((i + 0.5) / N) * 2, -1 + ((j + 0.5) / N) * 2, 0.5).unproject(cam);
  const d = p.sub(cam.position);
  if (d.y >= -1e-9) return null;
  const t = -cam.position.y / d.y;
  return t > 0 ? new Vector3().copy(cam.position).addScaledVector(d, t) : null;
};
const onDeck = (p) => p.z >= HULL_Z_AFT && p.z <= HULL_Z_FWD && Math.abs(p.x) <= hullHalfWidthAt(p.z);

const measure = (cam, props) => {
  let deck = 0,
    cov = 0,
    pb = 0,
    pt = 0,
    sb = 0,
    st = 0;
  const col = new Array(N).fill(false),
    colDeck = new Array(N).fill(false);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const h = hitAt(cam, i, j);
      if (!h || !onDeck(h)) continue;
      deck++;
      colDeck[i] = true;
      let hit = false;
      for (const p of props)
        if (Math.abs(h.x - p.pos.x) <= p.hx && Math.abs(h.z - p.pos.z) <= p.hz) {
          hit = true;
          break;
        }
      if (hit) {
        cov++;
        col[i] = true;
      }
      if (h.x < 0) {
        pt++;
        if (!hit) pb++;
      } else {
        st++;
        if (!hit) sb++;
      }
    }
  let run = 0,
    worst = 0;
  for (let i = 0; i < N; i++) {
    if (colDeck[i] && !col[i]) {
      run++;
      worst = Math.max(worst, run);
    } else run = 0;
  }
  return { deckPct: deck / (N * N), cov: deck ? cov / deck : 0, portBare: pt ? pb / pt : 0, stbdBare: st ? sb / st : 0, band: worst / N };
};

console.log('==== 1. THE PROPOSED STORES: ARE THEY ON DECK AND CLEAR?\n');
console.log('prop                 x       z    footprint   halfWidth@z   fits?   clear of everything?');
let feasible = true;
for (const p of PROPOSED) {
  const hw = Math.min(hullHalfWidthAt(p.pos.z - p.hz), hullHalfWidthAt(p.pos.z + p.hz));
  const onShip = Math.abs(p.pos.x) + p.hx <= hw;
  const clash = [...CURRENT, ...PROPOSED]
    .filter((q) => q !== p && Math.abs(p.pos.x - q.pos.x) < p.hx + q.hx && Math.abs(p.pos.z - q.pos.z) < p.hz + q.hz)
    .map((q) => q.name);
  if (!onShip || clash.length) feasible = false;
  console.log(
    `${p.name.padEnd(18)} ${p.pos.x.toFixed(2).padStart(6)} ${p.pos.z.toFixed(2).padStart(7)}   ${(p.hx * 2).toFixed(2)}x${(p.hz * 2).toFixed(2)}      ${hw.toFixed(2).padStart(6)}    ${onShip ? 'yes' : 'NO '}     ${clash.length ? 'CLASH ' + clash.join(',') : 'yes'}`,
  );
}
console.log(`\n   feasibility: ${feasible ? 'PASS' : 'FAIL'}`);

console.log('\n\n==== 2. REACHABLE-TIER REGRESSION CHECK\n');
console.log('The three interactive props must still project inside NDC at every aspect,');
console.log('and the new scenery must not occlude them. Scenery is NOT held to the frame rule.\n');
const REACHABLE = CURRENT.filter((p) => ['cannon', 'shipWheel', 'treasureChest'].includes(p.kind));
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  const bad = REACHABLE.filter((p) => {
    const v = p.pos.clone().project(cam);
    return Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
  });
  console.log(
    `${label.padEnd(24)} ${REACHABLE.length - bad.length}/${REACHABLE.length} reachable in frame  ${bad.length ? 'FAIL ' + bad.map((p) => p.name).join(',') : 'PASS'}`,
  );
}

console.log('\n\n==== 3. WHAT THE STORES ARE WORTH, PER ASPECT\n');
console.log('aspect                   deck covered      PORT bare        STBD bare      worst empty band');
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  const b = measure(cam, CURRENT),
    a = measure(cam, [...CURRENT, ...PROPOSED]);
  console.log(
    `${label.padEnd(24)} ${(b.cov * 100).toFixed(1).padStart(5)}% -> ${(a.cov * 100).toFixed(1).padStart(5)}%   ` +
      `${(b.portBare * 100).toFixed(1).padStart(5)}% -> ${(a.portBare * 100).toFixed(1).padStart(5)}%   ` +
      `${(b.stbdBare * 100).toFixed(1).padStart(5)}% -> ${(a.stbdBare * 100).toFixed(1).padStart(5)}%   ` +
      `${(b.band * 100).toFixed(1).padStart(5)}% -> ${(a.band * 100).toFixed(1).padStart(5)}%`,
  );
}

console.log('\n\n==== 4. THE SAFETY PROPERTY, MEASURED RATHER THAN ASSUMED\n');
console.log('How many of the new stores are visible at each aspect, and did any narrow frame change?\n');
console.log('aspect                   stores on screen   narrow-frame deck coverage change');
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  const seen = PROPOSED.filter((p) => {
    for (const sx of [p.pos.x - p.hx, p.pos.x + p.hx])
      for (const sz of [p.pos.z - p.hz, p.pos.z + p.hz]) {
        const v = new Vector3(sx, p.yMax, sz);
        if (!inFront(cam, v)) continue;
        v.project(cam);
        if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) return true;
      }
    return false;
  });
  const b = measure(cam, CURRENT),
    a = measure(cam, [...CURRENT, ...PROPOSED]);
  const delta = (a.cov - b.cov) * 100;
  console.log(
    `${label.padEnd(24)} ${`${seen.length}/${PROPOSED.length}`.padStart(16)}   ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} points  ${delta < -1e-9 ? 'REGRESSION' : 'no regression'}`,
  );
}
