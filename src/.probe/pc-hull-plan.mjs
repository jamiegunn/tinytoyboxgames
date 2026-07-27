// Round 3 fix solver: what hull plan and camera pose make Pirate Cove read as a
// ship from a camera that is standing on its deck?
//
// The charge (see .probe/pc-hull-frame.mjs) is that the shipped hull is 15.3
// wide by 13.3 long -- beam:length 1:0.87, wider than it is long -- with a flat
// 7.5-unit transom at BOTH ends, and that the camera is pinned at radius 10 by
// `maxDistance`, 2.66 units off the bow, so the outline spans 293% of the frame
// in landscape and 1343% at 360x900. The player never sees a ship.
//
// Pulling the camera back to see the ship from outside is the obvious fix and it
// is wrong; this probe scores it so the write-up can say so with a number.
//
// The alternative this searches: keep the camera on deck and make the deck
// itself read. From on deck a ship is legible through exactly one cue -- the
// side rails converging toward a stem you can see. That needs (a) length, and
// (b) a bow that comes to a point, in frame.
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const { SCENE_CAMERA_FOV, distanceMultiplierForAspect } = await bundleEntry(
  'pc-hull-plan',
  `export { SCENE_CAMERA_FOV, distanceMultiplierForAspect } from './src/utils/cameraPresets';`,
);

const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 768 / 1024],
  ['viewport 480x854', 480 / 854],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
];

// A hull plan in the naval sense: a flat transom aft, maximum beam some way
// forward of it, and a stem point at the bow. z increases toward the bow.
//
// Returns the outline as a closed polyline of world (x, z) pairs, port side
// first, so a renderer can walk it directly.
function hullOutline({ beam, length, transomWidth, maxBeamAt }) {
  const hb = beam / 2;
  const ht = transomWidth / 2;
  const zAft = -length / 2;
  const zFwd = length / 2;
  const zBeam = zAft + length * maxBeamAt;
  return [
    [-ht, zAft], // transom, port corner
    [ht, zAft], // transom, starboard corner
    [hb, zBeam], // maximum beam, starboard
    [0, zFwd], // stem
    [-hb, zBeam], // maximum beam, port
  ];
}

// Half-width of the hull at a given z, by linear interpolation along the plan.
function halfWidthAt(plan, z) {
  const { beam, length, transomWidth, maxBeamAt } = plan;
  const zAft = -length / 2;
  const zFwd = length / 2;
  const zBeam = zAft + length * maxBeamAt;
  if (z < zAft || z > zFwd) return null;
  if (z <= zBeam) return MathUtils.lerp(transomWidth / 2, beam / 2, (z - zAft) / (zBeam - zAft));
  return MathUtils.lerp(beam / 2, 0, (z - zBeam) / (zFwd - zBeam));
}

function cameraFor(preset, aspect) {
  const mult = distanceMultiplierForAspect(aspect);
  const radius = MathUtils.clamp(preset.distance * mult, preset.minDistance, preset.maxDistance ?? preset.distance * mult);
  const target = new Vector3(...preset.target);
  const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth)));
  if (position.y > preset.ceilingY) position.y = preset.ceilingY;
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return { cam, radius, position };
}

const ndc = (cam, x, y, z) => new Vector3(x, y, z).project(cam);
const inFrame = (n) => Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 && n.z <= 1;

// How diagonal is the port rail in screen space? A rail that runs across the
// frame is a fence; a rail that runs away from the viewer is a ship. Measured as
// the angle from horizontal of the screen-space segment joining the rail at the
// near edge of the frame to the rail at the stem.
function railAngle(cam, plan, railY) {
  const zAft = -plan.length / 2;
  const zFwd = plan.length / 2;
  const samples = [];
  for (let i = 0; i <= 40; i += 1) {
    const z = MathUtils.lerp(zAft, zFwd, i / 40);
    const hw = halfWidthAt(plan, z);
    if (hw === null) continue;
    const n = ndc(cam, -hw, railY, z);
    if (n.z > 1) continue;
    samples.push(n);
  }
  const visible = samples.filter(inFrame);
  if (visible.length < 2) return null;
  const a = visible[0];
  const b = visible[visible.length - 1];
  const deg = (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI;
  return { deg, span: Math.hypot(b.x - a.x, b.y - a.y) };
}

function score(label, plan, preset, mast) {
  console.log(`\n#### ${label}`);
  console.log(
    `     hull beam ${plan.beam} x length ${plan.length}  (1 : ${(plan.length / plan.beam).toFixed(2)})  transom ${plan.transomWidth} = ${((100 * plan.transomWidth) / plan.beam).toFixed(0)}% of beam  max beam at ${(plan.maxBeamAt * 100).toFixed(0)}% aft`,
  );
  console.log(
    `     camera d=${preset.distance} max=${preset.maxDistance ?? '-'} polar=${preset.polar} target=[${preset.target}] ceil=${preset.ceilingY}   mast z=${mast.z} h=${mast.height} nest=${(mast.height * 0.85).toFixed(2)}`,
  );
  let stemOk = 0;
  let mastOk = 0;
  let nestOk = 0;
  const angles = [];
  for (const [aname, aspect] of ASPECTS) {
    const { cam, position } = cameraFor(preset, aspect);
    const stem = ndc(cam, 0, 0, plan.length / 2);
    const mastTop = ndc(cam, 0, mast.height, mast.z);
    const nest = ndc(cam, 0, mast.height * 0.85, mast.z);
    const ra = railAngle(cam, plan, 2.0);
    if (inFrame(stem)) stemOk += 1;
    if (inFrame(mastTop)) mastOk += 1;
    if (inFrame(nest)) nestOk += 1;
    if (ra) angles.push(ra.deg);
    const camZ = position.z;
    console.log(
      `       ${aname.padEnd(22)} camZ ${camZ.toFixed(1).padStart(6)}  stem ndc(${stem.x.toFixed(2)},${stem.y.toFixed(2)}) ${inFrame(stem) ? 'IN ' : 'OUT'}` +
        `  mastTop y ${mastTop.y.toFixed(2)} ${inFrame(mastTop) ? 'IN ' : 'OUT'}  nest y ${nest.y.toFixed(2)} ${inFrame(nest) ? 'IN ' : 'OUT'}` +
        `  rail ${ra ? `${ra.deg.toFixed(0)}deg` : ' n/a '}`,
    );
  }
  const mean = angles.length ? angles.reduce((a, b) => a + b, 0) / angles.length : 0;
  console.log(`     => stem in frame ${stemOk}/8   mast top ${mastOk}/8   crow's nest ${nestOk}/8   mean rail angle ${mean.toFixed(1)} deg`);
  return { stemOk, mastOk, nestOk, mean };
}

const SHIPPED_PRESET = { azimuth: Math.PI, polar: 1.2, distance: 10, minDistance: 9, maxDistance: 10, target: [0, 0.3, 0], ceilingY: 4.8 };
// The shipped hull as a plan: bow at -z (camera side), stern at +z, both flat.
// `maxBeamAt` 0 and a transom as wide as the bow is the whole complaint.
const SHIPPED_PLAN = { beam: 15.3, length: 13.3, transomWidth: 7.5, maxBeamAt: 0.36 };

console.log('======== BASELINE: what ships today');
score('shipped', SHIPPED_PLAN, SHIPPED_PRESET, { z: 3.9, height: 6 });

console.log('\n\n======== REJECTED FIX: pull the camera out until the whole ship is in frame');
for (const d of [16, 22, 30]) {
  score(`pull back to d=${d}`, SHIPPED_PLAN, { ...SHIPPED_PRESET, distance: d, minDistance: d - 1, maxDistance: d, ceilingY: 12 }, { z: 3.9, height: 6 });
}

console.log('\n\n======== CANDIDATE FIX: long hull, pointed stem forward, camera over the quarterdeck');
const CANDIDATES = [
  ['A  beam 11 length 26', { beam: 11, length: 26, transomWidth: 6.5, maxBeamAt: 0.3 }, { z: 2.0, height: 6 }],
  ['B  beam 11 length 30', { beam: 11, length: 30, transomWidth: 6.5, maxBeamAt: 0.3 }, { z: 3.0, height: 6.5 }],
  ['C  beam 12 length 24', { beam: 12, length: 24, transomWidth: 7.0, maxBeamAt: 0.32 }, { z: 1.0, height: 6 }],
  ['D  beam 11 length 26, taller mast further fwd', { beam: 11, length: 26, transomWidth: 6.5, maxBeamAt: 0.3 }, { z: 4.0, height: 7 }],
];
for (const [name, plan, mast] of CANDIDATES) {
  score(name, plan, SHIPPED_PRESET, mast);
}
