// Second pass. The first search found only 9 legal portal positions, all at the
// stern behind the mast, because the visible deck strip at the binding aspect
// is narrow AND the treasure chest sits in the middle of what is left.
//
// The binding aspect is iPad portrait (0.75), where the pull-back rule is a
// no-op by arithmetic accident, so removing `maxDistance` does not widen it.
//
// This pass searches for a portal position and a treasure-chest position
// together, and reports what each candidate costs.
import { PerspectiveCamera, Spherical, Vector3 } from 'three';

const FOV = 50;
const P = { azimuth: Math.PI, polar: 1.2, distance: 10, target: [0, 0.3, 0], minDistance: 9, maxDistance: 10, ceilingY: 4.8 };
const ASPECTS = [1280 / 720, 1024 / 768, 1, 768 / 1024, 480 / 854, 375 / 667, 393 / 852, 412 / 915, 0.4];
const LABELS = ['landscape', 'tablet', 'square', 'iPad portrait', '480x854', 'iPhone SE', 'iPhone 15', 'Pixel 8', 'extreme'];

const mult = (a) => (a < 1 ? (1.0 / a) * 0.75 : 1);
const camFor = (aspect) => {
  const target = new Vector3(...P.target);
  const r = Math.min(Math.max(P.distance * mult(aspect), P.minDistance), P.maxDistance);
  const pos = target.clone().add(new Vector3().setFromSpherical(new Spherical(r, P.polar, P.azimuth)));
  if (pos.y > P.ceilingY) pos.y = P.ceilingY;
  const c = new PerspectiveCamera(FOV, aspect, 0.1, 100);
  c.position.copy(pos);
  c.lookAt(target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
const CAMS = ASPECTS.map(camFor);

const worstOver = (x, y, z) => {
  let w = -Infinity,
    at = '';
  CAMS.forEach((cam, i) => {
    const n = new Vector3(x, y, z).project(cam);
    const o = Math.max(Math.abs(n.x) - 1, Math.abs(n.y) - 1);
    if (o > w) {
      w = o;
      at = LABELS[i];
    }
  });
  return { over: w, at };
};

// Fixed props: everything that is not the portal and not the chest.
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
];
const clearOf = (x, z, r, list) => Math.min(...list.map(([, px, pz, pr]) => Math.hypot(x - px, z - pz) - pr - r));

const halfW = 7.5,
  halfD = 6.5,
  sternCut = 2.625,
  bowNarrow = 3.75;
const deckHalfWidth = (z) => {
  const t = (z + halfD) / (2 * halfD);
  return t > 0.5 ? halfW - sternCut * (t - 0.5) * 2 : halfW - bowNarrow * (0.5 - t) * 2;
};
const onDeck = (x, z, r) => z < halfD - 0.6 && z > -halfD + 0.6 && Math.abs(x) <= deckHalfWidth(z) - 0.8 - (r - 1.0);

const PORTAL_R = 1.0,
  CHEST_R = 1.1;

// Where can the chest go? Anywhere on deck clear of the fixed props; it does not
// have to be on screen at every aspect (it is scenery, not an affordance), but
// it should stay visible in landscape.
const chestSpots = [];
for (let x = -6.5; x <= 6.5; x += 0.25) {
  for (let z = -6; z <= 6; z += 0.25) {
    if (!onDeck(x, z, CHEST_R)) continue;
    if (clearOf(x, z, CHEST_R, FIXED) < 0.5) continue;
    const land = new Vector3(x, 0.4, z).project(CAMS[0]);
    if (Math.abs(land.x) > 0.92 || Math.abs(land.y) > 0.92) continue;
    chestSpots.push([x, z]);
  }
}

const results = [];
for (let x = -6; x <= 6; x += 0.1) {
  for (let z = -6; z <= 6; z += 0.1) {
    if (!onDeck(x, z, PORTAL_R)) continue;
    const { over, at } = worstOver(x, 0.3, z);
    if (over > -0.1) continue;
    const cf = clearOf(x, z, PORTAL_R, FIXED);
    if (cf < 1.2) continue;
    // Is there still somewhere legal for the chest, >=1.2u from this portal?
    const chest = chestSpots.filter(([cx, cz]) => Math.hypot(cx - x, cz - z) - CHEST_R - PORTAL_R >= 1.2);
    if (!chest.length) continue;
    results.push({ x, z, over, at, cf, chestOptions: chest.length });
  }
}
results.sort((a, b) => a.over - b.over);
console.log(`${results.length} portal positions clear all nine aspects by >=0.10 NDC with >=1.2u clearance and leave room for the chest`);
console.log('\nbest by frame margin:');
for (const r of results.slice(0, 10)) {
  console.log(
    `  (${r.x.toFixed(1)}, ${r.z.toFixed(1)})  worst ${r.over.toFixed(3)} NDC at ${r.at.padEnd(14)} prop clearance ${r.cf.toFixed(2)}u   ${r.chestOptions} chest spots remain`,
  );
}
// Group by z band so the shape of the legal region is visible, not just the max.
const bands = new Map();
for (const r of results) {
  const k = Math.round(r.z);
  if (!bands.has(k)) bands.set(k, []);
  bands.get(k).push(r.x);
}
console.log('\nlegal region, by deck row (z, then the x range that qualifies):');
for (const k of [...bands.keys()].sort((a, b) => a - b)) {
  const xs = bands.get(k);
  console.log(`  z~${String(k).padStart(3)}   x in [${Math.min(...xs).toFixed(1)}, ${Math.max(...xs).toFixed(1)}]   (${xs.length} cells)`);
}
