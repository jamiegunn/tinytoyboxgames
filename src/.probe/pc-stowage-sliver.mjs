/**
 * RE-APPLYING THE METRIC THAT KILLED THE LAST DRAFT -- AND FIXING THE FIRST
 * REPLACEMENT METRIC I REACHED FOR, WHICH DID NOT WORK.
 * =========================================================================
 *
 * `.probe/pc-sliver-band.mjs` killed round 4's first fix (discrete outboard
 * barrels and rope coils) with two numbers over a continuous aspect sweep:
 *
 *     shipped furniture alone        0.0% of the aspect range shows a sliver
 *     with the outboard stores      43.3%
 *
 * The replacement fix -- elongated spar stowage along the rails -- has to face
 * the same metric, or the metric was never a standard, only a stick I picked up
 * to beat a draft I had already decided against.
 *
 * WHAT THE AREA METRIC CAN AND CANNOT SAY
 * ---------------------------------------
 * The old metric is `visible projected area / total projected area`, banded
 * 0.15..0.55. Its hidden premise is that a low visible fraction means an
 * unreadable object. That is true of a compact singular object and false of a
 * self-similar one -- the ship's own top rails are a few percent visible on
 * every phone and read perfectly. Run only the area metric and a spar run scores
 * badly BY CONSTRUCTION, exactly as the rails and the deck plank seams already
 * would, and those have never been defects. So the area metric is reported for
 * continuity and is not the decision.
 *
 * A FALSE START, RECORDED BECAUSE IT WAS WRONG IN AN INSTRUCTIVE WAY
 * -----------------------------------------------------------------
 * My first replacement metric compared the residue's extent ACROSS the object's
 * long axis with the whole object's extent across that axis, on the theory that
 * a transverse cut keeps the cross-section and an along-axis cut eats it. It
 * did not discriminate: it scored the spar run at 6.1% cross-section kept and a
 * barrel in the same place at 0.3%, both "mutilated", and both with a residue
 * still longer than it was wide.
 *
 * The reason is perspective, and it would have been easy to miss. The run leans
 * away from the eye, so its NEAR end projects large and its FAR end small. The
 * whole object's cross extent is set by the near end; the residue that survives
 * a narrow frame is the far end. The ratio was therefore measuring foreshortening,
 * not mutilation. A global cross-section comparison is meaningless on anything
 * that recedes.
 *
 * THE METRIC THAT ACTUALLY ASKS THE QUESTION: SPAN FILL
 * ----------------------------------------------------
 * Compare like with like by comparing LOCALLY. Take the residue's own interval
 * along the object's projected long axis, clip the WHOLE projected silhouette to
 * that same interval, and compare areas:
 *
 *     spanFill = visible area / area of the whole silhouette over the same span
 *
 * If the frame edge cut across the object, everything within the surviving span
 * is on screen and spanFill is 1: the object was SHORTENED. If the frame edge
 * cut along the object, part of every station in the span is missing and
 * spanFill falls: the object was MUTILATED. Foreshortening cancels, because
 * both areas are measured over the same stations.
 *
 * TWO CONTROLS, ONE ON EACH SIDE
 * ------------------------------
 * A threshold I invent is worth nothing. So the run is scored against the two
 * things this scene has already judged:
 *
 *   FORBIDDEN  a barrel staged at the run's own centroid -- the exact prop the
 *              rule bans from standing outboard, in the exact place.
 *   ACCEPTED   the ship's own top rails, which run off the frame at every
 *              aspect and which nobody has ever called a defect.
 *
 * If the stowage scores with the rails, the fix stands on the scene's existing
 * standard rather than on a number I chose. If it scores with the barrel, the
 * rule was a rationalisation and the fix dies with the draft it replaced.
 */
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { convexHull2D } from '../tests/framework/_footprint.mjs';

const M = await bundleEntry(
  'pc-stowage-sliver',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
  export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
  export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
  export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
  export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
  export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
  export { RAIL_STOWAGE_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/railStowage';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
  export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
  export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
  export { createRailStowage } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/railStowage/create';
  export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
  export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
  export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';
  export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell';
`,
);

const materials = M.createPirateCoveMaterials();
const opts = { materials };

/** Every world-space vertex under a root. Nothing re-derived, nothing guessed. */
const worldVerts = (root) => {
  root.updateMatrixWorld(true);
  const out = [];
  const v = new Vector3();
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      out.push(v.clone());
    }
  });
  return out;
};

const B = {
  anchor: (s, p) => M.createAnchor(s, p, opts),
  barrel: (s, p) => M.createBarrel(s, p, opts),
  ropeCoil: (s, p) => M.createRopeCoil(s, p, opts),
  cannon: (s, p) => M.createCannon(s, p, opts).root,
  shipWheel: (s, p) => M.createShipWheel(s, p, opts).root,
  treasureChest: (s, p) => M.createTreasureChest(s, p, opts).root,
};
const build = (name, kind, p) => ({ name, verts: worldVerts(B[kind](new Scene(), p)) });
const g = (kind, st, pre) => st.map((p, i) => build(`${pre ?? kind}${st.length > 1 ? i : ''}`, kind, p));

const EXISTING = [
  ...g('anchor', M.ANCHOR_STAGING),
  ...g('barrel', M.BARREL_STAGING),
  ...g('ropeCoil', M.ROPE_COIL_STAGING),
  ...g('cannon', M.CANNON_STAGING),
  ...g('shipWheel', M.SHIP_WHEEL_STAGING),
  ...g('treasureChest', M.TREASURE_CHEST_STAGING),
];

const stowageOpts = {
  materials: { weatheredWood: materials.weatheredWood, shellTrim: materials.shellTrim, rope: materials.rope },
};
const STOWAGE = M.RAIL_STOWAGE_STAGING.map((run, i) => ({
  name: `stowage${i}`,
  verts: worldVerts(M.createRailStowage(new Scene(), run, stowageOpts)),
}));

// FORBIDDEN CONTROL: a barrel standing where the starboard run stands.
const centroidOf = (verts) => {
  let sx = 0;
  let sz = 0;
  for (const v of verts) {
    sx += v.x;
    sz += v.z;
  }
  return { x: sx / verts.length, z: sz / verts.length };
};
const c1 = centroidOf(STOWAGE[1].verts);
const FORBIDDEN = [build('ctrlBarrel', 'barrel', { position: new Vector3(c1.x, 0, c1.z), rotY: 0, scale: 1 })];

// ACCEPTED CONTROL: the ship's own top rails, which already run off the frame.
const shell = M.createSceneShell(new Scene(), { wallHeight: 2, materials });
shell.updateMatrixWorld(true);
const ACCEPTED = [];
shell.traverse((o) => {
  if (!o.name.startsWith('railing_top_')) return;
  if (!o.name.includes('side')) return; // the two long side rails
  const v = new Vector3();
  const pts = [];
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  ACCEPTED.push({ name: o.name.replace('railing_top_', 'rail_'), verts: pts });
});

const cameraFor = (a) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', a);
  const c = new PerspectiveCamera(M.SCENE_CAMERA_FOV, a, 0.1, 100);
  c.position.copy(pose.position);
  c.lookAt(pose.target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;

/** Pixel-space projected hull on a 1000-tall canvas, so a wide viewport really is wider. */
const CANVAS_H = 1000;
const projectedHull = (cam, verts, aspect) => {
  const halfW = (CANVAS_H * aspect) / 2;
  const halfH = CANVAS_H / 2;
  const pts = [];
  for (const vert of verts) {
    if (!inFront(cam, vert)) continue;
    const p = vert.clone().project(cam);
    pts.push([p.x * halfW, p.y * halfH]);
  }
  if (pts.length < 3) return null;
  const hull = convexHull2D(pts);
  return hull.length >= 3 ? { hull, halfW, halfH } : null;
};

/** Sutherland-Hodgman clip of a convex polygon by one half-plane `keep(p) >= 0`. */
const clipHalf = (poly, keep, cut) => {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ain = keep(a) >= 0;
    const bin = keep(b) >= 0;
    if (ain) out.push(a);
    if (ain !== bin) out.push(cut(a, b));
  }
  return out;
};
const lerpAt = (a, b, ka, kb) => {
  const t = ka / (ka - kb);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};
const clipBy = (poly, keep) => (poly.length < 3 ? [] : clipHalf(poly, keep, (a, b) => lerpAt(a, b, keep(a), keep(b))));

const clipRect = (poly, halfW, halfH) => {
  let out = poly;
  out = clipBy(out, (p) => p[0] + halfW);
  out = clipBy(out, (p) => halfW - p[0]);
  out = clipBy(out, (p) => p[1] + halfH);
  out = clipBy(out, (p) => halfH - p[1]);
  return out;
};

const area = (poly) => {
  if (poly.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
};

/** Principal (long) axis of a hull, via its minimum-area rectangle. */
const longAxis = (hull) => {
  let best = { area: Infinity, ux: 1, uz: 0 };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const q of hull) {
      const u = q[0] * ux + q[1] * uz;
      const w = -q[0] * uz + q[1] * ux;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (w < v0) v0 = w;
      if (w > v1) v1 = w;
    }
    const ar = (u1 - u0) * (v1 - v0);
    if (ar >= best.area) continue;
    best = u1 - u0 >= v1 - v0 ? { area: ar, ux, uz } : { area: ar, ux: -uz, uz: ux };
  }
  return best;
};
const along = (ax, p) => p[0] * ax.ux + p[1] * ax.uz;

/**
 * One object at one aspect.
 *
 * `spanFill` is the decision quantity: of the whole silhouette lying within the
 * surviving span along the object's own axis, how much is actually on screen?
 */
const measure = (cam, o, aspect) => {
  const pj = projectedHull(cam, o.verts, aspect);
  if (!pj) return null;
  const full = area(pj.hull);
  if (full <= 0) return null;
  const clipped = clipRect(pj.hull, pj.halfW, pj.halfH);
  const vis = area(clipped);
  const frac = vis / full;
  if (vis <= 0) return { frac: 0, gone: true, whole: false };
  if (frac >= 0.999) return { frac, gone: false, whole: true, spanFill: 1, visPx: vis };

  const ax = longAxis(pj.hull);
  let u0 = Infinity;
  let u1 = -Infinity;
  for (const p of clipped) {
    const u = along(ax, p);
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
  }
  // The whole silhouette restricted to the SAME span along the object's axis.
  let span = clipBy(pj.hull, (p) => along(ax, p) - u0);
  span = clipBy(span, (p) => u1 - along(ax, p));
  const spanArea = area(span);
  return {
    frac,
    gone: false,
    whole: false,
    spanFill: spanArea > 1e-9 ? Math.min(1, vis / spanArea) : 1,
    visPx: vis,
  };
};

const LO = 0.15;
const HI = 0.55;
const N = 600;
const A0 = 0.4;
const A1 = 1.7778;
const ASPECT = (i) => A0 + (A1 - A0) * (i / N);
const pct = (n) => `${((n / (N + 1)) * 100).toFixed(1)}%`;

console.log(`==== 1. THE OLD AREA METRIC, for continuity (band ${LO}..${HI}, ${N + 1} samples ${A0} -> ${A1.toFixed(3)})`);
console.log('     Reported because it is the metric of record. NOT the decision --');
console.log('     it scores every self-similar run badly by construction, including the rails.\n');

const sweepArea = (props, label) => {
  let bad = 0;
  for (let i = 0; i <= N; i++) {
    const a = ASPECT(i);
    const cam = cameraFor(a);
    if (
      props.some((p) => {
        const m = measure(cam, p, a);
        return m && m.frac > LO && m.frac < HI;
      })
    ) {
      bad++;
    }
  }
  console.log(`  ${label.padEnd(44)} ${pct(bad).padStart(6)}`);
};
sweepArea(EXISTING, 'shipped furniture alone');
sweepArea([...EXISTING, ...STOWAGE], 'with rail stowage');
sweepArea(STOWAGE, '  the two stowage runs alone');
sweepArea(FORBIDDEN, '  FORBIDDEN control: barrel at the same spot');
sweepArea(ACCEPTED, "  ACCEPTED control: the ship's own side rails");

console.log('\n==== 2. SPAN FILL -- the decision metric');
console.log('     Over every aspect where the object is partly cut: is the residue');
console.log('     SHORTENED (spanFill 1.00, the cut ran across it) or MUTILATED');
console.log('     (spanFill low, the cut ran along it and ate every station)?\n');

const spanReport = (props, label) => {
  console.log(`  ${label}`);
  for (const p of props) {
    let partial = 0;
    let worst = 1;
    let sum = 0;
    let below90 = 0;
    for (let i = 0; i <= N; i++) {
      const a = ASPECT(i);
      const m = measure(cameraFor(a), p, a);
      if (!m || m.gone || m.whole) continue;
      partial++;
      sum += m.spanFill;
      if (m.spanFill < worst) worst = m.spanFill;
      if (m.spanFill < 0.9) below90++;
    }
    const mean = partial ? sum / partial : 1;
    console.log(
      `    ${p.name.padEnd(16)} partly cut ${pct(partial).padStart(6)} of aspects` +
        `   mean spanFill ${(mean * 100).toFixed(1)}%` +
        `   worst ${(worst * 100).toFixed(1)}%` +
        `   below 90% over ${pct(below90)}`,
    );
  }
};
spanReport(STOWAGE, 'RAIL STOWAGE -- the fix');
spanReport(ACCEPTED, "ACCEPTED control -- the ship's own side rails");
spanReport(FORBIDDEN, 'FORBIDDEN control -- a barrel in the same place');

console.log('\n==== 3. THE OPEN QUESTION: what a narrow phone actually sees');
console.log('     The eval left this unanswered: at aspect 0.562 coverage moved 4.5% -> 4.8%,');
console.log('     so "the phones are untouched" is exactly true only for the three narrowest.');
console.log('     Sizes are pixels on a 1000-tall canvas.\n');
const SHIPPING = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 768 / 1024],
  ['viewport 480x854', 480 / 854],
  ['iPhone SE 375x667', 375 / 667],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 360 / 900],
];
for (const [label, a] of SHIPPING) {
  const cam = cameraFor(a);
  const m = measure(cam, STOWAGE[1], a);
  const r = measure(cam, ACCEPTED[0], a);
  const fmt = (x) =>
    !x ? 'none' : x.gone ? 'OUT' : `${(x.frac * 100).toFixed(1)}% vis, spanFill ${(x.spanFill * 100).toFixed(0)}%, ${Math.round(x.visPx)} px2`;
  console.log(`  ${label.padEnd(24)} a=${a.toFixed(3)}   stowage: ${fmt(m).padEnd(40)} side rail: ${fmt(r)}`);
}

console.log('\n==== 4. WHY THE FIX IS NOT BEHAVING LIKE THE RAIL');
console.log('     The rail keeps spanFill at 98% everywhere; the stowage falls to 3.4%.');
console.log('     Both are "elongated in world". So world elongation is NOT the property.');
console.log('     What matters is the silhouette ON SCREEN and how the frame edge meets it.');
console.log('     `angle` is the projected long axis vs the vertical frame edge:');
console.log('     90 deg = the edge cuts straight across (shortens), 0 deg = along (mutilates).\n');
const geom = (cam, o, a) => {
  const pj = projectedHull(cam, o.verts, a);
  if (!pj) return null;
  const ax = longAxis(pj.hull);
  let u0 = Infinity,
    u1 = -Infinity,
    v0 = Infinity,
    v1 = -Infinity;
  for (const q of pj.hull) {
    const u = along(ax, q);
    const w = -q[0] * ax.uz + q[1] * ax.ux;
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (w < v0) v0 = w;
    if (w > v1) v1 = w;
  }
  // angle between the long axis and the VERTICAL frame edge direction (0,1)
  const dot = Math.abs(ax.uz);
  return { elong: (u1 - u0) / Math.max(1e-9, v1 - v0), angle: (Math.acos(Math.min(1, dot)) * 180) / Math.PI };
};
console.log('  aspect    stowage: elong  angle  spanFill   |   side rail: elong  angle  spanFill');
for (let i = 0; i <= 12; i++) {
  const a = A0 + (A1 - A0) * (i / 12);
  const cam = cameraFor(a);
  const gs = geom(cam, STOWAGE[1], a);
  const ms = measure(cam, STOWAGE[1], a);
  const gr = geom(cam, ACCEPTED[0], a);
  const mr = measure(cam, ACCEPTED[0], a);
  const f = (g2, m2) =>
    !g2 || !m2
      ? '   n/a                '
      : `${g2.elong.toFixed(1).padStart(6)} ${g2.angle.toFixed(0).padStart(5)}   ${m2.gone ? '  OUT' : `${(m2.spanFill * 100).toFixed(0).padStart(4)}%`}   `;
  console.log(`  ${a.toFixed(3)}    ${f(gs, ms)}  |               ${f(gr, mr)}`);
}
