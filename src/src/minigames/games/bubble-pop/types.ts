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
  /**
   * Radius the bubble is heading for, in world units (before GIANT_SCALE).
   * Set from `SIZE_VARIANTS[sizeVariant]` at spawn; only `tapGiantBubble`
   * moves it afterwards.
   */
  targetSize: number;
  /**
   * Currently rendered radius in world units, eased toward `targetSize` every
   * frame. Giving the size its own animated value is what lets a tapped giant
   * *visibly deflate* instead of snapping — see `tapGiantBubble`, which used
   * to step `sizeVariant` the wrong way and made a tapped giant grow.
   */
  displaySize: number;
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

/**
 * Rendered world-space radii for the three bubble variants, ascending.
 * The sphere geometry is authored at radius 0.5, so a bubble's mesh scale is
 * `SIZE_VARIANTS[v] / 0.5` and its true rendered radius is `SIZE_VARIANTS[v]`.
 */
export const SIZE_VARIANTS = [0.2, 0.32, 0.45];

/** Giant bubble size multiplier on top of SIZE_VARIANTS. */
export const GIANT_SCALE = 1.6;

/** Largest rendered radius any bubble can reach: 0.45 * 1.6 = 0.72 world units. */
export const MAX_BUBBLE_RADIUS = SIZE_VARIANTS[SIZE_VARIANTS.length - 1] * GIANT_SCALE;

/**
 * How fast `displaySize` chases `targetSize`, in world units per second.
 * A giant's first deflation is 0.45 -> 0.36, so it settles in 0.09 / 0.5 =
 * ~0.18s: fast enough to read as a direct response to the tap, slow enough
 * that a 3-year-old sees it shrink rather than teleport.
 */
export const SIZE_EASE_RATE = 0.5;

/**
 * Fraction of its radius a giant keeps per tap. Proportional rather than a
 * step down SIZE_VARIANTS, because `giantTapsRequired` can ask for up to five
 * taps and there are only three variants — stepping the variant could not
 * guarantee the "it got smaller!" feedback on every tap, which is the entire
 * point of a multi-tap bubble. Giants spawn at the largest variant, so the
 * rendered radius walks 0.72 -> 0.58 -> 0.46 -> 0.37 -> 0.29: every tap is a
 * visible ~20% shrink and the target stays comfortably tappable at the end.
 */
export const GIANT_TAP_SHRINK = 0.8;

/** Hard floor on `targetSize`, so no run of taps can shrink a bubble to nothing. */
export const MIN_DISPLAY_SIZE = 0.15;

/** Maximum number of bubbles active at once. */
export const MAX_BUBBLES = 80;

/** Starting number of bubbles. */
export const INITIAL_BUBBLES = 40;

/**
 * Y threshold above which bubbles are recycled.
 *
 * Was 9, roughly five units above anything a player can see, so an escaped
 * bubble sat off-frame holding a pool slot for 5–30 seconds. Derived from the
 * default shell camera (`DEFAULT_GAME_CAMERA`: position (0, 2, 5), target
 * (0, 0, 0), vertical fov 60):
 *
 *   view axis tilts down atan(2 / 5)          = 21.8 deg
 *   top frustum edge sits 30 deg above that   =  8.2 deg above horizontal
 *   top ray direction                         = (0, sin 8.2, -cos 8.2)
 *                                             = (0, 0.143, -0.990)
 *   bubbles live in z in [-1, 1.5]; the frame top is highest at the far end,
 *   z = -1:  t = (5 - -1) / 0.990 = 6.06  ->  y = 2 + 0.143 * 6.06 = 2.86
 *   clear of frame once the largest bubble's radius is past it:
 *                                     2.86 + MAX_BUBBLE_RADIUS (0.72) = 3.58
 *
 * fov is vertical, so this holds in both orientations.
 */
export const RECYCLE_Y = 3.6;

/** Respawn delay bounds in seconds — interpolated by difficulty level. */
export const MIN_RESPAWN_DELAY = 0.3;
export const MAX_RESPAWN_DELAY = 0.8;

/** Float speed bounds in units per second — interpolated by difficulty level. */
export const MIN_FLOAT_SPEED = 0.15;
export const MAX_FLOAT_SPEED = 1.0;

/**
 * Per-bubble random rise-speed variation, applied as a *multiplier* on the
 * difficulty-scaled base speed the caller already chose. Spawn placement used
 * to overwrite `speed` outright with randomRange(MIN_FLOAT_SPEED,
 * MAX_FLOAT_SPEED), which made every difficulty-scaled speed curve dead code.
 * A tight band around 1 keeps the crowd feeling alive without undoing the ramp.
 */
export const SPEED_VARIATION_MIN = 0.8;
export const SPEED_VARIATION_MAX = 1.25;

/** Horizontal sway amplitude. */
export const SWAY_AMPLITUDE = 0.6;

/** Sway frequency multiplier. */
export const SWAY_FREQUENCY = 1.2;

/**
 * Horizontal spawn extents, re-derived from the live camera whenever the
 * viewport changes (see `computeSpawnBand`).
 *
 * The old fixed band was x in [-4.5, 4.5] with side entries at +/-5.5. At fov
 * 60 and a camera 5 units back, the visible half-width at the bubble plane is
 * only ~1.4 units on a portrait phone, so the great majority of bubbles were
 * spawned where no child could see or reach them. Vertical extents stay
 * constant because fov is vertical and therefore orientation-independent;
 * only the horizontal band has to follow the aspect ratio.
 */
export interface SpawnBand {
  /** Half-width of the column in which a bottom-spawned bubble is on screen. */
  halfWidth: number;
  /** X just outside the frame, where side-entering bubbles start. */
  edgeX: number;
}

/**
 * Band used before the first camera-derived measurement lands. Sized for the
 * narrowest orientation we ship (portrait, aspect ~0.46) so it can only ever
 * be too conservative, never off screen.
 */
export const FALLBACK_SPAWN_BAND: SpawnBand = { halfWidth: 1.0, edgeX: 2.2 };

/** Bottom-edge spawn Y (just below the visible area at the bubble plane). */
export const SPAWN_Y_BOTTOM = -4.5;

/**
 * Side-edge spawn Y range (visible band for side-entering bubbles).
 * The top was 4, above the frame top of ~2.7 (see RECYCLE_Y) — those bubbles
 * were born off screen and, with RECYCLE_Y now lowered, would be recycled on
 * their very first frame. 2.0 keeps a side entrant inside the frame.
 */
export const SPAWN_SIDE_Y_MIN = -3;
export const SPAWN_SIDE_Y_MAX = 2.0;

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

/**
 * Minimum gap in seconds between spawn chimes. Every spawn used to play
 * `sfx_bubble_pop_appear`, and the spawn loop runs as fast as every 0.12s
 * (faster still during a shower), so the soundtrack was a continuous rattle.
 * One cue every few seconds still says "look, more bubbles" without the noise.
 */
export const SPAWN_CUE_MIN_INTERVAL = 3.0;

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
