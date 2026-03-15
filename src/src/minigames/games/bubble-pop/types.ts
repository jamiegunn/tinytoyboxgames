import { Color, Mesh, type Object3D, type MeshStandardMaterial } from 'three';

/** Bubble special type — determines pop behavior. */
export type BubbleKind = 'normal' | 'golden' | 'rainbow' | 'giant';

/** Game phase for emotional arc. */
export type GamePhase = 'calm' | 'building' | 'crescendo';

/** Internal state for a single bubble entity. */
export interface BubbleState {
  mesh: Mesh;
  /** Small white sphere child giving the classic specular shine highlight. */
  shineMesh: Mesh;
  speed: number;
  phase: number;
  sizeVariant: number;
  active: boolean;
  /** Base color used for particle effects on pop. */
  baseColor: Color;
  /**
   * Index into BUBBLE_COLORS for this bubble's palette color.
   * Only meaningful when `kind === 'normal'`; special kinds ignore this value.
   * Use `kind` (not colorIndex) to determine special bubble behavior.
   */
  colorIndex: number;
  /** Special bubble type. */
  kind: BubbleKind;
  /** For giant bubbles — how many taps remaining before it pops. */
  tapsRemaining: number;
  /** Wobble phase offset for squash-stretch animation. */
  wobblePhase: number;
  /** Wobble speed multiplier. */
  wobbleSpeed: number;
  /** Age in seconds since spawn — used for entrance animation. */
  age: number;
  /** Whether the bubble is still in its spawn animation and not pickable yet. */
  spawning: boolean;
}

/** Pastel rainbow colors for iridescent bubble appearance. */
export const BUBBLE_COLORS: Color[] = [
  new Color(1.0, 0.6, 0.7), // pastel pink
  new Color(0.6, 0.8, 1.0), // pastel blue
  new Color(0.7, 1.0, 0.7), // pastel green
  new Color(1.0, 0.85, 0.5), // pastel yellow
  new Color(0.8, 0.6, 1.0), // pastel purple
  new Color(0.5, 1.0, 0.9), // pastel teal
  new Color(1.0, 0.7, 0.5), // pastel orange
  new Color(0.9, 0.7, 1.0), // pastel lavender
];

/** Golden bubble color. */
export const GOLDEN_COLOR = new Color(1.0, 0.85, 0.3);

/** Rainbow bubble prismatic base color. */
export const RAINBOW_COLOR = new Color(1.0, 1.0, 1.0);

/** Size radii for the three bubble variants. */
export const SIZE_VARIANTS = [0.2, 0.32, 0.45];

/** Giant bubble size multiplier on top of SIZE_VARIANTS. */
export const GIANT_SCALE = 1.6;

/** Maximum number of bubbles active at once. */
export const MAX_BUBBLES = 80;

/** Starting number of bubbles. */
export const INITIAL_BUBBLES = 40;

/** Y threshold above which bubbles are recycled. */
export const RECYCLE_Y = 9;

/** Respawn delay bounds in seconds — interpolated by difficulty level. */
export const MIN_RESPAWN_DELAY = 0.3;
export const MAX_RESPAWN_DELAY = 0.8;

/** Float speed bounds in units per second — interpolated by difficulty level. */
export const MIN_FLOAT_SPEED = 0.15;
export const MAX_FLOAT_SPEED = 1.0;

/** Horizontal sway amplitude. */
export const SWAY_AMPLITUDE = 0.6;

/** Sway frequency multiplier. */
export const SWAY_FREQUENCY = 1.2;

/** Spawn area X bounds. */
export const SPAWN_X_MIN = -4.5;
export const SPAWN_X_MAX = 4.5;

/** Bottom-edge spawn Y (just below visible area). */
export const SPAWN_Y_BOTTOM = -6;

/** Side-edge spawn X offsets (just beyond visible area). */
export const SPAWN_X_LEFT_EDGE = -5.5;
export const SPAWN_X_RIGHT_EDGE = 5.5;

/** Side-edge spawn Y range (visible band for side-entering bubbles). */
export const SPAWN_SIDE_Y_MIN = -4;
export const SPAWN_SIDE_Y_MAX = 2;

/** Probability of spawning from the bottom vs. a side edge. */
export const SPAWN_BOTTOM_CHANCE = 0.7;

/** Chain pop radius — bubbles within this distance are chain-popped by rainbow bubbles. */
export const CHAIN_POP_RADIUS = 2.5;

/** Wobble radius — nearby bubbles wobble when one pops. */
export const WOBBLE_RADIUS = 2.0;

/** Number of mini-bubbles spawned when a golden bubble pops. */
export const GOLDEN_BURST_COUNT = 6;

/** Wobble amplitude for squash-stretch. */
export const WOBBLE_AMPLITUDE = 0.08;

/** Wobble speed range. */
export const WOBBLE_SPEED_MIN = 2.0;
export const WOBBLE_SPEED_MAX = 4.0;

/** Spawn animation duration in seconds. */
export const SPAWN_ANIM_DURATION = 0.4;

/** Moon pulse trigger — every N pops. */
export const MOON_PULSE_INTERVAL = 10;

/** Bubble shower trigger — every N pops. */
export const SHOWER_INTERVAL = 20;

/** Shower bubble count. */
export const SHOWER_COUNT = 32;

/** Crescendo cycle duration in seconds for the breathing rhythm. */
export const CRESCENDO_CYCLE = 60;

/** Base points awarded per bubble kind on pop. */
export const BUBBLE_POINTS: Record<BubbleKind, number> = {
  normal: 10,
  golden: 25,
  rainbow: 50,
  giant: 100,
};

/** Score milestone interval — celebration fires every N points. */
export const SCORE_MILESTONE_INTERVAL = 100;

/** Primary spawn loop interval in seconds. */
export const SPAWN_INTERVAL = 0.2;

/** Primary spawn loop jitter in seconds. */
export const SPAWN_JITTER = 0.08;

/** Shower burst spawn interval in seconds (stagger between each bubble). */
export const SHOWER_SPAWN_INTERVAL = 0.08;

/** Camera radius in portrait orientation. */
export const CAMERA_RADIUS_PORTRAIT = 13.0;

/** Camera radius in landscape orientation. */
export const CAMERA_RADIUS_LANDSCAPE = 10.0;

/** Number of taps required to pop a giant bubble. */
export const GIANT_TAPS = 3;

/** Extra pool slots beyond MAX_BUBBLES for golden burst headroom. */
export const POOL_BUFFER = 10;

/** Approximate world-to-screen scaling factor for decorative confetti placement. */
export const SCREEN_PROJECTION_SCALE = 50;

/** Speed boost cap added to MIN_FLOAT_SPEED during calm phase. */
export const CALM_SPEED_CEILING = 0.25;

/** Delay in seconds before a wobble-victim auto-pops. */
export const WOBBLE_AUTO_POP_DELAY = 0.5;

/** Chain pop stagger — initial delay before the first chain-popped bubble pops. */
export const CHAIN_POP_INITIAL_DELAY = 0.08;

/** Chain pop stagger — additional delay per subsequent chain-popped bubble. */
export const CHAIN_POP_STAGGER = 0.1;

/** Pop sound IDs indexed by sizeVariant (0=small, 1=medium, 2=large). */
export const POP_SOUNDS: readonly string[] = ['sfx_bubble_pop_pop_small', 'sfx_bubble_pop_pop_medium', 'sfx_bubble_pop_pop_large'];

/** Fallback world-projection extents for screen-to-world unproject on tap miss. */
export const FALLBACK_X_EXTENT = 10;
export const FALLBACK_Y_EXTENT = 8;
export const FALLBACK_Y_OFFSET = 2;

/** All environment objects for per-frame update and cleanup. */
export interface EnvironmentObjects {
  meshes: Object3D[];
  stars: StarMesh[];
  moon: Object3D | null;
  moonMat: MeshStandardMaterial | null;
}

/** Individual star with its own twinkle parameters. */
export interface StarMesh {
  mesh: Mesh;
  mat: MeshStandardMaterial;
  color: Color;
  baseIntensity: number;
  twinkleSpeed: number;
  twinklePhase: number;
}
