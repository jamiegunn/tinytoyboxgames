import { type Sprite, type SpriteMaterial, Vector3, Color } from 'three';
import type { StreamHandle } from '@app/utils/particles/engine';

/** Behavior type that determines how a firefly moves. */
export type FireflyBehavior = 'drift' | 'circle' | 'zigzag';

/** Internal state for each active firefly entity. */
export interface FireflyData {
  /** Billboard sprite carrying the soft additive glow (the bloom halo). */
  sprite: Sprite;
  /** Sprite material for color/opacity animation. */
  spriteMaterial: SpriteMaterial;
  /**
   * Child billboard drawn over the glow with the actual creature — body, head,
   * eyes and wings. The game is called Fireflies; a blurry dot is not one.
   */
  bodySprite: Sprite;
  /** Material for the creature billboard (its map is swapped to flap wings). */
  bodyMaterial: SpriteMaterial;
  /** Wing-flap phase in seconds, advanced each frame. */
  flapPhase: number;
  /** Seconds this firefly has left in play (goldens only; -1 = no limit). */
  lifeTimer: number;
  /** Continuous glow particle stream attached to this firefly. */
  glowTrail: StreamHandle;
  speed: number;
  glowPhase: number;
  driftOffsetX: number;
  driftOffsetY: number;
  driftOffsetZ: number;
  /** Accumulated time for drift animation. */
  time: number;
  /** Whether this firefly is the golden variant. */
  isGolden: boolean;
  /** Whether the firefly is currently being caught (animating to jar). */
  catching: boolean;
  /** Progress of catch animation (0-1). */
  catchProgress: number;
  /** Position at start of catch animation. */
  catchStartPos: Vector3;
  /** Whether the firefly is in flash phase before arc. */
  flashing: boolean;
  /** Timer for the flash phase. */
  flashTimer: number;
  /** Whether this firefly slot is active and visible. */
  active: boolean;
  /** Respawn timer countdown in seconds. */
  respawnTimer: number;
  /** Movement behavior type. */
  behavior: FireflyBehavior;
  /** Center point for circle orbit behavior. */
  behaviorCenter: Vector3;
  /** Current angle for circle orbit behavior (radians). */
  behaviorAngle: number;
  /** Orbit radius for circle behavior. */
  behaviorRadius: number;
  /** Timer until next direction change for zigzag behavior. */
  zigzagTimer: number;
  /** Current movement direction for zigzag behavior. */
  zigzagDir: Vector3;
}

/** Difficulty tier definition. */
export interface DifficultyTier {
  maxFireflies: number;
  speedMultiplier: number;
}

/**
 * Jar base position.
 *
 * Derived from the shell camera (fixed at (0,2,5) looking at the origin, 60 deg
 * vertical fov — see `DEFAULT_GAME_CAMERA`). With `d` the unit view direction
 * and `u` the camera up, a world point P projects to
 *   ndcY = ((P-C)·u) / (((P-C)·d) · tan(fov/2))
 * The jar used to sit at (0, 0, 3) at scale 0.5, which puts its silhouette dead
 * centre and spanning ndcY -0.74 → -0.22 (26% of frame height, 13% of width at
 * 3:2) — i.e. squarely inside the region a child taps. z = 3.28 is the depth at
 * which a base sitting on the ground plane lands at ndcY = -0.90, so the whole
 * jar drops into the empty foreground strip below the play area:
 *   yc = 0.92848·y - 0.37139·z,  depth = 5.38517 - 0.37139·y - 0.92848·z
 *   base (y=0, z=3.28): yc = -1.21797, depth = 2.34209 → ndcY = -0.9007
 * x = 0.62 shifts it off the centre line without leaving the frame on a tall
 * (portrait) viewport, where the horizontal half-extent is only
 * aspect·tan(30 deg)·depth: at aspect 0.75 that is 0.76 units, so a 0.62 offset
 * plus a 0.20 jar radius still fits.
 */
export const JAR_POS = new Vector3(0.62, 0, 3.28);

/**
 * Uniform scale applied to the jar mesh.
 *
 * At 0.36 the jar's 0.55-unit profile radius becomes 0.198 units, which at the
 * jar's view depth of 2.342 is a half-width of 0.198/2.342 = 0.0845 view units
 * → 0.0988 ndc at 3:2, i.e. 119 px of a 1200 px frame (9.9%). Its top (cork at
 * y = 1.88·0.36 = 0.677) lands at ndcY = -0.488, so jar + cork occupy the
 * bottom 21% of the frame and nothing else. Was 0.5 → 158 x 211 px, centred.
 */
export const JAR_SCALE = 0.36;

/** Unscaled jar body height (from LatheGeometry profile). */
export const JAR_BODY_HEIGHT = 1.78;

/**
 * Containment box for firefly drift, in world units.
 *
 * There is no x entry: the frustum is a cone, so a fixed |x| limit is either
 * off-screen up close or needlessly tight far away. The horizontal limit is
 * computed per-position from the view depth in `helpers.playHalfWidthAt`.
 *
 * The old box was `{xMin: -8, xMax: 8, yMin: 0.35, yMax: 8}` with no z limit at
 * all. Every one of those faces is far outside the frame: at the play depths
 * used here the frame ends at |x| ≈ 2-4 and y ≈ 1.9, so a firefly could drift
 * out of shot and stay "in bounds" indefinitely. That is why a 24-tap grid
 * sweep scored zero — the flock existed, it was just not on screen.
 */
export const BOUNDS = { yMin: 0.45, yMax: 1.9, zMin: -1.2, zMax: 2.9 };

/**
 * Spawn box, inset from {@link BOUNDS} so a fresh firefly is not immediately
 * clamped. Chosen so that every corner projects into the middle of the frame
 * (ndcY from +0.61 at the far-top corner to -0.26 at the near-bottom corner,
 * i.e. 20%-63% down a 3:2 frame) at a sprite size of 49-107 px.
 */
export const SPAWN = { yMin: 0.6, yMax: 1.7, zMin: -0.9, zMax: 2.6 };

/**
 * Foreground Z threshold — fireflies with z >= this are near the camera.
 * Was 2.0, the old spawn box's own zMax, so "foreground" meant "the very edge
 * of where fireflies could be"; it is now the near third of the play box.
 */
export const FOREGROUND_Z = 1.4;

/** Hit detection radius for tap-to-catch (world-space, legacy). */
export const HIT_RADIUS = 1.5;

/** Screen-space hit radius in CSS pixels for tap-to-catch. Generous for young players. */
export const HIT_RADIUS_PX = 80;

/** Seconds before a caught firefly respawns. */
export const RESPAWN_DELAY = 0.5;

/** Score threshold to unlock the golden firefly. */
export const GOLDEN_UNLOCK_SCORE = 10;

/** Seconds between golden firefly spawn attempts. */
export const GOLDEN_SPAWN_INTERVAL = 25;

/**
 * Seconds a golden firefly stays in play before drifting away on its own.
 *
 * Without a lifetime the golden never left play unless it was caught, and the
 * `goldenActive` latch is only cleared when it leaves play — so a golden the
 * child never managed to tap blocked every future golden for the rest of the
 * session.
 */
export const GOLDEN_LIFETIME = 16;

/** Seconds the golden takes to fade out when its lifetime expires. */
export const GOLDEN_FADE_DURATION = 1.2;

/** Duration of the flash phase on catch, in seconds. */
export const FLASH_DURATION = 0.2;

/** Duration of the arc-to-jar animation, in seconds. */
export const ARC_DURATION = 0.6;

/** Milestone threshold for the big celebration. */
export const MILESTONE_COUNT = 25;

/** Billboard size of a standard firefly's additive glow halo. */
export const FIREFLY_SPRITE_SCALE = 0.42;

/** Billboard size of the golden firefly's additive glow halo. */
export const GOLDEN_SPRITE_SCALE = 0.6;

/**
 * Creature billboard size as a fraction of the glow halo. The creature sits
 * inside its own bloom, so it stays legible in a near-black meadow.
 */
export const FIREFLY_BODY_SCALE = 0.62;

/** Wing flaps per second for the two-frame creature animation. */
export const FIREFLY_FLAP_HZ = 9;

/** Base emissive color for standard fireflies (warm amber). */
export const FIREFLY_COLOR = new Color('#FFB347');

/** Emissive color for golden fireflies (bright gold). */
export const GOLDEN_COLOR = new Color('#FFD700');
