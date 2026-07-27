// Solve the cannonball-splash portal position by search rather than by nudging.
//
// The constraint that binds is the OPENING POSE at the narrowest aspect. With
// `maxDistance: 10` equal to `distance: 10`, `radiusForAspect` clamps the
// portrait pull-back to zero, so the camera sits at one fixed point for every
// viewport and only the frustum width changes. At aspect 0.4 the horizontal
// half-tan is 0.4 * tan(25 deg) = 0.1865, which is a +/-10.6 degree cone --
// a narrow centre strip of a 15-unit-wide deck.
//
// Reports: the visible deck strip at each aspect, then a grid search for a
// portal centre that clears every aspect with margin AND stays clear of every
// other staged prop.
import { PerspectiveCamera, Spherical, Vector3 } from 'three';

const FOV = 50;
const PRESET = { azimuth: Math.PI, polar: 1.2, distance: 10, target: [0, 0.3, 0], maxDistance: 10, minDistance: 9, ceilingY: 4.8 };

const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 768 / 1024],
  ['viewport 480x854', 480 / 854],
  ['iPhone SE 375x667', 375 / 667],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
];

const mult = (a) => (a < 1 ? (1.0 / a) * 0.75 : 1);
const radius = (a) => Math.min(Math.max(PRESET.distance * mult(a), PRESET.minDistance), PRESET.maxDistance);

const camFor = (aspect) => {
  const target = new Vector3(...PRESET.target);
  const pos = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius(aspect), PRESET.polar, PRESET.azimuth)));
  if (pos.y > PRESET.ceilingY) pos.y = PRESET.ceilingY;
  const cam = new PerspectiveCamera(FOV, aspect, 0.1, 100);
  cam.position.copy(pos);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

const cams = ASPECTS.map(([label, a]) => [label, a, camFor(a)]);
console.log(
  'camera position (identical at every aspect):',
  cams[0][2].position
    .toArray()
    .map((v) => v.toFixed(2))
    .join(', '),
);

// The portal disc is drawn on the deck; sample at the ring height the scene uses.
const PORTAL_Y = 0.3;
const worstOver = (x, z) => {
  let w = -Infinity;
  for (const [, , cam] of cams) {
    const ndc = new Vector3(x, PORTAL_Y, z).project(cam);
    w = Math.max(w, Math.abs(ndc.x) - 1, Math.abs(ndc.y) - 1);
  }
  return w;
};

console.log('\nvisible deck strip in x, at the opening pose (portal height y=0.3):');
for (const [label, aspect, cam] of cams) {
  // binary search the largest |x| that still projects inside, at a few depths
  const row = [];
  for (const z of [-4, -2, 0, 2, 4]) {
    let lo = 0,
      hi = 12;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const ndc = new Vector3(mid, PORTAL_Y, z).project(cam);
      if (Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) lo = mid;
      else hi = mid;
    }
    row.push(`z=${z}: |x|<=${lo.toFixed(2)}`);
  }
  console.log(`  ${label.padEnd(22)} ${row.join('   ')}`);
}

// Every other staged prop, with the deck footprint radius it occupies.
const PROPS = [
  ['anchor', -4.5, 3.5, 1.0],
  ['barrel0', -3.2, -1.5, 0.6],
  ['barrel1', -3.8, -0.8, 0.6],
  ['barrel2', -2.8, -0.4, 0.6],
  ['barrel3', -3.5, 0.2, 0.6],
  ['cannon', 4.0, 3.5, 1.0],
  ['rope0', -1.5, 1.5, 0.6],
  ['rope1', 2.0, 0.5, 0.6],
  ['wheel', 0, 2.8, 0.9],
  ['chest', 0.5, -3.5, 1.1],
  ['owl', 0, -0.5, 0.9],
  ['mast', 0, 3.9, 0.5],
];
const PORTAL_RADIUS = 1.0;
const clearance = (x, z) => {
  let m = Infinity;
  for (const [, px, pz, r] of PROPS) m = Math.min(m, Math.hypot(x - px, z - pz) - r - PORTAL_RADIUS);
  return m;
};

// Deck outline, from index.ts: halfW 7.5, halfD 6.5, sternCut 2.625, bowNarrow 3.75.
const halfW = 7.5,
  halfD = 6.5,
  sternCut = 2.625,
  bowNarrow = 3.75;
const onDeck = (x, z) => {
  if (z > halfD - 0.6 || z < -halfD + 0.6) return false;
  // hull half-width tapers from (halfW - sternCut) at the stern out to halfW
  // mid-ship and in to (halfW - bowNarrow) at the bow.
  const t = (z + halfD) / (2 * halfD); // 0 at bow, 1 at stern
  const hw = t > 0.5 ? halfW - sternCut * (t - 0.5) * 2 : halfW - bowNarrow * (0.5 - t) * 2;
  return Math.abs(x) <= hw - 0.8;
};

let best = null;
const cands = [];
for (let x = -6; x <= 6; x += 0.1) {
  for (let z = -6; z <= 6; z += 0.1) {
    if (!onDeck(x, z)) continue;
    const over = worstOver(x, z);
    if (over > -0.08) continue;
    const clr = clearance(x, z);
    if (clr < 1.2) continue;
    cands.push({ x, z, over, clr });
    if (!best || clr > best.clr || (clr === best.clr && over < best.over)) best = { x, z, over, clr };
  }
}
console.log(`\n${cands.length} deck positions clear every aspect with >=0.08 NDC margin and >=1.2u prop clearance`);
if (cands.length) {
  const byMargin = [...cands].sort((a, b) => a.over - b.over).slice(0, 6);
  console.log('  deepest inside the frame:');
  for (const c of byMargin) console.log(`    (${c.x.toFixed(1)}, ${c.z.toFixed(1)})  worst NDC ${c.over.toFixed(3)}  prop clearance ${c.clr.toFixed(2)}u`);
  const byClear = [...cands].sort((a, b) => b.clr - a.clr).slice(0, 6);
  console.log('  most open deck around it:');
  for (const c of byClear) console.log(`    (${c.x.toFixed(1)}, ${c.z.toFixed(1)})  worst NDC ${c.over.toFixed(3)}  prop clearance ${c.clr.toFixed(2)}u`);
}
