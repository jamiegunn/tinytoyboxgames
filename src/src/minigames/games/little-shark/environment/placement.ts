// Poisson disk sampling and density-based prop placement for reef scenery.

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/** Configuration for Poisson disk sampling in a circular region. */
export interface PoissonOptions {
  /** Radius of the placement area. */
  radius: number;
  /** Minimum distance between any two points. */
  minDistance: number;
  /** Maximum attempts per active point before giving up. */
  maxAttempts?: number;
  /** Seed for deterministic results. */
  seed?: number;
  /** Maximum number of points to generate. */
  maxPoints?: number;
}

/** A single placement point produced by Poisson disk sampling. */
export interface PlacementPoint {
  x: number;
  z: number;
  /** Distance from center (0-1 normalized). */
  distFromCenter: number;
}

/** Per-prop-type placement preferences. */
export interface PropPlacementConfig {
  /** Identifier for this prop type (e.g., 'coral', 'seaweed', 'rock'). */
  type: string;
  /** Target count to place. */
  count: number;
  /** Minimum distance between same-type props. */
  minSpacing: number;
  /** Preferred distance from center: 'inner' (0-0.4), 'middle' (0.3-0.7), 'outer' (0.6-1.0), 'any'. */
  zone: 'inner' | 'middle' | 'outer' | 'any';
}

/** Options for density-based multi-prop placement. */
export interface DensityPlacementOptions {
  /** Total area radius. */
  radius: number;
  /** Prop types to place with their spacing and count preferences. */
  props: PropPlacementConfig[];
  /** Seed for deterministic results. */
  seed?: number;
}

/** A prop instance with position, rotation, and scale. */
export interface PlacedProp {
  type: string;
  x: number;
  z: number;
  /** Random rotation in radians [0, 2pi). */
  rotationY: number;
  /** Random scale factor [0.8, 1.2]. */
  scaleFactor: number;
}

// ---------------------------------------------------------------------------
// Seeded RNG (xorshift32)
// ---------------------------------------------------------------------------

/**
 * Create a seeded pseudo-random number generator using xorshift32.
 *
 * @param seed - Integer seed value.
 * @returns A function that returns the next pseudo-random number in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed | 0 || 1; // ensure non-zero
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

// ---------------------------------------------------------------------------
// Poisson disk sampling (Bridson's algorithm, circular region)
// ---------------------------------------------------------------------------

/**
 * Generate Poisson-disk-distributed points within a circular region using
 * Bridson's algorithm.
 *
 * Points are guaranteed to be at least `minDistance` apart and lie within the
 * circle of the given `radius` centered at the origin.
 *
 * @param options - Sampling configuration.
 * @returns An array of placement points.
 */
export function poissonDiskSample(options: PoissonOptions): PlacementPoint[] {
  const { radius, minDistance, maxAttempts = 30, seed = 42, maxPoints = 100 } = options;

  const rand = createSeededRandom(seed);

  // Spatial grid for fast neighbour lookup
  const cellSize = minDistance / Math.SQRT2;
  const gridSpan = Math.ceil((radius * 2) / cellSize);
  const grid: (number | undefined)[] = new Array(gridSpan * gridSpan).fill(undefined);

  const points: PlacementPoint[] = [];
  const activeList: number[] = [];

  // Helpers to convert world coords → grid coords (offset so origin maps to center of grid)
  const toGridX = (wx: number) => Math.floor((wx + radius) / cellSize);
  const toGridZ = (wz: number) => Math.floor((wz + radius) / cellSize);
  const gridIndex = (gx: number, gz: number) => gz * gridSpan + gx;

  const addPoint = (x: number, z: number): number => {
    const dist = Math.sqrt(x * x + z * z);
    const pt: PlacementPoint = { x, z, distFromCenter: radius > 0 ? dist / radius : 0 };
    const idx = points.length;
    points.push(pt);
    activeList.push(idx);

    const gx = toGridX(x);
    const gz = toGridZ(z);
    if (gx >= 0 && gx < gridSpan && gz >= 0 && gz < gridSpan) {
      grid[gridIndex(gx, gz)] = idx;
    }
    return idx;
  };

  const isTooClose = (x: number, z: number): boolean => {
    const gx = toGridX(x);
    const gz = toGridZ(z);

    // Check a 5x5 neighbourhood in the grid
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx < 0 || nx >= gridSpan || nz < 0 || nz >= gridSpan) continue;
        const neighbour = grid[gridIndex(nx, nz)];
        if (neighbour === undefined) continue;
        const np = points[neighbour];
        const ddx = np.x - x;
        const ddz = np.z - z;
        if (ddx * ddx + ddz * ddz < minDistance * minDistance) {
          return true;
        }
      }
    }
    return false;
  };

  // Seed with a point near center
  const startAngle = rand() * Math.PI * 2;
  const startR = radius * 0.1 * rand();
  addPoint(Math.cos(startAngle) * startR, Math.sin(startAngle) * startR);

  while (activeList.length > 0 && points.length < maxPoints) {
    // Pick a random active point
    const activeIdx = Math.floor(rand() * activeList.length);
    const currentPoint = points[activeList[activeIdx]];
    let found = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Random point in annulus [minDistance, 2 * minDistance]
      const angle = rand() * Math.PI * 2;
      const dist = minDistance + rand() * minDistance;
      const cx = currentPoint.x + Math.cos(angle) * dist;
      const cz = currentPoint.z + Math.sin(angle) * dist;

      // Must be within circular boundary
      if (cx * cx + cz * cz > radius * radius) continue;

      if (!isTooClose(cx, cz)) {
        addPoint(cx, cz);
        found = true;
        if (points.length >= maxPoints) break;
      }
    }

    if (!found) {
      // Remove from active list (swap-and-pop)
      activeList[activeIdx] = activeList[activeList.length - 1];
      activeList.pop();
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Zone helpers
// ---------------------------------------------------------------------------

/** Normalized distance range for each zone label. */
const ZONE_RANGES: Record<PropPlacementConfig['zone'], [number, number]> = {
  inner: [0, 0.4],
  middle: [0.3, 0.7],
  outer: [0.6, 1.0],
  any: [0, 1.0],
};

/**
 * Score how well a point matches a zone preference.
 * Returns 1 when perfectly inside the range, falling off outside.
 *
 * @param distFromCenter - Normalized distance [0, 1].
 * @param zone - Zone preference label.
 * @returns Fitness score >= 0.
 */
function zoneFitness(distFromCenter: number, zone: PropPlacementConfig['zone']): number {
  const [lo, hi] = ZONE_RANGES[zone];
  if (distFromCenter >= lo && distFromCenter <= hi) return 1;
  // Smooth falloff outside the range
  const overshoot = distFromCenter < lo ? lo - distFromCenter : distFromCenter - hi;
  return Math.max(0, 1 - overshoot * 4);
}

// ---------------------------------------------------------------------------
// Density-based multi-prop placement
// ---------------------------------------------------------------------------

/**
 * Place multiple prop types across a circular area using Poisson disk sampling
 * as the base distribution, then assign each point to a prop type based on
 * zone preference and count targets.
 *
 * @param options - Density placement configuration.
 * @returns An array of placed props with position, rotation, and scale.
 */
export function placePropsByDensity(options: DensityPlacementOptions): PlacedProp[] {
  const { radius, props, seed = 42 } = options;

  if (props.length === 0) return [];

  // Use the smallest minSpacing as the base Poisson distance
  const baseMinDistance = Math.min(...props.map((p) => p.minSpacing));
  const totalCount = props.reduce((sum, p) => sum + p.count, 0);

  // Generate candidate points
  const candidates = poissonDiskSample({
    radius,
    minDistance: baseMinDistance,
    maxPoints: Math.max(totalCount * 2, 200), // oversample so assignment has choices
    seed,
  });

  const rand = createSeededRandom(seed + 7919); // offset seed for assignment phase

  // Track how many of each type have been placed
  const placed: PlacedProp[] = [];
  const remaining = new Map<string, number>();
  for (const p of props) {
    remaining.set(p.type, p.count);
  }

  // For each prop config, keep a set of placed positions for same-type spacing checks
  const typePositions = new Map<string, { x: number; z: number }[]>();
  for (const p of props) {
    typePositions.set(p.type, []);
  }

  // Shuffle candidates for non-biased assignment
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Sort props by specificity — place tighter zones first so they get first pick
  const sortedProps = [...props].sort((a, b) => {
    const zoneOrder: Record<string, number> = { inner: 0, outer: 1, middle: 2, any: 3 };
    return (zoneOrder[a.zone] ?? 3) - (zoneOrder[b.zone] ?? 3);
  });

  // Assign candidates to prop types
  const usedIndices = new Set<number>();

  for (const propConfig of sortedProps) {
    const { type, minSpacing, zone } = propConfig;
    let needed = remaining.get(type) ?? 0;
    if (needed <= 0) continue;

    // Score and sort candidates by zone fitness
    const scored = shuffled
      .map((pt, i) => ({ pt, i, fitness: zoneFitness(pt.distFromCenter, zone) }))
      .filter((entry) => !usedIndices.has(entry.i) && entry.fitness > 0)
      .sort((a, b) => b.fitness - a.fitness);

    const positions = typePositions.get(type)!;

    for (const { pt, i } of scored) {
      if (needed <= 0) break;

      // Check same-type minimum spacing
      let tooClose = false;
      for (const existing of positions) {
        const dx = existing.x - pt.x;
        const dz = existing.z - pt.z;
        if (dx * dx + dz * dz < minSpacing * minSpacing) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      usedIndices.add(i);
      positions.push({ x: pt.x, z: pt.z });

      placed.push({
        type,
        x: pt.x,
        z: pt.z,
        rotationY: rand() * Math.PI * 2,
        scaleFactor: 0.8 + rand() * 0.4,
      });

      needed--;
    }

    remaining.set(type, needed);
  }

  return placed;
}
