// SIMULATE THE ROUND 4 FIX BEFORE WRITING ANY OF IT.
//
// The measured charge: the prop layout is the INTERSECTION of nine framings, and
// `pc-aspect-binding.mjs` showed the intersection IS the narrowest framing --
// `extreme 360x900` binds 6 stations out of 6. So landscape surrenders 75% of its
// own usable width to a phone that is not looking.
//
// `pc-frame-budget.mjs` (rewritten, after two bugs of mine) then killed the
// obvious camera fix. The frame is HEIGHT-limited at ALL NINE aspects, with an
// identical worst |ndc.y| of 0.911 set by the mast top -- identical because a
// three.js PerspectiveCamera holds VERTICAL fov constant and varies horizontal
// fov with aspect, so vertical framing is aspect-invariant BY CONSTRUCTION.
// Closing in is capped at 10.2% everywhere and buys landscape 6% relative deck
// coverage. Distance is a scalar: it shrinks both axes together, and the axis
// with slack is blocked by the axis without. The camera cannot spend width.
//
// Only PLACEMENT can spend width. So: resolve the lateral spread per aspect.
//
// THE PROPOSED RULE
//   scale  = max(1, aspect / 0.40)
//   x'     = sign(x) * min(|x| * scale, deckLimit(z) )
//
// Two properties make this the safe form of the idea:
//   1. At aspect <= 0.40 it is the IDENTITY. The narrow phones the current layout
//      was solved for get byte-identical placements. They cannot regress.
//   2. The lateral frame allowance for a POINT is exactly proportional to aspect
//      -- horizontal half-fov obeys tan(h/2) = aspect * tan(v/2), and the camera's
//      local X axis is world X here (azimuth pi, so the eye sits on the z axis and
//      the view direction lies in the y-z plane), so the along-view depth cancels
//      out of the ratio. Scaling by aspect/0.40 therefore tracks the frame exactly
//      for a point and CONSERVATIVELY for a box, since a box's limit is
//      (k*aspect - halfWidth), which grows slightly FASTER than proportionally.
//      `pc-aspect-binding.mjs` confirms that: at z=-5 the measured box allowance
//      goes 0.96 -> 5.56 (x5.79) while aspect goes 0.40 -> 1.778 (x4.45).
//
// This probe applies the rule and re-measures everything the charge measured, and
// re-checks all three original staging rules at every aspect. If it does not move
// the numbers, the fix is wrong and I want to know now.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-spread-sim',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
   export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
   export { HULL_PLAN, HULL_Z_AFT, HULL_Z_FWD, MAST, hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell';
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
const REF_ASPECT = 0.4;
const RAIL_MARGIN = 0.35; // keep the footprint inboard of the rail line

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
// Build each prop once at its staged pose to learn its true extents, then reuse
// those extents translated -- the geometry does not change when x changes.
const PROPS = [];
const add = (kind, staging) =>
  staging.forEach((pl, i) => {
    const root = B[kind](new Scene(), pl);
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    PROPS.push({
      name: `${kind}${staging.length > 1 ? i : ''}`,
      kind,
      pos: pl.position.clone(),
      half: { x: (box.max.x - box.min.x) / 2, z: (box.max.z - box.min.z) / 2 },
      yMin: box.min.y,
      yMax: box.max.y,
    });
  });
add('anchor', M.ANCHOR_STAGING);
add('barrel', M.BARREL_STAGING);
add('ropeCoil', M.ROPE_COIL_STAGING);
add('cannon', M.CANNON_STAGING);
add('shipWheel', M.SHIP_WHEEL_STAGING);
add('treasureChest', M.TREASURE_CHEST_STAGING);

// The deck ceiling on |x| for a prop: its whole footprint must stay inside the
// hull outline, checked at BOTH ends of its z extent because the hull tapers.
const deckLimit = (p) => {
  const hw = Math.min(hullHalfWidthAt(p.pos.z - p.half.z), hullHalfWidthAt(p.pos.z + p.half.z));
  return Math.max(0, hw - p.half.x - RAIL_MARGIN);
};
const spreadX = (p, aspect) => {
  if (p.pos.x === 0) return 0; // centreline props stay centred
  const scale = Math.max(1, aspect / REF_ASPECT);
  return Math.sign(p.pos.x) * Math.min(Math.abs(p.pos.x) * scale, deckLimit(p));
};

const preset = {}; // camera comes only from resolveSceneCameraPose
const cameraFor = (aspect) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};
void preset;
const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;

const N = 400;
const deckHit = (cam, nx, ny) => {
  const p = new Vector3(nx, ny, 0.5).unproject(cam);
  const dir = p.sub(cam.position);
  if (dir.y >= -1e-9) return null;
  const t = -cam.position.y / dir.y;
  return t > 0 ? new Vector3().copy(cam.position).addScaledVector(dir, t) : null;
};
const onDeck = (p) => p.z >= HULL_Z_AFT && p.z <= HULL_Z_FWD && Math.abs(p.x) <= hullHalfWidthAt(p.z);

// Deck pixels, and which of them are "furnished": within a prop's footprint.
const measure = (cam, xs) => {
  let deckPx = 0,
    covered = 0,
    portBare = 0,
    portTot = 0,
    stbdBare = 0,
    stbdTot = 0;
  const colHas = new Array(N).fill(false);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const h = deckHit(cam, -1 + ((i + 0.5) / N) * 2, -1 + ((j + 0.5) / N) * 2);
      if (!h || !onDeck(h)) continue;
      deckPx++;
      let hit = false;
      for (let k = 0; k < PROPS.length; k++) {
        const p = PROPS[k];
        if (Math.abs(h.x - xs[k]) <= p.half.x && Math.abs(h.z - p.pos.z) <= p.half.z) {
          hit = true;
          break;
        }
      }
      if (hit) {
        covered++;
        colHas[i] = true;
      }
      if (h.x < 0) {
        portTot++;
        if (!hit) portBare++;
      } else {
        stbdTot++;
        if (!hit) stbdBare++;
      }
    }
  // widest run of frame columns that contain deck but no prop
  let run = 0,
    worst = 0;
  for (let i = 0; i < N; i++) {
    const anyDeck = (() => {
      for (let j = 0; j < N; j += 4) {
        const h = deckHit(cam, -1 + ((i + 0.5) / N) * 2, -1 + ((j + 0.5) / N) * 2);
        if (h && onDeck(h)) return true;
      }
      return false;
    })();
    if (anyDeck && !colHas[i]) {
      run++;
      worst = Math.max(worst, run);
    } else run = 0;
  }
  return {
    deckPct: deckPx / (N * N),
    coveredPct: deckPx ? covered / deckPx : 0,
    portBare: portTot ? portBare / portTot : 0,
    stbdBare: stbdTot ? stbdBare / stbdTot : 0,
    band: worst / N,
  };
};

const ndcOk = (cam, p, x) => {
  for (const sx of [x - p.half.x, x + p.half.x])
    for (const sy of [p.yMin, p.yMax])
      for (const sz of [p.pos.z - p.half.z, p.pos.z + p.half.z]) {
        const v = new Vector3(sx, sy, sz);
        if (!inFront(cam, v)) continue; // astern of the eye: not a crop
        v.project(cam);
        if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return false;
      }
  return true;
};

console.log('==== 1. WHERE EACH PROP WOULD STAND, PER ASPECT\n');
console.log(`reference aspect ${REF_ASPECT} (the layout as shipped); rail margin ${RAIL_MARGIN}\n`);
console.log('prop            z     deck cap   now   ' + ASPECTS.map(([l]) => l.split(' ')[0].slice(0, 7).padStart(8)).join(''));
for (const p of PROPS) {
  console.log(
    `${p.name.padEnd(14)} ${p.pos.z.toFixed(1).padStart(5)} ${deckLimit(p).toFixed(2).padStart(9)} ${p.pos.x.toFixed(2).padStart(6)}   ` +
      ASPECTS.map(([, a]) => spreadX(p, a).toFixed(2).padStart(8)).join(''),
  );
}

console.log('\n\n==== 2. SCREEN-SPACE DECK OCCUPANCY: NOW vs SPREAD\n');
console.log('aspect                    covered now -> spread    PORT bare        STBD bare        worst empty band');
const before = {},
  after = {};
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  const b = measure(
    cam,
    PROPS.map((p) => p.pos.x),
  );
  const a = measure(
    cam,
    PROPS.map((p) => spreadX(p, aspect)),
  );
  before[label] = b;
  after[label] = a;
  console.log(
    `${label.padEnd(24)} ${(b.coveredPct * 100).toFixed(1).padStart(6)}% -> ${(a.coveredPct * 100).toFixed(1).padStart(5)}%   ` +
      `${(b.portBare * 100).toFixed(0).padStart(3)}% -> ${(a.portBare * 100).toFixed(0).padStart(3)}%   ` +
      `${(b.stbdBare * 100).toFixed(0).padStart(3)}% -> ${(a.stbdBare * 100).toFixed(0).padStart(3)}%   ` +
      `${(b.band * 100).toFixed(1).padStart(6)}% -> ${(a.band * 100).toFixed(1).padStart(5)}%`,
  );
}

console.log('\n\n==== 3. DO ALL THREE ORIGINAL STAGING RULES STILL HOLD?\n');
let bad = 0;
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  const xs = PROPS.map((p) => spreadX(p, aspect));
  const offDeck = [],
    offFrame = [],
    overlap = [];
  PROPS.forEach((p, k) => {
    const hw = Math.min(hullHalfWidthAt(p.pos.z - p.half.z), hullHalfWidthAt(p.pos.z + p.half.z));
    if (Math.abs(xs[k]) + p.half.x > hw + 1e-9) offDeck.push(p.name);
    if (!ndcOk(cam, p, xs[k])) offFrame.push(p.name);
    for (let m = k + 1; m < PROPS.length; m++) {
      const q = PROPS[m];
      if (Math.abs(xs[k] - xs[m]) < p.half.x + q.half.x && Math.abs(p.pos.z - q.pos.z) < p.half.z + q.half.z) overlap.push(`${p.name}/${q.name}`);
    }
  });
  const fail = offDeck.length + offFrame.length + overlap.length;
  bad += fail;
  console.log(
    `${label.padEnd(24)} ON DECK ${offDeck.length ? 'FAIL ' + offDeck.join(',') : 'ok'}   IN FRAME ${offFrame.length ? 'FAIL ' + offFrame.join(',') : 'ok'}   CLEAR ${overlap.length ? 'FAIL ' + overlap.join(',') : 'ok'}`,
  );
}
console.log(`\n   total rule violations across all nine aspects: ${bad}  ${bad === 0 ? 'PASS' : 'FAIL'}`);

console.log('\n\n==== 4. IS THE NARROW END UNTOUCHED? (the safety invariant)\n');
for (const [label, aspect] of ASPECTS.slice(-3)) {
  const moved = PROPS.filter((p) => Math.abs(spreadX(p, aspect) - p.pos.x) > 1e-9);
  console.log(
    `${label.padEnd(24)} aspect ${aspect.toFixed(3)}  scale ${Math.max(1, aspect / REF_ASPECT).toFixed(3)}  props moved: ${moved.length ? moved.map((p) => p.name).join(', ') : 'NONE — identical to shipped'}`,
  );
}
