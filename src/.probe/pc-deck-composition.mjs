// ROUND 4 CHARGE INSTRUMENT: what does the deck look like as a COMPOSITION?
//
// Round 3 rebuilt the hull so the ship reads as a ship, and `pc-stage-solve.mjs`
// re-placed every prop on it. That solve tested three rules -- ON DECK, IN FRAME,
// CLEAR -- and every one of them is a rule about a SINGLE prop in isolation. On
// deck: this prop's footprint is inside the outline. In frame: this prop's
// corners project inside NDC. Clear: this prop does not intersect one already
// placed. A layout in which all seven props are stacked in a 1-unit column
// passes none of them by accident -- it passes all three by construction.
//
// Nothing has ever measured the ARRANGEMENT. That is what this does.
//
// Two rules carried from the earlier probes:
//   1. The camera comes from `resolveSceneCameraPose`, never re-derived here.
//   2. Prop extents come from the REAL factories at the REAL staged placements,
//      never from a guessed radius around a staging position.
//
// The measure is screen-space, not world-space, and that choice is load-bearing.
// The eye stands ON the deck, so a square metre at z -5 covers hundreds of times
// the pixels of a square metre at the stem. A world-area answer would call the
// far half of the deck important and the near foreground negligible, which is
// the exact opposite of what a player sees. So: shoot a ray through every pixel
// of a grid across the frame, keep the ones that land on deck, and ask what is
// standing on each.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-deck-composition',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
   export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
   export { HULL_PLAN, HULL_Z_AFT, HULL_Z_FWD, HULL_Z_MAX_BEAM, MAST, hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell';
   export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
   export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
   export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
   export { PARROT_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/parrot';
   export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
   export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
   export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
   export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
   export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
   export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
   export { createParrot } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/parrot/create';
   export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
   export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
   export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';`,
);

const { hullHalfWidthAt, HULL_Z_AFT, HULL_Z_FWD, PIRATE_COVE_ENVIRONMENT } = M;

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
const BUILDERS = {
  anchor: (s, p) => M.createAnchor(s, p, opts),
  barrel: (s, p) => M.createBarrel(s, p, opts),
  ropeCoil: (s, p) => M.createRopeCoil(s, p, opts),
  parrot: (s, p) => M.createParrot(s, p),
  cannon: (s, p) => M.createCannon(s, p, opts).root,
  shipWheel: (s, p) => M.createShipWheel(s, p, opts).root,
  treasureChest: (s, p) => M.createTreasureChest(s, p, opts).root,
};

// Every prop, built where it actually stands, measured as it actually is.
const OCCUPANTS = [];
const add = (kind, staging) =>
  staging.forEach((placement, i) => {
    const scene = new Scene();
    const root = BUILDERS[kind](scene, placement);
    root.updateMatrixWorld(true);
    OCCUPANTS.push({ name: `${kind}${staging.length > 1 ? i : ''}`, kind, placement, box: new Box3().setFromObject(root) });
  });
add('anchor', M.ANCHOR_STAGING);
add('barrel', M.BARREL_STAGING);
add('ropeCoil', M.ROPE_COIL_STAGING);
add('cannon', M.CANNON_STAGING);
add('shipWheel', M.SHIP_WHEEL_STAGING);
add('treasureChest', M.TREASURE_CHEST_STAGING);

// The mast is not staging data but it is very much something standing on deck,
// so it counts as an occupant. Taken from the real shell, not from MAST.
const shellScene = new Scene();
const shell = M.createSceneShell(shellScene, { wallHeight: 2, materials });
shell.updateMatrixWorld(true);
shell.traverse((o) => {
  if (o.isMesh && (o.name === 'ship_mast' || o.name === 'crows_nest' || o.name === 'ship_yardarm' || o.name === 'ship_mainsail')) {
    OCCUPANTS.push({ name: o.name, kind: 'rig', placement: { position: o.position.clone() }, box: new Box3().setFromObject(o) });
  }
});

console.log('==== 1. WHERE THE PROPS STAND, IN WORLD SPACE\n');
console.log(`hull: beam ${M.HULL_PLAN.beam}, length ${M.HULL_PLAN.length}, z ${HULL_Z_AFT}..${HULL_Z_FWD}\n`);
console.log('prop            x        z    |x|   halfWidth@z   |x|/halfWidth  (1.0 = at the rail)');
const deckProps = OCCUPANTS.filter((o) => o.kind !== 'rig');
for (const o of deckProps.slice().sort((a, b) => a.placement.position.x - b.placement.position.x)) {
  const { x, z } = o.placement.position;
  const hw = hullHalfWidthAt(z);
  console.log(
    `${o.name.padEnd(14)} ${x.toFixed(2).padStart(6)} ${z.toFixed(2).padStart(7)} ${Math.abs(x).toFixed(2).padStart(6)}   ${hw.toFixed(2).padStart(6)}        ${(Math.abs(x) / hw).toFixed(3).padStart(6)}`,
  );
}
const absX = deckProps.map((o) => Math.abs(o.placement.position.x));
const frac = deckProps.map((o) => Math.abs(o.placement.position.x) / hullHalfWidthAt(o.placement.position.z));
console.log(`\nmax |x| over all ${deckProps.length} deck props: ${Math.max(...absX).toFixed(2)} on a hull half-beam of ${M.HULL_PLAN.beam / 2}`);
console.log(`max |x| / halfWidth-at-that-station:     ${Math.max(...frac).toFixed(3)}  (1.0 would be touching the rail)`);
console.log(`mean |x| / halfWidth:                    ${(frac.reduce((a, b) => a + b, 0) / frac.length).toFixed(3)}`);

// ---------------------------------------------------------------------------

const cameraFor = (aspect) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;

// NDC rectangle of a world box, dropping corners behind the eye (they project to
// garbage). A box with no corner in front contributes nothing.
const ndcRect = (cam, box) => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    any = false;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new Vector3(x, y, z);
        if (!inFront(cam, p)) continue;
        p.project(cam);
        any = true;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
  return any ? { minX, maxX, minY, maxY } : null;
};

// Ray through an NDC point, intersected with the deck plane y = 0.
const deckHit = (cam, nx, ny) => {
  const p = new Vector3(nx, ny, 0.5).unproject(cam);
  const dir = p.sub(cam.position);
  if (dir.y >= -1e-9) return null; // ray goes up or runs parallel: never meets the deck
  const t = -cam.position.y / dir.y;
  if (t <= 0) return null;
  return new Vector3().copy(cam.position).addScaledVector(dir, t);
};

const onDeck = (p) => {
  if (p.z < HULL_Z_AFT || p.z > HULL_Z_FWD) return false;
  const hw = hullHalfWidthAt(p.z);
  return hw !== null && Math.abs(p.x) <= hw;
};

const N = 400; // 400 x 400 rays across the frame

console.log('\n\n==== 2. SCREEN-SPACE DECK OCCUPANCY\n');
console.log('Of the pixels that show bare deck, what fraction has a prop standing on it?');
console.log('"covered" = the pixel falls inside the NDC bounding rect of some prop or');
console.log('the rig. That is a GENEROUS over-count -- a rect is bigger than the shape');
console.log('inside it -- so every emptiness number below is an UNDER-statement.\n');
console.log('aspect                     deck px%   covered   PORT bare   STBD bare   worst empty band');

const rows = [];
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  const rects = OCCUPANTS.map((o) => ({ o, r: ndcRect(cam, o.box) })).filter((e) => e.r);

  let deckPx = 0,
    coveredPx = 0,
    portPx = 0,
    portBare = 0,
    stbdPx = 0,
    stbdBare = 0;
  // Column histogram: for each screen column, how many deck pixels are bare.
  const colDeck = new Array(N).fill(0);
  const colBare = new Array(N).fill(0);

  for (let i = 0; i < N; i++) {
    const nx = -1 + ((i + 0.5) / N) * 2;
    for (let j = 0; j < N; j++) {
      const ny = -1 + ((j + 0.5) / N) * 2;
      const hit = deckHit(cam, nx, ny);
      if (!hit || !onDeck(hit)) continue;
      deckPx++;
      colDeck[i]++;
      const covered = rects.some((e) => nx >= e.r.minX && nx <= e.r.maxX && ny >= e.r.minY && ny <= e.r.maxY);
      if (covered) coveredPx++;
      else colBare[i]++;
      if (hit.x < 0) {
        portPx++;
        if (!covered) portBare++;
      } else {
        stbdPx++;
        if (!covered) stbdBare++;
      }
    }
  }

  // Longest run of screen columns that show deck and show nothing standing on it.
  let run = 0,
    best = 0,
    bestStart = 0,
    start = 0;
  for (let i = 0; i < N; i++) {
    const allBare = colDeck[i] > 0 && colBare[i] === colDeck[i];
    if (allBare) {
      if (run === 0) start = i;
      run++;
      if (run > best) {
        best = run;
        bestStart = start;
      }
    } else run = 0;
  }
  const bandPct = (best / N) * 100;

  rows.push({ label, deckPx, coveredPx, portPx, portBare, stbdPx, stbdBare, bandPct, bestStart, best });
  console.log(
    `${label.padEnd(24)} ${((deckPx / (N * N)) * 100).toFixed(1).padStart(6)}%  ${((coveredPx / deckPx) * 100).toFixed(1).padStart(6)}%  ` +
      `${((portBare / portPx) * 100).toFixed(1).padStart(8)}%  ${((stbdBare / stbdPx) * 100).toFixed(1).padStart(8)}%   ` +
      `${bandPct.toFixed(1).padStart(5)}% of width`,
  );
}

const worst = rows.reduce((a, b) => (b.coveredPx / b.deckPx < a.coveredPx / a.deckPx ? b : a));
const bestRow = rows.reduce((a, b) => (b.coveredPx / b.deckPx > a.coveredPx / a.deckPx ? b : a));
console.log(`\nleast-furnished aspect: ${worst.label} at ${((worst.coveredPx / worst.deckPx) * 100).toFixed(1)}% of visible deck covered`);
console.log(`most-furnished aspect:  ${bestRow.label} at ${((bestRow.coveredPx / bestRow.deckPx) * 100).toFixed(1)}%`);
const portAll = rows.reduce((a, r) => a + r.portBare, 0) / rows.reduce((a, r) => a + r.portPx, 0);
const stbdAll = rows.reduce((a, r) => a + r.stbdBare, 0) / rows.reduce((a, r) => a + r.stbdPx, 0);
console.log(`port deck bare, all aspects:      ${(portAll * 100).toFixed(1)}%`);
console.log(`starboard deck bare, all aspects: ${(stbdAll * 100).toFixed(1)}%`);

// ---------------------------------------------------------------------------

console.log('\n\n==== 3. THE NEAR FOREGROUND\n');
console.log('The bottom edge of frame meets the deck at z -5.80 on every aspect. The');
console.log('band from there to the mast is the deck the player is standing in. What is');
console.log('in it, and where?\n');
const MAST_Z = M.MAST.z;
console.log(`mast stands at z ${MAST_Z}\n`);
const near = deckProps.filter((o) => o.placement.position.z >= -5.8 && o.placement.position.z <= MAST_Z);
console.log(`props in the near band (-5.80 <= z <= ${MAST_Z}): ${near.length} of ${deckProps.length}`);
for (const o of near.sort((a, b) => a.placement.position.z - b.placement.position.z)) {
  console.log(`  ${o.name.padEnd(14)} (${o.placement.position.x.toFixed(2)}, ${o.placement.position.z.toFixed(2)})`);
}
const nearPort = near.filter((o) => o.placement.position.x < -0.3);
const nearStbd = near.filter((o) => o.placement.position.x > 0.3);
console.log(`  ...of which to port (x < -0.3): ${nearPort.length}  [${nearPort.map((o) => o.name).join(', ') || 'NONE'}]`);
console.log(`  ...of which to starboard (x > 0.3): ${nearStbd.length}  [${nearStbd.map((o) => o.name).join(', ') || 'NONE'}]`);

// ---------------------------------------------------------------------------

console.log('\n\n==== 4. THE OWL AND THE PORTAL SHARE A SIGHT LINE\n');
const owl = PIRATE_COVE_ENVIRONMENT.floorTap.owlPosition;
const portal = PIRATE_COVE_ENVIRONMENT.portals[0].position;
console.log(`owl perch:  (${owl.x}, ${owl.y}, ${owl.z})`);
console.log(`portal:     (${portal.x}, ${portal.y}, ${portal.z})`);
console.log(`both on x = 0, ${Math.abs(owl.z - portal.z).toFixed(2)} apart in z, with the eye also on x = 0.\n`);
console.log('aspect                   owl ndc(x,y)        portal ndc(x,y)     dx      dy    owl in front of portal?');
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  const o = owl.clone();
  const pt = portal.clone();
  const oIn = inFront(cam, o),
    pIn = inFront(cam, pt);
  o.project(cam);
  pt.project(cam);
  const dOwl = owl.clone().sub(cam.position).length();
  const dPortal = portal.clone().sub(cam.position).length();
  console.log(
    `${label.padEnd(24)} (${o.x.toFixed(3)}, ${o.y.toFixed(3)})   (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)})  ` +
      `${(o.x - pt.x).toFixed(3).padStart(6)} ${(o.y - pt.y).toFixed(3).padStart(7)}   ${oIn && pIn ? (dOwl < dPortal ? `YES (${dOwl.toFixed(2)} vs ${dPortal.toFixed(2)})` : 'no') : 'off-camera'}`,
  );
}

// ---------------------------------------------------------------------------

console.log('\n\n==== 5. LIVE SURFACE vs DEAD SURFACE\n');
console.log('soul.md: "A dead tap is a broken promise."');
console.log('vision.md: "every toybox should expose 4-7 obvious tappable interaction');
console.log('points" and "avoid small precision targets".\n');
console.log('A three-year-old cannot tell a barrel from a treasure chest by looking:');
console.log('both are chest-high, both are wooden, both stand on the deck. They will');
console.log('tap the barrel. So the question is not "how many things are tappable"');
console.log('but "of the deck furniture a child sees and reaches for, how much of it');
console.log('answers".\n');

// Which composers wire a dispatcher tap. Verified by reading each compose.ts:
// anchor/barrels/ropeCoils call composeCollection with a create fn and nothing
// else; cannon/shipWheel/treasureChest pass a setup*Tap; parrot has its own
// interaction.ts registering on the dispatcher.
const LIVE = new Set(['cannon', 'shipWheel', 'treasureChest']);
console.log('prop family      instances   tappable?');
const families = [...new Set(deckProps.map((o) => o.kind))].sort();
for (const kind of families) {
  const n = deckProps.filter((o) => o.kind === kind).length;
  console.log(`  ${kind.padEnd(16)} ${String(n).padStart(3)}       ${LIVE.has(kind) ? 'LIVE' : 'dead  <-- looks tappable, is not'}`);
}
const liveCount = deckProps.filter((o) => LIVE.has(o.kind)).length;
console.log(
  `\ndeck props: ${deckProps.length}   live: ${liveCount}   dead: ${deckProps.length - liveCount}   (${(((deckProps.length - liveCount) / deckProps.length) * 100).toFixed(0)}% of the furniture is scenery)`,
);

console.log('\nNow in screen area -- the measure that matches what a thumb goes for.');
console.log('Prop pixels are counted by ray-casting the frame and testing the world');
console.log("hit against each prop's own world box, so a big near barrel outweighs a");
console.log('small far one exactly as it does on the glass.\n');
console.log('aspect                    live px%   dead px%   dead/(live+dead)');

let liveTot = 0,
  deadTot = 0;
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  const rects = deckProps.map((o) => ({ o, r: ndcRect(cam, o.box) })).filter((e) => e.r);
  let livePx = 0,
    deadPx = 0;
  for (let i = 0; i < N; i++) {
    const nx = -1 + ((i + 0.5) / N) * 2;
    for (let j = 0; j < N; j++) {
      const ny = -1 + ((j + 0.5) / N) * 2;
      const hits = rects.filter((e) => nx >= e.r.minX && nx <= e.r.maxX && ny >= e.r.minY && ny <= e.r.maxY);
      if (!hits.length) continue;
      // A pixel showing two overlapping props belongs to the NEARER one, which
      // is the one a tap would hit.
      const nearest = hits.reduce((a, b) => (b.o.box.distanceToPoint(cam.position) < a.o.box.distanceToPoint(cam.position) ? b : a));
      if (LIVE.has(nearest.o.kind)) livePx++;
      else deadPx++;
    }
  }
  liveTot += livePx;
  deadTot += deadPx;
  console.log(
    `${label.padEnd(24)} ${((livePx / (N * N)) * 100).toFixed(2).padStart(7)}%  ${((deadPx / (N * N)) * 100).toFixed(2).padStart(7)}%   ` +
      `${((deadPx / (livePx + deadPx)) * 100).toFixed(1).padStart(6)}%`,
  );
}
console.log(
  `\nacross all nine aspects: ${((deadTot / (liveTot + deadTot)) * 100).toFixed(1)}% of the deck-furniture pixels a child sees belong to something that does not answer a tap.`,
);
