/**
 * ROUND 5, THE COMPOSITION CONSTRAINT PRICED IN PIXELS.
 *
 * The solver's answer to "where do four portals go" is a straight, evenly spaced
 * row across the near foreground: x = -1.9, -0.7, 0.7, 1.9 all at z = -4.6. It
 * is optimal against the tap-separation objective and it is the one arrangement
 * `vision.md` names as wrong:
 *
 *     "soft cinematic framing rather than a flat game board"
 *     "use material richness instead of clutter"
 *
 * Four identical rings in a line, equally spaced, at the same depth, is a flat
 * game board. It is also backwards for a diorama: the camera sits at z = -9.3
 * looking toward +z, so z = -4.6 is the NEAR foreground. The portals -- the
 * things that lead deeper into the world -- would be staged in front of the
 * world they lead into.
 *
 * So this prices the composition constraints rather than assuming they are free.
 * Four shapes, same objective, same nine viewports:
 *
 *   free      the solver's answer, no composition constraint
 *   arc       outer pair and inner pair at different depths by >= 0.6 units, so
 *             the four read as a curve rather than a rank
 *   back      every portal behind the scene's centre (z >= 0), which is where a
 *             doorway belongs, at the cost of perspective compressing it
 *   back-arc  both at once
 *
 * If a constrained shape still clears the 70 px catchment, the constraint is
 * affordable and should be taken. If it does not, the trade is explicit and the
 * decision is made against a number instead of a preference.
 */

import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'nature-portal-shape',
  `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { PROXIMITY_PX } from './src/utils/interaction/gestureRules';
  export { MUSHROOM_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/mushrooms';
  export { FLOWER_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/flowers';
  export { LEAF_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/leaves';
  export { SNAIL_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/snail';
  export { LOG_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/log';
  export { BUTTERFLY_STAGING } from './src/scenes/immersive-toybox-scenes/naturescene/staging/butterflies';
`,
);

const PROXIMITY_PX = M.PROXIMITY_PX;
const PORTAL_Y = 0.3;
const CLEARANCE = 0.8;
const NDC_MARGIN = 0.04;

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
const CAMS = VIEWS.map(([label, w, h]) => {
  const pose = M.resolveSceneCameraPose('nature', w / h);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, w / h, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return { label, w, h, cam };
});
const px = (v, view) => {
  const n = v.clone().project(view.cam);
  return { x: ((n.x + 1) / 2) * view.w, y: ((1 - n.y) / 2) * view.h, nx: n.x, ny: n.y, nz: n.z };
};
const framed = (v) =>
  CAMS.every((view) => {
    const s = px(v, view);
    return s.nz <= 1 && Math.abs(s.nx) <= 1 - NDC_MARGIN && Math.abs(s.ny) <= 1 - NDC_MARGIN;
  });
const vec = (p) => new Vector3(p.x, p.y, p.z);
const ANCHORED = [
  ...M.MUSHROOM_STAGING.map((s) => ['mushroom', vec(s.position)]),
  ...M.FLOWER_STAGING.map((s) => ['flower', vec(s.position)]),
  ...M.LEAF_STAGING.map((s) => ['leaf', vec(s.position)]),
  ['snail', vec(M.SNAIL_STAGING.position)],
  ['log', vec(M.LOG_STAGING.position)],
  ...M.BUTTERFLY_STAGING.map((s) => ['butterfly', vec(s.position)]),
].filter(([, v]) => framed(v));

const worstGap = (probe, targets) => {
  let best = Infinity;
  for (const view of CAMS) {
    const a = px(probe[1], view);
    if (a.nz > 1) continue;
    for (const [cls, t] of targets) {
      if (cls === probe[0]) continue;
      const b = px(t, view);
      if (b.nz > 1) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < best) best = d;
    }
  }
  return best;
};

const SHAPES = [
  ['free', () => true],
  ['arc', (zo, zi) => Math.abs(zo - zi) >= 0.6],
  ['back', (zo, zi) => zo >= 0 && zi >= 0],
  ['back-arc', (zo, zi) => zo >= 0 && zi >= 0 && Math.abs(zo - zi) >= 0.6],
];

console.log('==== WHAT EACH COMPOSITION CONSTRAINT COSTS\n');
console.log('  shape      portals                                              tier1    tier2');

for (const [name, ok] of SHAPES) {
  let best = null;
  for (let a = 1.4; a <= 4.4; a += 0.1) {
    for (let b = 0.3; b <= 3.4; b += 0.1) {
      if (b >= a - 0.3) continue;
      for (let zo = -4.6; zo <= 4.6; zo += 0.2) {
        for (let zi = -4.6; zi <= 4.6; zi += 0.2) {
          if (!ok(zo, zi)) continue;
          const cand = [
            ['portal:bubble-pop', new Vector3(-a, PORTAL_Y, zo)],
            ['portal:star-catcher', new Vector3(-b, PORTAL_Y, zi)],
            ['portal:fireflies', new Vector3(b, PORTAL_Y, zi)],
            ['portal:little-shark', new Vector3(a, PORTAL_Y, zo)],
          ];
          if (!cand.every(([, p]) => framed(p))) continue;
          if (!cand.every(([, p]) => ANCHORED.every(([, t]) => Math.hypot(p.x - t.x, p.z - t.z) >= CLEARANCE))) continue;
          let t1 = Infinity;
          for (const view of CAMS) {
            const proj = cand.map(([, p]) => px(p, view));
            for (let i = 0; i < 4; i++)
              for (let j = i + 1; j < 4; j++) {
                const d = Math.hypot(proj[i].x - proj[j].x, proj[i].y - proj[j].y);
                if (d < t1) t1 = d;
              }
          }
          const pool = [...ANCHORED, ...cand];
          const t2 = Math.min(
            ...cand.map(([id, p]) =>
              worstGap(
                [id, p],
                pool.filter(([c]) => c !== id),
              ),
            ),
          );
          const key = Math.min(t1, PROXIMITY_PX) * 1000 + t2;
          if (!best || key > best.key) best = { a, b, zo, zi, t1, t2, key, cand };
        }
      }
    }
  }
  if (!best) {
    console.log(`  ${name.padEnd(10)} no candidate satisfies this shape at all nine viewports`);
    continue;
  }
  const desc = best.cand.map(([, p]) => `(${p.x.toFixed(1)},${p.z.toFixed(1)})`).join(' ');
  const mark = (v) => (v >= PROXIMITY_PX ? 'ok' : 'FAIL');
  console.log(
    `  ${name.padEnd(10)} ${desc.padEnd(48)} ${best.t1.toFixed(1).padStart(6)} ${mark(best.t1).padEnd(5)} ${best.t2.toFixed(1).padStart(5)} ${mark(best.t2)}`,
  );
}
