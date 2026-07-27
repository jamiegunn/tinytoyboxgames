// Reef regions: the reef's answer to "where am I?".
//
// ── The defect this exists to fix ─────────────────────────────────────────
//
// A 400-second free-swim was captured at 44 positions spanning 50 units of x
// and 80 of z, and every pair of frames was compared as a 24x14 grid of mean
// CIE Lab blocks (a grid, so individual drifting fish average out and what
// survives is large-scale layout and colour). Across 946 pairs:
//
//   separation      frame dE2000
//     0- 10 u           9.5
//    10- 25 u           9.5
//    25- 40 u          10.9
//    40- 60 u          11.5
//    60- 82 u          11.2
//
//   correlation(separation, frame difference)  r = +0.112,  r^2 = 0.012
//
// Swimming eighty units changed the screen no more than swimming five. The
// player's position explained 1.2% of what was on it.
//
// The instrument was not blind: terrain relief and props fade out past r=43,
// and interior frames (r<25) differed from rim frames (r>45) by 11.29 while
// differing from each other by only 7.28, against a same-place noise floor of
// 1.36. So it could see a region when there was one; there was one region.
//
// Every screenful was a fresh independent sample of one distribution. That is
// monotony in the literal, statistical sense, and it is why there was never any
// reason to swim anywhere: everywhere was the same.
//
// ── The design this replaced, and why it was wrong ────────────────────────
//
// The first fix drafted here was five "gardens" built around coral spires 7-10
// units tall, on the theory that a tall silhouette survives fog and reads from
// across the reef. That theory was never checked, and it is false.
//
// Driving a real PerspectiveCamera at the follow camera's measured steady state
// -- eye at shark + (0.3, 6.317, -7.834) looking at (sharkX, 0.35, sharkZ),
// vertical fov 0.85 rad -- and binary-searching for the greatest world height
// still inside the frame straight ahead of the shark:
//
//   distance ahead        5      10      15      20     25+
//   max visible height  3.37    2.22    1.08   -0.07   below the floor
//
// The camera is pitched 37.3 degrees below horizontal with a 24.4-degree half
// fov, so the TOP of the frame points 12.9 degrees below the horizon. There is
// no horizon, no water column and no surface in shot. A 10-unit spire ten units
// away shows 18% of itself; at 25 units neither it nor the ground under it is on
// screen at all. Height in this game is not merely unhelpful, it is off-camera.
//
// Everything built by this module is therefore under about two units tall, and
// the region signal is carried by the one channel that has real bandwidth here:
// the reef floor itself. Raycasting a 120x81 grid through the live scene graph,
// 100% of frame pixels hit the floor plane and 73.3% of the frame is floor at
// under 60% fog. `terrain.ts` was painting all 100x100 units of it a single
// albedo. That single albedo is the structural cause of the number above.
//
// ── Choosing the colours ──────────────────────────────────────────────────
//
// Not by taste. An offline model of the real pipeline (three.js ACES IN/OUT
// matrices, RRTAndODTFit, exposure 1.15, sRGB encode, then the display-space
// FogExp2 lerp toward the water colour) was first validated against the
// independently documented sand: it predicts rgb(153, 146, 87) where the shipped
// frame measures rgb(156, 150, 90), agreeing within 3 levels per channel.
//
// Candidate albedos were then swept on a 0.055 grid and had to clear four bars,
// each of which killed a palette that had already passed an eyeball test:
//
//   1. display luminance in [112, 205]      -- no black holes, no blown white
//   2. worst fish-vs-floor block dE >= 10.0 -- the sand scores 10.74. A green
//      floor that looked friendly scored 6.27 and hid the green fish.
//   3. floor-vs-water dE >= 33              -- the sand scores 51.4. A blue
//      floor that looked like deeper water scored 12 and dissolved into the fog,
//      which is the same failure mode as the shark's old bleaching belly flash.
//   4. litter contrast >= 80% of the sand's -- reefLitter.ts separates its
//      pebbles and clumps from the floor by LUMINANCE (dL ~ -35), not hue, so a
//      region darker than the sand would erase the seabed scatter. This bar
//      turned out to be slack: the sand is the WORST floor for litter contrast
//      at 16.78, and all three regions below score 22.9-28.5.
//
// 632 albedos survive. Greedy max-min selection over their 24-bin block
// signatures gives, for the home sand plus three regions, a minimum pairwise
// block dE2000 of 12.92 -- against the 7.28 that the instrument already resolved
// as "interior versus interior" and the 1.36 same-place noise floor. Adding a
// fourth region drops the minimum to 12.63 and spends it on a second green, so
// three it is: three colours a three-year-old can name, and no two of them
// confusable.
//
// ── What it actually measured once rendered ───────────────────────────────
//
// The model above is a prediction, so it was checked against the screen with
// the SAME 24x14 block instrument that produced the r^2 = 0.012 defect number,
// and the check was then itself tested three ways.
//
// The measurement. A 7x7 lattice over x,z in {-36,-24,-12,0,12,24,36}, the
// shark frozen and teleported to each site with the follow camera snapped to
// its steady state, one frame each, 1176 pairs. Run twice on the same build,
// once as shipped and once with REEF_REGIONS emptied to [] -- which switches
// off floor colour, thickets and fish enrichment together, i.e. reconstructs
// the pre-fix reef inside the post-fix instrument.
//
//                                    regions out   regions in
//   mean pairwise frame dE2000           4.60         8.78
//   p90                                  6.32        14.46
//   max                                 11.01        25.93
//   pairs above 7.28 (old interior bar)   3.6%        59.4%
//   pairs above 11.29 (old ceiling)       0.0%        24.3%
//   r^2(region-field distance, frame dE)  0.001        0.806
//
// The last row is the load-bearing one, and it is the row that had to replace
// the original statistic. Euclidean separation is the WRONG predictor once a
// reef has discrete places -- two sand sites 70 units apart are still both sand
// -- and it stays near zero (r^2 = 0.002) even with this fix in. Region-field
// distance is computed from the smoothstep field below and from nothing else.
//
// Test 1, the null control. That geometric predictor scores 0.001 with the
// regions removed, so it cannot manufacture a correlation out of the lattice.
//
// Test 2, the instrument cross-check. The regions-out lattice tops out at
// 11.01, independently reproducing the historical free-swim interior-vs-rim
// ceiling of 11.29 from a completely different sampling design. Two instruments
// agree on the most the old reef could ever produce.
//
// Test 3, reproducibility. A six-site capture was repeated from a fresh page
// load, so coralFactory.ts's unseeded Math.random() rebuilt every prop and every
// fish was elsewhere. Same-site cross-run dE: mean 1.99, max 4.19; every
// destination pair reproduced within +/-0.98. Weakest destination pair 11.65
// against that 1.99 noise -- 5.9x. The model predicted a 12.92 minimum before
// anything rendered; the screen gave 11.65-12.63, so the model over-predicted by
// 2-10%.
//
// Ablation. "The floor is the carrier" is a mechanism claim, so it was tested by
// running the lattice a third time with buildRegionThickets disabled:
//
//                                        r^2      mean dE   max dE
//   no regions at all                    0.001      4.60     11.01
//   floor colour only, no thickets       0.815      8.98     26.45
//   floor colour + thickets (shipped)    0.806      8.78     25.93
//
// The floor alone accounts for the entire frame-scale effect; the thickets
// contribute nothing to it (very slightly negative, since they add prop content
// that region and non-region frames share). They are justified at close range
// only -- see the note above buildRegionThickets in setup.ts.
//
// Negative control that behaved correctly: two open-sand sites 13.5 units apart
// still differ by only 3.76. The old monotonous reef is still there in the
// corridors, which is what makes crossing one read as travelling.

/** A linear-space floor albedo, multiplied into the terrain's white material. */
export type Albedo = readonly [number, number, number];

/** The reef's default floor: warm tropical sand. See terrain.ts for the derivation. */
export const HOME_SAND: Albedo = [1.0, 0.8, 0.26];

/** A coloured stretch of reef floor with a name, a place and a size. */
export interface ReefRegion {
  /** Stable identifier. */
  id: string;
  /** Region centre, world x. */
  x: number;
  /** Region centre, world z. */
  z: number;
  /** Distance from the centre at which the region has faded fully back to sand. */
  radius: number;
  /** Linear floor albedo at full strength. */
  albedo: Albedo;
}

/**
 * Distance from the arena centre at which the ring of regions sits.
 *
 * The shark starts at the origin, so at 27 the nearest region edge is 9 units
 * away — inside the ~20-unit visible wedge. A child who has not moved yet can
 * already see somewhere else to be.
 */
const RING_RADIUS = 27.0;

/**
 * Region radius.
 *
 * The measured frame window is about 26 units wide by 17 deep, so 18 (36
 * across) is wider than the view: standing in the middle of a region, the whole
 * screen is that region. Three regions 120 degrees apart on the ring are
 * 2 * 27 * sin(60 deg) = 46.8 units between centres, leaving a 10.8-unit sand
 * corridor between their edges — about half a view depth, enough that crossing
 * it reads as travelling rather than as a colour swap.
 */
const REGION_RADIUS = 18.0;

/**
 * Fraction of the radius held at full strength before the fade begins.
 *
 * The fade band is therefore 0.45 * 18 = 8.1 out to 18, roughly 10 units, which
 * at the ~17-unit view depth means the new colour arrives across the frame over
 * about half a screen of swimming instead of switching on at a line.
 */
const CORE_FRACTION = 0.45;

/**
 * How much the fish target is multiplied by at the centre of a region.
 *
 * A coloured floor on its own is scenery. This is what makes a region a
 * destination: the reef is genuinely richer there, so swimming to the pink one
 * pays. It scales the same difficulty-derived target the open reef uses, so it
 * cannot push the population past the ceiling arithmetic in waves.ts.
 */
const REGION_FISH_GAIN = 0.5;

// Hermite smoothstep. Duplicated from terrain.ts rather than imported: terrain
// imports this module for its vertex colours, and the reverse import would be a
// cycle.
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The reef's three regions.
 *
 * Angles are 90, 210 and 330 degrees. 90 puts the turquoise shallows straight
 * ahead of a shark that starts at the origin facing +z, so the first thing a
 * child sees is the edge of somewhere worth going.
 */
export const REEF_REGIONS: readonly ReefRegion[] = [
  // rgb(151, 106, 106) unfogged, luminance 116, fish 10.37, water 33.3, litter 24.64
  {
    id: 'rose-flats',
    x: RING_RADIUS * Math.cos((210 * Math.PI) / 180),
    z: RING_RADIUS * Math.sin((210 * Math.PI) / 180),
    radius: REGION_RADIUS,
    albedo: [1.0, 0.45, 0.395],
  },
  // rgb(47, 162, 158) unfogged, luminance 137, fish 11.33, water 33.2, litter 28.49
  {
    id: 'turquoise-shallows',
    x: RING_RADIUS * Math.cos((90 * Math.PI) / 180),
    z: RING_RADIUS * Math.sin((90 * Math.PI) / 180),
    radius: REGION_RADIUS,
    albedo: [0.12, 1.0, 0.835],
  },
  // rgb(43, 161, 55) unfogged, luminance 129, fish 13.04, water 53.6, litter 22.86
  {
    id: 'green-meadow',
    x: RING_RADIUS * Math.cos((330 * Math.PI) / 180),
    z: RING_RADIUS * Math.sin((330 * Math.PI) / 180),
    radius: REGION_RADIUS,
    albedo: [0.12, 1.0, 0.12],
  },
];

/** How strongly a region colours the floor at a point, and which region it is. */
export interface RegionSample {
  /** The region in whose reach the point falls, or null out on the open sand. */
  region: ReefRegion | null;
  /** Blend weight in [0, 1]: 1 in the core, 0 outside the radius. */
  weight: number;
}

/**
 * Samples the region field at a world position.
 *
 * The regions do not overlap (46.8 units between centres against a 36-unit
 * diameter), so the strongest region is also the only one with any weight;
 * taking the maximum is exact rather than an approximation.
 *
 * @param x - World x.
 * @param z - World z.
 * @returns The region covering this point and its blend weight.
 */
export function sampleRegion(x: number, z: number): RegionSample {
  let best: ReefRegion | null = null;
  let bestW = 0;
  for (const r of REEF_REGIONS) {
    const dx = x - r.x;
    const dz = z - r.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= r.radius) continue;
    const w = 1 - smoothstep(r.radius * CORE_FRACTION, r.radius, d);
    if (w > bestW) {
      bestW = w;
      best = r;
    }
  }
  return { region: best, weight: bestW };
}

/**
 * The linear floor albedo at a world position, blended between the home sand
 * and whichever region covers it.
 *
 * @param x - World x.
 * @param z - World z.
 * @param out - Three-element array written in place, to avoid allocating per vertex.
 * @returns The same array, for convenience.
 */
export function floorAlbedoAt(x: number, z: number, out: [number, number, number]): [number, number, number] {
  const { region, weight } = sampleRegion(x, z);
  if (!region || weight <= 0) {
    out[0] = HOME_SAND[0];
    out[1] = HOME_SAND[1];
    out[2] = HOME_SAND[2];
    return out;
  }
  for (let c = 0; c < 3; c++) {
    out[c] = HOME_SAND[c] + (region.albedo[c] - HOME_SAND[c]) * weight;
  }
  return out;
}

/**
 * Multiplier on the nearby-fish target at a world position.
 *
 * Returns 1.0 on the open sand and 1 + REGION_FISH_GAIN at a region's core.
 *
 * @param x - World x.
 * @param z - World z.
 * @returns A multiplier in [1, 1 + REGION_FISH_GAIN].
 */
export function regionFishMultiplier(x: number, z: number): number {
  return 1 + REGION_FISH_GAIN * sampleRegion(x, z).weight;
}
