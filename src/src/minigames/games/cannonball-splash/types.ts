/**
 * Local type surface for the Cannonball Splash minigame.
 *
 * All game-specific contracts shared across modules live here.
 */

import type { Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';

// ── Target types ────────────────────────────────────────────────────────────

export type TargetKind = 'barrel' | 'bottle' | 'duck' | 'golden-barrel' | 'rainbow-bottle';

export type TargetState = 'spawning' | 'active' | 'hit' | 'drifted-off';

export interface Target {
  root: Group;
  kind: TargetKind;
  state: TargetState;
  stateTimer: number;
  bobPhase: number;
  bobSpeed: number;
  driftVx: number;
  driftVz: number;
  baseY: number;
  scoreValue: number;
  /**
   * Materials owned by this instance (never shared with another target), so the
   * edge warning can tint one target without repainting the whole scene and so
   * recycling can dispose them safely.
   */
  materials: MeshStandardMaterial[];
  /**
   * False until the target has drifted in past the edge-warning threshold.
   * Targets spawn outside it, so without this every new target would flash the
   * "I'm leaving" warning for its first few seconds of life.
   */
  hasEnteredPlay: boolean;
}

// ── Cannonball ──────────────────────────────────────────────────────────────

export interface Cannonball {
  mesh: Mesh;
  shadow: Mesh;
  /** Launch position (barrel mouth) at the moment of firing. */
  startPos: Vector3;
  /** Launch velocity in world units per second; gravity does the rest. */
  velocity: Vector3;
  /** Time at which the ball is expected to reach the water. */
  flightDuration: number;
  elapsed: number;
  trailTimer: number;
}

// ── Cannon ──────────────────────────────────────────────────────────────────

export interface CannonRig {
  root: Group;
  barrelGroup: Group;
  recoilTimer: number;
  idlePhase: number;
  aimYaw: number;
  aimPitch: number;
}

// ── Particles / Effects ─────────────────────────────────────────────────────

export interface SplashParticle {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  lifetime: number;
  elapsed: number;
}

export interface Fragment {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  rotSpeedX: number;
  rotSpeedY: number;
  rotSpeedZ: number;
  lifetime: number;
  elapsed: number;
}

export interface BonusCoin {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  elapsed: number;
}

// ── Game state ──────────────────────────────────────────────────────────────

export interface GameState {
  targets: Target[];
  cannonballs: Cannonball[];
  splashParticles: SplashParticle[];
  fragments: Fragment[];
  coins: BonusCoin[];
  cannon: CannonRig | null;
  elapsedTime: number;
  milestoneScores: Set<number>;
  pendingChainHits: Array<{ target: Target; delay: number }>;
  cameraShakeTimer: number;
  /** Unit-ish direction the current shake oscillates along, re-rolled per shot. */
  cameraShakeDir: { x: number; y: number };
}

// ── Environment ─────────────────────────────────────────────────────────────

export interface EnvironmentRig {
  ocean: Mesh;
  skyBase: Mesh;
  sun: Group;
  clouds: Group[];
  foamStrips: Mesh[];
  waveBands: Mesh[];
  islands: Group[];
  /** Hull, deck, bulwarks and bowsprit — the ship the child is standing on. */
  ship: Group;
  cannon: CannonRig;
  dispose: () => void;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const C = {
  // Flight times. Longer than the old 0.6–1.0s because the ball now falls under
  // real gravity: a short flight is a flat, fast line, and the lob is what makes
  // the shot read as a cannonball. Immediate feedback still comes from the
  // muzzle flash, boom, recoil and shake at t = 0.
  FLIGHT_DURATION_NEAR: 0.8,
  FLIGHT_DURATION_FAR: 1.4,
  /**
   * Horizontal distance from the ball's splashdown point within which a target
   * counts as hit. 1.6 units ≈ two barrel widths: a target is ~0.8 wide, and it
   * drifts up to ~1.0 units sideways during the longest (1.4s) flight, so a
   * well-aimed shot always connects while a tap that lands more than two barrel
   * widths off genuinely splashes in the water. Three-year-olds get the benefit
   * of every doubt.
   */
  HIT_RADIUS: 1.6,
  GRACE_RADIUS: 1.0,
  CHAIN_RADIUS: 3.0,
  CHAIN_STAGGER: 0.15,
  PLAY_X_MIN: -8,
  PLAY_X_MAX: 8,
  PLAY_Z_MIN: -18,
  PLAY_Z_MAX: -3,
  SPAWN_X_EDGE: 9,
  SPAWN_Z_NEAR: -4,
  SPAWN_Z_FAR: -16,
  /** |x| beyond which a target is warned as about to drift out of play. */
  EDGE_WARN_X: 7,
  SPAWN_ANIM_DURATION: 0.4,
  HIT_ANIM_DURATION: 0.3,
  BOB_AMPLITUDE: 0.06,
  ROLL_AMPLITUDE: 0.04,
  DRIFT_SPEED_MIN: 0.3,
  DRIFT_SPEED_MAX: 0.75,
  SPAWN_INTERVAL_MIN: 0.85,
  SPAWN_INTERVAL_MAX: 2.5,
  MAX_TARGETS_MIN: 3,
  MAX_TARGETS_MAX: 8,
  /**
   * One target size at every difficulty. Targets used to shrink 1.35 → 1.10 as
   * difficulty rose, which asks a three-year-old for finer aim exactly as the
   * game speeds up; escalation now lives entirely in drift speed and spawn rate.
   */
  TARGET_SCALE: 1.35,
  CAMERA_SHAKE_MAGNITUDE: 0.05,
  /** Shake oscillation rate in radians/sec (~9 Hz — a jolt, not a slide). */
  CAMERA_SHAKE_FREQUENCY: 58,
  CAMERA_SHAKE_DURATION: 0.28,
  MUZZLE_FLASH_COUNT: 10,
  EXPLOSION_FRAGMENT_COUNT: 10,
  SPLASH_PARTICLE_COUNT: 7,
  GOLDEN_SPARKLE_COUNT: 18,
  BONUS_COIN_COUNT: 5,
  TRAIL_SPAWN_INTERVAL: 0.03,
  OCEAN_SPARKLE_INTERVAL: 0.4,
  SCORE_MILESTONE_INTERVAL: 100,
  RECOIL_DURATION: 0.47,

  // Camera
  CAMERA_FOV: 55,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 80,
  CAMERA_POS_X: 0,
  CAMERA_POS_Y: 3.0,
  CAMERA_POS_Z: 2.8,
  CAMERA_LOOK_X: 0,
  CAMERA_LOOK_Y: 1.1,
  CAMERA_LOOK_Z: -10,

  // Cannon position. Pulled forward from z = 0 onto the bow: with the camera at
  // z = 2.8 and a 55° vertical FOV, the water plane only enters frame at about
  // z = -1.3, so a cannon at the origin sat almost entirely below the bottom of
  // the screen — the child could not see the barrel swing or the recoil. y puts
  // the carriage wheels on the deck (deck top is y = 0.30).
  CANNON_X: 0,
  CANNON_Y: 0.9,
  CANNON_Z: -1.4,

  // Cannon aim constraints. Yaw is generous (81°) because the play area reaches
  // x = ±8 as close as z = -4, which needs ~65° of swing; the old 60° clamp
  // pinned the barrel sideways for a large slice of legal taps.
  AIM_MAX_YAW: Math.PI * 0.45,
  // Pitch is positive-up in the barrel's YXZ frame: always at least a little
  // above horizontal, never past ~54°.
  AIM_MIN_PITCH: 0.04,
  AIM_MAX_PITCH: 0.95,

  // Score values
  SCORE_BARREL: 10,
  SCORE_BOTTLE: 15,
  SCORE_DUCK: 20,
  SCORE_GOLDEN: 50,
  SCORE_RAINBOW: 35,
  SCORE_COIN: 5,

  // Gravity
  GRAVITY: -9.8,
} as const;
