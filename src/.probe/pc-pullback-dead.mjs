/**
 * ROUND 5. I WENT LOOKING FOR A RESIZE BUG AND FOUND THE FEATURE WAS NEVER ON.
 *
 * The hypothesis was that `resize()` fails to re-apply the portrait pull-back,
 * because it recomputes the ceiling and then only CLAMPS the radius under it,
 * and a clamp can lower a radius but never raise one. That reading of the code
 * is correct. `.probe/pc-rotate-pullback.mjs` then measured the consequence on
 * four real devices and found: none. Radius 12.000 before rotation, 12.000
 * after, 12.000 if opened fresh, 12.000 after six rotations.
 *
 * Not because `resize` is fine. Because the pull-back it fails to re-apply was
 * never applied in the first place. Pirate Cove's preset declares
 *
 *     distance: 12,  constraints: { minDistance: 11, maxDistance: 12 }
 *
 * and `radiusForAspect` is
 *
 *     clamp(distance * distanceMultiplierForAspect(aspect), minDistance, maxDistance)
 *
 * `distanceMultiplierForAspect` returns `max(1, 0.75 / aspect)` — never below 1
 * — so the product is never below `distance`, and `maxDistance === distance`
 * clamps every bit of it away. At EVERY aspect. The multiplier is computed,
 * used, and discarded.
 *
 * This probe asks the question that matters more than one scene's numbers: for
 * how much of the codebase is the pull-back live, and how much of it is a
 * mechanism that runs, is tested, and changes nothing?
 */

import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-pullback-dead',
  `
  export { SCENE_CATALOG } from './src/scenes/sceneCatalog';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { distanceMultiplierForAspect, resolveSceneCameraPose, PULLBACK_REFERENCE_ASPECT } from './src/utils/cameraPresets';
`,
);

// Widest and narrowest shapes the app ships into, plus the reference the rule
// is authored against.
const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['iPad portrait 768x1024', 768 / 1024],
  ['iPhone SE 375x667', 375 / 667],
  ['iPhone 15 393x852', 393 / 852],
  ['extreme 360x900', 0.4],
];

const sceneIds = Object.keys(M.SCENE_CATALOG);

console.log('==== 1. IS THE PULL-BACK LIVE? per scene, radius at widest vs narrowest\n');
console.log('  A live pull-back means the radius GROWS as the viewport narrows.');
console.log('  "dead" means the ceiling clamps every bit of it away at every aspect.\n');
console.log('  scene                       distance  minD   maxD    radius@1.778  radius@0.400   pull-back');

let dead = 0;
let live = 0;
const deadScenes = [];
for (const id of sceneIds) {
  let preset;
  try {
    preset = M.getSceneCameraPreset(id);
  } catch {
    continue;
  }
  const c = preset.constraints ?? {};
  const wide = M.resolveSceneCameraPose(id, 1.7778).radius;
  const narrow = M.resolveSceneCameraPose(id, 0.4).radius;
  const isDead = Math.abs(narrow - wide) < 1e-9;
  if (isDead) {
    dead++;
    deadScenes.push(id);
  } else live++;
  console.log(
    `  ${id.padEnd(27)} ${String(preset.distance).padStart(6)}  ${String(c.minDistance ?? '-').padStart(5)}  ${String(c.maxDistance ?? '-').padStart(5)}   ${wide.toFixed(3).padStart(10)}  ${narrow.toFixed(3).padStart(11)}   ${isDead ? 'DEAD' : `live (+${(((narrow - wide) / wide) * 100).toFixed(1)}%)`}`,
  );
}
console.log(`\n  ${dead} scene(s) with the pull-back fully clamped away, ${live} live.`);

console.log('\n==== 2. THE MULTIPLIER THAT IS COMPUTED AND THROWN AWAY\n');
console.log('  What `distanceMultiplierForAspect` asks for, against what each dead');
console.log('  scene is allowed to do about it.\n');
console.log('  aspect                     multiplier   asked radius   allowed   discarded');
for (const id of deadScenes) {
  const preset = M.getSceneCameraPreset(id);
  console.log(`\n  ${id}:`);
  for (const [label, a] of ASPECTS) {
    const mult = M.distanceMultiplierForAspect(a);
    const asked = preset.distance * mult;
    const allowed = M.resolveSceneCameraPose(id, a).radius;
    console.log(
      `  ${label.padEnd(24)} ${mult.toFixed(4).padStart(9)}   ${asked.toFixed(3).padStart(12)}   ${allowed.toFixed(3).padStart(7)}   ${(asked - allowed).toFixed(3).padStart(9)}`,
    );
  }
}

console.log('\n==== 3. HOW MUCH ZOOM DOES THE CHILD ACTUALLY HAVE?\n');
console.log('  minDistance..maxDistance is the whole pinch-zoom range.\n');
for (const id of sceneIds) {
  let preset;
  try {
    preset = M.getSceneCameraPreset(id);
  } catch {
    continue;
  }
  const c = preset.constraints ?? {};
  const min = c.minDistance ?? preset.distance * 0.2;
  const max = c.maxDistance ?? preset.distance * M.distanceMultiplierForAspect(0.4);
  console.log(
    `  ${id.padEnd(27)} ${min.toFixed(2).padStart(6)} .. ${max.toFixed(2).padStart(6)}   = ${(((max - min) / min) * 100).toFixed(1)}% of the near distance`,
  );
}

console.log('\n==== 4. WHAT THE RULE WOULD HAVE DONE, had the ceiling allowed it\n');
console.log(`  reference aspect ${M.PULLBACK_REFERENCE_ASPECT}: at or above it the camera sits at the`);
console.log('  preset distance; below it the camera pulls back to hold world width.\n');
console.log('  aspect     multiplier   world half-width held constant?');
for (const [label, a] of ASPECTS) {
  const mult = M.distanceMultiplierForAspect(a);
  // Visible world half-width at distance d is proportional to d * aspect.
  const heldWide = 1 * M.distanceMultiplierForAspect(1.7778) * 1.7778;
  const held = mult * a;
  console.log(`  ${label.padEnd(24)} ${mult.toFixed(4).padStart(8)}   width index ${held.toFixed(4)} (landscape ${heldWide.toFixed(4)})`);
}
