// Is there a CAMERA-ONLY fix for pirate-cove framing?
//
// Removing `maxDistance` helps only below aspect 0.75, because the shared
// pull-back rule (1/a)*0.75 evaluates to exactly 1.0 at a=0.75 -- an iPad in
// portrait gets no pull-back at all. And the mast top is off the top of the
// frame at EVERY aspect including landscape. So before moving any prop, sweep
// (distance x ceilingY) to find whether the scene can be framed by the camera
// alone, and report the binding prop for each candidate.
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-camera-sweep',
  `export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
   export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
   export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
   export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
   export { PARROT_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/parrot';
   export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
   export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
   export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';`,
);
const { SCENE_CAMERA_FOV, PIRATE_COVE_ENVIRONMENT } = M;

const PROPS = [
  ...M.ANCHOR_STAGING.map((s, i) => [`anchor${i}`, s.position, 0.6]),
  ...M.BARREL_STAGING.map((s, i) => [`barrel${i}`, s.position, 0.35]),
  ...M.CANNON_STAGING.map((s, i) => [`cannon${i}`, s.position, 0.4]),
  ...M.PARROT_STAGING.map((s, i) => [`parrot${i}`, s.position, 0.2]),
  ...M.ROPE_COIL_STAGING.map((s, i) => [`rope${i}`, s.position, 0.1]),
  ...M.SHIP_WHEEL_STAGING.map((s, i) => [`wheel${i}`, s.position, 0.9]),
  ...M.TREASURE_CHEST_STAGING.map((s, i) => [`chest${i}`, s.position, 0.3]),
  ...PIRATE_COVE_ENVIRONMENT.portals.map((p) => [`PORTAL:${p.gameId}`, p.position, 0.3]),
  ['mastTop', new Vector3(0, 0, 3.9), 5.4],
];

const ASPECTS = [1280 / 720, 1024 / 768, 1, 768 / 1024, 480 / 854, 375 / 667, 393 / 852, 412 / 915, 0.4];
const mult = (a) => (a < 1 ? (1.0 / a) * 0.75 : 1);

function worstOver(distance, ceilingY, minDistance) {
  let worst = -Infinity;
  let who = '';
  for (const aspect of ASPECTS) {
    const radius = MathUtils.clamp(distance * mult(aspect), minDistance, Infinity);
    const target = new Vector3(0, 0.3, 0);
    const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, 1.2, Math.PI)));
    if (position.y > ceilingY) position.y = ceilingY;
    const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
    cam.position.copy(position);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    for (const [nm, v, dy] of PROPS) {
      const ndc = new Vector3(v.x, v.y + dy, v.z).project(cam);
      const over = Math.max(Math.abs(ndc.x) - 1, Math.abs(ndc.y) - 1);
      if (over > worst) {
        worst = over;
        who = `${nm}@a=${aspect.toFixed(2)}`;
      }
    }
  }
  return { worst, who };
}

console.log('distance x ceilingY  ->  worst NDC overshoot across all 9 aspects and all 14 points');
console.log('   (<=0 means the whole staged ship is framed everywhere; the binding point is named)');
for (const d of [10, 11, 12, 13, 14, 15, 16]) {
  const row = [];
  for (const ceil of [4.8, 6.0, 7.0, 8.0, 10.0]) {
    const r = worstOver(d, ceil, 9);
    row.push(`${ceil.toFixed(1)}:${r.worst > 0 ? '+' : ''}${r.worst.toFixed(2)}`);
  }
  const best = worstOver(d, 10.0, 9);
  console.log(`  distance ${String(d).padStart(2)}   ${row.join('  ')}   binding@ceil10: ${best.who}`);
}

console.log('\n# detail for the most promising candidates');
for (const [d, ceil] of [
  [13, 8.0],
  [14, 8.0],
  [15, 8.0],
  [14, 10.0],
  [15, 10.0],
]) {
  const r = worstOver(d, ceil, 9);
  console.log(`  distance=${d} ceilingY=${ceil}: worst ${r.worst.toFixed(3)} (${r.who})`);
}
process.exit(0);
