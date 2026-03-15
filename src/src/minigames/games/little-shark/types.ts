import { Color, type Object3D, type Mesh } from 'three';

// ── Fish color variants ──────────────────────────────────────────────

/** Color palette for standard fish variants. */
export const FISH_COLORS: Color[] = [
  new Color(1.0, 0.5, 0.15), // orange
  new Color(1.0, 0.9, 0.2), // yellow
  new Color(0.3, 0.5, 1.0), // blue
  new Color(0.2, 0.8, 0.3), // green
  new Color(1.0, 0.5, 0.7), // pink
];

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

export const MIN_FISH_COUNT = 5;
export const MAX_FISH_COUNT = 10;

// ── Speed multiplier (MIN/MAX bounds, interpolated by difficulty) ───

export const MIN_SPEED_MULTIPLIER = 1.0;
export const MAX_SPEED_MULTIPLIER = 1.4;

// ── Golden fish ─────────────────────────────────────────────────────

export const GOLDEN_SPAWN_INTERVAL = 12.0;
export const GOLDEN_SCALE = 1.4;

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
