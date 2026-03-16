/**
 * Local type surface for the Cannonball Splash minigame.
 *
 * All game-specific contracts shared across modules live here.
 */

import type { Group, Mesh, Vector3 } from 'three';

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
}

// ── Cannonball ──────────────────────────────────────────────────────────────

export interface Cannonball {
  mesh: Mesh;
  shadow: Mesh;
  startPos: Vector3;
  endPos: Vector3;
  flightDuration: number;
  elapsed: number;
  arcHeight: number;
  target: Target | null;
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
  lastFireTime: number;
  elapsedTime: number;
  milestoneScores: Set<number>;
  pendingChainHits: Array<{ target: Target; delay: number }>;
  oceanMesh: Mesh | null;
  cameraShakeTimer: number;
  cameraShakeOffset: { x: number; y: number };
}

// ── Environment ─────────────────────────────────────────────────────────────

export interface EnvironmentRig {
  ocean: Mesh;
  skyBase: Mesh;
  skyHorizon: Mesh;
  clouds: Mesh[];
  foamStrips: Mesh[];
  islands: Group[];
  deckFloor: Mesh;
  railing: Group;
  cannon: CannonRig;
  dispose: () => void;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const C = {
  FIRE_COOLDOWN: 0.5,
  FLIGHT_DURATION_NEAR: 0.6,
  FLIGHT_DURATION_FAR: 1.0,
  ARC_HEIGHT_NEAR: 1.5,
  ARC_HEIGHT_FAR: 4.0,
  GRACE_RADIUS: 1.0,
  CHAIN_RADIUS: 3.0,
  CHAIN_STAGGER: 0.15,
  COMBO_WINDOW: 3.0,
  PLAY_X_MIN: -8,
  PLAY_X_MAX: 8,
  PLAY_Z_MIN: -18,
  PLAY_Z_MAX: -3,
  OCEAN_Y: 0,
  SPAWN_X_EDGE: 9,
  SPAWN_Z_NEAR: -4,
  SPAWN_Z_FAR: -16,
  SPAWN_ANIM_DURATION: 0.4,
  HIT_ANIM_DURATION: 0.3,
  BOB_AMPLITUDE: 0.06,
  ROLL_AMPLITUDE: 0.04,
  DRIFT_SPEED_MIN: 0.3,
  DRIFT_SPEED_MAX: 0.7,
  SPAWN_INTERVAL_MIN: 1.0,
  SPAWN_INTERVAL_MAX: 2.5,
  MAX_TARGETS_MIN: 3,
  MAX_TARGETS_MAX: 8,
  TARGET_SCALE_MIN: 0.85,
  TARGET_SCALE_MAX: 1.0,
  RAMP_START: 50,
  RAMP_END: 500,
  GOLDEN_UNLOCK: 150,
  RAINBOW_UNLOCK: 275,
  CAMERA_SHAKE_MAGNITUDE: 0.06,
  CAMERA_SHAKE_FRAMES: 6,
  CAMERA_SHAKE_DURATION: 0.2,
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
  CAMERA_POS_Y: 4,
  CAMERA_POS_Z: 3,
  CAMERA_LOOK_X: 0,
  CAMERA_LOOK_Y: 0.5,
  CAMERA_LOOK_Z: -8,

  // Cannon position
  CANNON_X: 0,
  CANNON_Y: 0.6,
  CANNON_Z: 0,

  // Cannon aim constraints
  AIM_MAX_YAW: Math.PI / 3,
  AIM_MIN_PITCH: -0.1,
  AIM_MAX_PITCH: -0.7,

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
