// Where do the props go on the new hull?
//
// The staged positions were authored against a 15.3 x 13.3 deck whose bow was a
// flat 7.5-unit transom, seen from a camera at radius 10 and polar 1.2. The hull
// is now 10 x 24 with a stem at z = +12, and the eye stands further aft and
// higher. Six of the seven staging files therefore describe positions on a deck
// that no longer exists — the anchor at x = -4.5 is 0.15 units OUTSIDE the new
// port rail at its own station, and the parrot at y 3.85 is 1.7 units below the
// crow's nest it is documented as sitting on.
//
// This probe does not guess. It builds every prop with its REAL factory, takes
// its REAL bounding box, and tests candidate placements against three rules:
//
//   ON DECK    every corner of the prop's footprint is inside the hull outline,
//              inset by the rail's own thickness, so nothing floats over water
//              or grows through a railing plank.
//   IN FRAME   every corner of the prop's world box projects inside NDC at all
//              nine shipping aspects, at the opening pose.
//   CLEAR      the footprint does not overlap the mast, the portal disc, or any
//              prop placed before it.
//
// Roles are mine; positions are the solver's. A cannon belongs at a gunport on
// the starboard side and a helm belongs aft on the centreline — those are facts
// about ships, not about this camera. Which starboard station and which aft
// station satisfy the three rules is what gets searched.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-stage-solve',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
   export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
   export { HULL_PLAN, HULL_Z_AFT, HULL_Z_FWD, MAST, hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
   export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
   export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
   export { createParrot } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/parrot/create';
   export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
   export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
   export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';`,
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

// Build one of each prop at the origin, unrotated, unit scale, and measure it.
const BUILDERS = {
  anchor: (s, p) => M.createAnchor(s, p, opts),
  barrel: (s, p) => M.createBarrel(s, p, opts),
  ropeCoil: (s, p) => M.createRopeCoil(s, p, opts),
  parrot: (s, p) => M.createParrot(s, p),
  cannon: (s, p) => M.createCannon(s, p, opts).root,
  shipWheel: (s, p) => M.createShipWheel(s, p, opts).root,
  treasureChest: (s, p) => M.createTreasureChest(s, p, opts).root,
};

const boxFor = (kind, placement) => {
  const scene = new Scene();
  const root = BUILDERS[kind](scene, placement);
  root.updateMatrixWorld(true);
  return new Box3().setFromObject(root);
};

console.log('==== PROP EXTENTS (built with the real factory, placed at the origin, unit scale)\n');
const EXTENT = {};
for (const kind of Object.keys(BUILDERS)) {
  const b = boxFor(kind, { position: new Vector3(0, 0, 0), rotY: 0, scale: 1 });
  EXTENT[kind] = b;
  console.log(
    `   ${kind.padEnd(14)} x ${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)}   y ${b.min.y.toFixed(2)}..${b.max.y.toFixed(2)}   z ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)}   ` +
      `footprint radius ${Math.max(Math.abs(b.min.x), b.max.x, Math.abs(b.min.z), b.max.z).toFixed(2)}`,
  );
}

// ------------------------------------------------------------------- cameras
const cameras = ASPECTS.map(([label, aspect]) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return { label, cam };
});

console.log('\n==== WHERE THE BOTTOM EDGE OF THE FRAME LANDS ON DECK (vertical FOV does not vary with aspect)\n');
for (const { label, cam } of cameras) {
  // March the bottom-centre ray until it crosses y = 0.
  let hitZ = null;
  const origin = cam.position.clone();
  const dir = new Vector3(0, -1, 0.5).unproject(cam).sub(origin).normalize();
  if (dir.y < 0) hitZ = origin.z + dir.z * (-origin.y / dir.y);
  console.log(`   ${label.padEnd(22)} bottom-centre ray meets the deck at z ${hitZ === null ? 'n/a' : hitZ.toFixed(2)}`);
}

// -------------------------------------------------------------------- rules
// Rail geometry: posts of radius 0.12 sit ON the outline, and the top rail is
// 0.18 wide. A prop whose footprint reaches the outline is inside a railing.
const RAIL_INSET = 0.35;

const cornersOf = (b) => {
  const out = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new Vector3(x, y, z));
  return out;
};

const placedBox = (kind, pos, rotY, scale) => boxFor(kind, { position: pos, rotY, scale });

const onDeck = (box) => {
  // Sample the footprint's four corners plus its z extremes at both x edges.
  for (const x of [box.min.x, box.max.x]) {
    for (const z of [box.min.z, box.max.z]) {
      if (z < M.HULL_Z_AFT + RAIL_INSET || z > M.HULL_Z_FWD - RAIL_INSET) return false;
      const hw = M.hullHalfWidthAt(z);
      if (hw === null || Math.abs(x) > hw - RAIL_INSET) return false;
    }
  }
  return true;
};

const inFrame = (box) => {
  const pts = cornersOf(box);
  for (const { label, cam } of cameras) {
    for (const p of pts) {
      const n = p.clone().project(cam);
      if (Math.abs(n.x) > 1 || Math.abs(n.y) > 1) return label;
    }
  }
  return null;
};

const overlapsXZ = (a, b, pad = 0) => a.min.x - pad < b.max.x && a.max.x + pad > b.min.x && a.min.z - pad < b.max.z && a.max.z + pad > b.min.z;

// Things already on the deck that a prop must not grow through.
const OBSTACLES = [
  ['the mast', new Box3(new Vector3(-0.25, 0, M.MAST.z - 0.25), new Vector3(0.25, M.MAST.height, M.MAST.z + 0.25))],
  ...M.PIRATE_COVE_ENVIRONMENT.portals.map((p) => [
    `portal '${p.gameId}'`,
    new Box3(new Vector3(p.position.x - 0.9, 0, p.position.z - 0.9), new Vector3(p.position.x + 0.9, 0.4, p.position.z + 0.9)),
  ]),
];

// ------------------------------------------------------------------- search
//
// Each role names a region and a preference. The search walks a 0.1-unit grid,
// keeps every candidate that satisfies all three rules, and returns the one that
// best serves the role — never the first one found, so the choice is comparable.
const placed = [];

const search = (kind, role, region, prefer, rotY, scale) => {
  const kept = [];
  for (let x = region.x0; x <= region.x1 + 1e-9; x += 0.1) {
    for (let z = region.z0; z <= region.z1 + 1e-9; z += 0.1) {
      const pos = new Vector3(Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10);
      const box = placedBox(kind, pos, rotY, scale);
      if (!onDeck(box)) continue;
      if (inFrame(box) !== null) continue;
      let blocked = false;
      for (const [, ob] of OBSTACLES) if (overlapsXZ(box, ob, 0.15)) blocked = true;
      for (const p of placed) if (overlapsXZ(box, p.box, 0.15)) blocked = true;
      if (blocked) continue;
      kept.push({ pos, box });
    }
  }
  if (!kept.length) {
    console.log(`   ${role.padEnd(30)} NO CANDIDATE in x ${region.x0}..${region.x1}, z ${region.z0}..${region.z1}`);
    return null;
  }
  kept.sort((a, b) => prefer(a.pos) - prefer(b.pos));
  const best = kept[0];
  placed.push(best);
  console.log(
    `   ${role.padEnd(30)} ${kept.length.toString().padStart(4)} candidates -> (${best.pos.x.toFixed(1)}, 0, ${best.pos.z.toFixed(1)})  rotY ${rotY.toFixed(2)}  scale ${scale}`,
  );
  return best.pos;
};

console.log('\n==== ROLE SEARCH (0.1-unit grid; on deck, in frame at all nine, clear of mast/portal/each other)\n');

// How far a point at (x, z) sits inside the rail on its own station. Roles that
// say "against the rail" are scored with this rather than with a literal x,
// because the rail moves: the hull is 5.0 half-wide amidships and 1.4 at z 7.2,
// so one x cannot mean "by the rail" at two stations.
const rail = (p) => (M.hullHalfWidthAt(p.z) ?? 0) - Math.abs(p.x);
const near = (x, z) => (p) => Math.hypot(p.x - x, p.z - z);

// The helm belongs aft on the centreline. It is also the scene's only near
// foreground: at z -5.0 it stands 6.4 units from the eye against the stem's
// 23.4, and a deck with something close, something mid and something far is a
// deck that has depth. Pushed to the aft limit (-5.5) it would sit 0.3 from the
// bottom frame edge, which is one pan from being cropped, so the preference
// targets -5.0 rather than minimising z.
search('shipWheel', 'ship wheel (helm, aft centre)', { x0: -0.8, x1: 0.8, z0: -5.5, z1: -2.0 }, (p) => Math.abs(p.z + 5.0) + Math.abs(p.x) * 2, 0, 1);

// A gun runs out through a port on the beam. Starboard side, hard against the
// rail, muzzle outboard.
search('cannon', 'cannon (starboard gunport)', { x0: 1.2, x1: 4.6, z0: -5.0, z1: 2.0 }, (p) => rail(p) + Math.abs(p.z + 1) * 0.1, Math.PI * 0.5, 1);

// The chest is treasure: prominent, on open deck, on the side the cannon is not.
search('treasureChest', 'treasure chest (port side)', { x0: -4.6, x1: -1.0, z0: -4.5, z1: 1.5 }, near(-2.4, -1.5), Math.PI * 0.55, 1);

// Ground tackle lives forward and against the rail, where the cable runs to the
// hawse. Rail-hugging first, forward second — at z 7.2 the deck is only 2.9 wide
// and "forward" alone drags the anchor onto the centreline, which is a walkway.
search('anchor', 'anchor (forward, port rail)', { x0: -4.0, x1: -0.6, z0: 2.0, z1: 7.5 }, (p) => rail(p) * 2 - p.z * 0.3, Math.PI * 0.95, 1);

// Barrels are stores: a CLUSTER, not a row. Each is preferred near the same
// centre, so they crowd instead of lining the rail like fence posts.
const BARRELS = [
  [0, 1],
  [Math.PI * 0.3, 0.85],
  [Math.PI * -0.15, 1.1],
  [Math.PI * 0.6, 0.75],
];
BARRELS.forEach(([rot, scale], i) => {
  search('barrel', `barrel ${i} (stores, starboard)`, { x0: 0.8, x1: 3.6, z0: 2.0, z1: 6.5 }, near(2.2, 4.6), rot, scale);
});

// Rope coils are the small change of a deck: they fill the gaps.
search('ropeCoil', 'rope coil 0', { x0: -3.0, x1: -0.8, z0: -0.5, z1: 3.0 }, near(-1.9, 2.2), 0, 1);
search('ropeCoil', 'rope coil 1', { x0: 0.8, x1: 3.0, z0: -4.0, z1: -0.5 }, near(1.8, -3.2), Math.PI * 0.4, 0.9);

// ------------------------------------------------------------------- parrot
//
// Not searched: the parrot's position is DERIVED from the crow's nest it is
// documented as sitting on. The shipped staging put it at y 3.85 while the nest
// hoop stood at 5.83 — the comment said "sitting on the crow's nest rim" and the
// prop was hanging in mid-air beside the sail. A derived value cannot drift.
const NEST_RADIUS = 0.5;
const HOOP_TOP = M.MAST.nestY + 0.3 + 0.03;
const a = Math.PI * 0.75; // aft-starboard, so the bird faces the camera over the rail
const parrotPos = new Vector3(Math.sin(a) * NEST_RADIUS * 1.02, HOOP_TOP, M.MAST.z + Math.cos(a) * NEST_RADIUS * 1.02);
const parrotBox = placedBox('parrot', parrotPos, Math.PI, 1.2);
console.log(
  `\n   parrot (crow's nest rim)       derived -> (${parrotPos.x.toFixed(2)}, ${parrotPos.y.toFixed(3)}, ${parrotPos.z.toFixed(2)})  ` +
    `hoop top y ${HOOP_TOP.toFixed(3)}   in frame: ${inFrame(parrotBox) === null ? 'all nine' : `OFF at ${inFrame(parrotBox)}`}`,
);
console.log(
  `   parrot box y ${parrotBox.min.y.toFixed(2)}..${parrotBox.max.y.toFixed(2)}, mast top is ${M.MAST.height.toFixed(2)} — the bird must not poke past the truck.`,
);
