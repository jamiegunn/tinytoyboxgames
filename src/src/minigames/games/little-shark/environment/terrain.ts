import { Scene, Mesh, PlaneGeometry, MeshStandardMaterial, Color, BufferAttribute } from 'three';
import { floorAlbedoAt } from './regions';

/**
 * Noise-based heightmapped reef floor terrain with sandy hills,
 * ripple detail, and smooth edge falloff.
 *
 * Self-contained — no external noise libraries or game module imports.
 */

/** Default terrain radius — large enough for an effectively infinite reef. */
const DEFAULT_RADIUS = 60.0;

// ── Relief and tessellation (defect 11) ─────────────────────────────
//
// This was a 120x120 plane at 128x128 segments — 16,641 vertices — displaced by
// at most ±0.4 units. At a grid cell of 0.94 units it was spending sixteen
// thousand vertices to render something the eye read as a flat sheet of sand.
//
// Worse, the noise it sampled was unrepresentable at that tessellation. The
// second FBM octave had a wavelength of 0.83 units and the "sand ripple" octave
// 0.25 units, both at or below the 1.88-unit Nyquist limit of the grid, so they
// contributed per-vertex hash noise rather than shape.
//
// Now: 64x64 segments (4,225 vertices, a 4x cut) at a 1.88-unit cell, with the
// two surviving octaves retuned to 22-unit and 9-unit wavelengths — 12 and 5
// cells respectively, comfortably resolvable — and real relief hung on them.

/** Grid resolution for the terrain plane. */
const SEGMENTS = 64;

/**
 * Peak height above the baseline plane.
 *
 * Deliberately small: the shark swims at y = 0 with no terrain collision, so a
 * hill that crested above the baseline by more than this would swallow it.
 */
const MAX_RISE = 0.3;

/**
 * Depth of the basins below the baseline plane.
 *
 * All the real relief lives on this side, where nothing can be clipped through.
 */
const MAX_DROP = 1.8;

/** Terrain Y position (slightly below water level). */
const TERRAIN_Y = -0.5;

/** Fraction of the radius at which relief starts fading to a flat rim. */
const EDGE_FADE_START = 0.72;

// ── Noise primitives ────────────────────────────────────────────────

/**
 * Linear interpolation between two values.
 * @param a - Start value.
 * @param b - End value.
 * @param t - Interpolation factor in [0, 1].
 * @returns Interpolated value.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Hermite smoothstep interpolation.
 * Returns 0 when x <= edge0, 1 when x >= edge1, and a smooth
 * cubic transition in between.
 * @param edge0 - Lower edge of the transition.
 * @param edge1 - Upper edge of the transition.
 * @param x - Input value.
 * @returns Smoothly interpolated value in [0, 1].
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Integer hash producing a pseudo-random value in [0, 1].
 * Deterministic for any given (x, y) pair.
 * @param x - Integer x coordinate.
 * @param y - Integer y coordinate.
 * @returns Pseudo-random value in [0, 1].
 */
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}

/**
 * 2D value noise with smoothstep interpolation.
 * Returns coherent noise in the range [-1, 1].
 * @param x - Continuous x coordinate.
 * @param y - Continuous y coordinate.
 * @returns Noise value in [-1, 1].
 */
export function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smoothstep fractional parts for bicubic-like interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = hash(ix, iy);
  const n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1);
  const n11 = hash(ix + 1, iy + 1);

  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy) * 2 - 1;
}

// ── Terrain height computation ──────────────────────────────────────

/**
 * Computes the 2-octave fractal Brownian motion height at the given
 * world-space coordinates, with an asymmetric rise/drop envelope and a
 * smooth falloff to a flat rim at the terrain edge.
 * @param x - World x position.
 * @param z - World z position.
 * @returns Height value in world units, relative to the baseline plane.
 */
function computeHeight(x: number, z: number): number {
  // Octave wavelengths of 22 and 9 world units — both several grid cells wide
  // at SEGMENTS = 64, so they survive tessellation as shape instead of noise.
  const fbm = noise2D(x * 0.045, z * 0.045) * 0.72 + noise2D(x * 0.11, z * 0.11) * 0.28;

  // Gain then clamp, so the basins reach their full depth instead of hovering
  // around the middle of the range the way a raw 2-octave sum does.
  const shaped = Math.max(-1, Math.min(1, fbm * 1.35));

  // Asymmetric envelope: shallow hills, deep hollows. See MAX_RISE.
  const h = shaped >= 0 ? shaped * MAX_RISE : shaped * MAX_DROP;

  // Flatten toward the rim so the horizon does not end in a ragged sawtooth.
  const dist = Math.sqrt(x * x + z * z);
  const fade = 1 - smoothstep(DEFAULT_RADIUS * EDGE_FADE_START, DEFAULT_RADIUS, dist);
  return h * fade;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Returns the approximate terrain height at a world position (x, z).
 * Uses the same noise formula as the mesh builder so props can be
 * placed at the correct elevation without creating geometry.
 * @param x - World x coordinate.
 * @param z - World z coordinate.
 * @returns Terrain height in world units (add to TERRAIN_Y for final y).
 */
export function getTerrainHeight(x: number, z: number): number {
  return computeHeight(x, z) + TERRAIN_Y;
}

/**
 * Builds a noise-displaced reef floor mesh with sandy hills, ripple
 * detail, and smooth edge falloff.
 *
 * The mesh is added to the scene and positioned at y = -0.5.
 * Vertex normals are recomputed after displacement so lighting
 * responds correctly to the terrain shape.
 *
 * @param scene - The Three.js scene to add the terrain to.
 * @param radius - Terrain radius in world units. The edge falloff inside
 *   `computeHeight` is keyed to DEFAULT_RADIUS so that `getTerrainHeight` agrees
 *   with the mesh without callers having to thread the radius through; pass
 *   something other than the default and the rim fade will not line up.
 * @returns The reef terrain mesh.
 */
export function buildReefTerrain(scene: Scene, radius: number = DEFAULT_RADIUS): Mesh {
  const diameter = radius * 2;
  const geo = new PlaneGeometry(diameter, diameter, SEGMENTS, SEGMENTS);

  // Rotate to horizontal (XZ plane)
  geo.rotateX(-Math.PI / 2);

  // Displace vertices using noise
  const posAttr = geo.getAttribute('position');
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = computeHeight(x, z);
    posAttr.setY(i, y);
  }

  // Recompute normals after displacement
  geo.computeVertexNormals();

  // Warm sand material.
  //
  // Every pixel of this game's frame is this material seen through some amount
  // of fog — the camera is pitched 37.3 degrees down with a 24.4-degree half-FOV,
  // so even the top of the frame points below the horizon (setup.ts). That makes
  // this albedo one of only two colours in the image; the water colour is the
  // other, and fog lerps between them in display space.
  //
  // Both the value and the saturation matter, and the saturation is the
  // non-obvious one. ACES desaturates hard near the top of its curve: at the
  // 0.888 irradiance this rig used to run at, this albedo kept only 13 of its
  // 38 sRGB levels of chroma and rendered as rgb(223, 220, 211) — a blown-out
  // near-neutral with no headroom above it for caustics or slope shading. At
  // the rig's present total of (0.2234, 0.2549, 0.2890) the same curve is far
  // more forgiving, so the albedo can be pushed toward real sand yellow and
  // actually keep it.
  //
  // The blue channel is the whole lever, and the previous value of 0.48 was
  // spending it in the wrong direction.
  //
  // This comment used to warn that pushing the yellow further was not free:
  // warm sand and blue water sit on opposite sides of neutral, the fog lerp
  // between them passes through grey somewhere in the frame, and a more
  // saturated sand was supposed to deepen that crossover -- "(0.98, 0.76, 0.28)
  // dips to 17 and moves into mid-frame". That is measurably false. Rasterising
  // the real scene graph offline and evaluating candidate sand albedos over the
  // recorded per-pixel illuminant (so the only thing that varies is the albedo)
  // gives per-band chroma, top of frame first:
  //
  //   (0.93, 0.80, 0.48)  114 98 84 72 62 53 44 36 29 24 20 18   min 18, band 12
  //   (0.98, 0.76, 0.28)  110 89 73 58 46 36 30 25 22 21 23 26   min 21, band 10
  //   (1.00, 0.80, 0.26)  109 88 71 57 45 36 31 27 24 25 28 31   min 24, band  9
  //
  // The crossover does move up-frame, but it gets *shallower*, not deeper: a
  // saturated sand comes out of the grey on the far side, into yellow, so the
  // near bands regain chroma instead of asymptoting to neutral. The old albedo
  // had its minimum at the bottom of frame precisely because it never crossed
  // -- it just faded to grey and stopped there.
  //
  // What that buys, per band, R-B (= R minus B, the warm/cool axis):
  //
  //   (0.93, 0.80, 0.48)  -114 -98 -84 -72 -62 -53 -44 -36 -29 -23 -17 -13
  //   (1.00, 0.80, 0.26)  -109 -88 -71 -56 -44 -32 -21 -11  -3  +5 +11 +17
  //
  // i.e. the far end stays deep blue (-109 against water at -135) and the near
  // end crosses into warm at band 9 instead of never crossing at all. Display
  // luminance is unchanged to within 1 level in every band (88..130 against
  // 88..131), so nothing above this on the floor loses contrast.
  //
  // (1.00, 0.80, 0.26) renders unfogged at rgb(156, 150, 90); through fog it is
  // rgb(31, 99, 140) at the top of frame, rgb(86, 121, 118) mid, and
  // rgb(121, 136, 104) at the bottom.
  //
  // Note that the litter palette in reefLitter.ts is annotated against this
  // sand. Move this albedo and those dL and R-B figures go stale.
  //
  // ── Where this albedo now lives ─────────────────────────────────────
  //
  // It is no longer a property of the material. The floor was a single flat
  // albedo over all 100x100 units of arena, and since 73% of every frame is this
  // material at under 60% fog, that uniformity was the structural reason a
  // 400-second swim over 80 units changed the screen no more than a 5-unit one
  // (r^2 = 0.012; see regions.ts for the measurement and the palette search).
  //
  // So the material is white and the albedo above is per-vertex, supplied by
  // `floorAlbedoAt` as the home sand blended toward one of three measured region
  // colours. White x vertex colour reproduces the value above exactly wherever
  // no region reaches, which is most of the reef; the derivation and the litter
  // annotation therefore still hold on the open sand, and regions.ts records
  // what they become inside a region.
  //
  // Vertex colours are consumed raw, in the working (linear) space `new
  // Color(r, g, b)` writes to, which is the same space these albedos are
  // authored in — the same arrangement reefLitter.ts already uses for its two
  // InstancedMeshes' per-instance colours.
  //
  // Resolution check: the grid cell is 120/64 = 1.875 units and a region's fade
  // band is 8.1 to 18 units from its centre, about 5.3 cells. Interpolating a
  // smoothstep piecewise-linearly over 5 samples departs from it by under 3% of
  // a colour delta whose full span is dE2000 ~13, i.e. under 0.4 dE — well below
  // the 2.3 JND, so the band does not facet.
  const mat = new MeshStandardMaterial({
    color: new Color(1, 1, 1),
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
  });
  mat.name = 'terrain_reef_floor_mat';

  const colours = new Float32Array(posAttr.count * 3);
  const albedo: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < posAttr.count; i++) {
    floorAlbedoAt(posAttr.getX(i), posAttr.getZ(i), albedo);
    colours[i * 3] = albedo[0];
    colours[i * 3 + 1] = albedo[1];
    colours[i * 3 + 2] = albedo[2];
  }
  geo.setAttribute('color', new BufferAttribute(colours, 3));

  const mesh = new Mesh(geo, mat);
  mesh.name = 'terrain_reef_floor';
  mesh.position.y = TERRAIN_Y;

  scene.add(mesh);
  return mesh;
}
