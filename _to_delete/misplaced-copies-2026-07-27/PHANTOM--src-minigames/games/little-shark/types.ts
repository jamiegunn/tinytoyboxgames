import { Color, type Object3D, type Mesh } from 'three';

// ── Fish color variants ──────────────────────────────────────────────

/**
 * Color palette for standard fish variants.
 *
 * The previous table in this comment measured each albedo against the WATER
 * colour. That was the wrong background. The camera is pitched 37.3 degrees
 * down with a 24.4-degree half-FOV, so no part of the frame points above the
 * horizon: fish swim at y = 0 and are seen against the reef floor, never
 * against open water. Every contrast ratio in the old table described a
 * comparison the child never makes.
 *
 * Redone against the sand, through the full chain — albedo x rig irradiance
 * (0.2225, 0.2540, 0.2889) + emissive, ACES filmic at exposure 1.15, sRGB
 * encode, then the FogExp2 lerp toward the water colour IN DISPLAY SPACE
 * (fog_fragment runs after colorspace_fragment, and WebGLMaterials passes
 * fogColor through getUnlitUniformColorSpace, so fog is never tone-mapped).
 * That model reproduces the figures terrain.ts recorded from the real
 * renderer to within 4 levels per channel, so these are computed numbers and
 * not eyeballed ones.
 *
 * Fish live at the bottom of the frame, ~9.4 units from the camera, where fog
 * has taken 24% of the pixel and the sand renders rgb(117, 132, 103). Scoring
 * the old set there in CIEDE2000 — every fish against the sand, against the
 * golden fish, and against each other — the worst separation anywhere in the
 * set was 7.43, between orange and yellow. The warm-sand albedo the terrain
 * moved to is the reason: a yellow fish on yellow sand is camouflage.
 *
 * An exhaustive search over 22 nameable hues, maximising that worst-case
 * separation and additionally requiring every pair to sit at least 50 degrees
 * apart in RENDERED hue angle (so the five read as five colours a child can
 * name, not five points that merely happen to be far apart in Lab), returns
 * the set below at a worst-case separation of 13.67 — 1.84x the old set.
 * Rendered, with dE2000 against the sand:
 *
 *   red         (1.00, 0.22, 0.18)  ->  rgb 151, 99,107   hue 351   36.5
 *   tangerine   (1.00, 0.45, 0.05)  ->  rgb 150,134, 76   hue  47   14.0
 *   green       (0.35, 0.95, 0.40)  ->  rgb 109,169,150   hue 161   15.5
 *   periwinkle  (0.55, 0.60, 1.00)  ->  rgb 122,148,187   hue 216   30.5
 *   magenta     (1.00, 0.30, 0.90)  ->  rgb 150,115,183   hue 271   43.7
 *
 * The weakest link is tangerine at 14.0, and it is weak for the same reason
 * the old set was: warm on warm. It survives because it is the only warm slot,
 * so nothing else in the set competes with it, and 14 dE2000 is several times
 * the just-noticeable difference even for immature acuity.
 *
 * Note what does NOT appear here: yellow. Yellow is unrecoverable against this
 * sand at any emissive level, and the golden fish already owns the bright-warm
 * slot. Giving it away to a one-point fish was the actual regression.
 */
export const FISH_COLORS: Color[] = [
  new Color(1.0, 0.22, 0.18), // red
  new Color(1.0, 0.45, 0.05), // tangerine
  new Color(0.35, 0.95, 0.4), // green
  new Color(0.55, 0.6, 1.0), // periwinkle
  new Color(1.0, 0.3, 0.9), // magenta
];

/**
 * Emissive fraction applied to standard fish skin, replacing the 0.04 that
 * `createSkinMaterial` bakes in for every game.
 *
 * Swept through the render model against the palette above: the worst
 * fish-vs-sand separation at the bottom of the frame goes 12.73 (0.04) ->
 * 13.77 (0.12) -> 13.14 (0.20), and at mid-frame 5.39 -> 7.08 -> 5.97. It
 * turns over because past ~0.15 the fish start colliding with the GOLDEN fish
 * instead of with the sand — emissive buys lightness, and lightness is the
 * only channel the golden has. 0.12 is the peak of both curves.
 *
 * Applied locally rather than by raising the 0.04 in `createSkinMaterial`,
 * which is shared with every other game in the box.
 */
export const FISH_EMISSIVE_SCALAR = 0.12;

/**
 * Emissive fraction applied to the golden fish.
 *
 * Unchanged in effect from the hand-tuned `new Color(0.4, 0.35, 0.05)` it
 * replaces — that value was the golden albedo times 0.4 — but expressed as a
 * scalar so it can be applied to all five of the fish's material tiers instead
 * of only the body, and so the sweep above has something to move.
 *
 * It does not go higher. The golden separates from the sand on LIGHTNESS
 * (dL* +17.6) rather than hue, because ACES desaturates as irradiance climbs:
 * pushing this to 0.9 buys 2.0 dE2000 but costs 16 of the fish's 37 sRGB
 * levels of chroma, and a golden fish that has stopped looking gold has lost
 * the thing that made it worth chasing.
 */
export const GOLDEN_EMISSIVE_SCALAR = 0.4;

/** Golden fish body color. */
export const GOLDEN_COLOR = new Color(1.0, 0.85, 0.2);

// ── Bounds ───────────────────────────────────────────────────────────

/** Play area extent on each axis (±BOUNDS). */
export const BOUNDS = 50.0;

// ── Fish hit radius ─────────────────────────────────────────────────

/** Generous hit radius for standard fish — easy to catch. */
export const FISH_HIT_RADIUS = 1.0;

/** Generous hit radius for golden fish — easy to catch. */
export const GOLDEN_HIT_RADIUS = 1.5;

// ── Fish speed (MIN/MAX bounds, interpolated by difficulty) ─────────

export const FISH_BASE_SPEED_MIN = 1.0;
export const FISH_BASE_SPEED_MAX = 1.8;

// ── Fish count (MIN/MAX bounds, interpolated by difficulty) ─────────
//
// Defect 3: nothing read these — the spawner hard-coded 2 nearby fish forever.
// They are now the on-screen fish budget the spawner maintains, ramping with
// `difficulty.level` (manifest ramp {start: 4, end: 40}, so 4 catches to leave
// the floor and 40 to reach the ceiling).
//
// MIN was 3. Measured with the headless tap probe (24 taps in a 6x4 grid over a
// 1200x810 canvas — the same sweep the live harness runs): a floor of 3 left a
// mean of 2.96 fish actually inside the camera frustum, and the nearest fish to
// a given tap sat a mean of 338 px away, further than any believable aim assist
// could reach. At 5 the frustum holds 6.0 and the nearest fish is 220 px away,
// and the grid sweep goes from 5.9 catches to 11.0. Three fish spread over a
// 15-unit radius is not an easy difficulty setting for a three-year-old, it is
// an empty reef.

// Raised again, 5-8 -> 14-18, and this time against a measurement of the thing
// that actually matters rather than of the thing that was easy to count.
//
// A three-year-old does not aim. They put a finger somewhere in the picture and
// expect the picture to answer. So the honest metric is not "can the game be
// beaten" but "of N pokes at arbitrary points, how many produce a reward".
// Measured in the real browser with a blind 6x4 tap grid over a 1200x810
// canvas: 10 hits in 24 taps, a 41.7% hit rate. The literature says a
// four-year-old already misses 39.3% of taps at a STATIONARY, well-defined
// target (Chen et al. 2020, N=41); compound that with a 41.7% chance the target
// is even there and the child's real hit rate is around a quarter.
//
// An independent simulation of the 220px tap-snap over the fish distribution
// predicted 41.5% at a floor of 5 — two instruments agreeing to 0.2 points,
// which is the only reason to trust either. That simulation fits a Poisson
// occupancy model, P(hit) = 1 - exp(-N * 0.1072), giving 77.7% at 14 and 85.4%
// at 18.
//
// The perf cost is real and bounded: each fish is ~20 meshes, and the hard
// ceiling at the call site keeps the total active population finite.
export const MIN_FISH_COUNT = 14;
export const MAX_FISH_COUNT = 18;

// ── Speed multiplier (MIN/MAX bounds, interpolated by difficulty) ───
//
// Defect 3: the old 1.0→1.4 band was then multiplied by 0.5 at the call site,
// so fish crawled at 0.5–0.7x and the ramp was imperceptible. The 0.5 is gone
// and the band is widened: a beginner's fish is slightly slower than before,
// and a veteran's is roughly twice as quick.

export const MIN_SPEED_MULTIPLIER = 0.55;
export const MAX_SPEED_MULTIPLIER = 1.45;

// ── Evasiveness (MIN/MAX bounds, interpolated by difficulty) ────────
//
// Defect 3: fish evasion was fixed — a 1.5-unit startle radius and exactly two
// golden dodges, no matter how good the child got. Normalized 0–1; see
// `getFishEvasiveness` and its consumers in fish/effects.ts.

export const MIN_EVASIVENESS = 0.0;
export const MAX_EVASIVENESS = 1.0;

// ── Golden fish ─────────────────────────────────────────────────────

export const GOLDEN_SPAWN_INTERVAL = 12.0;
export const GOLDEN_SCALE = 1.4;

/**
 * Radius of the ring the golden fish is placed on, relative to the shark.
 *
 * It used to be placed by `randomPositionAwayFrom`, i.e. uniformly anywhere in
 * the 100x100 play area at least 4 units from the shark. Uniform placement in a
 * square puts the expected distance at roughly 0.52 x the side length: a median
 * of about 40 units, in a reef where fog has taken 86% of the pixel by 24 units
 * and the palette's worst-case separation from the sand is 1.4 dE2000 there.
 * The fish worth five points was, in practice, never seen.
 *
 * 13 sits just outside CAMERA_VIEW_RADIUS, so the golden arrives from the edge
 * of the legible zone rather than materialising on top of the shark, and it is
 * well inside CULL_DISTANCE so it has time to be noticed before it can drift
 * out.
 */
export const GOLDEN_SPAWN_RING = 13.0;

// ── Golden fish dodge ───────────────────────────────────────────────

/** Distance the golden fish darts sideways during a dodge. */
export const GOLDEN_DODGE_DISTANCE = 1.5;
/** Duration of a single dodge animation in seconds. */
export const GOLDEN_DODGE_DURATION = 0.3;
/** Cooldown between consecutive dodges in seconds. */
export const GOLDEN_DODGE_COOLDOWN = 2.0;
/** Maximum number of dodges before the golden fish becomes "tired." */
export const GOLDEN_MAX_DODGES = 2;
/** Speed multiplier applied to tired golden fish (after max dodges). */
export const GOLDEN_TIRED_SPEED_MULTIPLIER = 0.5;

// ── Scoring ─────────────────────────────────────────────────────────

/** Points awarded per fish kind. */
export const FISH_POINTS: Record<'standard' | 'golden', number> = {
  standard: 1,
  golden: 5,
};

/** Milestone schedule — contextual celebrations at specific scores. */
export const MILESTONE_SCHEDULE: { score: number; size: 'small' | 'medium' | 'large' }[] = [
  { score: 3, size: 'small' },
  { score: 8, size: 'medium' },
  { score: 15, size: 'large' },
];

/** After the last scheduled milestone, repeat every N points. */
export const MILESTONE_REPEAT_INTERVAL = 10;

// ── Spawning ────────────────────────────────────────────────────────

/** Minimum distance from shark when placing a new fish. */
export const MIN_SPAWN_DISTANCE = 4.0;

// ── Animation timing ────────────────────────────────────────────────

export const EAT_ANIM_DURATION = 0.6;
export const FISH_DESPAWN_SCALE_DURATION = 0.2;
/** The body scaling.x value used by animalBuilder for the shark body. */
export const SHARK_BODY_SCALE_X = 1.15;

// ── Environment ─────────────────────────────────────────────────────

export const CAUSTIC_LIGHT_COUNT = 4;

// ── Camera ──────────────────────────────────────────────────────────

export const CAMERA_RADIUS_PORTRAIT = 13.0;
export const CAMERA_RADIUS_LANDSCAPE = 10.0;

// ── Fish state ──────────────────────────────────────────────────────

/** Discriminated fish kind — determines scoring, appearance, and dodge behavior. */
export type FishKind = 'standard' | 'golden';

/** Internal state for a single fish entity. */
export interface FishState {
  root: Mesh;
  /** The body child mesh used for tap-picking. */
  bodyPickMesh: Object3D;
  /** Discriminated kind — use this for behavior branching. */
  kind: FishKind;
  /**
   * The body colour this fish is currently wearing.
   *
   * Recorded because the fish is pooled and recoloured on reuse, so nothing
   * downstream can infer it. The catch celebration and the catch explosion both
   * used to hardcode `FISH_COLORS[0]`, which meant every standard fish in the
   * game — whatever colour the child saw — burst into orange confetti.
   */
  color: Color;
  active: boolean;
  driftPhaseX: number;
  driftPhaseZ: number;
  driftSpeed: number;
  driftCenterX: number;
  driftCenterZ: number;
  /** Countdown for despawn scale-to-zero animation, -1 when not despawning. */
  despawnTimer: number;
  /** Number of dodges performed (golden fish only). */
  dodgeCount: number;
  /** Cooldown timer until next dodge is possible. */
  dodgeCooldown: number;
  /** Whether this fish is the current target of a player tap-lunge. */
  isTargeted: boolean;
  /** Whether this fish is in spawn-arrival animation (not yet catchable). */
  spawning: boolean;
  /** Timer for spawn arrival animation. */
  spawnTimer: number;
  /** Edge position this fish spawned from (for arrival animation). */
  spawnEdgeX: number;
  /** Edge position this fish spawned from (for arrival animation). */
  spawnEdgeZ: number;
}
