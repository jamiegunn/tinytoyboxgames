/**
 * ROUND 5, THE FIX SOLVER, v5. NOW SEARCHING THE SCENE THAT EXISTS.
 *
 * WHY THERE IS A v5, IN ONE SENTENCE EACH
 * ---------------------------------------
 *   v2  scored candidates against a smaller field of competitors than the app
 *       uses, because it skipped off-frame targets. `pickByProximity` skips
 *       exactly one category -- behind the camera -- so an off-canvas flower
 *       still wins taps aimed at whatever IS visible near that edge.
 *   v3  measured CENTRES. A pedestal is 1.4 units wide, so v3 cheerfully put an
 *       inner pair 1.2 units apart, cleared its 70 px bar, and produced four
 *       portals fused into one slab. `.probe/nature-portal-fit.mjs` showed the
 *       missing constraint needs no projection at all: two coplanar discs the
 *       camera is in front of cannot be fused or separated by perspective, and
 *       the minimum non-overlap pitch is a flat 1.40 at every depth and viewport.
 *   v4  fixed that, cleared every bar it set -- 74.6 px tier 1, 70.6 px tier 2,
 *       0.40 units of grass between the closest rims -- and put two portals and
 *       four mushrooms IN THE RIVER. Bed violations went 3 -> 9.
 *
 * The through-line is not carelessness, it is the same structural error three
 * times: each version's model of the world was missing a part of the world, so
 * each version produced a TRUE number about a scene that was not this one.
 * Clearing a criterion is evidence about the criterion. The only thing that has
 * ever caught these is rendering the result and looking at it.
 *
 * WHAT v5 CHANGES
 * ---------------
 * 1. THE STREAM IS IN THE SEARCH SPACE. `.probe/_stream.mjs` imports the scene's
 *    own `createStreamContext` and `createBankSamples` and takes the obstacle to
 *    be the polygon between the two shoulder polylines -- the BANK, not the bed.
 *    The bed ribbon is nearly flat; the bank crest rises to y 0.15 while the
 *    pedestal's top face is at y 0.12, so where they overlap the bank comes up
 *    THROUGH the disc. Measuring against the bed understates the obstacle by
 *    about 0.25 units.
 *
 * 2. THE SYMMETRIC FAMILY IS GONE. v2-v4 searched portals as (+-a, zOuter) and
 *    (+-b, zInner). Nothing ever justified that -- it was a way to make a
 *    brute-force sweep cheap -- and it mirrors a scene that is not mirrored: the
 *    stream runs from (-1.25, -5.6) to (-0.95, 5.6) and crosses the centre line
 *    twice, so the left half and the right half are not interchangeable.
 *    `.probe/nature-portal-policy.mjs` priced the assumption: dropping it takes
 *    reachable tier 1 from 74.6 px to over 100. Portals are now placed
 *    independently, by greedy farthest-point from many seeds, then refined by
 *    lifting each one out and re-placing it against the other three.
 *
 * 3. THE BASELINE IS READ FROM git HEAD, NOT THE WORKING TREE. v4's answer is
 *    currently written into the tree, so a solver that reads the tree bootstraps
 *    from its own last output -- a moving target dressed up as a baseline. Every
 *    "in the tree" and "from ->" number below is the author's layout.
 *
 * WHAT HAS NOT CHANGED, BECAUSE IT SURVIVED
 * -----------------------------------------
 *   - Every tappable prop must be inside the frame at all nine shipping
 *     viewports, and for a portal the whole DISC must be, not its centre.
 *   - PORTAL_MIN_SEP = 2 * PEDESTAL_R + PORTAL_DAYLIGHT. The daylight is not
 *     decoration: a child aims at what they can see, so separation they cannot
 *     perceive is separation they cannot use, and inside a fused silhouette the
 *     tap is settled by the raycast -- draw order, not intent.
 *   - Releases are granted ONE prop at a time, only after a solve has provably
 *     failed, each printed with the number that forced it. A solver allowed to
 *     move everything is a redesign nobody reviewed; a solver forbidden to move
 *     anything reports a failure and calls it an answer, which is what v3 did.
 *
 * THE THREE COSTS, WHICH ARE NOT EQUAL
 * ------------------------------------
 *   tier 1  portal / portal    the wrong mini-game launches. Unrecoverable
 *                              without a child-hostile back-out.
 *   tier 2  portal / scenery   a game launches unasked, or a portal tap lands on
 *                              a mushroom. The first is expensive.
 *   tier 3  scenery / scenery  a wrong sparkle. The child taps again.
 *
 * TWO FLOORS, FROM DIFFERENT CONSTANTS
 * ------------------------------------
 * The contest is NEAREST-wins, so the boundary between two targets d px apart is
 * their perpendicular bisector, d/2 from each:
 *   d >= 2 * WOBBLE_TAP_TOLERANCE_PX = 56 px   one tap's own smear (the app
 *                                              concedes 28 px of travel DURING a
 *                                              tap) must not by itself cross into
 *                                              another answer.
 *   d >= PROXIMITY_PX = 70 px                  the forgiveness granted to a tap
 *                                              aimed at A must not reach B.
 *
 * ENV: POLICY=A|B|C|D  PORTAL_DAYLIGHT=0.3  STREAM_DAYLIGHT=0.2  RELEASE_CAP=12
 */

import { PerspectiveCamera, Vector3 } from 'three';
import { execSync } from 'node:child_process';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { bankClearance, BANK_MAX_Y } from './_stream.mjs';

const M = await bundleEntry(
  'nature-restage-solve',
  `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { PROXIMITY_PX, WOBBLE_TAP_TOLERANCE_PX } from './src/utils/interaction/gestureRules';
`,
);

const PROXIMITY_PX = M.PROXIMITY_PX;
const SMEAR_FLOOR = 2 * M.WOBBLE_TAP_TOLERANCE_PX;
const PORTAL_Y = 0.3;
const NDC_MARGIN = 0.04;

/** Pedestal disc radius, from `gamePortal.ts`. Not a guess; the cylinder is 1.4 wide. */
const PEDESTAL_R = 0.7;
/** Visible grass required between two pedestal rims, in world units. */
const PORTAL_DAYLIGHT = Number(process.env.PORTAL_DAYLIGHT ?? 0.3);
const PORTAL_MIN_SEP = 2 * PEDESTAL_R + PORTAL_DAYLIGHT;
/** Portal centre to scenery centre. 0.7 of it is pedestal, so this leaves 0.4 of grass. */
const CLEARANCE = PEDESTAL_R + 0.4;
/** Grass required between a prop's footprint and the outer edge of the bank. */
const STREAM_DAYLIGHT = Number(process.env.STREAM_DAYLIGHT ?? 0.2);
const POLICY = (process.env.POLICY ?? 'A').toUpperCase();

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

const framedCache = new Map();
const framedEverywhere = (v) => {
  const key = `${Math.round(v.x * 20)},${Math.round(v.y * 20)},${Math.round(v.z * 20)}`;
  const hit = framedCache.get(key);
  if (hit !== undefined) return hit;
  const out = CAMS.every((view) => {
    const s = px(v, view);
    return s.nz <= 1 && Math.abs(s.nx) <= 1 - NDC_MARGIN && Math.abs(s.ny) <= 1 - NDC_MARGIN;
  });
  framedCache.set(key, out);
  return out;
};

/**
 * Is the whole pedestal inside every shipping frame?
 *
 * The centre being framed is not enough for a prop 1.4 units wide -- that is the
 * same centres-only mistake v3 made about separation, applied to framing.
 */
const discFramed = (v) =>
  framedEverywhere(v) &&
  [
    [PEDESTAL_R, 0],
    [-PEDESTAL_R, 0],
    [0, PEDESTAL_R],
    [0, -PEDESTAL_R],
  ].every(([dx, dz]) => framedEverywhere(new Vector3(v.x + dx, 0, v.z + dz)));

// ------------------------------------------------- the author's layout, from git

/**
 * Read from git HEAD rather than the working tree. v4's answer is sitting in the
 * tree right now; a solver that reads the tree measures its own last output and
 * calls it a baseline.
 */
const atHead = (p) => execSync(`git show HEAD:./src/scenes/immersive-toybox-scenes/naturescene/${p}`, { encoding: 'utf8' });
const vecs = (s) => [...s.matchAll(/new Vector3\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)].map((m) => new Vector3(+m[1], +m[2], +m[3]));

const ALL_NON_PORTAL = [];
for (const [cls, file] of [
  ['mushroom', 'mushrooms'],
  ['flower', 'flowers'],
  ['leaf', 'leaves'],
  ['stone', 'stones'],
  ['snail', 'snail'],
  ['log', 'log'],
  ['butterfly', 'butterflies'],
])
  for (const v of vecs(atHead(`staging/${file}.ts`))) ALL_NON_PORTAL.push([cls, v]);

const HEAD_PORTALS = [
  ...atHead('environment.ts').matchAll(/gameId: '([^']+)', position: new Vector3\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g),
].map((m) => [`portal:${m[1]}`, new Vector3(+m[2], PORTAL_Y, +m[4])]);

/**
 * Butterflies hover at y 1.3-1.8, clear of the bank crest at 0.15 and clear of
 * the water, so a butterfly over the stream is a butterfly over a stream. They
 * are excluded from the stream test and from nothing else; a probe that cries
 * wolf about correct staging is a probe whose real findings get discounted.
 */
const AIRBORNE = (cls) => cls === 'butterfly';

// ------------------------------------------------------------ what may move

console.log('==== 0. WHAT IS ALLOWED TO MOVE\n');
console.log('  Three grounds, and no others, because a solver permitted to move everything');
console.log('  stops being a fix and becomes a redesign nobody reviewed:\n');
console.log('    off-frame  — the prop leaves the frame at some shipping viewport, so it is a');
console.log('                 tap target with no affordance and must move whatever else happens.');
console.log('    in the bank— the prop stands inside raised stream geometry. The bank crest');
console.log(`                 reaches y ${BANK_MAX_Y.toFixed(3)}; anything with a stem is growing out of a river.`);
console.log('    stone      — the family is already indicted: two of three are off-frame, all');
console.log('                 three are staged as one back-right cluster, and moving two of');
console.log('                 three would split a group the composition reads as one.');
console.log('    released   — leaving the prop fixed makes tier 2 UNREACHABLE. Granted one at a');
console.log('                 time, only after a solve has failed, each printed with the number');
console.log('                 that forced it.\n');

const MOVERS = [];
const ANCHORED = [];
for (const [cls, v] of ALL_NON_PORTAL) {
  const off = !framedEverywhere(v);
  const wet = !AIRBORNE(cls) && bankClearance(v.x, v.z) < 0;
  if (off || wet || cls === 'stone') {
    MOVERS.push([cls, v]);
    const why = [off && 'off-frame', wet && `in the bank (${bankClearance(v.x, v.z).toFixed(2)})`, !off && !wet && 'stone family'].filter(Boolean).join(', ');
    console.log(`    ${cls.padEnd(10)} (${v.x.toFixed(2).padStart(5)}, 0, ${v.z.toFixed(2).padStart(5)})   ${why}`);
  } else ANCHORED.push([cls, v]);
}
console.log(`\n  ${MOVERS.length} of ${ALL_NON_PORTAL.length} non-portal props indicted up front; ${ANCHORED.length} stay where the author put them.`);

// ------------------------------------------------------------- stage one

const POLICIES = {
  A: ['anywhere framed and clear of the bank', () => true],
  B: ['back half only (z <= -1.0)', (v) => v.z <= -1.0],
  C: ['back and middle (z <= 1.0)', (v) => v.z <= 1.0],
  D: ['no near foreground (z <= 2.5)', (v) => v.z <= 2.5],
};
const [policyLabel, policyPred] = POLICIES[POLICY];

console.log('\n==== 1. THE FOUR PORTALS\n');
console.log(`  policy ${POLICY}: ${policyLabel}`);
console.log(`  pedestal radius ${PEDESTAL_R}, daylight between rims ${PORTAL_DAYLIGHT} => centres >= ${PORTAL_MIN_SEP.toFixed(2)} apart`);
console.log(`  whole DISC framed at all nine viewports, and >= ${STREAM_DAYLIGHT} of grass to the bank\n`);

const CELLS = [];
for (let x = -4.6; x <= 4.601; x += 0.1) {
  for (let z = -4.6; z <= 4.601; z += 0.1) {
    const v = new Vector3(Math.round(x * 10) / 10, PORTAL_Y, Math.round(z * 10) / 10);
    if (!policyPred(v)) continue;
    if (!discFramed(v)) continue;
    if (bankClearance(v.x, v.z, PEDESTAL_R) < STREAM_DAYLIGHT) continue;
    CELLS.push(v);
  }
}
console.log(`  ${CELLS.length} cells survive framing and the bank.`);

/**
 * Projected pixel coordinates are precomputed for every cell at every viewport.
 * Refinement lifts each portal out and rescans all cells against the other three
 * plus the anchored scenery; doing that with live projections is millions of
 * matrix multiplies for numbers that never change.
 */
const CELL_PX = CELLS.map((v) => CAMS.map((view) => px(v, view)));
const cellSep = (i, j) => {
  let m = Infinity;
  for (let k = 0; k < CAMS.length; k++) {
    const a = CELL_PX[i][k];
    const b = CELL_PX[j][k];
    if (a.nz > 1 || b.nz > 1) continue;
    m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y));
  }
  return m;
};

/**
 * Tier 2 decomposes: a portal's worst screen gap to the anchored scenery depends
 * only on where that portal is, so it is a per-cell constant and the layout's
 * tier 2 is the min over its four cells. That also makes the release loop exact
 * -- the blocking prop is whichever one realises that min.
 */
let sceneryMin = [];
let sceneryWho = [];
const recomputeScenery = () => {
  const SC_PX = ANCHORED.map(([, t]) => CAMS.map((view) => px(t, view)));
  sceneryMin = CELLS.map((v, i) => {
    let m = Infinity;
    let who = -1;
    for (let s = 0; s < ANCHORED.length; s++) {
      for (let k = 0; k < CAMS.length; k++) {
        const a = CELL_PX[i][k];
        const b = SC_PX[s][k];
        if (a.nz > 1 || b.nz > 1) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < m) {
          m = d;
          who = s;
        }
      }
    }
    sceneryWho[i] = who;
    void v;
    return m;
  });
};

/** World-space admissibility of a cell given the anchored props (not the portals). */
let cellOk = [];
const recomputeCellOk = () => {
  cellOk = CELLS.map((v) => ANCHORED.every(([, t]) => Math.hypot(v.x - t.x, v.z - t.z) >= CLEARANCE));
};

const key = (t1, t2) => Math.min(t1, PROXIMITY_PX) * 1000 + t2;
const scoreSet = (idx) => {
  let t1 = Infinity;
  for (let i = 0; i < idx.length; i++) for (let j = i + 1; j < idx.length; j++) t1 = Math.min(t1, cellSep(idx[i], idx[j]));
  let t2 = Infinity;
  let who = -1;
  for (const c of idx)
    if (sceneryMin[c] < t2) {
      t2 = sceneryMin[c];
      who = sceneryWho[c];
    }
  return { t1, t2, who, key: key(t1, t2) };
};

const farEnough = (idx, c) => idx.every((i) => Math.hypot(CELLS[i].x - CELLS[c].x, CELLS[i].z - CELLS[c].z) >= PORTAL_MIN_SEP);

/**
 * Greedy farthest-point from many seeds, then lift-out-and-re-place refinement.
 *
 * Greedy alone leaves value on the table because each portal is blind to the ones
 * placed after it; refinement alone depends entirely on where it started. Running
 * both from a spread of seeds is the same technique stage two already uses, and
 * it is what replaces the symmetric sweep -- with four independent positions the
 * exhaustive search is 1500^4, which is not a search, it is a heat death.
 */
const solvePortals = () => {
  recomputeCellOk();
  recomputeScenery();
  const pool = CELLS.map((_, i) => i).filter((i) => cellOk[i]);
  if (pool.length < 4) return null;
  let best = null;
  const step = Math.max(1, Math.floor(pool.length / 120));
  for (let s = 0; s < pool.length; s += step) {
    const idx = [pool[s]];
    while (idx.length < 4) {
      let pick = -1;
      let pickScore = -1;
      for (const c of pool) {
        if (!farEnough(idx, c)) continue;
        let m = Infinity;
        for (const i of idx) m = Math.min(m, cellSep(i, c));
        if (m > pickScore) {
          pickScore = m;
          pick = c;
        }
      }
      if (pick < 0) break;
      idx.push(pick);
    }
    if (idx.length < 4) continue;
    for (let pass = 0; pass < 4; pass++) {
      let moved = 0;
      for (let slot = 0; slot < 4; slot++) {
        const others = idx.filter((_, k) => k !== slot);
        let pick = idx[slot];
        let pickKey = -1;
        for (const c of pool) {
          if (!farEnough(others, c)) continue;
          const trial = [...others, c];
          const sc = scoreSet(trial);
          if (sc.key > pickKey) {
            pickKey = sc.key;
            pick = c;
          }
        }
        if (pick !== idx[slot]) {
          idx[slot] = pick;
          moved++;
        }
      }
      if (!moved) break;
    }
    const sc = scoreSet(idx);
    if (!best || sc.key > best.key) best = { ...sc, idx: [...idx] };
  }
  return best;
};

let best = null;
const RELEASED = [];
const RELEASE_CAP = Number(process.env.RELEASE_CAP ?? 12);
// `attempt <= CAP`, not `< CAP`: a cap of 0 means "solve, release nothing", not
// "do not solve". The first version of this loop returned NO SOLUTION at cap 0,
// which is the answer to a different question.
for (let attempt = 0; attempt <= RELEASE_CAP; attempt++) {
  best = solvePortals();
  if (!best) break;
  if (attempt === RELEASE_CAP) break;
  if (best.t2 >= PROXIMITY_PX || best.who < 0) break;
  const [cls, v] = ANCHORED[best.who];
  console.log(`  release ${attempt + 1}: best tier 2 with everything anchored is ${best.t2.toFixed(1)} px, blocked by`);
  console.log(`             the ${cls} at (${v.x.toFixed(2)}, 0, ${v.z.toFixed(2)}). Releasing it and re-solving.`);
  ANCHORED.splice(best.who, 1);
  MOVERS.push([cls, v]);
  RELEASED.push([cls, v]);
}
if (!best) {
  console.log('\n  NO SOLUTION under this policy with these constraints.');
  process.exit(1);
}

/** The four portals keep the author's left-to-right identity order where possible. */
const IDS = ['portal:bubble-pop', 'portal:star-catcher', 'portal:fireflies', 'portal:little-shark'];
const chosen = best.idx.map((i) => CELLS[i]).sort((p, q) => p.x - q.x);
const PORTALS = chosen.map((v, k) => [IDS[k], v]);

const worstRimGap = (cand) => {
  let worst = Infinity;
  for (let i = 0; i < cand.length; i++)
    for (let j = i + 1; j < cand.length; j++) worst = Math.min(worst, Math.hypot(cand[i][1].x - cand[j][1].x, cand[i][1].z - cand[j][1].z) - 2 * PEDESTAL_R);
  return worst;
};

console.log('');
for (const [id, p] of PORTALS)
  console.log(
    `    ${id.padEnd(20)} (${p.x.toFixed(2).padStart(5)}, 0, ${p.z.toFixed(2).padStart(5)})   bank ${bankClearance(p.x, p.z, PEDESTAL_R).toFixed(2)}`,
  );
console.log(`\n  tier 1 (portal/portal): ${best.t1.toFixed(1)} px    tier 2 vs anchored scenery: ${best.t2.toFixed(1)} px`);
console.log(`  closest two pedestal rims: ${worstRimGap(PORTALS).toFixed(2)} world units of grass`);
console.log(`  props released to get here: ${RELEASED.length === 0 ? 'none' : RELEASED.map(([c]) => c).join(', ')}`);
console.log(
  `  TOTAL SCOPE: ${MOVERS.length} of ${ALL_NON_PORTAL.length} non-portal props move (${MOVERS.length - RELEASED.length} indicted up front, ${RELEASED.length} released on proven failure).`,
);

// ------------------------------------------------------------- stage two

console.log('\n==== 2. THE DISPLACED PROPS, PLACED AND THEN REFINED\n');

/**
 * A separate grid per hover height, and NOT one grid used for everything.
 *
 * Butterflies are staged at y 1.3 to 1.8. A grid built at y 0 and handed to a
 * butterfly does two wrong things at once: it lands the butterfly on the grass,
 * and it tests framing at the wrong height, which on a portrait phone is a
 * different answer entirely. It also applies the bank constraint to a prop that
 * is 1.3 units above the bank crest -- a butterfly over the stream is a
 * butterfly over a stream, and forbidding it would be the probe inventing a
 * defect. So the bank filter is applied only to props that touch the ground.
 */
const gridCache = new Map();
const gridFor = (y) => {
  const k = y.toFixed(2);
  if (gridCache.has(k)) return gridCache.get(k);
  const g = [];
  for (let x = -4.6; x <= 4.601; x += 0.1) {
    for (let z = -4.6; z <= 4.601; z += 0.1) {
      const v = new Vector3(Math.round(x * 10) / 10, y, Math.round(z * 10) / 10);
      if (!framedEverywhere(v)) continue;
      if (y < 0.5 && bankClearance(v.x, v.z) < STREAM_DAYLIGHT) continue;
      g.push(v);
    }
  }
  gridCache.set(k, g);
  return g;
};
console.log(`  ${gridFor(0).length} ground positions are framed at all nine viewports and clear of the bank.\n`);

const isP = (c) => c.startsWith('portal:');
const worstGap = (probe, targets) => {
  let best2 = { px: Infinity, at: null, against: null };
  for (const view of CAMS) {
    const a = px(probe[1], view);
    if (a.nz > 1) continue;
    for (const [cls, t] of targets) {
      if (cls === probe[0]) continue;
      const b = px(t, view);
      if (b.nz > 1) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < best2.px) best2 = { px: d, at: view.label, against: cls };
    }
  }
  return best2;
};

const placed = [...ANCHORED, ...PORTALS];
const slots = MOVERS.map(([cls, from]) => ({ cls, y: from.y, v: null }));

const bestSpot = (cls, y, others) => {
  let pick = null;
  for (const v of gridFor(y)) {
    // Scenery must clear a pedestal by more than it must clear another pebble:
    // the portal is 0.7 units of disc, and a prop standing on a portal rim is
    // exactly the 0.22-unit overlap this round was opened to fix.
    if (!others.every(([c, t]) => Math.hypot(v.x - t.x, v.z - t.z) >= (isP(c) ? CLEARANCE : 0.55))) continue;
    const g = worstGap([cls, v], others);
    // Keeping the portals clear dominates; own gap breaks ties. The cap sits
    // ABOVE the catchment on purpose: capping it AT 70 makes the solver stop
    // caring the moment it clears the bar, and it duly returned 70.1 px -- one
    // grid step from failing, which is a coincidence, not a margin.
    const portalCost = Math.min(...others.filter(([c]) => isP(c)).map(([c, t]) => worstGap([c, t], [[cls, v]]).px));
    const k = Math.min(portalCost, 90) * 1000 + g.px;
    if (!pick || k > pick.key) pick = { v, g, key: k };
  }
  return pick;
};

for (const slot of slots) {
  const pick = bestSpot(slot.cls, slot.y, placed);
  slot.v = pick.v;
  placed.push([slot.cls, slot.v]);
}
let pass = 0;
for (;;) {
  pass++;
  let moved = 0;
  for (const slot of slots) {
    const others = placed.filter(([, v]) => v !== slot.v);
    const pick = bestSpot(slot.cls, slot.y, others);
    if (pick.v.x !== slot.v.x || pick.v.z !== slot.v.z) {
      const idx = placed.findIndex(([, v]) => v === slot.v);
      slot.v = pick.v;
      placed[idx] = [slot.cls, slot.v];
      moved++;
    }
  }
  console.log(`  refinement pass ${pass}: ${moved} prop(s) relocated`);
  if (moved === 0 || pass >= 6) break;
}

// -------------------------------------------------------------- verdict

const layoutMin = (all, filter) => {
  let b = { px: Infinity, at: null, pair: null };
  for (const view of CAMS) {
    const proj = all.map(([c, v]) => [c, px(v, view)]).filter(([, s]) => s.nz <= 1);
    for (let i = 0; i < proj.length; i++)
      for (let j = i + 1; j < proj.length; j++) {
        if (proj[i][0] === proj[j][0]) continue;
        if (!filter(proj[i][0], proj[j][0])) continue;
        const d = Math.hypot(proj[i][1].x - proj[j][1].x, proj[i][1].y - proj[j][1].y);
        if (d < b.px) b = { px: d, at: view.label, pair: `${proj[i][0]} / ${proj[j][0]}` };
      }
  }
  return b;
};
const TIER1 = (a, b) => isP(a) && isP(b);
const TIER2 = (a, b) => isP(a) !== isP(b);
const TIER3 = (a, b) => !isP(a) && !isP(b);

const HEAD_ALL = [...ALL_NON_PORTAL, ...HEAD_PORTALS];

console.log('\n==== 3. THE AUTHOR’S LAYOUT vs PROPOSED, BY TIER\n');
console.log(`  floors: ${SMEAR_FLOOR} px (a single tap's own smear) and ${PROXIMITY_PX} px (the forgiveness radius)\n`);
console.log('  tier                        author                        proposed');
for (const [name, f] of [
  ['1  portal / portal', TIER1],
  ['2  portal / scenery', TIER2],
  ['3  scenery / scenery', TIER3],
]) {
  const s = layoutMin(HEAD_ALL, f);
  const p = layoutMin(placed, f);
  const mark = (v) => (v >= PROXIMITY_PX ? 'ok  ' : v >= SMEAR_FLOOR ? 'thin' : 'FAIL');
  console.log(`  ${name.padEnd(24)} ${s.px.toFixed(1).padStart(6)} px ${mark(s.px)} ${String(s.pair)}`);
  console.log(`  ${''.padEnd(24)} ${p.px.toFixed(1).padStart(6)} px ${mark(p.px)} ${String(p.pair)}  @ ${p.at}`);
}

const inBank = (set) => set.filter(([c, v]) => !AIRBORNE(c) && bankClearance(v.x, v.z, isP(c) ? PEDESTAL_R : 0) < 0);
console.log(
  `\n  off-frame at some viewport — author: ${HEAD_ALL.filter(([, v]) => !framedEverywhere(v)).length}, proposed: ${placed.filter(([, v]) => !framedEverywhere(v)).length}`,
);
console.log(`  overlapping the bank        — author: ${inBank(HEAD_ALL).length}, proposed: ${inBank(placed).length}`);
for (const [c, v] of inBank(placed))
  console.log(`      still wet: ${c} (${v.x.toFixed(1)}, ${v.z.toFixed(1)})  ${bankClearance(v.x, v.z, isP(c) ? PEDESTAL_R : 0).toFixed(2)}`);
console.log(`  closest two pedestal rims   — author: ${worstRimGap(HEAD_PORTALS).toFixed(2)} units, proposed: ${worstRimGap(PORTALS).toFixed(2)} units`);
console.log('  (negative means the two discs interpenetrate and read as one object)');

console.log('\n==== 4. THE LAYOUT TO WRITE\n');
console.log('  portals (environment.ts):');
for (const [id, p] of PORTALS) console.log(`    ${id.replace('portal:', '').padEnd(14)} new Vector3(${p.x.toFixed(1)}, 0, ${p.z.toFixed(1)})`);
// Printed FROM -> TO, not just TO. Several mushrooms move and they are
// distinguished only by their variant in the staging array; a list of
// destinations alone has to be matched back to sources by hand, in MOVERS order,
// which is exactly the silent off-by-one that would swap two variants and never
// show up in any measurement this round takes.
console.log('\n  displaced scenery (from -> to; match on the FROM coordinate):');
for (let i = 0; i < slots.length; i++) {
  const [, from] = MOVERS[i];
  console.log(
    `    ${slots[i].cls.padEnd(10)} (${from.x.toFixed(1).padStart(4)}, ${from.y.toFixed(1)}, ${from.z.toFixed(1).padStart(4)})  ->  new Vector3(${slots[i].v.x.toFixed(1)}, ${slots[i].v.y.toFixed(1)}, ${slots[i].v.z.toFixed(1)})`,
  );
}
