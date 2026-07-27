/**
 * ROUND 5, ITERATION 3: RE-PRICING THE COMPOSITION CONSTRAINT AGAINST A WORLD
 * MODEL THAT IS NO LONGER WRONG.
 *
 * Two things were decided under models that have since been falsified, and both
 * decisions have to be re-taken rather than inherited:
 *
 *   1. The portals were searched as a SYMMETRIC family -- (+-a, zOuter) and
 *      (+-b, zInner). Nothing justified that; it was a way to make a brute-force
 *      sweep cheap. It also mirrors a scene that is not mirrored: the stream
 *      snakes from (-1.25, -5.6) to (-0.95, 5.6) crossing the centre line twice.
 *   2. "Portals belong at the BACK, where a doorway belongs" was measured and
 *      rejected at 30.8 px of portal/scenery margin -- but that measurement was
 *      taken inside the symmetric family and on a ground plane with no stream in
 *      it. A number produced by a falsified model is not evidence.
 *
 * So this prices four spatial policies against each other, on the corrected
 * model: every candidate cell must have its whole 1.4-unit disc framed at all
 * nine shipping viewports AND stand clear of the stream bed. Portals are placed
 * by greedy farthest-point from many seeds, then refined by lifting each one out
 * and re-placing it, which is the same technique stage two already uses.
 *
 * The point is not to pick the biggest number. Tier 1 only has to clear the 70 px
 * catchment; everything above that is slack, and slack spent on composition is
 * slack spent on the thing `vision.md` actually asks for. The point is to find
 * out how much composition is affordable now, because the last answer left 4.6 px
 * of margin and had no room to buy anything.
 */
import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { execSync } from 'node:child_process';

const M = await bundleEntry(
  'nature-portal-policy',
  `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { PROXIMITY_PX } from './src/utils/interaction/gestureRules';
`,
);
const PR = 0.7,
  NDC = 0.04,
  MIN_SEP = 1.7,
  STREAM_DAY = 0.15;
const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['square 900x900', 900, 900],
  ['iPad 768x1024', 768, 1024],
  ['480x854', 480, 854],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 360x900', 360, 900],
];
const CAMS = VIEWS.map(([l, w, h]) => {
  const p = M.resolveSceneCameraPose('nature', w / h);
  const c = new PerspectiveCamera(M.SCENE_CAMERA_FOV, w / h, 0.1, 100);
  c.position.copy(p.position);
  c.lookAt(p.target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return { l, w, h, c };
});
const px = (v, V) => {
  const n = v.clone().project(V.c);
  return { x: ((n.x + 1) / 2) * V.w, y: ((1 - n.y) / 2) * V.h, nx: n.x, ny: n.y, nz: n.z };
};
const framed = (v) =>
  CAMS.every((V) => {
    const s = px(v, V);
    return s.nz <= 1 && Math.abs(s.nx) <= 1 - NDC && Math.abs(s.ny) <= 1 - NDC;
  });
const discFramed = (v) =>
  framed(v) &&
  [
    [PR, 0],
    [-PR, 0],
    [0, PR],
    [0, -PR],
  ].every(([dx, dz]) => framed(new Vector3(v.x + dx, 0.3, v.z + dz)));

const SP = [
  new Vector3(-1.25, 0, -5.6),
  new Vector3(-0.8, 0, -3.9),
  new Vector3(-0.2, 0, -1.7),
  new Vector3(0.65, 0, 0.35),
  new Vector3(0.15, 0, 2.45),
  new Vector3(-0.95, 0, 5.6),
];
const s01 = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const eb = (t) => Math.min(s01(t / 0.09), s01((1 - t) / 0.09));
const bwid = (t) => 1.05 + Math.sin(t * Math.PI * 1.35 + 0.3) * 0.16 + Math.sin(t * Math.PI * 4.6) * 0.05;
const bed = (t) => (bwid(t) + 0.52 + Math.cos(t * Math.PI * 2.4 - 0.45) * 0.08) * (0.3 + eb(t) * 0.7);
const cur = new CatmullRomCurve3(SP, false, 'catmullrom', 0.7);
const S = [];
for (let i = 0; i <= 2000; i++) {
  const t = i / 2000;
  S.push({ p: cur.getPointAt(t), h: bed(t) / 2 });
}
const streamClear = (x, z, r) => {
  let w = Infinity;
  for (const s of S) w = Math.min(w, Math.hypot(x - s.p.x, z - s.p.z) - s.h - r);
  return w;
};

// Scenery as the AUTHOR staged it, read from git so this is stable across runs.
// Reading the working tree instead would make each solve bootstrap from the last
// one's output, which is a moving target dressed up as a baseline.
const atHead = (p) => execSync(`git show HEAD:./src/scenes/immersive-toybox-scenes/naturescene/${p}`, { encoding: 'utf8' });
const vecs = (s) => [...s.matchAll(/new Vector3\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)].map((m) => new Vector3(+m[1], +m[2], +m[3]));
const SCENERY = [];
for (const [cls, f] of [
  ['mushroom', 'mushrooms'],
  ['flower', 'flowers'],
  ['leaf', 'leaves'],
  ['stone', 'stones'],
  ['snail', 'snail'],
  ['log', 'log'],
  ['butterfly', 'butterflies'],
])
  for (const v of vecs(atHead(`staging/${f}.ts`))) SCENERY.push([cls, v]);

const sep = (a, b) => {
  let m = Infinity;
  for (const V of CAMS) {
    const p = px(a, V),
      q = px(b, V);
    if (p.nz > 1 || q.nz > 1) continue;
    m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y));
  }
  return m;
};
const minPair = (set) => {
  let m = Infinity;
  for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) m = Math.min(m, sep(set[i], set[j]));
  return m;
};
const t2of = (set) => {
  let m = Infinity;
  for (const v of set) for (const [, t] of SCENERY) m = Math.min(m, sep(v, t));
  return m;
};

const POLICIES = [
  ['A  anywhere framed + clear of the stream', () => true],
  ['B  back half only  (z <= -1.0)          ', (v) => v.z <= -1.0],
  ['C  back and middle (z <=  1.0)          ', (v) => v.z <= 1.0],
  ['D  no near foreground (z <= 2.5)        ', (v) => v.z <= 2.5],
];

console.log('==== WHAT DOES COMPOSITION COST, NOW THAT THE MODEL INCLUDES THE STREAM?\n');
console.log(`  tier 1 must clear ${M.PROXIMITY_PX} px. Anything above that is slack available to`);
console.log('  spend on where the portals actually belong.\n');
console.log("  policy                                     cells   tier 1    tier 2 vs the author's scenery");

for (const [label, pred] of POLICIES) {
  const cells = [];
  for (let x = -4.6; x <= 4.6; x += 0.1)
    for (let z = -4.6; z <= 4.6; z += 0.1) {
      const v = new Vector3(Math.round(x * 10) / 10, 0.3, Math.round(z * 10) / 10);
      if (!pred(v)) continue;
      if (!discFramed(v)) continue;
      if (streamClear(v.x, v.z, PR) < STREAM_DAY) continue;
      cells.push(v);
    }
  let bestSet = null,
    bestScore = -1;
  for (let seed = 0; seed < cells.length; seed += 5) {
    const set = [cells[seed]];
    while (set.length < 4) {
      let bc = null,
        bs = -1;
      for (const c of cells) {
        if (set.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < MIN_SEP)) continue;
        let m = Infinity;
        for (const s of set) m = Math.min(m, sep(s, c));
        if (m > bs) {
          bs = m;
          bc = c;
        }
      }
      if (!bc) break;
      set.push(bc);
    }
    if (set.length < 4) continue;
    const m = minPair(set);
    if (m > bestScore) {
      bestScore = m;
      bestSet = set;
    }
  }
  const t2 = bestSet ? t2of(bestSet) : NaN;
  console.log(
    `  ${label}  ${String(cells.length).padStart(5)}   ${bestSet ? bestScore.toFixed(1).padStart(6) : '  none'}    ${bestSet ? t2.toFixed(1).padStart(6) : '  none'}`,
  );
  if (bestSet)
    for (const v of bestSet)
      console.log(`      (${v.x.toFixed(1).padStart(5)}, 0, ${v.z.toFixed(1).padStart(5)})  stream ${streamClear(v.x, v.z, PR).toFixed(2)}`);
}
