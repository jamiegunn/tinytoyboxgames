import { PerspectiveCamera, Spherical, Vector3 } from 'three';
const FOV = 50;
const P = { azimuth: Math.PI, polar: 1.2, distance: 10, target: [0, 0.3, 0], minDistance: 9, maxDistance: 10, ceilingY: 4.8 };
const A = [
  ['landscape', 1280 / 720],
  ['tablet', 1024 / 768],
  ['square', 1],
  ['iPad portrait', 768 / 1024],
  ['480x854', 480 / 854],
  ['iPhone 15', 393 / 852],
  ['Pixel 8', 412 / 915],
  ['extreme', 0.4],
];
const mult = (a) => (a < 1 ? (1.0 / a) * 0.75 : 1);
const camFor = (a) => {
  const t = new Vector3(...P.target);
  const r = Math.min(Math.max(P.distance * mult(a), P.minDistance), P.maxDistance);
  const p = t.clone().add(new Vector3().setFromSpherical(new Spherical(r, P.polar, P.azimuth)));
  if (p.y > P.ceilingY) p.y = P.ceilingY;
  const c = new PerspectiveCamera(FOV, a, 0.1, 100);
  c.position.copy(p);
  c.lookAt(t);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
const CAMS = A.map(([l, a]) => [l, camFor(a)]);
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
const over = (x, y, z, cam) => {
  const n = new Vector3(x, y, z).project(cam);
  return Math.max(Math.abs(n.x) - 1, Math.abs(n.y) - 1);
};

for (const [need, label] of [
  [3, 'inside at iPad portrait (0.75) too'],
  [4, 'inside at 480x854 too'],
  [7, 'inside at every aspect'],
]) {
  let best = null;
  for (let x = -6.5; x <= 6.5; x += 0.1)
    for (let z = -6; z <= 6; z += 0.1) {
      if (z > halfD - 0.8 || z < -halfD + 0.8 || Math.abs(x) > dhw(z) - 0.9) continue;
      let ok = true;
      for (let i = 0; i <= need; i++)
        if (over(x, 0.4, z, CAMS[i][1]) > -0.06) {
          ok = false;
          break;
        }
      if (!ok) continue;
      const clr = Math.min(...FIXED.map(([, px, pz, r]) => Math.hypot(x - px, z - pz) - r - 1.1));
      if (clr < 0.6) continue;
      if (!best || clr > best.clr) best = { x, z, clr };
    }
  console.log(
    best
      ? `chest ${label.padEnd(32)} -> (${best.x.toFixed(1)}, ${best.z.toFixed(1)})  clearance ${best.clr.toFixed(2)}u`
      : `chest ${label.padEnd(32)} -> no legal spot`,
  );
}
