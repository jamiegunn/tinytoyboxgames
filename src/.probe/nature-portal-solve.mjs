/**
 * ROUND 5, THE FIX SOLVER. SEPARATE THE EXPENSIVE TAPS ACROSS THE FRAME, NOT
 * INTO IT.
 *
 * THE DEFECT THIS SOLVES
 * ----------------------
 * `.probe/render/nature-classes.mjs` measured, through the real renderer, that
 * on every phone two portal PAIRS project inside the app's own 70 px tap
 * catchment (`PROXIMITY_PX` in `interaction/gestureRules.ts`):
 *
 *     little-shark / fireflies    43.2 px at 360x900,  51.4 at iPhone SE
 *     bubble-pop  / star-catcher  55.8 px at 360x900,  64.4 at iPhone SE
 *
 * Portals are the only props in this scene whose responses genuinely differ.
 * Every mushroom registers one handler, every flower another; a child who aims
 * at one mushroom and lands on its neighbour gets a mushroom that bounces, which
 * is what they asked for. Each portal launches a DIFFERENT mini-game, so a
 * near-miss between two of them is the only confusion in the scene that takes a
 * child somewhere they did not choose -- and it is the only one they cannot undo
 * by tapping again, because it leaves the scene.
 *
 * The mechanism is visible in the authored positions:
 *
 *     little-shark ( 2.6, 0, -1.0)      fireflies    ( 2.5, 0, -2.8)
 *     bubble-pop   (-2.6, 0, -1.8)      star-catcher (-2.0, 0, -3.8)
 *
 * Each pair is separated almost entirely in DEPTH. The camera sits about 21
 * degrees above the ground (polar 1.2), and a camera that shallow foreshortens
 * depth to almost nothing: the 1.8 world units of z between little-shark and
 * fireflies survive as 43 screen px, while the 5.2 units of x between the left
 * and right pairs survive as 275. The staging spends its separation on the one
 * axis the camera throws away.
 *
 * WHAT THE SWEEP FOUND ON ITS FIRST RUN, WHICH CHANGED THE SHAPE OF THE FIX
 * ------------------------------------------------------------------------
 * The shipped layout is REJECTED by this solver's own clearance rule before it
 * is ever scored: `bubble-pop` at (-2.6, -1.8) is 0.22 world units from a stone
 * at (-2.5, -2.0). They are the same spot. And the best portal-only candidate
 * scored 36.5 px, still half the catchment, because its limit was not another
 * portal -- it was a stone. The stones are staged across the same back strip the
 * portals need.
 *
 * Which is worth stating on its own: `.probe/render/nature-frame.mjs` shows all
 * three stones project OUTSIDE the frame on every phone, at both radii. The
 * scene ships an entire interactive family -- lift a stone, find a grub -- that
 * no phone can see. So the stones are not an obstacle to route around; they are
 * a second defect, and moving them inboard fixes both.
 *
 * So this solves in two stages, portals first because their constraint is the
 * expensive one, then the stones into what is left.
 */

import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'nature-portal-solve',
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

const PROXIMITY_PX = 70;
const PORTAL_Y = 0.3;
/** Minimum world separation between a portal and any other tappable prop. */
const CLEARANCE = 0.9;
/** NDC margin: a portal centre this close to the edge has a visibly clipped ring. */
const NDC_MARGIN = 0.06;

/** The nine shipping viewports, in pixels — the aspect list the suite uses, with the sizes it implies. */
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

const camAt = (position, target, aspect) => {
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

// One camera per shipping viewport, built once from the REAL pose resolver, so
// the pull-back and the ceilingY clamp are both included exactly as they ship.
// `.probe/render/nature-agree.mjs` checks these cameras against the ones the
// live renderer uses: worst disagreement 0.00 px.
const CAMS = VIEWS.map(([label, w, h]) => {
  const pose = M.resolveSceneCameraPose('nature', w / h);
  return { label, w, h, cam: camAt(pose.position, pose.target, w / h), radius: pose.radius };
});

const toPx = (v, view) => {
  const ndc = v.clone().project(view.cam);
  return { x: ((ndc.x + 1) / 2) * view.w, y: ((1 - ndc.y) / 2) * view.h, ndc };
};
const onScreen = (s) => Math.abs(s.ndc.x) <= 1 && Math.abs(s.ndc.y) <= 1;

const vec = (p) => new Vector3(p.x, p.y, p.z);

/** Every non-portal, non-stone tap target: the population that is not moving. */
const FIXED = [
  ...M.MUSHROOM_STAGING.map((s) => ['mushroom', vec(s.position)]),
  ...M.FLOWER_STAGING.map((s) => ['flower', vec(s.position)]),
  ...M.LEAF_STAGING.map((s) => ['leaf', vec(s.position)]),
  ['snail', vec(M.SNAIL_STAGING.position)],
  ['log', vec(M.LOG_STAGING.position)],
  ...M.BUTTERFLY_STAGING.map((s) => ['butterfly', vec(s.position)]),
];
const SHIPPED_STONES = M.STONE_STAGING.map((s) => vec(s.position));

/**
 * The worst screen gap, in CSS px, between a probe point and every listed
 * target of a different class, across all nine viewports. Off-screen targets are
 * skipped: a prop that cannot be seen cannot be mis-tapped.
 *
 * @param probe - `[class, Vector3]` being placed.
 * @param targets - `[class, Vector3][]` already placed.
 * @returns `{ px, at, against }` for the worst pair found.
 */
const worstGap = (probe, targets) => {
  let px = Infinity;
  let at = null;
  let against = null;
  for (const view of CAMS) {
    const a = toPx(probe[1], view);
    if (!onScreen(a)) continue;
    for (const [cls, t] of targets) {
      if (cls === probe[0]) continue;
      const b = toPx(t, view);
      if (!onScreen(b)) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < px) {
        px = d;
        at = view.label;
        against = cls;
      }
    }
  }
  return { px, at, against };
};

/** True when a point is inside the frame with margin at every shipping viewport. */
const framedEverywhere = (v) =>
  CAMS.every((view) => {
    const s = toPx(v, view);
    return Math.abs(s.ndc.x) <= 1 - NDC_MARGIN && Math.abs(s.ndc.y) <= 1 - NDC_MARGIN;
  });

const clears = (v, targets, min = CLEARANCE) => targets.every(([, t]) => Math.hypot(v.x - t.x, v.z - t.z) >= min);

// ---------------------------------------------------------------- incumbent

console.log('==== 1. THE SHIPPED LAYOUT, SCORED BY THE SAME FUNCTION\n');
const shippedPortals = M.NATURE_ENVIRONMENT.portals.map((p) => [`portal:${p.gameId}`, new Vector3(p.position.x, PORTAL_Y, p.position.z)]);
const shippedAll = [...FIXED, ...SHIPPED_STONES.map((s) => ['stone', s]), ...shippedPortals];
for (const [id, p] of shippedPortals) {
  const g = worstGap(
    [id, p],
    shippedAll.filter(([c]) => c !== id),
  );
  const framed = framedEverywhere(p);
  console.log(
    `  ${id.padEnd(20)} (${p.x.toFixed(2).padStart(5)}, ${p.z.toFixed(2).padStart(5)})   worst ${g.px.toFixed(1).padStart(6)} px vs ${String(g.against).padEnd(20)} at ${g.at}${framed ? '' : '   [clipped at some viewport]'}`,
  );
}
const baseWorst = Math.min(
  ...shippedPortals.map(
    ([id, p]) =>
      worstGap(
        [id, p],
        shippedAll.filter(([c]) => c !== id),
      ).px,
  ),
);
console.log(`\n  worst gap from any portal to any different-class target: ${baseWorst.toFixed(1)} px  (catchment ${PROXIMITY_PX} px)`);
console.log(
  '  stones on screen at a phone viewport: ' + (SHIPPED_STONES.some((s) => onScreen(toPx(s, CAMS[8]))) ? 'yes' : 'NO — all three are unreachable there'),
);

// ------------------------------------------------------------------ stage 1

console.log('\n==== 2. STAGE ONE: THE FOUR PORTALS\n');
console.log('  A symmetric family — outer pair at +-a, inner pair at +-b, at depths zOuter');
console.log('  and zInner — because the scene is staged symmetrically and four unrelated');
console.log('  numbers produce a layout nobody can maintain. Scored against everything that');
console.log('  is NOT moving; the stones are handled in stage two.\n');

let best = null;
let considered = 0;
let framedOk = 0;
for (let a = 1.6; a <= 4.6; a += 0.1) {
  for (let b = 0.4; b <= 3.4; b += 0.1) {
    if (b >= a - 0.3) continue;
    for (let zo = -4.6; zo <= -0.6; zo += 0.2) {
      for (let zi = -4.6; zi <= -0.6; zi += 0.2) {
        considered++;
        const cand = [
          ['portal:bubble-pop', new Vector3(-a, PORTAL_Y, zo)],
          ['portal:star-catcher', new Vector3(-b, PORTAL_Y, zi)],
          ['portal:fireflies', new Vector3(b, PORTAL_Y, zi)],
          ['portal:little-shark', new Vector3(a, PORTAL_Y, zo)],
        ];
        if (!cand.every(([, p]) => framedEverywhere(p))) continue;
        if (!cand.every(([, p]) => clears(p, FIXED))) continue;
        framedOk++;
        const pool = [...FIXED, ...cand];
        let w = Infinity;
        let detail = null;
        for (const [id, p] of cand) {
          const g = worstGap(
            [id, p],
            pool.filter(([c]) => c !== id),
          );
          if (g.px < w) {
            w = g.px;
            detail = g;
          }
        }
        if (!best || w > best.w) best = { a, b, zo, zi, cand, w, detail };
      }
    }
  }
}

console.log(`  ${considered} candidates swept; ${framedOk} kept every portal framed and clear at all nine viewports.\n`);
for (const [id, p] of best.cand) console.log(`    ${id.padEnd(20)} (${p.x.toFixed(2).padStart(5)}, 0, ${p.z.toFixed(2).padStart(5)})`);
console.log(`\n  a=${best.a.toFixed(1)}  b=${best.b.toFixed(1)}  zOuter=${best.zo.toFixed(1)}  zInner=${best.zi.toFixed(1)}`);
console.log(`  worst gap: ${best.w.toFixed(1)} px  (vs ${best.detail.against} at ${best.detail.at})`);

// ------------------------------------------------------------------ stage 2

console.log('\n==== 3. STAGE TWO: THE THREE STONES, PLACED INTO WHAT IS LEFT\n');
console.log('  Each stone is placed at the grid point maximising its worst gap to everything');
console.log('  already placed, subject to being framed at all nine viewports — which the');
console.log('  shipped stones are not. Placed one at a time, each seeing the last.\n');

const placed = [...FIXED, ...best.cand];
const stones = [];
for (let n = 0; n < 3; n++) {
  let pick = null;
  for (let x = -4.4; x <= 4.4; x += 0.1) {
    for (let z = -4.4; z <= 4.4; z += 0.1) {
      const v = new Vector3(x, 0, z);
      if (!framedEverywhere(v)) continue;
      if (!clears(v, placed, 0.6)) continue;
      const g = worstGap(['stone', v], placed);
      if (!pick || g.px > pick.g.px) pick = { v, g };
    }
  }
  stones.push(pick);
  placed.push(['stone', pick.v]);
  console.log(
    `    stone ${n + 1}  (${pick.v.x.toFixed(2).padStart(5)}, 0, ${pick.v.z.toFixed(2).padStart(5)})   worst ${pick.g.px.toFixed(1)} px vs ${pick.g.against} at ${pick.g.at}`,
  );
}

// ------------------------------------------------------------------- verdict

console.log('\n==== 4. THE PROPOSAL, SCORED AS A WHOLE\n');
let finalWorst = Infinity;
let finalDetail = null;
for (const [id, p] of best.cand) {
  const g = worstGap(
    [id, p],
    placed.filter(([c]) => c !== id),
  );
  console.log(`  ${id.padEnd(20)} worst ${g.px.toFixed(1).padStart(6)} px vs ${String(g.against).padEnd(20)} at ${g.at}`);
  if (g.px < finalWorst) {
    finalWorst = g.px;
    finalDetail = g;
  }
}
console.log(`\n  shipped:  ${baseWorst.toFixed(1)} px from a portal to a different-class target`);
console.log(`  proposed: ${finalWorst.toFixed(1)} px  (vs ${finalDetail.against} at ${finalDetail.at})`);
console.log(
  finalWorst >= PROXIMITY_PX
    ? `  CLEARS the ${PROXIMITY_PX} px catchment at every shipping viewport.`
    : `  STILL UNDER ${PROXIMITY_PX} px — this family cannot solve it alone.`,
);

console.log('\n  stones now framed on every phone: ' + (stones.every((s) => framedEverywhere(s.v)) ? 'yes' : 'no'));

console.log('\n==== 5. PORTAL PAIRS UNDER THE PROPOSAL, PER VIEWPORT\n');
console.log('  viewport                 radius   worst portal pair                              gap');
for (const view of CAMS) {
  const pp = best.cand.map(([id, p]) => [id.replace('portal:', ''), toPx(p, view)]);
  let w = Infinity;
  let pair = '';
  for (let i = 0; i < pp.length; i++) {
    for (let j = i + 1; j < pp.length; j++) {
      const d = Math.hypot(pp[i][1].x - pp[j][1].x, pp[i][1].y - pp[j][1].y);
      if (d < w) {
        w = d;
        pair = `${pp[i][0]} / ${pp[j][0]}`;
      }
    }
  }
  console.log(`  ${view.label.padEnd(24)} ${view.radius.toFixed(2).padStart(6)}   ${pair.padEnd(38)} ${w.toFixed(1).padStart(6)} px`);
}
