import { Color, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Scene, Vector3 } from 'three';
import { createSeededRandom } from './placement';
import { getTerrainHeight } from './terrain';

/**
 * Dense small-scale seabed scatter: water-worn pebbles and low weed clumps,
 * each drawn as a single InstancedMesh.
 *
 * Why this exists.
 *
 * The frame was 97.3% bare terrain, measured by rasterising the real scene
 * graph through the real camera at 1200x810: terrain 97.27% of pixels, all 478
 * placed prop groups together 1.49%. The reason is not that props are missing
 * or mis-scattered — they are spread at a sane 0.050 per square metre over a
 * radius-55 disc, and 49 of them are inside the frustum against the 59 a
 * uniform scatter predicts — it is that a uniform-by-area scatter and a camera
 * pitched 37.3 degrees below horizontal disagree about where the pixels are:
 *
 *   depth band   visible ground   share of frame   prop groups   |dL| vs sand
 *      7-11 u          51 m^2          24.9%             5           27.2
 *     11-14 u          88 m^2          24.2%             5           20.5
 *     14-18 u         170 m^2          21.6%             8           13.3
 *     18-23 u         299 m^2          15.7%            12            7.8
 *     23-40 u         567 m^2          10.7%            38            3.2
 *
 * The near half of the frame is half the pixels but only 139 of the 1175
 * visible square metres — 12% of the ground. Scattering uniformly by area
 * therefore puts 71% of the on-screen props into the far bands, where FogExp2
 * at density 0.058 has already removed 77-91% of their contrast: 38 of the 68
 * visible prop meshes differ from the sand they sit on by 3.2 display levels
 * out of 255, which is below what anyone can see. The props are not too few
 * (49 in shot) and not too small (median 30 px on the long side, p10 19 px).
 * They are in the part of the frame the fog has erased.
 *
 * CORRECTION (this pass). The table above was computed against the MANIFEST
 * camera's 35.6-degree pitch. The manifest camera never renders — followCamera
 * overwrites position and orientation every frame, and the real steady-state
 * pitch is 37.3 degrees. Recomputing the frame edges from an eye 6.317 above
 * the floor: the top of frame drops from 11.2 to 12.9 degrees below horizontal,
 * so the far edge moves from about 32.5 units to 28.3, 13% nearer; the bottom
 * edge moves from 7.29 to 7.17, 1.6% nearer. The near bands this whole file is
 * about are unchanged to within the terrain's own relief. The far bands are
 * slightly nearer than tabulated, which means fog has erased a little less
 * contrast out there than the 77-91% quoted — the argument gets weaker in the
 * band it does not depend on and holds exactly in the band it does.
 *
 * The fix is density in the near field, and the near field is wherever the
 * camera happens to be, because the camera follows the shark across a 100-unit
 * play area. So the scatter has to stay uniform in world space and simply be
 * six times denser than the placed props, which is affordable only as
 * instances: 4300 instances cost two draw calls, where 4300 prop groups would
 * cost about 8600. (The instancing technique is copied from star-catcher's
 * `buildGrassField`; nothing is imported from it.)
 *
 * What it buys, from the same rasteriser with the same pinned RNG:
 *
 *   non-seabed pixel coverage   1.49%  ->  9.48%
 *   pixels >=20 levels from
 *     their own row's sand      0.65%  ->  5.08%
 *   residStd (scene only)        4.91  ->   9.66
 *   lapMean  (scene only)       0.477  ->  1.562
 *
 * Cost: two draw calls and 86,000 triangles on top of 105,052.
 *
 * Why the colours are dark, and why the warm ones look wrong in source.
 *
 * Sand renders at rgb(156, 150, 90), display luminance 147. ACES at exposure
 * 1.15 is already compressing hard there, so brighter is not available: a cream
 * shell at albedo (1.00, 0.95, 0.82) lands at luminance 158, only 13 levels
 * above sand, and a white one at (1.00, 1.00, 0.96) reaches 162, just 16 — both
 * gone by the second depth band. Downward there is five times the room, so
 * everything here sits 30 to 50 levels below the sand. The saturation of the
 * warm entries is a separate matter and is explained at PEBBLE_COLORS.
 */

// ── Scatter density ────────────────────────────────────────────────
//
// Radius 56 sits inside the radius-60 terrain and just outside the radius-55
// prop disc, so the litter never stops before the terrain does. Area is
// pi * 56^2 = 9852 m^2.
const SCATTER_RADIUS = 56.0;

// 1500 / 9852 = 0.152 per m^2, i.e. 21 pebbles in the 139 m^2 near half of the
// frame where there were 5, and 179 across the whole 1175 m^2 visible wedge.
//
// Counts are traded against sizes deliberately, because covered screen area
// goes as count * radius^2 while cost goes as count alone. Widening the radius
// range from 0.14-0.30 to 0.16-0.34 raises mean r^2 from 0.0489 to 0.0652, a
// factor of 1.33, which buys back a third of the coverage lost to a lower count.
//
// 1500 rather than 3000 because a three-point sweep in the browser found the
// knee there. Same idle frame, same viewport, two 4-second fps samples each:
//
//   pebbles   fps    lapMean   near-band chroma (frame bands 8-11)
//        0    2.46      0.65   32 26 22 20
//     1500    2.00      1.30   43 37 29 27
//     3000    1.81      1.39   45 40 33 27
//
// The first 1500 double the local structure for 19% of the frame rate. The
// second 1500 add 7% more structure for another 10% of the frame rate, which is
// not a trade worth making. (Frame rates are from a software rasteriser —
// swiftshader on two cores — so they scale with triangles, which is the axis
// this file loads; on real hardware the discriminator has consistently been
// draw calls, and this costs two.)
const PEBBLE_COUNT = 1500;

// 1300 / 9852 = 0.132 per m^2, i.e. 18 clumps in the near half and 155 in shot.
// Fewer than the pebbles because a clump stands proud of the sand and carries a
// vertical silhouette, so it reads as roughly twice the visual weight at the
// same footprint.
const CLUMP_COUNT = 1300;

// ── Clustering ─────────────────────────────────────────────────────
//
// A uniform-by-area scatter renders as polka dots: every pebble equidistant
// from the next, no bare sand and no busy patch. A real rubble floor is
// patchy, and patchiness is also what `residStd` is measuring — the variation
// *within* a row of pixels. So two thirds of the instances are drawn in
// clusters of about seven around a shared centre and the rest are strays.
const CLUSTER_MEMBERS = 7;
const CLUSTER_SPREAD = 1.1; // metres; ~3 pebble diameters, so members touch
const STRAY_FRACTION = 0.34;

// Two independent streams so changing one count cannot reshuffle the other.
const PEBBLE_SEED = 90210;
const CLUMP_SEED = 31337;

// ── Sizes ──────────────────────────────────────────────────────────
//
// One pixel subtends 0.0112 world units at the 9.3-unit depth of the bottom of
// frame and 0.031 at the 27.7-unit top. A pebble of radius 0.25 is therefore
// about 45 px wide at the bottom of frame and 16 px at the top, and a clump
// 0.6 units tall is 54 px and 19 px. Anything below about 0.12 units would fall
// under 10 px near the camera and stop being a shape at all.
const PEBBLE_RADIUS_MIN = 0.16;
const PEBBLE_RADIUS_MAX = 0.34;
// Pebbles are squashed so they sit like shells and stones rather than balls.
const PEBBLE_FLATTEN_MIN = 0.35;
const PEBBLE_FLATTEN_MAX = 0.6;

const CLUMP_RADIUS_MIN = 0.22;
const CLUMP_RADIUS_MAX = 0.4;
// Clumps are stretched upward instead of flattened, which is what separates
// them from the pebbles at a glance — a taller-than-wide silhouette reads as
// something growing, a wider-than-tall one as something lying there.
//
// The stretch is capped at 2.0 on evidence. A 20-face solid scaled 1 : 3 : 1
// has flat vertical facets and a straight silhouette, so at 2.0-3.4 the field
// rendered as a plain of upright slabs — legible, but reading as standing
// stones rather than as anything growing, and not something to put on a
// three-year-old's seabed. Under about 2.0 the solid still reads as round.
const CLUMP_STRETCH_MIN = 1.4;
const CLUMP_STRETCH_MAX = 2.0;
// Up to 17 degrees of lean. A rounded solid standing perfectly upright reads as
// placed; the same solid leaning reads as grown, and the lean also breaks the
// vertical facet edges that make the taller ones look like slabs.
const CLUMP_LEAN_MAX = 0.3;

// ── Palettes ───────────────────────────────────────────────────────
//
// Linear albedos. Every figure below is a measurement, not an estimate: the
// real scene graph is rasterised offline with these two InstancedMeshes'
// colours forced to white, which records the per-pixel illuminant with the
// albedo and its jitter divided out, and a candidate albedo is then evaluated
// over those same pixels. So `rgb` is the mean on-screen colour of that entry
// over the pixels it actually covers in the near field -- bands 8-10 of 12 for
// pebbles, 9-11 for clumps, because pebbles are low enough that none of them
// reach the bottom twelfth of the frame -- after irradiance, ACES at exposure
// 1.15, the sRGB encode and the display-space FogExp2 lerp toward
// rgb(13, 92, 148). `dL` is against the sand in those same bands, which is
// rgb(112, 132, 108), luminance 126 for the pebble bands and rgb(117, 134, 106),
// luminance 128 for the clump bands. `warm` is R minus B, for which the sand's
// own near-field value is +5 and +11 respectively. `b6` and `b3` are the same
// warm figure at bands 6 and 3, i.e. what survives to mid-frame and to the far
// third.
//
// Four things are worth knowing before touching these numbers.
//
// Nothing goes below dL -50. Darker is available -- an umber at (0.22, 0.15,
// 0.10) reaches -70 -- but past about -55 a small object on lit sand stops
// reading as a stone and starts reading as a hole in the floor, which is the
// one thing a seabed for a three-year-old must not have. The darkest entries
// here are olive rubble at -48 and brick at -46.
//
// The blue channel of the albedo is the cheap lever, not the red one. The
// irradiance is 1.30x as strong in blue as in red, so whatever blue the albedo
// keeps gets amplified before ACES ever sees it, and the previous warm entries
// left 0.14 there and paid for it. Holding red and green fixed and taking the
// blue out, measured over the same pixels:
//
//   (1.00, 0.42, 0.14)   warm +25   dL -21
//   (1.00, 0.42, 0.03)   warm +51   dL -23
//
// +26 levels of warmth for 2 levels of luminance. Red cannot do that; it is
// already at 1.00 in that entry and has nowhere to go. Every warm entry here
// therefore runs its blue at or below 0.06. That is also why these source
// values look implausibly saturated -- a naive earth tone does not survive, and
// a terracotta at (0.42, 0.22, 0.15) renders as rgb(67, 71, 79), warm -13,
// bluer than the sand it is lying on.
//
// The clumps are what this palette is made of, not the pebbles. At 900x608
// through the live follow camera the rendered pixel counts are 7,364 for
// pebbles and 29,312 for clumps -- 3.98 clump pixels per pebble pixel, because
// a clump stands proud of the floor and presents its silhouette to a camera
// pitched 37 degrees down while a pebble presents its flattened top. Any change
// made only to PEBBLE_COLORS moves a fifth of the litter.
//
// The palette this replaced was cyan, which is to say it was the fog's own hue.
// Measured over real pixels the shipped entries averaged warm -30.5 for pebbles
// and -64.8 for clumps, area-weighted -57.9, against sand at -23. Objects on a
// near floor wearing the far water's colour is what makes a floor read as a
// blue gravel pit, and no reweighting could have fixed it, because the old
// CLUMP_COLORS held no entry that rendered warm at all -- the warmest of the
// four, coral weed at (0.95, 0.38, 0.42), still came out at -11. The colours
// had to change, not their weights.
const PEBBLE_COLORS: [number, number, number][] = [
  [0.66, 0.52, 0.22], // warm stone      rgb( 90,109, 97)  dL -22  warm  -8  b6 -46  b3 -83
  [0.34, 0.3, 0.18], // olive rubble    rgb( 59, 84, 88)  dL -48  warm -28  b6 -60  b3 -91
  [0.5, 0.42, 0.1], // olive warm      rgb( 76, 98, 75)  dL -34  warm  +1  b6 -40  b3 -80
  [0.72, 0.26, 0.04], // brick           rgb( 91, 79, 60)  dL -46  warm +32  b6 -22  b3 -70
  [0.86, 0.3, 0.05], // terracotta      rgb(101, 85, 63)  dL -40  warm +38  b6 -15  b3 -66
  [1.0, 0.42, 0.03], // burnt orange    rgb(109, 99, 58)  dL -28  warm +51  b6  -6  b3 -61
  [1.0, 0.3, 0.3], // coral red       rgb(109, 85,107)  dL -34  warm  +2  b6 -39  b3 -79
];
// Weighted near-field mean: warm +14.9, dL -36.2. Two cool-to-neutral entries
// carry 26% of the draw -- a floor of nothing but warm stones is a brick yard,
// and the eye needs something to read the warm ones against -- and the
// remaining 74% runs from neutral olive up to orange.
const PEBBLE_WEIGHTS = [0.14, 0.12, 0.16, 0.16, 0.18, 0.14, 0.1];

const CLUMP_COLORS: [number, number, number][] = [
  [0.3, 0.55, 0.2], // leaf green      rgb( 54,105, 87)  dL -35  warm -34  b6 -65  b3 -91
  [0.5, 0.46, 0.1], // olive weed      rgb( 73, 97, 70)  dL -38  warm  +3  b6 -41  b3 -76
  [0.8, 0.46, 0.05], // amber weed      rgb( 94, 98, 60)  dL -34  warm +35  b6 -20  b3 -63
  [1.0, 0.42, 0.24], // coral pink      rgb(106, 94, 94)  dL -32  warm +12  b6 -34  b3 -73
];
// Weighted near-field mean: warm +5.3, dL -35.2 -- deliberately a few levels
// cooler than the sand it sits on rather than warmer, because weed that is
// warmer than its sand stops reading as weed. The greens are kept but moved off
// the cyan axis onto the yellow side of green, which is where real kelp and sea
// lettuce sit anyway; the entry that used to be teal weed is now leaf green and
// the one that used to be deep teal is amber.
const CLUMP_WEIGHTS = [0.22, 0.3, 0.26, 0.22];

// Area-weighted over both meshes at 3.98 clump pixels per pebble pixel, the
// near-field litter mean moves from warm -57.9 to +7.2, against a near-field
// sand that moves from -23 to +5 (terrain.ts). Litter and floor now sit on the
// same side of neutral and are separated by luminance, which is what an object
// lying on sand looks like. Before, they were separated by hue, and the hue the
// litter had was the water's.

// Picks a palette entry from a cumulative-weight draw.
function pickWeighted(colors: [number, number, number][], weights: number[], r: number): [number, number, number] {
  let acc = 0;
  for (let i = 0; i < colors.length; i += 1) {
    acc += weights[i];
    if (r < acc) return colors[i];
  }
  return colors[colors.length - 1];
}

// Samples a point in the scatter disc. sqrt() of the uniform draw makes it
// uniform in area rather than crowded at the centre, so the density quoted
// above is the density everywhere -- which matters because the camera follows
// the shark across the whole play area and any place could be the near field.
function samplePoint(rand: () => number, out: { x: number; z: number }): void {
  const r = SCATTER_RADIUS * Math.sqrt(rand());
  const a = rand() * Math.PI * 2;
  out.x = Math.cos(a) * r;
  out.z = Math.sin(a) * r;
}

// Fills `out` with a clustered scatter: patches of CLUSTER_MEMBERS around a
// shared centre, plus STRAY_FRACTION of loose singles. Written into a flat
// array up front rather than sampled inside the instance loop because a
// cluster centre has to outlive the member that created it.
function sampleClustered(rand: () => number, count: number): Float64Array {
  const out = new Float64Array(count * 2);
  const centre = { x: 0, z: 0 };
  const point = { x: 0, z: 0 };
  let remaining = 0;
  for (let i = 0; i < count; i += 1) {
    if (rand() < STRAY_FRACTION) {
      samplePoint(rand, point);
      out[i * 2] = point.x;
      out[i * 2 + 1] = point.z;
      continue;
    }
    if (remaining === 0) {
      samplePoint(rand, centre);
      // +/-40% on the nominal member count, so patches vary in size.
      remaining = Math.max(2, Math.round(CLUSTER_MEMBERS * (0.6 + rand() * 0.8)));
    }
    remaining -= 1;
    const r = CLUSTER_SPREAD * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    out[i * 2] = centre.x + Math.cos(a) * r;
    out[i * 2 + 1] = centre.z + Math.sin(a) * r;
  }
  return out;
}

// Copied from star-catcher/environment/setup.ts `makeDecorative`: a decorative
// object must never intercept a tap meant for the shark's swim target. Taps in
// this game fall through `classifyPickedMesh` to the 'water' branch and steer
// the shark to `pickedPoint`, so litter that raycast would put the swim target
// on top of a pebble instead of on the sand.
function makeDecorative<T extends InstancedMesh>(mesh: T): T {
  mesh.raycast = () => {};
  return mesh;
}

/** The two instanced scatter meshes, kept so teardown can free them. */
export interface ReefLitter {
  pebbles: InstancedMesh;
  clumps: InstancedMesh;
}

/**
 * Builds and adds the seabed litter scatter.
 *
 * @param scene - The Three.js scene to add the instanced meshes to.
 * @returns Handles to both instanced meshes for teardown.
 */
export function buildReefLitter(scene: Scene): ReefLitter {
  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const tilt = new Vector3();
  const color = new Color();
  const point = { x: 0, z: 0 };

  // ── Pebbles ──────────────────────────────────────────────────────
  //
  // Icosahedron, not octahedron. An octahedron squashed to a third of its
  // height and seen from 35 degrees above reads as a flat diamond with four
  // sharp corners, which at 2000-plus copies makes the floor look like broken
  // glass. The 20-face solid has a near-circular silhouette and reads as a
  // water-worn stone. It costs 20 triangles instead of 8: 60k for the field,
  // which is vertex work in a frame that is bound by 972,000 lit and fogged
  // terrain fragments.
  const pebbleGeometry = new IcosahedronGeometry(1, 0);
  const pebbleMaterial = new MeshStandardMaterial({
    // White, because the per-instance colours multiply this. Roughness 1: wet
    // sand-scale debris has no specular lobe worth the shader cost.
    color: new Color(1, 1, 1),
    roughness: 1,
    metalness: 0,
  });
  pebbleMaterial.name = 'little-shark_reefLitterPebbleMat';

  const pebbles = new InstancedMesh(pebbleGeometry, pebbleMaterial, PEBBLE_COUNT);
  pebbles.name = 'reefLitter_pebbles';
  // The scatter spans the whole reef, so its bounding sphere always intersects
  // the frustum; culling it per-frame only costs a test it can never pass.
  pebbles.frustumCulled = false;

  const pebbleRand = createSeededRandom(PEBBLE_SEED);
  const pebblePoints = sampleClustered(pebbleRand, PEBBLE_COUNT);
  for (let i = 0; i < PEBBLE_COUNT; i += 1) {
    point.x = pebblePoints[i * 2];
    point.z = pebblePoints[i * 2 + 1];
    const radius = PEBBLE_RADIUS_MIN + pebbleRand() * (PEBBLE_RADIUS_MAX - PEBBLE_RADIUS_MIN);
    const flatten = PEBBLE_FLATTEN_MIN + pebbleRand() * (PEBBLE_FLATTEN_MAX - PEBBLE_FLATTEN_MIN);
    // Sunk by a third of the squashed height so the lower facets are buried and
    // it reads as bedded into the sand rather than resting on it.
    position.set(point.x, getTerrainHeight(point.x, point.z) - radius * flatten * 0.33, point.z);
    // A small random lean stops 3000 identical solids from looking stamped.
    tilt.set(pebbleRand() - 0.5, 0, pebbleRand() - 0.5).normalize();
    quaternion.setFromAxisAngle(tilt, (pebbleRand() - 0.5) * 0.5);
    scale.set(radius, radius * flatten, radius * (0.8 + pebbleRand() * 0.4));
    matrix.compose(position, quaternion, scale);
    pebbles.setMatrixAt(i, matrix);
    const albedo = pickWeighted(PEBBLE_COLORS, PEBBLE_WEIGHTS, pebbleRand());
    // +/-12% value jitter on top of the palette, so neighbouring pebbles of the
    // same tone still separate from one another.
    const jitter = 0.88 + pebbleRand() * 0.24;
    color.setRGB(albedo[0] * jitter, albedo[1] * jitter, albedo[2] * jitter);
    pebbles.setColorAt(i, color);
  }
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  scene.add(makeDecorative(pebbles));

  // ── Weed clumps ──────────────────────────────────────────────────
  //
  // Icosahedra, not cones. A cone thin enough to read as a blade at this
  // distance also reads as a spike, and nothing on a three-year-old's seabed
  // should look sharp; a rounder 20-face solid stretched upward gives the same
  // vertical silhouette while staying soft. 26k triangles for the field.
  const clumpGeometry = new IcosahedronGeometry(1, 0);
  const clumpMaterial = new MeshStandardMaterial({
    color: new Color(1, 1, 1),
    roughness: 1,
    metalness: 0,
  });
  clumpMaterial.name = 'little-shark_reefLitterClumpMat';

  const clumps = new InstancedMesh(clumpGeometry, clumpMaterial, CLUMP_COUNT);
  clumps.name = 'reefLitter_clumps';
  clumps.frustumCulled = false;

  const clumpRand = createSeededRandom(CLUMP_SEED);
  const clumpPoints = sampleClustered(clumpRand, CLUMP_COUNT);
  for (let i = 0; i < CLUMP_COUNT; i += 1) {
    point.x = clumpPoints[i * 2];
    point.z = clumpPoints[i * 2 + 1];
    const radius = CLUMP_RADIUS_MIN + clumpRand() * (CLUMP_RADIUS_MAX - CLUMP_RADIUS_MIN);
    const stretch = CLUMP_STRETCH_MIN + clumpRand() * (CLUMP_STRETCH_MAX - CLUMP_STRETCH_MIN);
    // Buried by a third of the radius so the clump grows out of the sand.
    position.set(point.x, getTerrainHeight(point.x, point.z) - radius * 0.33, point.z);
    // Leaned as though there were a current running over the reef.
    tilt.set(clumpRand() - 0.5, 0, clumpRand() - 0.5).normalize();
    quaternion.setFromAxisAngle(tilt, clumpRand() * CLUMP_LEAN_MAX);
    scale.set(radius, radius * stretch, radius * (0.8 + clumpRand() * 0.4));
    matrix.compose(position, quaternion, scale);
    clumps.setMatrixAt(i, matrix);
    const albedo = pickWeighted(CLUMP_COLORS, CLUMP_WEIGHTS, clumpRand());
    const jitter = 0.85 + clumpRand() * 0.3;
    color.setRGB(albedo[0] * jitter, albedo[1] * jitter, albedo[2] * jitter);
    clumps.setColorAt(i, color);
  }
  clumps.instanceMatrix.needsUpdate = true;
  if (clumps.instanceColor) clumps.instanceColor.needsUpdate = true;
  scene.add(makeDecorative(clumps));

  return { pebbles, clumps };
}

/**
 * Frees both instanced meshes and their geometry and materials.
 *
 * @param litter - The handles returned by buildReefLitter.
 */
export function disposeReefLitter(litter: ReefLitter): void {
  for (const mesh of [litter.pebbles, litter.clumps]) {
    mesh.removeFromParent();
    mesh.dispose();
    mesh.geometry.dispose();
    (mesh.material as MeshStandardMaterial).dispose();
  }
}
