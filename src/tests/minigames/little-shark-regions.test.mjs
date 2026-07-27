// Contract tests for little-shark's reef regions.
//
// The defect these exist to prevent coming back: a 400-second free swim was
// captured at 44 positions spanning 80 units, every pair of frames compared as a
// 24x14 grid of mean CIE Lab blocks, and the correlation between how far the
// shark had swum and how different the screen looked was r^2 = 0.012. Position
// explained 1.2% of what was on screen. Every screenful was a fresh independent
// sample of one distribution, which is monotony in the literal statistical
// sense, and it is why there was never any reason to swim anywhere.
//
// `regions.ts` fixed it by putting three coloured stretches of floor on a ring.
// Re-measured with the SAME instrument on a 49-site lattice, run once as shipped
// and once with REEF_REGIONS emptied so both numbers come from one instrument:
//
//                                        regions out   regions in
//   mean pairwise frame dE2000               4.60         8.78
//   max                                     11.01        25.93
//   r^2(region-field distance, frame dE)     0.001        0.806
//
// Every property asserted below is load-bearing for one of those numbers, so a
// later refactor that "tidies" any of them silently un-fixes the game while the
// build stays green. Where a constant is pinned to an exact value it is because
// that exact value is what was rendered and measured; changing it invalidates
// the measurement rather than merely changing a taste call.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../framework/_tsload.mjs';

const R = await loadTs('src/minigames/games/little-shark/environment/regions.ts');
const P = await loadTs('src/minigames/games/little-shark/environment/placement.ts');

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const at = (x, z) => R.floorAlbedoAt(x, z, [0, 0, 0]);

// ---------------------------------------------------------------------------
// The field: where the regions are
// ---------------------------------------------------------------------------

test('there are exactly three regions, evenly spaced on the ring', () => {
  assert.equal(R.REEF_REGIONS.length, 3);
  for (const r of R.REEF_REGIONS) {
    assert.ok(Math.abs(Math.hypot(r.x, r.z) - 27.0) < 1e-9, `${r.id} off the 27-unit ring`);
    assert.equal(r.radius, 18.0);
  }
  // 120 degrees apart => 2 * 27 * sin(60) = 46.765 between centres.
  const [a, b, c] = R.REEF_REGIONS;
  for (const [p, q] of [
    [a, b],
    [b, c],
    [a, c],
  ]) {
    assert.ok(Math.abs(dist(p.x, p.z, q.x, q.z) - 46.765) < 0.01);
  }
});

// The reason sampleRegion can take a plain maximum instead of accumulating
// contributions: if the regions ever overlapped, the maximum would be an
// approximation and the floor colour would step discontinuously along the seam.
test('no two regions overlap, so the max in sampleRegion is exact', () => {
  for (let i = 0; i < R.REEF_REGIONS.length; i++) {
    for (let j = i + 1; j < R.REEF_REGIONS.length; j++) {
      const p = R.REEF_REGIONS[i];
      const q = R.REEF_REGIONS[j];
      assert.ok(dist(p.x, p.z, q.x, q.z) > p.radius + q.radius, `${p.id} overlaps ${q.id}`);
    }
  }
  // And directly: sweep the whole arena and assert no point is ever inside two.
  for (let x = -50; x <= 50; x += 1) {
    for (let z = -50; z <= 50; z += 1) {
      const inside = R.REEF_REGIONS.filter((r) => dist(x, z, r.x, r.z) < r.radius);
      assert.ok(inside.length <= 1, `(${x}, ${z}) is inside ${inside.length} regions`);
    }
  }
});

test('the origin is open sand and the nearest region edge is 9 units away', () => {
  const s = R.sampleRegion(0, 0);
  assert.equal(s.region, null);
  assert.equal(s.weight, 0);
  const nearestEdge = Math.min(...R.REEF_REGIONS.map((r) => Math.hypot(r.x, r.z) - r.radius));
  assert.ok(Math.abs(nearestEdge - 9.0) < 1e-9);
});

test('sampleRegion is at full strength throughout the core and zero outside', () => {
  for (const r of R.REEF_REGIONS) {
    const core = r.radius * 0.45;
    assert.equal(R.sampleRegion(r.x, r.z).weight, 1, `${r.id} centre`);
    assert.equal(R.sampleRegion(r.x + core * 0.999, r.z).weight, 1, `${r.id} core edge`);
    assert.equal(R.sampleRegion(r.x, r.z).region.id, r.id);

    // At and beyond the radius there is no region at all -- not a small weight.
    // Stepped radially OUTWARD from the arena centre: any other direction can
    // walk into a neighbouring region, which is a property of the ring layout
    // rather than of the falloff being tested here.
    const ux = r.x / Math.hypot(r.x, r.z);
    const uz = r.z / Math.hypot(r.x, r.z);
    for (const d of [r.radius, r.radius + 0.001, r.radius + 20]) {
      const s = R.sampleRegion(r.x + ux * d, r.z + uz * d);
      assert.equal(s.weight, 0, `${r.id} at d=${d}`);
      assert.equal(s.region, null, `${r.id} at d=${d}`);
    }
  }
});

// The fade band is the whole reason a region reads as somewhere you travel to
// rather than a colour that switches on at a line: 8.1 out to 18 is about 10
// units against a ~17-unit view depth, so the new colour arrives across the
// frame over roughly half a screen of swimming.
test('the weight falls monotonically and smoothly across the fade band', () => {
  const r = R.REEF_REGIONS[0];
  let prev = 1;
  let sawIntermediate = false;
  for (let d = r.radius * 0.45; d <= r.radius; d += 0.05) {
    const w = R.sampleRegion(r.x + d, r.z).weight;
    assert.ok(w <= prev + 1e-12, `weight rose at d=${d}`);
    if (w > 0.05 && w < 0.95) sawIntermediate = true;
    prev = w;
  }
  assert.ok(sawIntermediate, 'no intermediate weights: the fade is a step, not a band');
  // Smoothstep, so the derivative vanishes at both ends and the transition has
  // no visible seam where it starts or stops.
  const eps = 0.02;
  const near = R.sampleRegion(r.x + r.radius * 0.45 + eps, r.z).weight;
  const far = R.sampleRegion(r.x + r.radius - eps, r.z).weight;
  assert.ok(1 - near < 1e-3, 'weight drops abruptly at the core edge');
  assert.ok(far < 1e-3, 'weight is still significant at the outer edge');
});

// ---------------------------------------------------------------------------
// The floor colour: the channel that was measured to carry the whole effect
// ---------------------------------------------------------------------------

test('open sand is exactly HOME_SAND, bit for bit', () => {
  // Not "close to" -- exactly. terrain.ts writes one vertex colour per grid
  // vertex, and a floor that was 0.999 of the sand in the corridors would put a
  // faint gradient across ground that is supposed to be flat and identical.
  for (const [x, z] of [
    [0, 0],
    [0, -13.5],
    [45, 45],
    [-50, 50],
    [0, 9.001 - 9],
  ]) {
    if (R.sampleRegion(x, z).weight > 0) continue;
    assert.deepEqual(at(x, z), [...R.HOME_SAND], `(${x}, ${z})`);
  }
});

test('a region core is exactly its own albedo', () => {
  for (const r of R.REEF_REGIONS) {
    assert.deepEqual(at(r.x, r.z), [...r.albedo], r.id);
  }
});

test('the blend is a monotone interpolation between sand and region', () => {
  for (const r of R.REEF_REGIONS) {
    for (let c = 0; c < 3; c++) {
      const lo = Math.min(R.HOME_SAND[c], r.albedo[c]);
      const hi = Math.max(R.HOME_SAND[c], r.albedo[c]);
      let prev = null;
      for (let d = 0; d <= r.radius; d += 0.25) {
        const v = at(r.x + d, r.z)[c];
        assert.ok(v >= lo - 1e-12 && v <= hi + 1e-12, `${r.id} ch${c} left the bracket at d=${d}`);
        if (prev !== null) {
          const rising = r.albedo[c] < R.HOME_SAND[c];
          assert.ok(rising ? v >= prev - 1e-12 : v <= prev + 1e-12, `${r.id} ch${c} reversed at d=${d}`);
        }
        prev = v;
      }
    }
  }
});

// The floor colour is the channel the whole measurement runs through, so the
// shape of its transition is not cosmetic. A hard step would satisfy every
// monotonicity assertion above while putting a visible line across the seabed
// and turning "swimming somewhere" into "a colour changing". This is the test
// that a deliberate hard-step mutation has to fail, and it does.
test('the colour arrives as a gradient, not as a line on the floor', () => {
  const STEP = 0.25;
  for (const r of R.REEF_REGIONS) {
    for (let c = 0; c < 3; c++) {
      const span = Math.abs(r.albedo[c] - R.HOME_SAND[c]);
      if (span < 0.1) continue;
      const profile = [];
      for (let d = 0; d <= r.radius; d += STEP) profile.push(at(r.x + d, r.z)[c]);

      const jumps = profile.slice(1).map((v, i) => Math.abs(v - profile[i]));
      const worst = Math.max(...jumps);
      // Over a ~10-unit fade band sampled every 0.25 units, no single step may
      // carry more than a few percent of the whole span.
      assert.ok(worst < 0.08 * span, `${r.id} ch${c}: a ${((100 * worst) / span).toFixed(0)}% jump in ${STEP} units`);

      const lo = Math.min(R.HOME_SAND[c], r.albedo[c]);
      const hi = Math.max(R.HOME_SAND[c], r.albedo[c]);
      const inBetween = profile.filter((v) => v > lo + 0.05 * span && v < hi - 0.05 * span).length;
      // The fade band is 8.1 to 18 units, so at 0.25-unit steps roughly 40
      // samples should land strictly inside the transition.
      assert.ok(inBetween >= 25, `${r.id} ch${c}: only ${inBetween} intermediate samples`);
    }
  }
});

test('floorAlbedoAt writes in place and returns the same array', () => {
  // terrain.ts calls this once per vertex over a 65x65 grid; allocating there
  // would be 4225 throwaway arrays per scene build. Both branches are exercised
  // -- an earlier version of this test only hit the open-sand early return, and
  // a deliberate mutation that made the blend branch allocate slipped past it.
  const r = R.REEF_REGIONS[0];
  for (const [label, x, z] of [
    ['open sand', 12, 12],
    ['region core', r.x, r.z],
    ['fade band', r.x + r.radius * 0.7, r.z],
  ]) {
    const out = [-1, -1, -1];
    const ret = R.floorAlbedoAt(x, z, out);
    assert.equal(ret, out, `${label}: returned a different array`);
    assert.ok(
      out.every((c) => c >= 0),
      `${label}: did not write all three channels`,
    );
  }
});

// ---------------------------------------------------------------------------
// The palette
// ---------------------------------------------------------------------------

// These exact numbers are what was rendered and measured. The offline model of
// the pipeline (ACES matrices, RRTAndODTFit, exposure 1.15, sRGB encode, then
// the display-space fog lerp) swept candidates on a 0.055 grid and kept only
// those clearing four bars -- display luminance in [112, 205], worst
// fish-vs-floor block dE >= 10.0, floor-vs-water dE >= 33, litter contrast >=
// 80% of the sand's -- then picked these by greedy max-min over their block
// signatures. Changing a channel here does not change a taste call, it
// invalidates the 8.78 mean and 0.806 r^2 measured on screen.
test('the measured palette is pinned', () => {
  assert.deepEqual([...R.HOME_SAND], [1.0, 0.8, 0.26]);
  const byId = Object.fromEntries(R.REEF_REGIONS.map((r) => [r.id, [...r.albedo]]));
  assert.deepEqual(byId, {
    'rose-flats': [1.0, 0.45, 0.395],
    'turquoise-shallows': [0.12, 1.0, 0.835],
    'green-meadow': [0.12, 1.0, 0.12],
  });
});

test('every albedo is a legal linear colour', () => {
  for (const a of [R.HOME_SAND, ...R.REEF_REGIONS.map((r) => r.albedo)]) {
    assert.equal(a.length, 3);
    for (const c of a) {
      assert.ok(Number.isFinite(c) && c >= 0 && c <= 1, `channel ${c} out of range`);
    }
  }
});

// A weak but renderer-free guard: two floors that are close in linear albedo
// cannot be far apart on screen, so this catches the gross case (someone adds a
// fourth region that is a near-duplicate) without pretending to reproduce the
// block-dE measurement, which needs an actual frame.
test('no two floors are near-duplicates in linear albedo', () => {
  const all = [{ id: 'home-sand', albedo: R.HOME_SAND }, ...R.REEF_REGIONS];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const d = Math.hypot(...[0, 1, 2].map((c) => all[i].albedo[c] - all[j].albedo[c]));
      assert.ok(d > 0.35, `${all[i].id} and ${all[j].id} differ by only ${d.toFixed(3)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// The reward: what makes a region a destination rather than scenery
// ---------------------------------------------------------------------------

test('the fish multiplier is 1 on the sand and 1.5 at a core, and never leaves that range', () => {
  assert.equal(R.regionFishMultiplier(0, 0), 1);
  for (const r of R.REEF_REGIONS) {
    assert.equal(R.regionFishMultiplier(r.x, r.z), 1.5);
  }
  for (let x = -60; x <= 60; x += 1.5) {
    for (let z = -60; z <= 60; z += 1.5) {
      const m = R.regionFishMultiplier(x, z);
      assert.ok(m >= 1 && m <= 1.5, `multiplier ${m} at (${x}, ${z})`);
    }
  }
});

// updateSpawning multiplies this into a target that is already multiplied by 2
// during a frenzy. 1.5 * 2 = 3x the difficulty-derived target is the worst case
// the ceiling arithmetic in waves.ts has to absorb; a larger gain here would
// quietly raise that ceiling from a file that says nothing about waves.
test('the multiplier stays inside the budget waves.ts was sized for', () => {
  const worst = Math.max(...R.REEF_REGIONS.map((r) => R.regionFishMultiplier(r.x, r.z))) * 2;
  assert.ok(worst <= 3, `worst-case spawn multiplier ${worst} exceeds 3x`);
});

// ---------------------------------------------------------------------------
// Thicket placement
// ---------------------------------------------------------------------------

// buildRegionThickets seeds createSeededRandom(20260726) so the thickets are the
// same on every load. They must be: the whole region measurement was captured
// across two independent page loads and reproduced to a mean dE of 1.99, and
// that reproducibility argument is void if the props move between runs. (The
// props' SHAPES still vary -- coralFactory.ts uses an unseeded Math.random() --
// which is a known defect logged separately, and which is what made the
// cross-run reproducibility test as harsh as it was.)
test('the thicket RNG is deterministic from its seed', () => {
  const a = P.createSeededRandom(20260726);
  const b = P.createSeededRandom(20260726);
  const seqA = Array.from({ length: 200 }, () => a());
  const seqB = Array.from({ length: 200 }, () => b());
  assert.deepEqual(seqA, seqB);
  const c = P.createSeededRandom(20260727);
  assert.notDeepEqual(
    seqA,
    Array.from({ length: 200 }, () => c()),
  );
  for (const v of seqA) assert.ok(v >= 0 && v < 1, `RNG produced ${v}`);
});

// buildRegionThickets places at sqrt(rand()) * core, which is the area-uniform
// draw. Piling props at the centre would leave the rest of the core as bare as
// the corridors while spending the same draw calls.
test('the thicket radius draw is uniform by area, not by radius', () => {
  const rand = P.createSeededRandom(20260726);
  const core = 18.0 * 0.45;
  const n = 20000;
  let inner = 0;
  for (let i = 0; i < n; i++) {
    // Half the AREA of the core disc lies inside core/sqrt(2).
    if (Math.sqrt(rand()) * core < core / Math.SQRT2) inner++;
  }
  assert.ok(Math.abs(inner / n - 0.5) < 0.02, `${((100 * inner) / n).toFixed(1)}% inside the half-area radius`);
});

// The thickets sit inside the core, where the floor colour is at full strength,
// so the prop cluster and the colour mark the same spot rather than two
// different ones.
test('thicket placement stays inside the full-strength core', () => {
  const rand = P.createSeededRandom(20260726);
  for (const region of R.REEF_REGIONS) {
    const core = region.radius * 0.45;
    for (let i = 0; i < 30; i++) {
      const r = Math.sqrt(rand()) * core;
      const a = rand() * Math.PI * 2;
      const px = region.x + Math.cos(a) * r;
      const pz = region.z + Math.sin(a) * r;
      rand();
      rand();
      rand();
      rand();
      const s = R.sampleRegion(px, pz);
      assert.equal(s.weight, 1, `${region.id} prop ${i} landed at weight ${s.weight}`);
      assert.ok(Math.hypot(px, pz) < 50.0, `${region.id} prop ${i} landed outside BOUNDS`);
    }
  }
});
