// Solve the pirate-cove opening pose so the whole ship stays framed on a phone.
//
// The scene's `maxDistance: 10` equals its `distance: 10`, so `radiusForAspect`
// clamps the portrait pull-back to zero: the camera never backs off, and a
// ~15-unit-wide ship is viewed through a ~4-unit-wide window. This sweeps
// candidate constraint sets against every staged prop, the portal, and the
// bottom-edge floor reach, so the replacement numbers are measured.
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-camera-fit',
  `export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
   export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
   export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
   export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
   export { PARROT_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/parrot';
   export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
   export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
   export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
   export { OCEAN_Y } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sea';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';`,
);
const { SCENE_CAMERA_FOV, PIRATE_COVE_ENVIRONMENT, OCEAN_Y } = M;

const PROPS = [
  ...M.ANCHOR_STAGING.map((s, i) => [`anchor${i}`, s.position, 0.6]),
  ...M.BARREL_STAGING.map((s, i) => [`barrel${i}`, s.position, 0.35]),
  ...M.CANNON_STAGING.map((s, i) => [`cannon${i}`, s.position, 0.4]),
  ...M.PARROT_STAGING.map((s, i) => [`parrot${i}`, s.position, 0.2]),
  ...M.ROPE_COIL_STAGING.map((s, i) => [`rope${i}`, s.position, 0.1]),
  ...M.SHIP_WHEEL_STAGING.map((s, i) => [`wheel${i}`, s.position, 0.9]),
  ...M.TREASURE_CHEST_STAGING.map((s, i) => [`chest${i}`, s.position, 0.3]),
  ...PIRATE_COVE_ENVIRONMENT.portals.map((p) => [`PORTAL:${p.gameId}`, p.position, 0.3]),
];
// Mast top, so the fix is not judged only on deck-level props.
const MAST_TOP = ['mastTop', new Vector3(0, 0, 6.5 * 0.6), 5.4];

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

const mult = (a) => (a < 1 ? (1.0 / a) * 0.75 : 1);

function pose(preset, aspect) {
  const c = preset.constraints ?? {};
  const minD = c.minDistance ?? preset.distance * 0.2;
  const maxD = c.maxDistance ?? preset.distance * mult(aspect);
  const radius = MathUtils.clamp(preset.distance * mult(aspect), minD, maxD);
  const target = new Vector3(...preset.target);
  const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth)));
  const ceilingY = c.ceilingY ?? 6.0;
  const clamped = position.y > ceilingY;
  if (clamped) position.y = ceilingY;
  return { position, target, radius, clamped };
}

function camFor(p, aspect) {
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(p.position);
  cam.lookAt(p.target);
  cam.updateMatrixWorld(true);
  return cam;
}

// Where the bottom edge lands on an arbitrary horizontal plane.
function bottomEdge(cam, planeY) {
  return [-1, 0, 1].map((ndcX) => {
    const dir = new Vector3(ndcX, -1, 0.5).unproject(cam).sub(cam.position).normalize();
    if (dir.y >= -1e-6) return null;
    return cam.position.clone().addScaledVector(dir, (planeY - cam.position.y) / dir.y);
  });
}

const BASE = { azimuth: Math.PI, polar: 1.2, distance: 10, target: [0, 0.3, 0] };
const CUR = {
  maxAzimuthRange: 0.12,
  minPolar: 1.14,
  maxPolar: 1.24,
  minDistance: 9,
  maxDistance: 10,
  panRangeX: 1.4,
  minTargetY: 0.2,
  maxTargetY: 0.45,
  ceilingY: 4.8,
};

const CONFIGS = [
  ['current', CUR],
  ['no maxDistance', { ...CUR, maxDistance: undefined }],
  ['no maxDistance, ceiling 6.0', { ...CUR, maxDistance: undefined, ceilingY: 6.0 }],
  ['no maxDistance, ceiling 7.5', { ...CUR, maxDistance: undefined, ceilingY: 7.5 }],
  ['maxDistance 16, ceiling 6.0', { ...CUR, maxDistance: 16, ceilingY: 6.0 }],
];

for (const [name, cons] of CONFIGS) {
  const preset = { ...BASE, constraints: cons };
  console.log(`\n### ${name}`);
  let worstOff = 0;
  for (const [label, aspect] of ASPECTS) {
    const p = pose(preset, aspect);
    const cam = camFor(p, aspect);
    const off = [];
    for (const [nm, v, dy] of [...PROPS, MAST_TOP]) {
      const ndc = new Vector3(v.x, v.y + dy, v.z).project(cam);
      const over = Math.max(Math.abs(ndc.x) - 1, Math.abs(ndc.y) - 1);
      if (over > 0) {
        off.push(`${nm}+${over.toFixed(2)}`);
        worstOff = Math.max(worstOff, over);
      }
    }
    const deck = bottomEdge(cam, 0).map((h) => (h ? `${h.z.toFixed(1)}` : 'UNB'));
    const sea = bottomEdge(cam, OCEAN_Y);
    const seaOk = sea.every((h) => h && Math.abs(h.x) <= 200 && Math.abs(h.z) <= 200);
    console.log(
      `  ${label.padEnd(22)} r=${p.radius.toFixed(1)} camY=${p.position.y.toFixed(2)}${p.clamped ? '*' : ' '} ` +
        `deckZ[${deck.join(',')}] sea:${seaOk ? 'ok' : 'MISS'}  off ${String(off.length).padStart(2)}/${PROPS.length + 1} ${off.slice(0, 5).join(' ')}`,
    );
  }
  console.log(`  worst overshoot: ${worstOff.toFixed(3)}`);
}
process.exit(0);
