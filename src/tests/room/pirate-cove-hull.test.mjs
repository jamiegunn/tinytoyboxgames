/**
 * Pirate Cove's ship must read as a ship, and every claim its source makes about
 * itself must be true of the geometry it actually builds.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * The shipped scene put the camera on the deck of a vessel that was 15.3 units
 * wide and 13.3 long — beam:length 1 : 0.87, WIDER THAN IT WAS LONG — with a flat
 * transom at both ends, the forward one 7.5 units across, 49% of the beam. From
 * on deck, the one cue that says "ship" rather than "yard" is two long rails
 * running away from you and converging on a stem you can see. Measured on the
 * built shell, those rails made 4.8 degrees with the horizontal at the worst
 * reachable pose. That is two nearly level lines: a fence around a platform.
 *
 * The masthead was cropped at 0 of 9 shipping aspects. So was the crow's nest.
 * A child on any device saw a mast that left the top of the screen and never
 * arrived anywhere.
 *
 * WHY THE ASSERTIONS BELOW ARE ABOUT SCREEN SPACE
 * -----------------------------------------------
 * "The hull is pointed" is a fact about plan geometry and is not the thing that
 * was wrong. A hull can be as fine forward as you like and still project as two
 * horizontal lines, because whether the rails converge on screen is a joint
 * property of the HULL AND THE CAMERA. Solving them in sequence is exactly what
 * produced the shipped defect. So the rail assertion is made in screen space, at
 * every aspect, across the reachable camera envelope — not on the plan.
 *
 * WHY THE SUITE INSTANTIATES THE REAL SHELL
 * -----------------------------------------
 * `.probe/pc-hull-solve.mjs` works on a PLAN MODEL of the hull, and its estimate
 * was wrong: it predicted a worst-case rail angle of 14.0 degrees where the built
 * shell measures 11.4. Asserting against the plan would have locked in the
 * prediction rather than the ship. Every number below is read off meshes
 * `createSceneShell` actually builds, with poses from the app's own
 * `resolveSceneCameraPose`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';

const {
  stageAspectFor,
  SCENE_CAMERA_FOV,
  resolveSceneCameraPose,
  sceneCameraMaxDistance,
  getSceneCameraPreset,
  PIRATE_COVE_ENVIRONMENT,
  PIRATE_COVE_SKY_FOG,
  createPirateCoveMaterials,
  createSceneShell,
  HULL_PLAN,
  HULL_OUTLINE,
  HULL_RAIL_RUNS,
  HULL_Z_AFT,
  HULL_Z_FWD,
  MAST,
  hullHalfWidthAt,
  ANCHOR_STAGING,
  BARREL_STAGING,
  CANNON_STAGING,
  PARROT_STAGING,
  ROPE_COIL_STAGING,
  SHIP_WHEEL_STAGING,
  TREASURE_CHEST_STAGING,
  resolveRotationRange,
} = await bundleEntry(
  'pirate-cove-hull',
  `
  export { stageAspectFor } from './src/utils/scene/stageRect';
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose, sceneCameraMaxDistance } from './src/utils/cameraPresets';
  export { resolveRotationRange } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { PIRATE_COVE_ENVIRONMENT, PIRATE_COVE_SKY_FOG } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell';
  export { HULL_PLAN, HULL_OUTLINE, HULL_RAIL_RUNS, HULL_Z_AFT, HULL_Z_FWD, MAST, hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
  export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
  export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
  export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
  export { PARROT_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/parrot';
  export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
  export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
  export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
`,
);

// THE ASPECTS THE CAMERA CAN ACTUALLY BE GIVEN, not the aspects a device can
// have. The stage is letterboxed (see src/utils/scene/stageRect.ts): outside a
// 1.0-1.4 band the leftover viewport becomes chrome rather than scene, so a
// 0.40 phone renders a 1.00 stage. This list used to be nine raw device aspects,
// five of which the camera can no longer be handed at all — and asserting
// against a state the app cannot reach is how a suite comes to look thorough
// while covering less than it claims. Derived from `stageAspectFor` so that
// widening the band cannot leave it behind.
const SHIPPING_VIEWPORTS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['square 800x800', 800, 800],
  ['iPad portrait 768x1024', 768, 1024],
  ['viewport 480x854', 480, 854],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 400x1000', 400, 1000],
];
const ASPECTS = SHIPPING_VIEWPORTS.map(([label, w, h]) => [`${label} -> stage ${stageAspectFor(w, h).toFixed(2)}`, stageAspectFor(w, h)]);

// ── the real ship, built once ───────────────────────────────────────────────
const scene = new Scene();
const shell = createSceneShell(scene, { wallHeight: 2, materials: createPirateCoveMaterials() });
shell.updateMatrixWorld(true);

const meshBoxes = (predicate) => {
  const out = [];
  shell.traverse((o) => {
    if (o.isMesh && predicate(o.name)) out.push(new Box3().setFromObject(o));
  });
  return out;
};
const unionBox = (boxes) => boxes.reduce((acc, b) => acc.union(b), new Box3().makeEmpty());

const camAt = (position, target, aspect) => {
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

const openingCam = (aspect) => {
  const pose = resolveSceneCameraPose('pirate-cove', aspect);
  return camAt(pose.position, pose.target, aspect);
};

// Reproduced from scene-sky-fog-contract.test.mjs, which reproduces it because
// it lives inside a test file. Same envelope, so the two suites cannot disagree
// about where a child can put the camera.
const envelopePoses = (aspect) => {
  const preset = getSceneCameraPreset('pirate-cove');
  const c = preset.constraints ?? {};
  const minPolar = c.minPolar ?? Math.max(0.9, preset.polar - 0.1);
  const maxPolar = c.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
  // THE TARGET IS FIXED. Panning was removed outright — a drag turns the room
  // now — so the reachable set is distance x tilt x turn. The turn is asked of
  // the app rather than read off the preset: rotation range stopped being
  // per-scene data when the Playroom was found to be authored a third wider
  // than its own walls allow — see utils/scene/rotationRange.
  const maxAz = resolveRotationRange();
  const ceilingY = c.ceilingY ?? 6.0;
  const minDistance = c.minDistance ?? preset.distance * 0.2;
  const maxDistance = sceneCameraMaxDistance('pirate-cove', aspect);
  const out = [];
  const target = new Vector3(...preset.target);
  for (const dist of [minDistance, preset.distance, maxDistance]) {
    for (const polar of [minPolar, preset.polar, maxPolar]) {
      for (const az of [preset.azimuth - maxAz, preset.azimuth, preset.azimuth + maxAz]) {
        const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(dist, polar, az)));
        if (position.y > ceilingY) position.y = ceilingY;
        out.push({ position, target });
      }
    }
  }
  return out;
};

// `project` divides by w, which is negative behind the eye, so a point astern
// comes back with its NDC negated and unbounded. The camera stands ON the deck —
// the transom is 0.6 units behind it — so this is not an edge case here, it is
// the normal condition for part of the hull.
const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
const inFrame = (cam, p) => {
  if (!inFront(cam, p)) return false;
  const n = p.clone().project(cam);
  return Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1;
};

// ── 1. the hull is a hull ───────────────────────────────────────────────────

test('the hull is longer than it is wide, by enough to read as a vessel', () => {
  const ratio = HULL_PLAN.length / HULL_PLAN.beam;
  assert.ok(
    ratio >= 2,
    `beam:length is 1 : ${ratio.toFixed(2)}. The shipped hull was 1 : 0.87 — wider than it was long — ` +
      `and that is the single fact that made it read as a fenced platform rather than a ship.`,
  );
});

test('the hull comes to a point forward — there is a stem, not a second transom', () => {
  assert.equal(hullHalfWidthAt(HULL_Z_FWD), 0, 'the forward-most station must have zero width: that is what a stem is');
  const stemIsInOutline = HULL_OUTLINE.some(([x, z]) => x === 0 && z === HULL_Z_FWD);
  assert.ok(stemIsInOutline, 'the stem must be a vertex of HULL_OUTLINE, so rails and deck plane converge on the same point');
  // The old bow was 7.5 wide, 49% of a 15.3 beam. Nothing forward of the maximum
  // beam station may be anywhere near that fraction.
  const quarterForward = HULL_Z_FWD - (HULL_Z_FWD - 0) * 0.25;
  const w = hullHalfWidthAt(quarterForward) * 2;
  assert.ok(w < HULL_PLAN.beam * 0.3, `the hull is still ${((w / HULL_PLAN.beam) * 100).toFixed(0)}% of its beam a quarter of the way aft of the stem`);
});

test('the built shell matches the plan it is supposed to be built from', () => {
  const rails = unionBox(meshBoxes((n) => n.startsWith('railing_')));
  // Rail posts have radius, so the built box is slightly larger than the plan.
  const beam = rails.max.x - rails.min.x;
  const length = rails.max.z - rails.min.z;
  assert.ok(Math.abs(beam - HULL_PLAN.beam) < 0.5, `built beam ${beam.toFixed(2)} vs plan ${HULL_PLAN.beam}`);
  assert.ok(Math.abs(length - HULL_PLAN.length) < 0.5, `built length ${length.toFixed(2)} vs plan ${HULL_PLAN.length}`);
});

// ── 2. the rails converge on screen ─────────────────────────────────────────

// Screen angle from horizontal. Pixel dx is (ndc.x / 2) * W and dy is
// (ndc.y / 2) * H, so the angle is atan(ndc_dy / (ndc_dx * aspect)).
const railScreenAngle = (cam, aspect, run, y) => {
  const p1 = new Vector3(run.x1, y, run.z1);
  const p2 = new Vector3(run.x2, y, run.z2);
  if (!inFront(cam, p1) || !inFront(cam, p2)) return null;
  const a = p1.project(cam);
  const b = p2.project(cam);
  return (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x) * aspect) * 180) / Math.PI;
};

const SIDE_RUNS = HULL_RAIL_RUNS.filter((r) => r.name === 'starboard_side' || r.name === 'port_side');
const RAIL_TOP_Y = 2 * 0.55;

test('the two side rails converge on screen at every aspect, at the opening pose', () => {
  for (const [label, aspect] of ASPECTS) {
    const cam = openingCam(aspect);
    for (const run of SIDE_RUNS) {
      const deg = railScreenAngle(cam, aspect, run, RAIL_TOP_Y);
      assert.notEqual(deg, null, `${label}: ${run.name} is not in front of the camera at the opening pose`);
      assert.ok(deg >= 20, `${label}: ${run.name} makes only ${deg.toFixed(1)} degrees with the horizontal (shipped hull: 4.8)`);
    }
  }
});

test('the side rails still converge at the worst corner of the reachable camera envelope', () => {
  // The opening pose is the easy case and measures 30.9 degrees on every aspect.
  // A child can pan, zoom and orbit; the read has to survive that, which is where
  // the shipped hull's 4.8 came from.
  let worst = { deg: Infinity };
  for (const [label, aspect] of ASPECTS) {
    for (const pose of envelopePoses(aspect)) {
      const cam = camAt(pose.position, pose.target, aspect);
      for (const run of SIDE_RUNS) {
        const deg = railScreenAngle(cam, aspect, run, RAIL_TOP_Y);
        if (deg !== null && deg < worst.deg) worst = { deg, label, run: run.name };
      }
    }
  }
  assert.ok(
    worst.deg >= 10,
    `worst reachable rail angle is ${worst.deg.toFixed(1)} degrees (${worst.run} at ${worst.label}). ` +
      `The shipped hull's worst was 4.8; anything approaching that is a fence again.`,
  );
});

// ── 3. the landmarks stay in frame ──────────────────────────────────────────

test("stem, masthead and crow's nest are in frame at every shipping aspect", () => {
  const landmarks = [
    ['the stem', new Vector3(0, RAIL_TOP_Y, HULL_Z_FWD)],
    ['the masthead', new Vector3(0, MAST.height, MAST.z)],
    ["the crow's nest", new Vector3(0, MAST.nestRailTopY, MAST.z)],
  ];
  for (const [label, aspect] of ASPECTS) {
    const cam = openingCam(aspect);
    for (const [what, p] of landmarks) {
      assert.ok(inFrame(cam, p), `${what} is off-frame at ${label}. The shipped rig cropped the masthead and the nest at 0 of 9 aspects.`);
    }
  }
});

test('the bottom edge of the frame lands on deck, not on water', () => {
  // A frame whose lower edge shows sea between the viewer and the hull puts the
  // camera off the ship, which is the opposite of the scene's premise. Vertical
  // FOV does not vary with aspect, so this line is identical on all nine — but it
  // is asserted on all nine anyway, because that invariance is a property of the
  // current projection setup and not a law.
  for (const [label, aspect] of ASPECTS) {
    const cam = openingCam(aspect);
    const origin = cam.position.clone();
    const dir = new Vector3(0, -1, 0.5).unproject(cam).sub(origin).normalize();
    assert.ok(dir.y < 0, `${label}: the bottom-centre ray does not point downward`);
    const hitZ = origin.z + dir.z * (-origin.y / dir.y);
    assert.ok(hitZ >= HULL_Z_AFT && hitZ <= HULL_Z_FWD, `${label}: the bottom edge of the frame meets y=0 at z ${hitZ.toFixed(2)}, which is off the hull`);
  }
});

test('the game portal is in frame at every shipping aspect', () => {
  for (const [label, aspect] of ASPECTS) {
    const cam = openingCam(aspect);
    for (const portal of PIRATE_COVE_ENVIRONMENT.portals) {
      assert.ok(inFrame(cam, portal.position), `portal '${portal.gameId}' is off-frame at ${label}`);
    }
  }
});

// ── 4. the fog does not haze its own subject ────────────────────────────────

test('no part of the ship is inside the fog', () => {
  // scene-sky-fog-contract.test.mjs asserts that portals and the play centre stay
  // clear and that the backdrop hazes. It makes no claim about the SHIP, because
  // when it was written the ship was small enough that the question never arose.
  // The hull is now 24 units long and its stem reaches a view-space depth of
  // 24.07 — past where `fog.near` used to start. This is the assertion that would
  // have caught that.
  // The fog lives on its own export, NOT on the environment — `PIRATE_COVE_SKY_FOG`,
  // which is what `scene-sky-fog-contract.test.mjs` reads. Guessing the accessor is
  // how this test first failed; the guard below is what caught the guess.
  const fog = PIRATE_COVE_SKY_FOG.fog;
  assert.ok(fog && typeof fog.near === 'number', 'pirate-cove must declare a fog near plane');
  const shipPoints = [];
  for (const [x, z] of HULL_OUTLINE) {
    shipPoints.push([`hull (${x}, ${z}) deck`, new Vector3(x, 0, z)]);
    shipPoints.push([`hull (${x}, ${z}) rail`, new Vector3(x, RAIL_TOP_Y, z)]);
  }
  shipPoints.push(['masthead', new Vector3(0, MAST.height, MAST.z)]);
  shipPoints.push(['yardarm tip', new Vector3(MAST.yardSpan / 2, MAST.yardY, MAST.z)]);

  // three.js fogs on view-space depth: `vFogDepth = -mvPosition.z`. Not world
  // distance, not distance from the origin.
  let deepest = { depth: -Infinity };
  for (const [, aspect] of ASPECTS) {
    for (const pose of envelopePoses(aspect)) {
      const cam = camAt(pose.position, pose.target, aspect);
      for (const [what, p] of shipPoints) {
        const depth = -p.clone().applyMatrix4(cam.matrixWorldInverse).z;
        if (depth > deepest.depth) deepest = { depth, what, aspect };
      }
    }
  }
  assert.ok(
    deepest.depth < fog.near,
    `${deepest.what} reaches a view depth of ${deepest.depth.toFixed(2)} but fog starts at ${fog.near}. The ship is fogging itself.`,
  );
});

// ── 5. every prop is on the ship it is staged on ────────────────────────────

const ALL_STAGING = [
  ['anchor', ANCHOR_STAGING],
  ['barrels', BARREL_STAGING],
  ['cannon', CANNON_STAGING],
  ['ropeCoils', ROPE_COIL_STAGING],
  ['shipWheel', SHIP_WHEEL_STAGING],
  ['treasureChest', TREASURE_CHEST_STAGING],
];

test('every deck prop stands on the deck, inside the rails', () => {
  // The shipped anchor sat at x -4.5, which on this hull is 0.15 units OUTSIDE
  // the port rail at its own station: it hung over the water. Half-width is read
  // at the prop's OWN z, because the hull tapers — the same x is inside the rail
  // amidships and over the sea forward.
  for (const [name, list] of ALL_STAGING) {
    list.forEach((p, i) => {
      const label = list.length > 1 ? `${name}[${i}]` : name;
      const hw = hullHalfWidthAt(p.position.z);
      assert.notEqual(hw, null, `${label} is at z ${p.position.z}, which is off the ends of the hull`);
      assert.ok(Math.abs(p.position.x) < hw, `${label} at x ${p.position.x} is outside the hull's half-width of ${hw.toFixed(2)} at z ${p.position.z}`);
      assert.equal(p.position.y, 0, `${label} is not standing on the deck`);
    });
  }
});

test('every staged prop is on screen at every shipping aspect', () => {
  const flat = [...ALL_STAGING, ['parrot', PARROT_STAGING]].flatMap(([n, list]) => list.map((p, i) => [list.length > 1 ? `${n}[${i}]` : n, p.position]));
  for (const [label, aspect] of ASPECTS) {
    const cam = openingCam(aspect);
    for (const [what, pos] of flat) {
      assert.ok(inFrame(cam, pos), `${what} is off screen at ${label}`);
    }
  }
});

// ── 6. the parrot is where its own comment says it is ───────────────────────

test("the parrot is actually standing on the crow's nest rim", () => {
  // This is the assertion the source used to make in prose and get wrong. The
  // staging said "sitting on the crow's nest rim" and put the bird at y 3.85; the
  // rim was at 5.83, so it hung in mid-air beside the sail, wrong by 1.98 units.
  // A comment was the only thing asserting the relationship. Now `MAST.nestRailTopY`
  // is read by both the shell that builds the hoop and the staging that seats the
  // bird, and this test is what proves the plumbing rather than the number.
  const nest = unionBox(meshBoxes((n) => n === 'crows_nest' || n === 'crows_nest_rail'));
  const parrot = PARROT_STAGING[0].position;
  assert.ok(
    Math.abs(parrot.y - nest.max.y) < 0.01,
    `the parrot's feet are at y ${parrot.y.toFixed(3)} and the top of the nest assembly is at ${nest.max.y.toFixed(3)}`,
  );
  const outFromMast = Math.hypot(parrot.x, parrot.z - MAST.z);
  assert.ok(
    Math.abs(outFromMast - MAST.nestRadius * 1.02) < 0.02,
    `the parrot is ${outFromMast.toFixed(3)} from the mast, but the rim it is documented as sitting on is at ${(MAST.nestRadius * 1.02).toFixed(3)}`,
  );
});

test('the parrot does not intersect the masthead pennant', () => {
  // Three of the sixteen seats around the rim put the flag through the bird —
  // the pennant flies to starboard from the truck, so the whole starboard beam is
  // occupied. Measured against the parrot's staged box rather than assumed.
  const pennant = shell.getObjectByName('ship_pennant');
  assert.ok(pennant, 'ship_pennant is missing from the shell');
  const flag = new Box3().setFromObject(pennant);
  const parrot = PARROT_STAGING[0];
  // A generous box around the staged bird: half its scale in every direction from
  // the perch, which over-claims rather than under-claims the space it occupies.
  const r = 0.45 * parrot.scale;
  const bird = new Box3(
    new Vector3(parrot.position.x - r, parrot.position.y, parrot.position.z - r),
    new Vector3(parrot.position.x + r, parrot.position.y + 0.75 * parrot.scale, parrot.position.z + r),
  );
  assert.ok(!flag.intersectsBox(bird), 'the masthead pennant passes through the parrot');
});
