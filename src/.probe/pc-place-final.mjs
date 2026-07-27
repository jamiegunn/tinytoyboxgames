import { PerspectiveCamera, Spherical, Vector3 } from 'three';
const FOV = 50;
const P = { azimuth: Math.PI, polar: 1.2, distance: 10, target: [0, 0.3, 0], minDistance: 9, maxDistance: 10, ceilingY: 4.8 };
const ASPECTS = [
  ['landscape', 1280 / 720],
  ['tablet', 1024 / 768],
  ['square', 1],
  ['iPad portrait', 768 / 1024],
  ['480x854', 480 / 854],
  ['iPhone SE', 375 / 667],
  ['iPhone 15', 393 / 852],
  ['Pixel 8', 412 / 915],
  ['extreme', 0.4],
];
const mult = (a) => (a < 1 ? (1.0 / a) * 0.75 : 1);
const camFor = (a) => {
  const t = new Vector3(...P.target);
  const r = Math.min(Math.max(P.distance * mult(a), P.minDistance), P.maxDistance);
  const pos = t.clone().add(new Vector3().setFromSpherical(new Spherical(r, P.polar, P.azimuth)));
  if (pos.y > P.ceilingY) pos.y = P.ceilingY;
  const c = new PerspectiveCamera(FOV, a, 0.1, 100);
  c.position.copy(pos);
  c.lookAt(t);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
const CAMS = ASPECTS.map(([l, a]) => [l, camFor(a)]);

const PORTAL = [0, 0.3, -4.2];
console.log('portal candidate (0, 0, -4.2), sampled at ring height y=0.3:');
for (const [l, c] of CAMS) {
  const n = new Vector3(...PORTAL).project(c);
  console.log(`  ${l.padEnd(14)} ndc (${n.x.toFixed(2)}, ${n.y.toFixed(2)})   margin ${(-Math.max(Math.abs(n.x) - 1, Math.abs(n.y) - 1)).toFixed(3)}`);
}
// apparent on-screen size at each aspect, as a fraction of frame width
console.log('\napparent portal diameter (disc radius 1.0) as a fraction of frame width:');
for (const [l, c] of CAMS) {
  const a = new Vector3(-1, 0.3, -4.2).project(c);
  const b = new Vector3(1, 0.3, -4.2).project(c);
  console.log(`  ${l.padEnd(14)} ${((Math.abs(b.x - a.x) / 2) * 100).toFixed(1)}%`);
}
// old position for comparison
console.log('\nold portal (4.0, 0, 1.0) for comparison:');
for (const [l, c] of CAMS) {
  const n = new Vector3(4.0, 0.3, 1.0).project(c);
  const o = Math.max(Math.abs(n.x) - 1, Math.abs(n.y) - 1);
  console.log(`  ${l.padEnd(14)} ndc (${n.x.toFixed(2)}, ${n.y.toFixed(2)})   ${o > 0 ? `OFF-SCREEN by ${o.toFixed(3)}` : `inside by ${(-o).toFixed(3)}`}`);
}

// Chest: maximise clearance from everything, stay well inside the landscape frame,
// and stay off the narrow visible strip so it never crowds the portal.
const FIXED = [
  ['anchor', -4.5, 3.5, 1.0],
  ['barrel0', -3.2, -1.5, 0.6],
  ['barrel1', -3.8, -0.8, 0.6],
  ['barrel2', -2.8, -0.4, 0.6],
  ['barrel3', -3.5, 0.2, 0.6],
  ['cannon', 4.0, 3.5, 1.0],
  ['rope0', -1.5, 1.5, 0.6],
  ['rope1', 2.0, 0.5, 0.6],
  ['wheel', 0, 2.8, 0.9],
  ['owl', 0, -0.5, 0.9],
  ['mast', 0, 3.9, 0.5],
  ['portal', 0, -4.2, 1.0],
];
const halfW = 7.5,
  halfD = 6.5,
  sternCut = 2.625,
  bowNarrow = 3.75;
const dhw = (z) => {
  const t = (z + halfD) / (2 * halfD);
  return t > 0.5 ? halfW - sternCut * (t - 0.5) * 2 : halfW - bowNarrow * (0.5 - t) * 2;
};
let best = null;
for (let x = -6.5; x <= 6.5; x += 0.1)
  for (let z = -6; z <= 6; z += 0.1) {
    if (z > halfD - 0.8 || z < -halfD + 0.8 || Math.abs(x) > dhw(z) - 0.9) continue;
    const n = new Vector3(x, 0.4, z).project(CAMS[0][1]);
    if (Math.abs(n.x) > 0.88 || Math.abs(n.y) > 0.88) continue;
    const clr = Math.min(...FIXED.map(([, px, pz, r]) => Math.hypot(x - px, z - pz) - r - 1.1));
    if (!best || clr > best.clr) best = { x, z, clr };
  }
console.log(`\nbest chest spot: (${best.x.toFixed(1)}, ${best.z.toFixed(1)})  clearance ${best.clr.toFixed(2)}u`);
for (const [l, c] of CAMS) {
  const n = new Vector3(best.x, 0.4, best.z).project(c);
  const o = Math.max(Math.abs(n.x) - 1, Math.abs(n.y) - 1);
  console.log(`  ${l.padEnd(14)} ${o > 0 ? `off by ${o.toFixed(2)}` : `in by ${(-o).toFixed(2)}`}`);
}
