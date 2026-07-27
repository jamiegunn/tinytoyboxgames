// Round 3 fix solver, pass 2: sweep the CAMERA PRESET jointly with the hull plan.
//
// WHY A SECOND PASS EXISTS
// ------------------------
// Pass 1 (`pc-hull-plan.mjs`) held the shipped preset fixed and varied only the
// hull. Every candidate came back `mast top 0/8, crow's nest 0/8` -- WORSE than
// the shipped 1.25 NDC, at 1.32..1.46 -- and the reason is visible in its own
// output: `camZ -9.3` on all thirty-two rows. The camera never moved, so the
// crop never moved. The vertical field of view is 50 degrees and it does not
// depend on aspect; `maxDistance: 10` pins the radius at 10 at every aspect.
// The vertical crop is therefore ONE number, not eight, and the only things that
// can change it are the polar angle, the target height, the orbit radius and the
// mast's own dimensions.
//
// The closed form, for a camera at spherical (r, polar, azimuth=PI) about a
// target at (0, ty, 0), with no ceiling clamp:
//
//   camY = ty + r*cos(polar)      camZ = -r*sin(polar)
//   pitch below horizontal  P = 90deg - polar          (exactly; atan(cot polar))
//   mast-top angle above horizontal  A = atan((mastH - camY) / (mastZ - camZ))
//   the mast top is in frame  <=>  A + P <= 25deg      (half of SCENE_CAMERA_FOV)
//
// At the shipped values P = 21.25deg, so A must be under 3.75deg, which needs
// the mast top 31.7 units away. That is why pass 1 could not win: it was
// searching the wrong variable.
//
// SELF-CHECK
// ----------
// This probe models a camera pose for presets that do not exist in the catalog,
// so it cannot call `resolveSceneCameraPose`. That is the exact duplication this
// round is prosecuting, so the model is CHECKED against the shipped resolver on
// the shipped preset before any candidate is scored. If they ever disagree the
// probe aborts rather than print numbers.
import assert from 'node:assert/strict';
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-hull-solve',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose, distanceMultiplierForAspect } from './src/utils/cameraPresets';
   export { getSceneCameraPreset } from './src/scenes/sceneCatalog';`,
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
const N = ASPECTS.length;

// The pose model. Mirrors cameraPresets.resolveSceneCameraPose; asserted equal
// to it below on the shipped preset.
function poseFor(preset, aspect) {
  const mult = M.distanceMultiplierForAspect(aspect);
  const minD = preset.minDistance ?? preset.distance * 0.2;
  const maxD = preset.maxDistance ?? preset.distance * mult;
  const radius = MathUtils.clamp(preset.distance * mult, minD, maxD);
  const target = new Vector3(preset.target[0], preset.target[1], preset.target[2]);
  const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth)));
  const ceilingY = preset.ceilingY ?? 6.0;
  if (position.y > ceilingY) position.y = ceilingY;
  return { position, target, radius };
}

{
  const shipped = M.getSceneCameraPreset('pirate-cove');
  const asPreset = { ...shipped, ...shipped.constraints };
  for (const [label, aspect] of ASPECTS) {
    const mine = poseFor(asPreset, aspect);
    const theirs = M.resolveSceneCameraPose('pirate-cove', aspect);
    assert.ok(mine.position.distanceTo(theirs.position) < 1e-9, `pose model disagrees with resolveSceneCameraPose at ${label}`);
    assert.ok(Math.abs(mine.radius - theirs.radius) < 1e-9, `radius model disagrees at ${label}`);
  }
  console.log('self-check: pose model == resolveSceneCameraPose on the shipped preset, at all 9 aspects.\n');
}

const camFor = (preset, aspect) => {
  const pose = poseFor(preset, aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 200);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return { cam, pose };
};

const ndc = (cam, x, y, z) => new Vector3(x, y, z).project(cam);
const inFrame = (n) => Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 && n.z <= 1;

// Half-width of the hull at a given z. Transom aft at -L/2, maximum beam some
// way forward of it, stem point at +L/2. z increases toward the bow.
function halfWidthAt(plan, z) {
  const zAft = -plan.length / 2;
  const zFwd = plan.length / 2;
  const zBeam = zAft + plan.length * plan.maxBeamAt;
  if (z < zAft || z > zFwd) return null;
  if (z <= zBeam) return MathUtils.lerp(plan.transomWidth / 2, plan.beam / 2, (z - zAft) / (zBeam - zAft));
  return MathUtils.lerp(plan.beam / 2, 0, (z - zBeam) / (zFwd - zBeam));
}

// Screen-space angle from horizontal of the port rail, between its first and
// last in-frame sample. A rail that runs across the frame is a fence; a rail
// that runs away from the viewer is a ship.
function railAngle(cam, plan, railY) {
  const pts = [];
  for (let i = 0; i <= 60; i += 1) {
    const z = MathUtils.lerp(-plan.length / 2, plan.length / 2, i / 60);
    const hw = halfWidthAt(plan, z);
    if (hw === null) continue;
    const n = ndc(cam, -hw, railY, z);
    if (n.z > 1) continue;
    pts.push(n);
  }
  const vis = pts.filter(inFrame);
  if (vis.length < 2) return null;
  const a = vis[0];
  const b = vis[vis.length - 1];
  return (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI;
}

// Where the bottom-centre view ray meets y = 0. This is the contract in
// tests/room/scene-ground-coverage.test.mjs: "the near half of the opening frame
// is playable surface, not backdrop".
function bottomCentreHit(cam) {
  const near = new Vector3(0, -1, -1).unproject(cam);
  const far = new Vector3(0, -1, 1).unproject(cam);
  const dir = far.sub(near);
  if (Math.abs(dir.y) < 1e-9 || dir.y >= 0) return null;
  const t = -near.y / dir.y;
  if (t < 0) return null;
  return near.add(dir.multiplyScalar(t));
}

function evaluate(plan, preset, mast, portalZ) {
  const r = { stem: 0, mastTop: 0, nest: 0, deck: 0, portal: 0, angles: [], rows: [] };
  for (const [label, aspect] of ASPECTS) {
    const { cam, pose } = camFor(preset, aspect);
    const stem = ndc(cam, 0, 0.9, plan.length / 2); // stem head, at rail height
    const mastTop = ndc(cam, 0, mast.height, mast.z);
    const nest = ndc(cam, 0, mast.height * 0.85, mast.z);
    const portal = ndc(cam, 0, 0.3, portalZ);
    const hit = bottomCentreHit(cam);
    const onDeck = hit !== null && Math.abs(hit.x) <= plan.beam / 2 && Math.abs(hit.z) <= plan.length / 2 && Math.abs(hit.x) <= (halfWidthAt(plan, hit.z) ?? 0);
    if (inFrame(stem)) r.stem += 1;
    if (inFrame(mastTop)) r.mastTop += 1;
    if (inFrame(nest)) r.nest += 1;
    if (onDeck) r.deck += 1;
    if (inFrame(portal)) r.portal += 1;
    const ra = railAngle(cam, plan, 0.9);
    if (ra !== null) r.angles.push(ra);
    r.rows.push({ label, camY: pose.position.y, camZ: pose.position.z, stem, mastTop, nest, hit, onDeck, ra });
  }
  r.mean = r.angles.length ? r.angles.reduce((a, b) => a + b, 0) / r.angles.length : 0;
  r.minAngle = r.angles.length ? Math.min(...r.angles) : 0;
  // The camera must be standing on the ship, not swimming behind it.
  r.aboard = r.rows.every((row) => row.camZ >= -plan.length / 2 + 0.5);
  r.pass = r.stem === N && r.mastTop === N && r.nest === N && r.deck === N && r.portal === N && r.aboard;
  return r;
}

// ---------------------------------------------------------------- the sweep
const results = [];
for (const length of [18, 20, 22, 24, 26]) {
  for (const beam of [9, 10, 11]) {
    for (const maxBeamAt of [0.3, 0.36]) {
      const plan = { beam, length, transomWidth: beam * 0.6, maxBeamAt };
      for (const polar of [1.25, 1.3, 1.35, 1.4, 1.45, 1.5]) {
        for (const ty of [0.3, 0.6, 0.9, 1.2, 1.5]) {
          for (const distance of [9, 10, 11, 12, 13]) {
            for (const mastH of [5, 5.5, 6]) {
              for (const mastFrac of [0.15, 0.25, 0.35]) {
                const mast = { z: -length / 2 + length * (0.5 + mastFrac), height: mastH };
                const preset = {
                  azimuth: Math.PI,
                  polar,
                  distance,
                  minDistance: distance - 1,
                  maxDistance: distance,
                  target: [0, ty, 0],
                  ceilingY: 8,
                };
                const r = evaluate(plan, preset, mast, -4.2);
                if (r.pass) results.push({ plan, preset, mast, r });
              }
            }
          }
        }
      }
    }
  }
}

console.log(
  `sweep: ${results.length} candidates satisfy stem ${N}/${N}, mast top ${N}/${N}, nest ${N}/${N}, deck under the bottom edge ${N}/${N}, portal ${N}/${N}, camera aboard.\n`,
);

// The rail angle does not depend on the mast at all, so ranking by it alone
// leaves the mast free -- the first pass of this ranking tied `5.0 @ 3.9` with
// `6.0 @ 9.1`, which are very different ships. Break the tie on the mast: a
// taller mast nearer midship reads more like a ship, and the crop margin is what
// round 3 is trying to buy, so require some.
const mastScore = (c) => {
  const margin = Math.min(...c.r.rows.map((row) => 1 - row.mastTop.y)); // NDC headroom
  const midship = 1 - Math.abs(c.mast.z) / (c.plan.length / 2); // 1 at midship, 0 at the ends
  return { margin, midship, score: c.mast.height + midship * 2 + Math.min(margin, 0.35) * 2 };
};

// The frontier: for each hull size, the best worst-aspect rail angle reachable,
// so the write-up can justify the hull it picks against the ones it did not.
console.log('frontier -- best worst-aspect rail angle by hull size:\n');
console.log('   beam x length  ratio   best min rail   at polar / ty / d');
const byHull = new Map();
for (const c of results) {
  const key = `${c.plan.beam}x${c.plan.length}`;
  const prev = byHull.get(key);
  if (!prev || c.r.minAngle > prev.r.minAngle) byHull.set(key, c);
}
for (const [key, c] of [...byHull.entries()].sort((a, b) => b[1].r.minAngle - a[1].r.minAngle)) {
  console.log(
    `   ${key.padEnd(13)} 1:${(c.plan.length / c.plan.beam).toFixed(2)}   ${c.r.minAngle.toFixed(1).padStart(5)} deg      ${c.preset.polar} / ${c.preset.target[1]} / ${c.preset.distance}`,
  );
}
console.log('');

if (!results.length) {
  console.log('NONE. The criteria are jointly unsatisfiable over this sweep; widen it or drop a criterion.');
} else {
  // Rank by how strongly the rails converge -- that is the "this is a ship" cue
  // the charge says is missing -- then prefer the SMALLEST ship that achieves it,
  // because a longer hull spreads the props thinner.
  results.sort((a, b) => b.r.minAngle - a.r.minAngle || mastScore(b).score - mastScore(a).score || a.plan.length - b.plan.length);
  console.log('top 12 by worst-aspect rail angle, tie-broken on the mast:\n');
  console.log('  rail min/mean   hull beam x length (ratio)   polar  ty   d    mast h @ z   mast-top NDC headroom');
  for (const c of results.slice(0, 12)) {
    const ms = mastScore(c);
    console.log(
      `  ${c.r.minAngle.toFixed(1).padStart(5)} / ${c.r.mean.toFixed(1).padStart(5)} deg   ` +
        `${String(c.plan.beam).padStart(2)} x ${String(c.plan.length).padStart(2)} (1:${(c.plan.length / c.plan.beam).toFixed(2)})   ` +
        `${c.preset.polar.toFixed(2)}  ${c.preset.target[1].toFixed(1)}  ${String(c.preset.distance).padStart(2)}   ` +
        `${c.mast.height.toFixed(1)} @ ${c.mast.z.toFixed(1).padStart(5)}   ${ms.margin.toFixed(2)}`,
    );
  }

  const best = results[0];
  console.log('\n==== BEST CANDIDATE, per aspect\n');
  console.log(
    `  hull beam ${best.plan.beam} x length ${best.plan.length}  transom ${best.plan.transomWidth.toFixed(1)}  max beam ${(best.plan.maxBeamAt * 100).toFixed(0)}% aft of transom`,
  );
  console.log(
    `  preset polar ${best.preset.polar} target [0, ${best.preset.target[1]}, 0] distance ${best.preset.distance} (min ${best.preset.minDistance}, max ${best.preset.maxDistance}) ceiling ${best.preset.ceilingY}`,
  );
  console.log(`  mast height ${best.mast.height} at z ${best.mast.z.toFixed(2)}, crow's nest at y ${(best.mast.height * 0.85).toFixed(2)}\n`);
  for (const row of best.r.rows) {
    console.log(
      `   ${row.label.padEnd(22)} camY ${row.camY.toFixed(2)} camZ ${row.camZ.toFixed(2)}   ` +
        `stem y ${row.stem.y.toFixed(2)}  mastTop y ${row.mastTop.y.toFixed(2)}  nest y ${row.nest.y.toFixed(2)}   ` +
        `bottom-centre lands z ${row.hit ? row.hit.z.toFixed(2) : 'n/a'} ${row.onDeck ? 'ON DECK' : 'OFF'}   rail ${row.ra === null ? ' n/a' : `${row.ra.toFixed(0)}deg`}`,
    );
  }
}

// ------------------------------------------------------------------ the pick
//
// Not the sweep's top row. The top row is 9 x 26 (1:2.89), which wins the rail
// angle by being a needle: at beam 9 the deck is too narrow to stage barrels
// beside a walkway, and at length 26 a prop at the bow is 22 units from the eye.
// 10 x 24 keeps the deck area the scene has today (240 sq units against 224) and
// still triples the worst-aspect rail angle. The frontier above is printed so
// this trade is arguable rather than asserted.
console.log('\n\n==== THE PICK: beam 10 x length 24, polar 1.25, target y 1.5, distance 12\n');
const PICK_PLAN = { beam: 10, length: 24, transomWidth: 6, maxBeamAt: 0.3 };
const PICK_PRESET = { azimuth: Math.PI, polar: 1.25, distance: 12, minDistance: 11, maxDistance: 12, target: [0, 1.5, 0], ceilingY: 8 };
for (const mastZ of [2, 3.6, 5, 6]) {
  for (const mastH of [5.5, 6, 6.5, 7]) {
    const r = evaluate(PICK_PLAN, PICK_PRESET, { z: mastZ, height: mastH }, -4.2);
    const margin = Math.min(...r.rows.map((row) => 1 - row.mastTop.y));
    console.log(
      `   mast h ${mastH} @ z ${mastZ}:  mast top ${r.mastTop}/${N}  nest ${r.nest}/${N}  headroom ${margin.toFixed(2)} NDC   ${r.pass ? 'PASS' : 'FAIL'}`,
    );
  }
}
const PICK_MAST = { z: 3.6, height: 6.5 };
const pick = evaluate(PICK_PLAN, PICK_PRESET, PICK_MAST, -4.2);
console.log(`\n   chosen mast: height ${PICK_MAST.height} at z ${PICK_MAST.z}, crow's nest y ${(PICK_MAST.height * 0.85).toFixed(2)}`);
console.log(
  `   stem ${pick.stem}/${N}  mast top ${pick.mastTop}/${N}  nest ${pick.nest}/${N}  deck under bottom edge ${pick.deck}/${N}  portal ${pick.portal}/${N}`,
);
console.log(`   rail angle min ${pick.minAngle.toFixed(1)} deg, mean ${pick.mean.toFixed(1)} deg\n`);
for (const row of pick.rows) {
  console.log(
    `   ${row.label.padEnd(22)} camY ${row.camY.toFixed(2)} camZ ${row.camZ.toFixed(2)}   ` +
      `stem ndc(${row.stem.x.toFixed(2)},${row.stem.y.toFixed(2)})  mastTop y ${row.mastTop.y.toFixed(2)}  nest y ${row.nest.y.toFixed(2)}   ` +
      `bottom-centre z ${row.hit ? row.hit.z.toFixed(2) : 'n/a'} ${row.onDeck ? 'ON DECK' : 'OFF'}   rail ${row.ra === null ? ' n/a' : `${row.ra.toFixed(0)}deg`}`,
  );
}

// Where can props live? The deck band that is inside the frame at EVERY aspect.
console.log('\n   deck band visible at all 9 aspects (prop staging envelope):');
for (const z of [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10]) {
  const hw = halfWidthAt(PICK_PLAN, z) ?? 0;
  let allIn = true;
  let minAbsX = Infinity;
  for (const [, aspect] of ASPECTS) {
    const { cam } = camFor(PICK_PRESET, aspect);
    const centre = ndc(cam, 0, 0.4, z);
    if (!inFrame(centre)) allIn = false;
    // widest |x| at this z that stays in frame at this aspect
    let ok = 0;
    for (let x = 0; x <= hw; x += 0.1) if (inFrame(ndc(cam, x, 0.4, z))) ok = x;
    minAbsX = Math.min(minAbsX, ok);
  }
  console.log(
    `     z ${String(z).padStart(3)}  hull half-width ${hw.toFixed(2)}   centreline ${allIn ? 'in frame' : 'OFF FRAME'}   props stay in frame out to |x| <= ${minAbsX.toFixed(1)}`,
  );
}

// ------------------------------------------------- what ships today, for scale
console.log('\n==== BASELINE (shipped hull as a plan, shipped preset)\n');
const shipped = M.getSceneCameraPreset('pirate-cove');
const shippedPreset = { ...shipped, ...shipped.constraints };
const shippedPlan = { beam: 15.3, length: 13.3, transomWidth: 7.5, maxBeamAt: 0.36 };
const base = evaluate(shippedPlan, shippedPreset, { z: 3.9, height: 6 }, -4.2);
console.log(
  `   stem ${base.stem}/${N}  mast top ${base.mastTop}/${N}  crow's nest ${base.nest}/${N}  deck under bottom edge ${base.deck}/${N}  portal ${base.portal}/${N}`,
);
console.log(`   rail angle min ${base.minAngle.toFixed(1)} deg, mean ${base.mean.toFixed(1)} deg`);
console.log('   NOTE: the shipped hull has a FLAT bow, not a stem point, so its "stem" column is a property of my');
console.log('   plan model rather than of the ship. It is reported for the record and must not be published as a score.');
