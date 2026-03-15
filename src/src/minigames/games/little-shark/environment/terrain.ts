import { Scene, Mesh, PlaneGeometry, MeshStandardMaterial, Color } from 'three';

/**
 * Noise-based heightmapped reef floor terrain with sandy hills,
 * ripple detail, and smooth edge falloff.
 *
 * Self-contained — no external noise libraries or game module imports.
 */

/** Default terrain radius — large enough for an effectively infinite reef. */
const DEFAULT_RADIUS = 60.0;

/** Maximum vertex displacement height (gentle hills). */
const MAX_HEIGHT = 0.4;

/** Terrain Y position (slightly below water level). */
const TERRAIN_Y = -0.5;

/** Grid resolution for the terrain plane. */
const SEGMENTS = 128;

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
 * Computes the 2-octave fractal Brownian motion height plus sand ripple
 * detail at the given world-space coordinates.
 * @param x - World x position.
 * @param z - World z position.
 * @returns Height value in world units.
 */
function computeHeight(x: number, z: number): number {
  // 2-octave FBM
  const fbm = noise2D(x * 0.5, z * 0.5) * 0.6 + noise2D(x * 1.2, z * 1.2) * 0.3;

  // Sand ripple detail
  const ripple = noise2D(x * 4, z * 4) * 0.05;

  return (fbm + ripple) * MAX_HEIGHT;
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
 * @param radius - Terrain radius in world units (default 8.0).
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

  // Warm sand material
  const mat = new MeshStandardMaterial({
    color: new Color(0.76, 0.69, 0.5),
    roughness: 0.9,
    metalness: 0.0,
  });
  mat.name = 'terrain_reef_floor_mat';

  const mesh = new Mesh(geo, mat);
  mesh.name = 'terrain_reef_floor';
  mesh.position.y = TERRAIN_Y;

  scene.add(mesh);
  return mesh;
}
