/**
 * ROUND 5, FALSIFICATION 9 -- AGAINST MY OWN FIX, AGAIN, AND FOR THE SAME REASON.
 *
 * v3 was falsified because its criterion measured CENTRES and a portal has WIDTH.
 * v4 fixed that, cleared every numeric bar it set -- tier 1 74.6 px, tier 2
 * 70.6 px, 0.40 world units of grass between the closest two pedestal rims -- was
 * written into the tree, rendered, and looked at.
 *
 * Two of the four portals are standing IN THE STREAM.
 *
 * This is not a near miss. `after2-iphone-se.png` shows a pedestal disc clipping
 * through the water surface and out the far bank, with the bank geometry passing
 * through the disc. The solver has no idea the stream exists: it models the
 * ground as an unobstructed plane and scores candidate positions on projected tap
 * separation alone. Every position it has ever proposed, in v2, v3 and v4, was
 * chosen from a search space that includes the middle of a river.
 *
 * Structurally this is the SAME error as v3's, one level out. v3's model of a
 * portal was missing the portal's width. v4's model of the GROUND is missing the
 * ground's contents. Both produce a confident number against an incomplete world,
 * and in both cases the number was true and the layout was wrong. Clearing a
 * criterion is evidence about the criterion, not about the scene, and the only
 * thing that has caught either of these is rendering it and looking.
 *
 * Why it is a real defect and not a cosmetic one:
 *
 *   - `soul.md` asks for a place that behaves like a place. Solid objects do not
 *     pass through each other, and a child who has ever seen a puddle knows a
 *     stone platform does not float halfway into a river with the water drawn
 *     over the top of it. The scene stops being somewhere and becomes a diagram.
 *   - `vision.md` asks for "soft cinematic framing rather than a flat game
 *     board". Props laid down on a surface irrespective of what is already there
 *     is the flat game board -- it is what a game board IS.
 *   - The stream is itself interactive (`stream/interaction.ts`), so a pedestal
 *     lying across it puts two different tappable surfaces in the same pixels and
 *     hands the outcome to the raycast, which is the tier-1 mechanism this whole
 *     round exists to remove.
 *
 * WHAT IS MEASURED
 * ----------------
 * The stream is a `CatmullRomCurve3` through `STREAM_POINTS` with a per-t bed
 * width from `getBedWidth`. Its bed -- not its water -- is the obstacle: the bank
 * is raised geometry, so a prop overlapping the bed interpenetrates something
 * solid even where there is no water. For each prop this reports
 *
 *   clearance = (distance from prop centre to the curve) - bedHalfWidth - propR
 *
 * so clearance < 0 means the prop's own footprint overlaps the stream bed.
 * `propR` is the pedestal radius for portals and 0 for scenery, whose footprints
 * are small and whose own radii are read from the live scene elsewhere; taking 0
 * here makes the scenery numbers OPTIMISTIC, which is the safe direction for a
 * probe whose job is to find violations.
 *
 * The curve is sampled densely rather than solved analytically because a
 * Catmull-Rom spline's true closest-point has no closed form and an approximation
 * that silently reports "no violation" is the failure mode that got us here.
 */

import { CatmullRomCurve3, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'nature-stream-clearance',
  `
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

// Mirrored from `factory/props/complex/stream/shared/{layout,context}.ts`. Copied
// rather than imported because those live under a deep private path with no
// barrel; if they drift, `tests/room/scene-stream-clearance.test.mjs` imports the
// real ones and will disagree with this.
const STREAM_POINTS = [
  new Vector3(-1.25, 0, -5.6),
  new Vector3(-0.8, 0, -3.9),
  new Vector3(-0.2, 0, -1.7),
  new Vector3(0.65, 0, 0.35),
  new Vector3(0.15, 0, 2.45),
  new Vector3(-0.95, 0, 5.6),
];
const smooth01 = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const endBlend = (t) => Math.min(smooth01(t / 0.09), smooth01((1 - t) / 0.09));
const baseWaterWidth = (t) => 1.05 + Math.sin(t * Math.PI * 1.35 + 0.3) * 0.16 + Math.sin(t * Math.PI * 4.6) * 0.05;
const bedWidth = (t) => (baseWaterWidth(t) + 0.52 + Math.cos(t * Math.PI * 2.4 - 0.45) * 0.08) * (0.3 + endBlend(t) * 0.7);

const curve = new CatmullRomCurve3(STREAM_POINTS, false, 'catmullrom', 0.7);
const SAMPLES = 4000;
const SAMPLED = [];
for (let i = 0; i <= SAMPLES; i++) {
  const t = i / SAMPLES;
  SAMPLED.push({ t, p: curve.getPointAt(t), half: bedWidth(t) / 2 });
}

/** Signed clearance from a prop footprint of radius r at (x, z) to the stream bed. */
const clearance = (x, z, r) => {
  let worst = Infinity;
  let at = null;
  for (const s of SAMPLED) {
    const c = Math.hypot(x - s.p.x, z - s.p.z) - s.half - r;
    if (c < worst) {
      worst = c;
      at = s;
    }
  }
  return { c: worst, t: at.t, half: at.half };
};

const PEDESTAL_R = 0.7;

/**
 * The layout as the author shipped it, read from git rather than retyped, so the
 * "did I introduce this?" column cannot be quietly flattering.
 */
const { execSync } = await import('node:child_process');
const atHead = (path) => execSync(`git show HEAD:./src/scenes/immersive-toybox-scenes/naturescene/${path}`, { encoding: 'utf8' });
const vecs = (src) => [...src.matchAll(/new Vector3\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)].map((m) => new Vector3(+m[1], +m[2], +m[3]));

/**
 * Butterflies are excluded, not overlooked. They hover at y 1.3 to 1.8 -- above
 * the bank, above the water, above everything the bed geometry occupies -- so a
 * butterfly over a stream is a butterfly over a stream. Including them would have
 * produced two "violations" that are the scene working correctly, and a probe
 * that cries wolf about correct staging is a probe whose real findings get
 * discounted.
 */
const collect = (env, staging) => {
  const out = [];
  for (const p of env) out.push([`portal:${p.gameId}`, p.position, PEDESTAL_R]);
  for (const [cls, list] of staging) for (const v of list) out.push([cls, v, 0]);
  return out;
};

const NOW = collect(M.NATURE_ENVIRONMENT.portals, [
  ['mushroom', M.MUSHROOM_STAGING.map((e) => e.position)],
  ['flower', M.FLOWER_STAGING.map((e) => e.position)],
  ['leaf', M.LEAF_STAGING.map((e) => e.position)],
  ['stone', M.STONE_STAGING.map((e) => e.position)],
  ['snail', [M.SNAIL_STAGING.position]],
  ['log', [M.LOG_STAGING.position]],
]);

const headEnv = atHead('environment.ts');
const HEAD = collect(
  [...headEnv.matchAll(/gameId: '([^']+)', position: new Vector3\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)].map((m) => ({
    gameId: m[1],
    position: new Vector3(+m[2], +m[3], +m[4]),
  })),
  [
    ['mushroom', vecs(atHead('staging/mushrooms.ts'))],
    ['flower', vecs(atHead('staging/flowers.ts'))],
    ['leaf', vecs(atHead('staging/leaves.ts'))],
    ['stone', vecs(atHead('staging/stones.ts'))],
    ['snail', vecs(atHead('staging/snail.ts'))],
    ['log', vecs(atHead('staging/log.ts'))],
  ],
);

const score = (props) => props.map(([cls, v, r]) => ({ cls, v, r, ...clearance(v.x, v.z, r) })).sort((a, b) => a.c - b.c);

const headRows = score(HEAD);
const nowRows = score(NOW);
const headBad = headRows.filter((r) => r.c < 0);
const nowBad = nowRows.filter((r) => r.c < 0);

console.log('==== DOES ANY PROP STAND IN THE STREAM?\n');
console.log('  The stream bed is raised bank geometry, so overlapping it is');
console.log('  interpenetration even where there is no water. Portals are measured with');
console.log('  their real 0.7 pedestal radius; scenery is measured as a point, which makes');
console.log('  the scenery numbers optimistic -- the safe direction for a violation probe.');
console.log('  Butterflies are excluded: they hover at y 1.3-1.8, clear of the bed.\n');

console.log(`  AS THE AUTHOR SHIPPED IT (git HEAD): ${headBad.length} of ${headRows.length} props in the bed`);
for (const r of headBad)
  console.log(`    ${r.cls.padEnd(22)} (${r.v.x.toFixed(1).padStart(5)},${r.v.z.toFixed(1).padStart(5)})   ${r.c.toFixed(2).padStart(6)}`);

console.log(`\n  AS THIS ROUND HAS LEFT IT: ${nowBad.length} of ${nowRows.length} props in the bed`);
console.log('  prop                     pos          bed half-w   clearance');
for (const row of nowRows) {
  console.log(
    `    ${row.cls.padEnd(22)} (${row.v.x.toFixed(1).padStart(5)},${row.v.z.toFixed(1).padStart(5)})   ${row.half.toFixed(2).padStart(6)}     ${row.c.toFixed(2).padStart(6)}  ${row.c < 0 ? 'IN THE STREAM' : ''}`,
  );
}

console.log('');
if (nowBad.length) {
  console.log(`  Worst now: ${nowBad[0].cls} at ${nowBad[0].c.toFixed(2)} units -- its CENTRE is past the far bank.`);
  console.log(`  Net change from this round: ${headBad.length} -> ${nowBad.length}.`);
  console.log('');
  console.log('  VERDICT: the solver searches a plane the scene does not have. Every layout');
  console.log('  it has proposed was drawn from a space that includes the middle of a river,');
  console.log('  so its numbers were answers to a question about a different scene. The');
  console.log('  constraint is not a tuning parameter -- it is a missing part of the world.');
  console.log('  Note the HEAD column: some of these are inherited, not introduced, which');
  console.log('  makes the omission older than this round without making it less mine --');
  console.log('  the round claimed to have measured the staging and did not measure this.');
} else {
  console.log('  No prop overlaps the stream bed.');
}
