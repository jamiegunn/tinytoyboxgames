/**
 * THE THEOREM THAT BREAKS ROUND 4's FIRST DRAFT
 * ---------------------------------------------
 * Viewport aspect is CONTINUOUS -- a desktop window is not one of nine values.
 * A prop that is wholly IN frame at aspect 1.78 and wholly OUT at 0.40 must, by
 * the intermediate value theorem, pass through every intermediate state,
 * including "sliced by the edge". So "no prop is ever clipped" is achievable
 * only by keeping every prop inside the NARROWEST frame -- which is precisely
 * the intersection layout Round 4 exists to break.
 *
 * The old layout was therefore not merely timid. It was buying something real,
 * and my fix spends it. This probe asks what the right price is.
 *
 * The honest rule is not "never clipped" but "never an UNREADABLE SLIVER": a
 * barrel with its outboard third cut off still reads as a barrel; a 4-pixel
 * strip of brown hugging the screen edge is a smudge. Legibility is measured as
 * visible projected area / total projected area, and the bad band is the range
 * of aspects where some prop sits between "gone" and "readable".
 *
 * That band cannot be eliminated -- but its MEASURE can be bounded, and a bound
 * on a continuous sweep is a property, where passing at nine sampled aspects is
 * just tuning to the test.
 *
 * READ THIS BEFORE REUSING THE METRIC BELOW. IT WAS LATER SHOWN UNTRUSTWORTHY.
 * ---------------------------------------------------------------------------
 * `legibility` here is visible projected area over total projected area, taken
 * off an AXIS-ALIGNED BOX. Both halves of that turned out to be bad:
 *
 *   - The AABB lies about anything diagonal. It reports the stowage run 1.41
 *     wide where it is 0.84, and 4.3 : 1 elongated where it is 7.2 : 1.
 *   - Visible-area-fraction disagrees with the two other proxies built beside
 *     it, and it condemns THE SHIP'S OWN SIDE RAILS (out of band over 44.4% of
 *     the aspect range) worse than any prop it was pointed at. A metric that
 *     fails the scene's accepted precedent is measuring the wrong thing.
 *
 * The question all of them proxied for -- does a clipped prop still read -- was
 * finally settled by rendering it (`.probe/render/diff.mjs`), which counts the
 * pixels that actually change when a subject is shown and hidden. This probe is
 * kept because it is what KILLED draft 3, and that verdict still stands on its
 * own terms; it is not kept as a decision rule, and nothing should be accepted
 * or rejected on its numbers again.
 *
 * The draft-3 staging it condemned was deleted before it was ever committed, so
 * it is inlined below as literal data. Without that, the 43.3% figure quoted in
 * `staging/railStowage.ts` would cite a probe that could no longer produce it.
 */
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-sliver-band',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
  export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
  export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
  export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
  export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
  export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
  export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
  export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
  export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
  export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
  export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';
`,
);

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
/**
 * DRAFT 3, VERBATIM. Six compact props on the bare outboard quarters -- four
 * barrels and two rope coils. This never reached a commit: the sweep below
 * killed it the day it was written. Preserved as data so the verdict stays
 * reproducible rather than merely quoted.
 */
const DRAFT3_BARRELS = [
  { position: new Vector3(-3.3, 0, -4.4), rotY: Math.PI * 0.15, scale: 1 },
  { position: new Vector3(-2.95, 0, -3.2), rotY: Math.PI * -0.35, scale: 0.9 },
  { position: new Vector3(3.35, 0, -5.0), rotY: Math.PI * 0.55, scale: 1.05 },
  { position: new Vector3(3.05, 0, -3.8), rotY: Math.PI * -0.2, scale: 0.85 },
];
const DRAFT3_ROPE_COILS = [
  { position: new Vector3(-3.55, 0, -5.6), rotY: Math.PI * 0.25, scale: 0.95 },
  { position: new Vector3(3.5, 0, -2.4), rotY: Math.PI * -0.45, scale: 0.9 },
];
const STORES = [...g('barrel', DRAFT3_BARRELS, 'storeBarrel'), ...g('ropeCoil', DRAFT3_ROPE_COILS, 'storeRope')];

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
/** visible projected area / total projected area, in [0,1] */
const legibility = (cam, p) => {
  let lo = [Infinity, Infinity],
    hi = [-Infinity, -Infinity],
    any = false;
  for (const x of [p.pos.x - p.hx, p.pos.x + p.hx])
    for (const y of [p.yMin, p.yMax])
      for (const z of [p.pos.z - p.hz, p.pos.z + p.hz]) {
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
  const w = Math.max(0, Math.min(hi[0], 1) - Math.max(lo[0], -1));
  const h = Math.max(0, Math.min(hi[1], 1) - Math.max(lo[1], -1));
  return (w * h) / tot;
};

const LO = 0.15,
  HI = 0.55;
const N = 600,
  A0 = 0.4,
  A1 = 1.7778;
const sweep = (props, label) => {
  let bad = 0;
  const perProp = new Map(props.map((p) => [p.name, 0]));
  for (let i = 0; i <= N; i++) {
    const a = A0 + (A1 - A0) * (i / N);
    const cam = cameraFor(a);
    let anyBad = false;
    for (const p of props) {
      const L = legibility(cam, p);
      if (L > LO && L < HI) {
        anyBad = true;
        perProp.set(p.name, perProp.get(p.name) + 1);
      }
    }
    if (anyBad) bad++;
  }
  console.log(`  ${label.padEnd(34)} ${((bad / (N + 1)) * 100).toFixed(1)}% of the aspect range shows an unreadable sliver`);
  return perProp;
};

console.log(`==== SLIVER BAND, continuous aspect sweep ${A0} -> ${A1.toFixed(3)}, legibility band ${LO}..${HI}\n`);
sweep(EXISTING, 'shipped furniture alone');
const pp = sweep([...EXISTING, ...STORES], 'with draft 3 outboard stores');

console.log('\n==== PER-STORE: what share of the aspect range is that prop a sliver?\n');
for (const p of STORES) {
  const c = pp.get(p.name);
  console.log(
    `  ${p.name.padEnd(14)} x ${p.pos.x.toFixed(2).padStart(6)}  z ${p.pos.z.toFixed(2).padStart(6)}   sliver over ${((c / (N + 1)) * 100).toFixed(1)}% of aspects`,
  );
}

console.log(
  '\n==== WHY: the frame edge sweeps FASTER in world-x at greater depth from the eye,\n     so a prop far from the camera is crossed quickly and a near prop lingers half-cut.\n',
);
const cam0 = cameraFor(1.0);
console.log(`  eye at z ${cam0.position.z.toFixed(2)}`);
for (const z of [-5, -3, -1, 1, 3]) {
  const d = Math.abs(z - cam0.position.z);
  // world-x of the right frame edge at deck level, at two aspects
  const edgeAt = (a) => {
    const cam = cameraFor(a);
    let lo2 = 0,
      hi2 = 12;
    for (let k = 0; k < 40; k++) {
      const m = (lo2 + hi2) / 2;
      const v = new Vector3(m, 0, z).project(cam);
      if (Math.abs(v.x) <= 1) lo2 = m;
      else hi2 = m;
    }
    return lo2;
  };
  const e1 = edgeAt(0.75),
    e2 = edgeAt(1.7778);
  console.log(
    `  z ${String(z).padStart(3)}  depth ${d.toFixed(2).padStart(6)}   frame edge |x| ${e1.toFixed(2)} (0.75) -> ${e2.toFixed(2)} (1.78)   sweeps ${(e2 - e1).toFixed(2)} world units`,
  );
}
