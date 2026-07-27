// What is actually ON SCREEN, and is there any room to close in?
//
// Section 2 of `pc-deck-composition.mjs` found deck coverage falls monotonically
// as the viewport widens: 48.8% of visible deck furnished at aspect 0.40, 21.5%
// at 1.78. `pc-aspect-binding.mjs` found the prop layout is the intersection of
// nine framings and that the intersection IS the 0.40 framing, 6 stations out
// of 6.
//
// The suspect is `distanceMultiplierForAspect` = max(1, 0.75 / aspect). It pulls
// the camera back below aspect 0.75 and does nothing above it, so every viewport
// from an iPad in portrait to a 16:9 desktop -- a 2.37x range of horizontal FOV
// -- is framed from the identical distance.
//
// The obvious fix is to let the rule close in on wide viewports. Round 2 removed
// a push-in from this very function, for stated reasons, so before proposing one
// back I have to find out whether there is any room for it AT ALL. The ship is
// 24 long and 10 wide and it is seen nearly end-on, so its length maps to SCREEN
// HEIGHT. If landscape is height-limited, closing in crops the stem and there is
// no room, and the camera is not the fix.
//
// ── WHY THIS FILE WAS REWRITTEN ─────────────────────────────────────────────
// The first version of this probe measured "the ship" as the union of every mesh
// `createSceneShell` builds, and scored the frame by the worst NDC excursion over
// every corner of every one of those boxes. It printed worst |ndc.x| of 22 to 99,
// a worst |ndc.y| of exactly 32.755 at all nine aspects, and "already cropped at
// the shipped distance" for every aspect -- which contradicts the green Round 3
// hull suite, so the probe was wrong and not the app. Two bugs, both mine:
//
//   1. It swept in the OCEAN and the SKYDOME. The skydome is radius 60 and the
//      ocean is a sea-sized plane. Of course they do not fit in frame; they are
//      not supposed to. That is where the constant 32.755 came from -- it is the
//      skydome, identical at every aspect because it is a sphere about the eye.
//   2. It returned a sentinel {x:99,y:99} the moment ANY box corner fell astern
//      of the eye. The eye stands ON the deck at z -11.39 and the transom is at
//      z -12.0, so 0.61 units of stern rail are behind the camera at ALL times.
//      The sentinel fired on every aspect, every radius, forever.
//
// So this version measures LANDMARKS, exactly the set the Round 3 scorecard
// already proves in the shipped suite: the stem, the mast top, the crow's nest,
// the portal, and every staged prop origin. Those are the things a viewer would
// notice missing. The rails are deliberately NOT in the set: they run past the
// viewer on both hands and exit left and right, which is what standing on a deck
// looks like, and scoring them as "cropped" is the mistake round 3 already
// documented.
import { PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-frame-budget',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
   export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
   export { HULL_Z_AFT, HULL_Z_FWD, hullHalfWidthAt, MAST } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
   export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
   export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
   export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
   export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
   export { PARROT_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/parrot';
   export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
   export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
   export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';`,
);
const { hullHalfWidthAt, HULL_Z_AFT, HULL_Z_FWD, MAST } = M;

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

// Instantiate the materials so the bundle graph matches the other probes, then
// throw the scene away: this probe measures POINTS, not meshes.
const scene = new Scene();
void scene;
void M.createPirateCoveMaterials();

const RAIL_Y = 2 * 0.55; // top of the rail; see sceneShell's railHeight

// The landmark set. Everything a viewer would name and notice missing.
const LANDMARKS = [
  ['stem', new Vector3(0, RAIL_Y, HULL_Z_FWD)],
  ['mast top', new Vector3(0, MAST.height, MAST.z)],
  ["crow's nest", new Vector3(0, MAST.nestRailTopY, MAST.z)],
  ['portal', M.PIRATE_COVE_ENVIRONMENT.portals[0].position.clone()],
  ...[
    ['anchor', M.ANCHOR_STAGING],
    ['barrel', M.BARREL_STAGING],
    ['cannon', M.CANNON_STAGING],
    ['parrot', M.PARROT_STAGING],
    ['ropeCoil', M.ROPE_COIL_STAGING],
    ['shipWheel', M.SHIP_WHEEL_STAGING],
    ['treasureChest', M.TREASURE_CHEST_STAGING],
  ].flatMap(([n, list]) => list.map((p, i) => [`${n}${list.length > 1 ? i : ''}`, p.position.clone()])),
];

const preset = M.getSceneCameraPreset('pirate-cove');
// Reproduces `createSceneCamera`'s `updateCameraPosition` exactly: target plus a
// spherical offset, the ceiling clamp on world Y, then lookAt. Only the radius is
// parameterised, which is the one thing this probe is sweeping.
const camAt = (aspect, radius) => {
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  const target = new Vector3(...preset.target);
  cam.position.copy(target).add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth)));
  const ceilingY = preset.constraints?.ceilingY ?? 6.0;
  if (cam.position.y > ceilingY) cam.position.y = ceilingY;
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;

// Worst NDC excursion over the landmark set. A landmark astern of the eye is
// reported as such rather than projected, because projected NDC is garbage for
// those points; but no landmark should ever BE astern, so it is a hard failure
// rather than something to average away.
const excursion = (cam) => {
  let wx = 0,
    wy = 0,
    astern = 0;
  for (const [, p] of LANDMARKS) {
    if (!inFront(cam, p)) {
      astern++;
      continue;
    }
    const n = p.clone().project(cam);
    wx = Math.max(wx, Math.abs(n.x));
    wy = Math.max(wy, Math.abs(n.y));
  }
  return { x: wx, y: wy, astern };
};

// The bottom edge of the frame has to land ON the deck, not on water: a frame
// whose lower edge shows sea between the viewer and the hull puts the camera off
// the ship. This is the same check the Round 3 scorecard makes, and it is a
// SECOND constraint on closing in -- pushing the camera forward walks the bottom
// edge forward too.
const bottomEdgeZ = (cam) => {
  const dir = new Vector3(0, -1, 0.5).unproject(cam).sub(cam.position).normalize();
  if (dir.y >= -1e-9) return Infinity;
  return cam.position.z + dir.z * (-cam.position.y / dir.y);
};
const bottomOnDeck = (cam) => {
  const z = bottomEdgeZ(cam);
  return z >= HULL_Z_AFT && z <= HULL_Z_FWD;
};

const fitsAt = (aspect, r) => {
  const cam = camAt(aspect, r);
  const e = excursion(cam);
  return e.astern === 0 && e.x <= 1 && e.y <= 1 && bottomOnDeck(cam);
};

console.log('==== A. WHAT LIMITS THE FRAME AT THE SHIPPED DISTANCE\n');
console.log('aspect                   radius   worst |ndc.x|   worst |ndc.y|   limited by   slack   bottom edge z');
const shipped = {};
for (const [label, aspect] of ASPECTS) {
  const r = M.resolveSceneCameraPose('pirate-cove', aspect).radius;
  const cam = camAt(aspect, r);
  const e = excursion(cam);
  shipped[label] = { r, e };
  const limitedBy = e.x > e.y ? 'WIDTH' : 'HEIGHT';
  console.log(
    `${label.padEnd(24)} ${r.toFixed(2).padStart(6)}   ${e.x.toFixed(3).padStart(13)}   ${e.y.toFixed(3).padStart(13)}   ${limitedBy.padEnd(10)}  ${(1 - Math.max(e.x, e.y)).toFixed(3).padStart(5)}   ${bottomEdgeZ(cam).toFixed(2).padStart(11)}`,
  );
}
console.log('\n"slack" is how much of the frame is spare before a landmark touches an edge.');
console.log('A big slack means the ship is small in a big picture.');
console.log(`the deck runs z ${HULL_Z_AFT} (transom) .. ${HULL_Z_FWD} (stem); the bottom edge must land inside that.\n`);

// The deck-coverage measure from `pc-deck-composition.mjs`, reused verbatim so
// the two probes' percentages are comparable.
const N = 300;
const deckHit = (cam, nx, ny) => {
  const p = new Vector3(nx, ny, 0.5).unproject(cam);
  const dir = p.sub(cam.position);
  if (dir.y >= -1e-9) return null;
  const t = -cam.position.y / dir.y;
  return t > 0 ? new Vector3().copy(cam.position).addScaledVector(dir, t) : null;
};
const onDeck = (p) => p.z >= HULL_Z_AFT && p.z <= HULL_Z_FWD && Math.abs(p.x) <= hullHalfWidthAt(p.z);
const deckFraction = (cam) => {
  let n = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const h = deckHit(cam, -1 + ((i + 0.5) / N) * 2, -1 + ((j + 0.5) / N) * 2);
      if (h && onDeck(h)) n++;
    }
  return n / (N * N);
};

console.log('\n==== B. HOW CLOSE COULD THE CAMERA GET AND STILL SHOW EVERY LANDMARK?\n');
console.log('aspect                   shipped r   tightest r   could close in by   what stops it');
const tight = {};
for (const [label, aspect] of ASPECTS) {
  if (!fitsAt(aspect, shipped[label].r)) {
    console.log(`${label.padEnd(24)} ${shipped[label].r.toFixed(2).padStart(9)}   (already cropped at the shipped distance)`);
    continue;
  }
  let lo = 1,
    hi = shipped[label].r;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fitsAt(aspect, mid)) hi = mid;
    else lo = mid;
  }
  tight[label] = hi;
  // What binds at the tightest distance? Re-measure just below it.
  const camJust = camAt(aspect, hi - 1e-3);
  const eJust = excursion(camJust);
  const reasons = [];
  if (eJust.x > 1) reasons.push('WIDTH');
  if (eJust.y > 1) reasons.push('HEIGHT');
  if (!bottomOnDeck(camJust)) reasons.push('bottom edge leaves the deck');
  console.log(
    `${label.padEnd(24)} ${shipped[label].r.toFixed(2).padStart(9)}   ${hi.toFixed(2).padStart(10)}   ${(((shipped[label].r - hi) / shipped[label].r) * 100).toFixed(1).padStart(15)}%   ${reasons.join(' + ') || 'nothing (floor)'}`,
  );
}

console.log('\n\n==== C. WHAT CLOSING IN WOULD BUY\n');
console.log('aspect                   deck px% now   deck px% tight   relative gain');
for (const [label, aspect] of ASPECTS) {
  if (tight[label] === undefined) continue;
  const now = deckFraction(camAt(aspect, shipped[label].r));
  const then = deckFraction(camAt(aspect, tight[label]));
  console.log(
    `${label.padEnd(24)} ${(now * 100).toFixed(1).padStart(12)}%   ${(then * 100).toFixed(1).padStart(14)}%   ${(((then - now) / now) * 100).toFixed(0).padStart(12)}%`,
  );
}
