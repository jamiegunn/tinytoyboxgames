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

/** Jar position constant used for catch arc targets. */
export const JAR_POS = new Vector3(0, 0, 3);

/** Uniform scale applied to the jar mesh. */
export const JAR_SCALE = 0.5;

/** Unscaled jar body height (from LatheGeometry profile). */
export const JAR_BODY_HEIGHT = 1.78;

/**
 * Play area bounds for firefly drift clamping.
 *
 * `yMin` used to be -2, i.e. two units *below* the ground plane at y=0, so a
 * drifting firefly would sink into the meadow and hover underground until it
 * finally tripped the out-of-bounds teleport. The floor now sits just above
 * the grass.
 */
export const BOUNDS = { xMin: -8, xMax: 8, yMin: 0.35, yMax: 8 };

/** Spawn area bounds for new fireflies — never below {@link BOUNDS}.yMin. */
export const SPAWN = { xMin: -5, xMax: 5, yMin: 0.6, yMax: 5, zMin: -2, zMax: 2 };

/** Foreground Z threshold — fireflies with z >= this are considered near the jar/camera. */
export const FOREGROUND_Z = 2.0;

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
