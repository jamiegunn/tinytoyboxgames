/**
 * ROUND 5, FALSIFICATION 7. THE PROBES SKIPPED OFF-SCREEN PROPS. THE APP DOES NOT.
 *
 * Every crowding probe in this round -- `nature-classes.mjs`, and `worstGap` in
 * `nature-portal-solve.mjs` -- discards a target whose projection falls outside
 * the frame, on the stated ground that "a prop that cannot be seen cannot be
 * mis-tapped". That reasoning is about the CHILD. The rule that actually decides
 * which handler fires is `pickByProximity` in `interactionController.ts`, and it
 * discards exactly one thing:
 *
 *     projected.copy(worldPos).project(camera);
 *     if (projected.z > 1) continue;              // behind the camera -> skip
 *
 * Behind the camera. Nothing else. A prop sitting just outside the left edge of
 * the frame still projects to a finite screen x -- a negative one, or one past
 * the canvas width -- and still enters `nearestPointWithin`. So an off-frame prop
 * cannot be AIMED at, but it can absolutely WIN a tap aimed at something else,
 * and when it does the child gets a response from a prop that is not on their
 * screen: a grub lifted under a stone they cannot see, a sound with no picture.
 *
 * `.probe/render/nature-frame.mjs` already established that all three stones are
 * off-frame at both radii on every phone. This asks the question that follows:
 * how far outside the edge are they, and is that inside the 70 px catchment of
 * any tap a child could plausibly make?
 *
 * A prop is an INVISIBLE THIEF at a viewport when it is (a) in front of the
 * camera, (b) outside the frame, and (c) within PROXIMITY_PX of at least one
 * point ON the canvas -- i.e. its stealing region overlaps pixels the child can
 * actually touch.
 */

import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'nature-thief',
  `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { NATURE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
  export { MUSHROOM_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/mushrooms';
  export { FLOWER_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/flowers';
  export { LEAF_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/leaves';
  export { STONE_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/stones';
  export { SNAIL_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/snail';
  export { LOG_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/log';
  export { BUTTERFLY_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/butterflies';
`,
);

// PROXIMITY_PX is IMPORTED, not restated. Round 11 found this one constant
// obtained four different ways across seventeen sites — six hard literals, eight
// hand-rolled regex resolvers, and two real imports — with the correct mechanism
// already present and adopted twice. A regex over the source cannot survive the
// constant becoming an expression; a literal cannot survive anything.
//
// The bundle slug is deliberately shared with the twelve sibling probes that
// need the same constant. bundleEntry emits `.tstest-tmp/entry_<slug>.bundle.mjs`,
// so a shared slug means a shared temp file — safe here only because the entry
// source below is byte-identical everywhere it appears. If you change this
// entry, change it in all of them or give yours a different slug.
const RULES = await bundleEntry('r11_gesture_rules', `export { PROXIMITY_PX } from './src/utils/interaction/gestureRules';`);
const PROXIMITY_PX = RULES.PROXIMITY_PX;

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['square 900x900', 900, 900],
  ['iPad portrait 768x1024', 768, 1024],
  ['viewport 480x854', 480, 854],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 360x900', 360, 900],
];

const vec = (p) => new Vector3(p.x, p.y, p.z);
const PROPS = [
  ...M.MUSHROOM_STAGING.map((s) => ['mushroom', vec(s.position)]),
  ...M.FLOWER_STAGING.map((s) => ['flower', vec(s.position)]),
  ...M.LEAF_STAGING.map((s) => ['leaf', vec(s.position)]),
  ...M.STONE_STAGING.map((s) => ['stone', vec(s.position)]),
  ['snail', vec(M.SNAIL_STAGING.position)],
  ['log', vec(M.LOG_STAGING.position)],
  ...M.BUTTERFLY_STAGING.map((s) => ['butterfly', vec(s.position)]),
  ...M.NATURE_ENVIRONMENT.portals.map((p) => [`portal:${p.gameId}`, new Vector3(p.position.x, 0.3, p.position.z)]),
];

console.log(`==== OFF-FRAME PROPS THAT CAN STILL WIN A TAP  (catchment ${PROXIMITY_PX} px)\n`);
console.log('  "overhang" is how far the prop sits outside the nearest canvas edge.');
console.log('  Anything under 70 px overhangs INTO the touchable area.\n');
console.log('  viewport                 prop          screen px            overhang   steals?');

let anyThief = false;
for (const [label, w, h] of VIEWS) {
  const pose = M.resolveSceneCameraPose('nature', w / h);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, w / h, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  const rows = [];
  for (const [cls, v] of PROPS) {
    const n = v.clone().project(cam);
    if (n.z > 1) continue; // behind the camera: the app skips these too
    const x = ((n.x + 1) / 2) * w;
    const y = ((1 - n.y) / 2) * h;
    const inside = x >= 0 && x <= w && y >= 0 && y <= h;
    if (inside) continue;
    // Distance from the prop to the nearest point ON the canvas.
    const dx = x < 0 ? -x : x > w ? x - w : 0;
    const dy = y < 0 ? -y : y > h ? y - h : 0;
    const overhang = Math.hypot(dx, dy);
    rows.push([cls, x, y, overhang]);
  }
  rows.sort((a, b) => a[3] - b[3]);
  for (const [cls, x, y, over] of rows) {
    const steals = over < PROXIMITY_PX;
    if (steals) anyThief = true;
    console.log(
      `  ${label.padEnd(24)} ${cls.padEnd(13)} ${x.toFixed(0).padStart(6)},${y.toFixed(0).padStart(6)}   ${over.toFixed(1).padStart(8)} px   ${steals ? 'YES — invisible thief' : 'no'}`,
    );
  }
  if (rows.length === 0) console.log(`  ${label.padEnd(24)} (every prop inside the frame)`);
  console.log('');
}

console.log(
  anyThief ? '  VERDICT: the shipped scene has props that cannot be seen and can still answer a tap.' : '  VERDICT: no off-frame prop reaches the canvas.',
);
