import { type PointLight, type Sprite, type SpriteMaterial, Vector3, Color } from 'three';
import type { SimpleParticleSystem } from '@app/utils/particles';

/** Behavior type that determines how a firefly moves. */
export type FireflyBehavior = 'drift' | 'circle' | 'zigzag';

/** Internal state for each active firefly entity. */
export interface FireflyData {
  /** Billboard sprite — the primary visual (a soft glowing dot). */
  sprite: Sprite;
  /** Sprite material for color/opacity animation. */
  spriteMaterial: SpriteMaterial;
  /** Per-firefly point light for glow illumination. */
  light: PointLight;
  /** Continuous glow particle trail attached to this firefly. */
  glowTrail: SimpleParticleSystem;
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

/** Play area bounds for firefly drift clamping. */
export const BOUNDS = { xMin: -8, xMax: 8, yMin: -2, yMax: 8 };

/** Spawn area bounds for new fireflies. */
export const SPAWN = { xMin: -5, xMax: 5, yMin: 0.5, yMax: 5, zMin: -2, zMax: 2 };

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

/** Duration of the flash phase on catch, in seconds. */
export const FLASH_DURATION = 0.2;

/** Duration of the arc-to-jar animation, in seconds. */
export const ARC_DURATION = 0.6;

/** Milestone threshold for the big celebration. */
export const MILESTONE_COUNT = 25;

/** Base emissive color for standard fireflies (warm amber). */
export const FIREFLY_COLOR = new Color('#FFB347');

/** Emissive color for golden fireflies (bright gold). */
export const GOLDEN_COLOR = new Color('#FFD700');
