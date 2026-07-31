import { Color, Mesh, type Object3D, type MeshBasicMaterial, type MeshStandardMaterial } from 'three';

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

/**
 * Hard ceiling on active bubbles — used for the spawner's `maxCount`, the pool
 * prewarm size and the pool cap. The *gameplay* crowd size is
 * `targetBubbleCount` (13 at difficulty 0 rising to 21); this constant only has
 * to leave headroom above that for the two things which can spawn past the
 * target:
 *
 *   targetBubbleCount(1)                                  = 21
 *   + shower headroom (`showerCount` allows target + 4)   =  4  -> 25
 *   + one golden burst on top (GOLDEN_BURST_COUNT)        =  6  -> 31
 *
 * rounded up to 32. It was 80, so `pool.prewarm(MAX_BUBBLES)` built 80 bubble
 * meshes (a 32x32 sphere, ~2k triangles, plus a material each) that the game
 * could never put on screen at once.
 */
export const MAX_BUBBLES = 32;

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

/**
 * Visible height of the bubble plane, in world units.
 *
 * Derived from the default shell camera (`DEFAULT_GAME_CAMERA`: position
 * (0, 2, 5), target (0, 0, 0), vertical fov 60), intersected with the plane
 * the bubbles float on, z = 0:
 *
 *   view axis tilts down atan(2 / 5)                = 21.8 deg
 *   top frustum edge    = 30 - 21.8 =  8.2 deg above horizontal
 *     dir (0,  sin 8.2,  -cos 8.2)  = (0,  0.143, -0.990)
 *     t = 5 / 0.990 = 5.05  ->  y = 2 + 0.143 * 5.05 =  2.72
 *   bottom frustum edge = 30 + 21.8 = 51.8 deg below horizontal
 *     dir (0, -sin 51.8, -cos 51.8) = (0, -0.786, -0.618)
 *     t = 5 / 0.618 = 8.09  ->  y = 2 - 0.786 * 8.09 = -4.36
 *
 *   visible band = 2.72 - (-4.36) = 7.08 world units
 *
 * fov is vertical, so this is orientation-independent. (Bubbles are spread
 * over z in [-1, 1.5] rather than pinned to z = 0, which widens the real band
 * to [-5.62, 2.86] at the far edge and narrows it to [-2.45, 2.50] at the near
 * edge; z = 0 is the representative middle and is what every derivation below
 * uses.)
 */
export const VISIBLE_BAND_HEIGHT = 7.08;

/**
 * Float speed bounds in world units per second — the hard floor and ceiling
 * that every bubble's rise rate is clamped into (see `clampSpeed`), and the
 * band `bubbleSpeedRange` slides its per-difficulty window through.
 *
 * Derived from how long a bubble should take to cross the frame, not by
 * nudging. A 3-year-old will not wait for a slow crossing, and a fast one is
 * unhittable, so the target is 6-12 seconds across VISIBLE_BAND_HEIGHT:
 *
 *   MIN = 7.08 / 12 = 0.59  ->  0.6  (slowest bubble crosses in 7.08/0.6 = 11.8 s)
 *   MAX = 7.08 /  6 = 1.18  ->  1.2  (fastest bubble crosses in 7.08/1.2 =  5.9 s)
 *
 * That arithmetic is WRITTEN OUT BELOW rather than left in this comment, and
 * the values are unchanged (0.59 and 1.18 round to 0.6 and 1.2 at one decimal).
 * A derivation stated only in prose is a claim nothing checks: before this,
 * VISIBLE_BAND_HEIGHT could be re-measured to any number at all and these two
 * would sit here still asserting they came from it. Now they do.
 *
 * These were 0.15 and 1.0. `bubbleSpeedRange` handed out ~0.18 u/s at
 * difficulty 0 in the calm phase, i.e. 7.08 / 0.18 = 39 seconds to cross the
 * frame — bubbles enter from the bottom, so the top two thirds of the screen
 * was measurably empty for the first half-minute of every session.
 *
 * NOTE the rise is not applied as a direct velocity: `updateBubbleMotion`
 * scales the flow field by `speed / DEFAULT_FLOW_CONFIG.baseRise` (= speed /
 * 0.3), and the field's mean vertical component is exactly `baseRise`, so the
 * *average* rise rate works out to `speed` u/s with simplex noise either side
 * of it. The numbers above are therefore averages, not instantaneous speeds.
 */
/** Slowest tolerable crossing of the visible band, in seconds. */
const SLOWEST_CROSSING_SECONDS = 12;
/** Fastest still-hittable crossing of the visible band, in seconds. */
const FASTEST_CROSSING_SECONDS = 6;

/**
 * Rounds to one decimal place — these are tuning dials a human reads, not raw quotients.
 *
 * @param n - The quotient to round.
 * @returns `n` to one decimal place.
 */
const round1 = (n: number): number => Math.round(n * 10) / 10;

export const MIN_FLOAT_SPEED = round1(VISIBLE_BAND_HEIGHT / SLOWEST_CROSSING_SECONDS);
export const MAX_FLOAT_SPEED = round1(VISIBLE_BAND_HEIGHT / FASTEST_CROSSING_SECONDS);

/**
 * Per-bubble random rise-speed variation, applied as a *multiplier* on the
 * difficulty-scaled base speed the caller already chose. Spawn placement used
 * to overwrite `speed` outright with randomRange(MIN_FLOAT_SPEED,
 * MAX_FLOAT_SPEED), which made every difficulty-scaled speed curve dead code.
 * A tight band around 1 keeps the crowd feeling alive without undoing the ramp.
 */
export const SPEED_VARIATION_MIN = 0.8;
export const SPEED_VARIATION_MAX = 1.25;

/**
 * Horizontal sway, as a VELOCITY coefficient in u/s — not a position offset.
 *
 * `updateBubbleMotion` applies it as `x += sin(t*F + phase) * A * 0.3 * dt`, so
 * the excursion a child actually sees is the integral of that: peak-to-peak
 * `0.6 * A / F` = 0.30 world units, about 34 px at a phone portrait viewport.
 * Note the consequence — raising the FREQUENCY SHRINKS the travel.
 *
 * These two are fixed on purpose, and sway is the one balance question
 * `balance.ts` does not answer. That file used to carry `swayAmplitude(ed)` and
 * `swayFrequency(ed)` curves that nothing imported; they scaled A and F in
 * lockstep, so `A / F` ran 0.375 → 0.5 → 0.5 and the hard end of the ramp
 * reduced to exactly the pair below, while the whole easy→hard ramp came to
 * 8.6 px — less than the 28 px of smear a tap already forgives. Measured in
 * `.probe/gameplay/r8-bubble-sway-lever.mjs`; the full reasoning is kept in
 * balance.ts where those curves used to be.
 */
export const SWAY_AMPLITUDE = 0.6;
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

/**
 * Bottom-edge spawn Y (just below the visible area at the bubble plane).
 * Bottom spawns are jittered into [SPAWN_Y_BOTTOM - 0.5, SPAWN_Y_BOTTOM], so
 * the mean entry height is -4.75, against a visible bottom edge of -4.36 (see
 * VISIBLE_BAND_HEIGHT) — bubbles still enter from off screen.
 */
export const SPAWN_Y_BOTTOM = -4.5;

/**
 * Mean vertical distance a bubble rises before it is recycled, averaged over
 * both spawn edges. `targetBubbleCount` and `spawnInterval` size themselves
 * off this, because a bubble's lifetime is this distance divided by its speed.
 *
 *   bottom edge (SPAWN_BOTTOM_CHANCE = 70%), mean spawn y = -4.75:
 *     RECYCLE_Y - (-4.75)                              = 8.35
 *   side edge (30%), mean spawn y = (-3 + 2.0) / 2     = -0.5:
 *     RECYCLE_Y - (-0.5)                               = 4.10
 *
 *   0.7 * 8.35 + 0.3 * 4.10 = 5.845 + 1.230            = 7.08
 *
 * (That it lands on the same 7.08 as VISIBLE_BAND_HEIGHT is a coincidence of
 * the two spawn edges, not a derivation — they are independent numbers.)
 */
export const MEAN_TRAVEL_DISTANCE = 7.08;

/**
 * Fraction of an active bubble's life that is actually on screen — the bridge
 * between "how many bubbles should a child see" and the active-entity count
 * the pool and spawner deal in.
 *
 *   bottom-edge bubble: crosses the whole visible band, 7.08 units of its
 *     8.35-unit run
 *   side-edge bubble: born inside the visible band at mean y = -0.5 and leaves
 *     at 2.72, so 3.22 of its 4.10-unit run is vertically on screen — but it
 *     starts just outside the horizontal frame edge and only drifts inward on
 *     about half the flow-field rolls, so call it 3.22 * 0.5 = 1.61
 *
 *   visible units per spawn = 0.7 * 7.08 + 0.3 * 1.61 = 4.956 + 0.483 = 5.44
 *   fraction                = 5.44 / MEAN_TRAVEL_DISTANCE = 5.44 / 7.08 = 0.77
 *
 * The last line is computed rather than transcribed, for the same reason as
 * MIN_FLOAT_SPEED: MEAN_TRAVEL_DISTANCE had no reader at all until this line,
 * so the sentence "sizes itself off this" above was true of the author's intent
 * and false of the program.
 */
const VISIBLE_UNITS_PER_SPAWN = 5.44;

export const VISIBLE_LIFE_FRACTION = Math.round((VISIBLE_UNITS_PER_SPAWN / MEAN_TRAVEL_DISTANCE) * 100) / 100;

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

/**
 * Chain pop radius — bubbles within this distance are chain-popped by rainbow
 * bubbles. Flat across difficulty, and that is a decision.
 *
 * balance.ts used to export an unimported `chainPopRadius(ed, activeCount)`
 * running 2.0 → 3.0 with a x1.3 bonus under 8 active. Unlike the sway curves it
 * was easily perceptible (a 0.5 unit change is ~57 px at phone portrait), but it
 * spent that on giving the EASIEST difficulty the SMALLEST reach: at ed = 0 with
 * a normal 13-bubble field it returned 2.00 against the 2.5 shipping here, a 20%
 * cut for the youngest player. A rainbow bubble is this game's biggest reward,
 * and the child least able to earn one is the last who should get less of it.
 */
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

/** Base points awarded per bubble kind on pop. */
export const BUBBLE_POINTS: Record<BubbleKind, number> = {
  normal: 10,
  golden: 25,
  rainbow: 50,
  giant: 100,
};

/**
 * NOT HERE, DELIBERATELY: the tuning knobs live in balance.ts, not in this file.
 *
 * This block used to also hold SPAWN_INTERVAL, SHOWER_INTERVAL, SHOWER_COUNT,
 * SHOWER_SPAWN_INTERVAL, SCORE_MILESTONE_INTERVAL, GIANT_TAPS,
 * MIN_RESPAWN_DELAY and MAX_RESPAWN_DELAY. Every one of them was a plain
 * `export const` with a confident one-line comment, and not one was imported
 * anywhere. They were left behind when the fixed values were replaced by the
 * difficulty curves in balance.ts, and they did not merely sit idle — they
 * disagreed with the game:
 *
 *   SPAWN_INTERVAL 0.2            vs  spawnInterval(ed)        0.62 → 0.25
 *   SHOWER_INTERVAL 20 pops       vs  showerInterval(ed)       30 → 15
 *   SHOWER_COUNT 32 bubbles       vs  showerCount(...)         3 → 10, headroom-capped
 *   SHOWER_SPAWN_INTERVAL 0.08    vs  showerSpawnStagger(ed)   0.15 → 0.06
 *   SCORE_MILESTONE_INTERVAL 100  vs  MILESTONE_SCHEDULE       100/300/600/1000/1500, then +500
 *   GIANT_TAPS 3                  vs  giantTapsRequired(p)     1 → 5 by player profile
 *   MIN/MAX_RESPAWN_DELAY         vs  nothing — bubbles do not respawn on a delay at all
 *
 * Anyone — human or model — reading this file to learn the rules would have
 * come away with the wrong number for every rule it named. Balance questions
 * are answered by balance.ts; put new curves there, not new constants here.
 *
 * AND THE RULE RUNS BOTH WAYS, because it was later caught running backwards.
 * balance.ts had accumulated three curves — `swayAmplitude`, `swayFrequency`,
 * `chainPopRadius` — that nothing imported, while the game ran on
 * `SWAY_AMPLITUDE`, `SWAY_FREQUENCY` and `CHAIN_POP_RADIUS` below. A reader who
 * obeyed the paragraph above went to balance.ts, found a documented difficulty
 * ramp for sway, and was wrong about the game. An unimported curve in the
 * authority file is this same lie wearing the other file's name, and it is
 * worse, because this block is what sends people there to be misled. Those
 * three are deleted; see balance.ts for the measurements that decided deleting
 * them beat wiring them in.
 */

/** Primary spawn loop jitter in seconds. */
export const SPAWN_JITTER = 0.08;

/** Extra pool slots beyond MAX_BUBBLES for golden burst headroom. */
export const POOL_BUFFER = 10;

/** Approximate world-to-screen scaling factor for decorative confetti placement. */
export const SCREEN_PROJECTION_SCALE = 50;

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
  /**
   * Material of the moon disc. Unlit (`MeshBasicMaterial`): the disc's shading,
   * craters and warm-to-cool tint all live in its texture, and `color` is a
   * plain brightness multiplier the pop pulse rides on. It used to be a
   * `MeshStandardMaterial` whose `emissive` was pulsed, which meant the moon's
   * appearance depended on the shell's environment map as well as its own
   * emissive term.
   */
  moonMat: MeshBasicMaterial | null;
  /** Material of the moon's additive glow quad — pulsed alongside `moonMat`. */
  moonGlowMat: MeshBasicMaterial | null;
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
