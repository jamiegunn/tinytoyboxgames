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
  /**
   * Seagulls crossing the sky.
   *
   * The sky used to hold nothing but clouds drifting at 0.05 units/second, which
   * at 18 px per world unit out at z = -42 is 0.9 px/s — 0.015 px per frame. That
   * is the measured 0.07 and 0.01 mean-|Δ|-luminance of the top two bands: the
   * upper third of the frame was, arithmetically, a still image. Birds fly at
   * 1.8-2.6 units/second nearer the camera (26-29 px/unit) and flap, which is
   * about 1 px of change per frame.
   */
  birds: Group[];
  islands: Group[];
  /** Hull, deck, bulwark and bow furniture — the ship the child is standing on. */
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
  CHAIN_RADIUS: 3.0,
  CHAIN_STAGGER: 0.15,
  /**
   * Depth band targets live in, far edge first.
   *
   * The old band was z ∈ [-18, -3] paired with a *rectangular* x range of
   * ±8, which is not the shape of what the camera can see. The visible
   * half-width at the water plane grows linearly with depth — about ±5.4 units
   * at z = -4.5 and ±11.9 at z = -12 on a 3:2 canvas — so a fixed ±8 box is
   * simultaneously off-screen near the camera and far short of the frame edges
   * out at the horizon. Horizontal extent is now derived per-z from the live
   * camera (see playHalfWidthAt) and only the depth band is a constant.
   *
   * The far edge moved from -18 to -12 because depth is brutally foreshortened
   * at this camera pitch: z = -12 → z = -18 is 25 screen pixels of water, and a
   * target out there is under 20 px tall. The near edge moved from -3 to -4.5 to
   * clear the ship's bow, whose bulwark cap projects to y ≈ 617 px against the
   * near play edge at y ≈ 602 px.
   */
  PLAY_Z_MIN: -12,
  PLAY_Z_MAX: -4.5,
  /**
   * World units held back from the visible frame edge so a target sitting at the
   * play boundary is still drawn whole. A barrel's widest part is 0.57 units at
   * TARGET_SCALE 1.35 = 0.77; 0.85 leaves a little slack for the roll animation.
   */
  PLAY_EDGE_MARGIN: 0.85,
  /** Floor on the derived half-width, so a very narrow canvas still has a play area. */
  PLAY_HALF_WIDTH_MIN: 1.5,
  /** Minimum horizontal gap between two freshly spawned targets, in world units. */
  SPAWN_MIN_SEPARATION: 2.0,
  /**
   * Tap-to-target snap radius, as a fraction of the canvas's shorter side.
   *
   * This replaced a 1.0 *world unit* grace radius, which is a wildly different
   * number of pixels depending on where you tap: at z = -4.5 one world unit is
   * 95 px across but only 41 px up the screen, and at z = -12 it is 50 px across
   * and 15 px up. A screen-space radius is the same forgiveness everywhere.
   * 0.06 of a 810 px-tall canvas is 49 px, about 8 mm on a 10" tablet — half a
   * toddler fingertip.
   */
  TAP_SNAP_SCREEN_FRACTION: 0.06,
  /** Seconds a target stays in play before it shrinks away and is recycled. */
  TARGET_LIFETIME: 16,
  /** Seconds of pulsing warning before a target expires. */
  TARGET_WARN_TIME: 3,
  SPAWN_ANIM_DURATION: 0.4,
  HIT_ANIM_DURATION: 0.3,
  ROLL_AMPLITUDE: 0.04,
  DRIFT_SPEED_MIN: 0.3,
  DRIFT_SPEED_MAX: 0.75,
  SPAWN_INTERVAL_MIN: 0.85,
  /**
   * Seconds between spawn attempts at difficulty 0 (2.5 → 1.5).
   *
   * The difficulty ramp in the manifest starts at 60 seconds, so every one of a
   * child's first few shots happens at difficulty 0 — which is exactly where the
   * game was emptiest. At 2.5s the pond took 7.5 seconds to fill from the two
   * targets `start()` puts down. 1.5s fills it in 1.5. With TARGET_LIFETIME 16,
   * the steady-state population is min(capacity, 16 / 1.5) = min(5, 10.7), so the
   * capacity is what binds and the water stays full rather than pulsing.
   */
  SPAWN_INTERVAL_MAX: 1.5,
  /**
   * Simultaneous standard targets at difficulty 0 (3 → 5) and at difficulty 1.
   *
   * The playable trapezoid is z ∈ [-4.5, -12] with half-widths 5.45 and 11.01
   * units, i.e. (10.90 + 22.02) / 2 × 7.5 = 123.5 square units of water. A barrel
   * at TARGET_SCALE 1.35 covers about 1.55 × 1.55 = 2.4 of them, so three targets
   * occupied 5.8% of the pond — on screen, three ~100 × 75 px shapes in a
   * 1076 × 195 px band. Five is 9.7%, still far below the point where
   * SPAWN_MIN_SEPARATION 2.0 starts rejecting samples, and it roughly doubles the
   * chance that a toddler's untargeted tap lands on something.
   */
  MAX_TARGETS_MIN: 5,
  MAX_TARGETS_MAX: 8,
  /**
   * One target size at every difficulty. Targets used to shrink 1.35 → 1.10 as
   * difficulty rose, which asks a three-year-old for finer aim exactly as the
   * game speeds up; escalation now lives entirely in drift speed and spawn rate.
   */
  TARGET_SCALE: 1.35,
  /**
   * How high each kind rides above the water, in world units, applied to the
   * target's root before TARGET_SCALE.
   *
   * These used to be written into the builders as `root.position.y = ...`, which
   * spawnTarget then overwrote with the spawn position's y of -0.3 — so every
   * kind sat at the same depth and the builder values were dead. At -0.3 a
   * barrel's scaled extents are y ∈ [-0.91, +0.36]: 1.27 units tall with 0.36 of
   * it out of the water, i.e. 72% submerged, about 15 px of visible target at
   * z = -12. +0.08 puts the waterline at 42% of the barrel's height.
   */
  FLOAT_Y_BARREL: 0.08,
  FLOAT_Y_BOTTLE: 0.05,
  FLOAT_Y_DUCK: 0.14,
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
  // Raised from y = 3.0 / look-at y = 1.1, which put the eye only 8.4° above
  // horizontal. At that pitch the water is crushed into a strip: the whole play
  // band occupied 217 of 810 screen rows, one world unit of depth at z = -8 was
  // 16 px against 70 px across (a 4.4:1 squash), and the sky took the top 36% of
  // the frame with nothing in it but slow clouds — which is exactly the dead top
  // third and the 4.4:1 anisotropic tap tolerance the measurements show.
  //
  // At y = 4.2 / look-at y = 0.6 the pitch is 15.7°. The horizon drops from
  // screen row 290 to 186 (sky 23% of the frame), the play band covers 195 rows
  // over a 7.5-unit depth range instead of 217 over 15, depth resolution at
  // z = -8 rises to 24.8 px per unit (2.7:1 squash), and the ship's bow deck
  // comes into view instead of being seen edge-on.
  CAMERA_POS_Y: 4.2,
  CAMERA_POS_Z: 2.8,
  CAMERA_LOOK_X: 0,
  CAMERA_LOOK_Y: 0.6,
  CAMERA_LOOK_Z: -10,

  // Cannon position. Pulled forward onto the bow so the carriage stands on the
  // stretch of deck the child can actually see (z = -3.2 to about -1.7) and the
  // muzzle clears the bow rail: at z = -2.0 the mouth projects to screen row 575
  // against a rail cap at row 617, so the barrel reads as poking out over the
  // sea rather than being buried behind the bulwark. y puts the carriage wheels
  // on the deck (deck top is y = 0.30).
  CANNON_X: 0,
  CANNON_Y: 0.9,
  CANNON_Z: -2.0,

  // Cannon aim constraints. Yaw is generous (81°) because the near edge of the
  // play area reaches x = ±5.4 at z = -4.5, which from the cannon at z = -2.0 is
  // atan(5.4 / 2.5) = 65° of swing; the old 60° clamp pinned the barrel sideways
  // for a large slice of legal taps.
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
