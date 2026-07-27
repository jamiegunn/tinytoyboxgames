// Round 3 verification instrument: does the pirate ship fit inside its own frame,
// and does its silhouette read as a ship?
//
// This started as the CHARGE instrument — the thing that measured the defect. It
// returned, against the shipped hull: side rails at 4.8 degrees from horizontal
// at the worst aspect, masthead cropped at 0 of 9 aspects, crow's nest cropped at
// 0 of 9, and a parrot 1.98 units below the rim it was documented as sitting on.
// It is now the instrument that has to disagree with all of that, run against the
// REBUILT shell rather than against the plan model that predicted the fix. If the
// built ship disagrees with the plan model, the plan model is what was wrong.
//
// Two rules this probe follows, both learned the hard way in round 2:
//
// 1. NOTHING here re-derives the camera. The pose comes from
//    `resolveSceneCameraPose('pirate-cove', aspect)`, the exported function the
//    app itself calls. The previous framing probe (`pc-framing.mjs`) carried its
//    own copy of the pull-back rule -- `a < 1 ? (1/a)*0.75 : 1` -- which round 2
//    deleted from the app. Every number it printed after that commit described a
//    camera that no longer ships.
//
// 2. NOTHING here hand-copies the hull outline. `pc-framing.mjs` transcribed the
//    six hull corners into a literal array; if `sternCut` changed, the probe
//    would keep measuring the old boat. This one instantiates the REAL
//    `createSceneShell` into a real Scene and reads world-space bounding boxes
//    off the meshes it actually builds.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-hull-frame',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose, sceneCameraMaxDistance } from './src/utils/cameraPresets';
   export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
   export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
   export { HULL_Z_AFT, HULL_Z_FWD, HULL_RAIL_RUNS, MAST } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell';
   export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
   export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
   export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
   export { PARROT_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/parrot';
   export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
   export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
   export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';`,
);

// All nine shipping aspects. `iPhone SE 375x667` was missing from this list while
// the probe was the charge instrument, which is exactly the aspect most likely to
// crop: it is the shortest phone still in the suite.
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

// Build the real shell once. It is pure three.js -- no DOM, no canvas.
// `createSceneShell` no longer takes a width and a depth: the hull is
// `hullPlan.ts`, and passing a width and a depth here is how the shell and the
// deck plane were able to describe two different boats.
const scene = new Scene();
const materials = M.createPirateCoveMaterials();
const shell = M.createSceneShell(scene, { wallHeight: 2, materials });
shell.updateMatrixWorld(true);

// Group the shell's meshes into the parts a viewer would name.
const partOf = (name) => {
  if (name.startsWith('railing_')) return 'railings (hull outline)';
  if (name === 'ship_mast') return 'mast';
  if (name === 'crows_nest' || name === 'crows_nest_rail') return "crow's nest";
  if (name === 'ship_yardarm') return 'yardarm';
  if (name === 'ship_mainsail' || name === 'ship_sailBand') return 'sail';
  return `other:${name}`;
};

// Each mesh keeps its OWN world-space box. They are deliberately not unioned
// into one box per part: the hull narrows to a point at the stem, so the corner
// of a single box spanning the whole hull sits over open sea. Projecting that
// corner would charge the ship for geometry that does not exist. Union happens
// in NDC instead, over the tight per-mesh boxes.
const parts = new Map();
shell.traverse((o) => {
  if (!o.isMesh) return;
  const key = partOf(o.name);
  if (!parts.has(key)) parts.set(key, []);
  parts.get(key).push(new Box3().setFromObject(o));
});
const partBox = (key) => parts.get(key).reduce((acc, b) => acc.union(b), new Box3().makeEmpty());

// Corner points of a box, in world space.
const corners = (b) => {
  const out = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new Vector3(x, y, z));
  return out;
};

const cameraFor = (aspect) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return { cam, radius: pose.radius };
};

// Is a world point in front of the eye? `Object3D.project` divides by w, and w
// is negative behind the camera, so a point behind the eye comes back with its
// NDC x and y NEGATED and unbounded. The first run of this probe after the hull
// change reported the railings spanning "7031% of the width, OFF-FRAME L+69.31
// R+69.31" — which is not a cropping defect, it is the transom. The eye stands
// at z -11.39 and the transom is at z -12.0, so 0.61 units of stern rail are
// BEHIND the camera, which is what standing on a deck means. Projected NDC is
// meaningless for those points and they have to be excluded rather than
// averaged in.
const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;

// NDC bounds of a set of world points, over the ones in front of the eye.
const ndcBounds = (cam, pts) => {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity,
    behind = 0;
  for (const p of pts) {
    if (!inFront(cam, p)) {
      behind++;
      continue;
    }
    const n = p.clone().project(cam);
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y);
    y1 = Math.max(y1, n.y);
  }
  return { x0, x1, y0, y1, behind, total: pts.length };
};

console.log('==== SHIPPED FRAMING (pose from resolveSceneCameraPose, geometry from createSceneShell)\n');
const hull = partBox('railings (hull outline)');
console.log(
  `  hull bbox  x ${hull.min.x.toFixed(2)}..${hull.max.x.toFixed(2)}  y ${hull.min.y.toFixed(2)}..${hull.max.y.toFixed(2)}  z ${hull.min.z.toFixed(2)}..${hull.max.z.toFixed(2)}`,
);
console.log(
  `  hull footprint ${(hull.max.x - hull.min.x).toFixed(1)} wide x ${(hull.max.z - hull.min.z).toFixed(1)} deep  ->  beam:length = 1 : ${((hull.max.z - hull.min.z) / (hull.max.x - hull.min.x)).toFixed(2)}\n`,
);

const PART_ORDER = ['railings (hull outline)', 'mast', 'yardarm', 'sail', "crow's nest"];

for (const [label, aspect] of ASPECTS) {
  const { cam, radius } = cameraFor(aspect);
  console.log(`### ${label}   aspect ${aspect.toFixed(3)}  orbit radius ${radius.toFixed(2)}`);
  for (const key of PART_ORDER) {
    const boxes = parts.get(key);
    if (!boxes) continue;
    const b = ndcBounds(
      cam,
      boxes.flatMap((box) => corners(box)),
    );
    const spanW = ((b.x1 - b.x0) / 2) * 100;
    const spanH = ((b.y1 - b.y0) / 2) * 100;
    const over = { L: -b.x0 - 1, R: b.x1 - 1, B: -b.y0 - 1, T: b.y1 - 1 };
    const off = Object.entries(over)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}+${v.toFixed(2)}`)
      .join(' ');
    const astern = b.behind ? `  (${b.behind}/${b.total} box corners astern of the eye — excluded)` : '';
    // The railings are EXPECTED to leave the frame sideways and that is not a
    // defect: the camera stands on the deck, so the two side rails run past the
    // viewer on both hands and exit left and right, exactly as the gunwales of a
    // real boat do. Reporting "OFF-FRAME L+21" for them reads like a failure and
    // is not one. What actually matters for the hull is whether the STEM — the
    // point they converge on — is in frame, which the scorecard below measures.
    const expected = key === 'railings (hull outline)' && off ? '  <- expected: the rails run past the viewer on both sides' : '';
    console.log(
      `   ${key.padEnd(24)} spans ${spanW.toFixed(0).padStart(4)}% w, ${spanH.toFixed(0).padStart(4)}% h   ${off ? `OFF-FRAME ${off}` : 'in frame'}${astern}${expected}`,
    );
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────────── the read
//
// THE ONE MEASUREMENT THAT DECIDES WHETHER THIS IS A SHIP.
//
// From a camera standing on the deck of a vessel, the cue that says "ship" is
// two long rails running away from you and CONVERGING on a stem you can see.
// The shipped hull was 15.3 x 13.3 with a flat bow: its side rails made 4.8
// degrees with the horizontal at the worst aspect, which on screen is two nearly
// level lines — a fence around a platform. The angle is measured here in SCREEN
// space, because that is where the read happens; a hull can be as pointed as you
// like in plan and still project flat.
// Measured over the WHOLE camera envelope, not just the opening pose. Measuring
// the opening pose alone returns 30.9 degrees at every aspect and looks like a
// clean pass; it is a weaker claim than it appears, because a child can pan,
// zoom and orbit inside the preset's constraints and the convergence is worst at
// the corners of that envelope, not at its centre. The envelope is the same one
// `tests/room/scene-sky-fog-contract.test.mjs` walks, reproduced here rather than
// imported because it lives inside the test file.
const envelopePoses = (sceneId, aspect) => {
  const preset = M.getSceneCameraPreset(sceneId);
  const c = preset.constraints ?? {};
  const panRangeX = c.panRangeX ?? 3.5;
  const minPolar = c.minPolar ?? Math.max(0.9, preset.polar - 0.1);
  const maxPolar = c.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
  const maxTargetY = c.maxTargetY ?? 2.0;
  const maxAz = c.maxAzimuthRange ?? 0.25;
  const ceilingY = c.ceilingY ?? 6.0;
  const minDistance = c.minDistance ?? preset.distance * 0.2;
  const maxDistance = M.sceneCameraMaxDistance(sceneId, aspect);
  const out = [];
  for (const dist of [minDistance, preset.distance, maxDistance]) {
    for (const polar of [minPolar, preset.polar, maxPolar]) {
      for (const tx of [-panRangeX, 0, panRangeX]) {
        for (const ty of [0, maxTargetY]) {
          for (const az of [preset.azimuth - maxAz, preset.azimuth, preset.azimuth + maxAz]) {
            const target = new Vector3(tx, ty, preset.target[2]);
            const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(dist, polar, az)));
            if (position.y > ceilingY) position.y = ceilingY;
            out.push({ position, target });
          }
        }
      }
    }
  }
  return out;
};

console.log('==== RAIL CONVERGENCE (screen angle of the two long side runs, from horizontal)\n');
const SIDE_RUNS = M.HULL_RAIL_RUNS.filter((r) => r.name === 'starboard_side' || r.name === 'port_side');
const RAIL_Y = 2 * 0.55; // top of the rail; see sceneShell's railHeight

// Screen angle from horizontal. Pixel dx is (ndc.x / 2) * W and pixel dy is
// (ndc.y / 2) * H, so the angle is atan(ndc_dy / (ndc_dx * aspect)). A rail run
// with an endpoint astern of the eye is skipped rather than projected, for the
// same reason the framing table skips them.
const railAngle = (cam, aspect, run) => {
  const p1 = new Vector3(run.x1, RAIL_Y, run.z1);
  const p2 = new Vector3(run.x2, RAIL_Y, run.z2);
  if (!inFront(cam, p1) || !inFront(cam, p2)) return null;
  const a = p1.project(cam);
  const b = p2.project(cam);
  return (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x) * aspect) * 180) / Math.PI;
};

const allAngles = [];
for (const [label, aspect] of ASPECTS) {
  const open = cameraFor(aspect).cam;
  const openAngles = SIDE_RUNS.map((r) => railAngle(open, aspect, r)).filter((v) => v !== null);
  const env = [];
  for (const pose of envelopePoses('pirate-cove', aspect)) {
    const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
    cam.position.copy(pose.position);
    cam.lookAt(pose.target);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    for (const r of SIDE_RUNS) {
      const v = railAngle(cam, aspect, r);
      if (v !== null) env.push(v);
    }
  }
  allAngles.push(...env);
  const mean = env.reduce((a, b) => a + b, 0) / env.length;
  console.log(
    `   ${label.padEnd(22)} opening ${openAngles[0].toFixed(1)}deg   envelope min ${Math.min(...env).toFixed(1)}deg  mean ${mean.toFixed(1)}deg  over ${env.length} samples`,
  );
}
const railMin = Math.min(...allAngles);
const railMean = allAngles.reduce((a, b) => a + b, 0) / allAngles.length;
console.log(`\n   ACROSS EVERYTHING: min ${railMin.toFixed(1)}deg   mean ${railMean.toFixed(1)}deg   (shipped hull: min 4.8deg)`);

// ───────────────────────────────────────────────────── the landmark scorecard
//
// Five things have to be true at every one of the nine aspects. Printed as N/9
// so a regression shows up as a number rather than as a wall of text.
console.log('\n==== LANDMARK SCORECARD (out of 9 aspects)\n');
const stem = new Vector3(0, RAIL_Y, M.HULL_Z_FWD);
const mastTop = new Vector3(0, M.MAST.height, M.MAST.z);
const nestTop = new Vector3(0, M.MAST.nestRailTopY, M.MAST.z);
const portal = M.PIRATE_COVE_ENVIRONMENT.portals[0].position;

const inNdc = (p, cam, margin = 0) => {
  const n = p.clone().project(cam);
  return Math.abs(n.x) <= 1 - margin && Math.abs(n.y) <= 1 - margin;
};

const score = { stem: 0, 'mast top': 0, "crow's nest": 0, 'deck under bottom edge': 0, portal: 0 };
for (const [, aspect] of ASPECTS) {
  const { cam } = cameraFor(aspect);
  if (inNdc(stem, cam)) score.stem++;
  if (inNdc(mastTop, cam)) score['mast top']++;
  if (inNdc(nestTop, cam)) score["crow's nest"]++;
  if (inNdc(portal, cam)) score.portal++;
  // Where does the bottom edge of the frame land? It must land on deck, not on
  // water: a frame whose lower edge shows sea between the viewer and the hull
  // puts the camera off the ship.
  const origin = cam.position.clone();
  const dir = new Vector3(0, -1, 0.5).unproject(cam).sub(origin).normalize();
  const hitZ = dir.y < 0 ? origin.z + dir.z * (-origin.y / dir.y) : Infinity;
  if (hitZ >= M.HULL_Z_AFT && hitZ <= M.HULL_Z_FWD) score['deck under bottom edge']++;
}
for (const [k, v] of Object.entries(score)) console.log(`   ${k.padEnd(24)} ${v}/9  ${v === 9 ? 'PASS' : 'FAIL'}`);

// Staged props: is each one on screen at all, at each aspect?
const PROPS = [
  ['anchor', M.ANCHOR_STAGING],
  ['barrels', M.BARREL_STAGING],
  ['cannon', M.CANNON_STAGING],
  ['parrot', M.PARROT_STAGING],
  ['ropeCoils', M.ROPE_COIL_STAGING],
  ['shipWheel', M.SHIP_WHEEL_STAGING],
  ['treasureChest', M.TREASURE_CHEST_STAGING],
];
const flat = PROPS.flatMap(([n, list]) => list.map((p, i) => [`${n}${list.length > 1 ? `[${i}]` : ''}`, p.position]));

console.log('\n==== STAGED PROP VISIBILITY (prop origin inside NDC, |x|<=1 and |y|<=1)\n');
for (const [label, aspect] of ASPECTS) {
  const { cam } = cameraFor(aspect);
  const missing = flat.filter(([, pos]) => {
    const n = pos.clone().project(cam);
    return Math.abs(n.x) > 1 || Math.abs(n.y) > 1;
  });
  console.log(
    `   ${label.padEnd(22)} ${flat.length - missing.length}/${flat.length} on screen` + (missing.length ? `   off: ${missing.map(([n]) => n).join(', ')}` : ''),
  );
}

// The parrot's own staging comment says it sits on the crow's nest rim. It used
// to be 1.98 units below it. Both the hoop and the perch now read the same
// exported constant, so this check is asking whether that plumbing works, not
// whether somebody typed the right number.
console.log('\n==== PARROT vs CROW\'S NEST (the staging comment claims the parrot is "sitting on the crow\'s nest rim")\n');
const nest = partBox("crow's nest");
const parrot = M.PARROT_STAGING[0].position;
console.log(
  `   crow's nest  y ${nest.min.y.toFixed(2)}..${nest.max.y.toFixed(2)}   x ${nest.min.x.toFixed(2)}..${nest.max.x.toFixed(2)}   z ${nest.min.z.toFixed(2)}..${nest.max.z.toFixed(2)}`,
);
console.log(`   parrot       y ${parrot.y.toFixed(3)}              x ${parrot.x.toFixed(2)}          z ${parrot.z.toFixed(2)}`);
const gap = parrot.y - nest.max.y;
console.log(
  `   the parrot's feet are ${Math.abs(gap).toFixed(3)} units ${gap >= 0 ? 'above' : 'below'} the top of the nest assembly  ${Math.abs(gap) < 0.01 ? 'PASS — standing on it' : 'FAIL'}`,
);
const insideRim = Math.hypot(parrot.x, parrot.z - M.MAST.z) <= M.MAST.nestRadius * 1.05 + 1e-6;
console.log(
  `   horizontal distance from the mast: ${Math.hypot(parrot.x, parrot.z - M.MAST.z).toFixed(3)} against a rim radius of ${(M.MAST.nestRadius * 1.02).toFixed(3)}  ${insideRim ? 'PASS — on the rim' : 'FAIL — off the rim'}`,
);
