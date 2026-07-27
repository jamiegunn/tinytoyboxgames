import { Vector3 } from 'three';
import { randomRange, clamp } from '@app/minigames/shared/mathUtils';
import type { DifficultyTier, FireflyBehavior, FireflyData } from './types';
import { SPAWN, BOUNDS, FOREGROUND_Z } from './types';

export { randomRange };

// ---------------------------------------------------------------------------
// Camera-derived play area
// ---------------------------------------------------------------------------
// The shell hands every mini-game the same fixed camera unless the manifest
// overrides it, and the fireflies entry does not: DEFAULT_GAME_CAMERA is
// position (0,2,5), target (0,0,0), 60 deg vertical fov. So the projection can
// be solved in closed form here instead of guessing at world-space limits.
//
//   forward d = normalize((0,0,0) - (0,2,5)) = (0, -0.3713907, -0.9284767)
//   up      u = (0, 0.9284767, -0.3713907)
// and for a world point P, with C the camera position:
//   depth = (P-C)·d = 5.3851648 - 0.3713907*y - 0.9284767*z
//   yc    = (P-C)·u = 0.9284767*y - 0.3713907*z
//   ndcY  = yc / (depth * tan(fov/2))
//   ndcX  = x  / (depth * tan(fov/2) * aspect)
// The depth constant is -(C·d) = 2*0.3713907 + 5*0.9284767 = 5.3851648.
const CAM_FWD_Y = -0.3713907;
const CAM_FWD_Z = -0.9284767;
const CAM_DEPTH_BIAS = 5.3851648;
const TAN_HALF_FOV_Y = 0.5773503;

// Fraction of the half-frame width fireflies are allowed to reach. 0.72 keeps
// the whole 80 px tap disc (2*80/1200 = 0.133 ndc, i.e. 0.067 half) plus the
// sprite's own ~50-110 px halo inside the frame even at the very edge of the
// range, so nothing is ever half-clipped by the viewport border.
const X_NDC_LIMIT = 0.72;

// Updated from the shell's viewport in setup()/onResize(). Seeded with 3:2,
// the aspect the game was measured at, so the module is usable before setup.
let viewAspect = 1200 / 810;

/**
 * Records the current viewport aspect so the horizontal play limits track the
 * actual frame. Call from `setup()` and `onResize()`.
 *
 * @param aspect - Viewport width / height.
 */
export function setViewAspect(aspect: number): void {
  if (Number.isFinite(aspect) && aspect > 0) viewAspect = aspect;
}

/**
 * Distance from the camera plane to a world point, along the view direction.
 *
 * @param y - World Y.
 * @param z - World Z.
 * @returns View-space depth in world units (larger = further away).
 */
export function viewDepth(y: number, z: number): number {
  return CAM_DEPTH_BIAS + CAM_FWD_Y * y + CAM_FWD_Z * z;
}

/**
 * Largest |x| that still renders comfortably inside the frame at a given view
 * depth. The frustum is a cone, so a single fixed |x| limit is wrong at every
 * depth but one — hence the per-position computation.
 *
 * @param depth - View-space depth from {@link viewDepth}.
 * @returns Half-width of the usable play area, in world units.
 */
export function playHalfWidthAt(depth: number): number {
  // Guard the degenerate near-camera case; 0.4 is well inside the 0.1 near
  // plane and BOUNDS.zMax never gets closer than depth 2.6 anyway.
  return X_NDC_LIMIT * viewAspect * TAN_HALF_FOV_Y * Math.max(0.4, depth);
}

/** Firefly count at difficulty level 0 (a calm, uncrowded meadow). */
// Raised 6 -> 8. The play box is now camera-tight, so all of them are on
// screen; the previous 6 were spread over a box ~4x the frame's volume and
// typically only 2-5 were ever visible at once.
const FIREFLY_COUNT_MIN = 8;

/** Firefly count at difficulty level 1 (a meadow that feels genuinely busy). */
const FIREFLY_COUNT_MAX = 18;

/** Speed multiplier at difficulty level 0 — slower than before, so tier 0 is gentler. */
const SPEED_MULT_MIN = 0.85;

/** Speed multiplier at difficulty level 1 — fireflies really dart about. */
const SPEED_MULT_MAX = 2.4;

/**
 * Returns the difficulty tier for a normalized difficulty level.
 *
 * This used to switch on the raw score with hard-coded breakpoints up to 50,
 * which yielded 7→14 fireflies and x1.0→x1.2 speed across the entire session —
 * a ramp a competent child cannot feel. It now reads the shell's normalized
 * level, which the manifest ramps 0→1 over 5→45 points, and widens the spread
 * on both axes so the meadow visibly fills up and speeds up.
 *
 * @param level - Normalized difficulty from the shell, 0 (easiest) to 1.
 * @returns The difficulty tier with maxFireflies and speedMultiplier.
 */
export function getDifficultyTier(level: number): DifficultyTier {
  const t = Math.min(1, Math.max(0, level));
  // Ease the count in slightly faster than the speed: more targets first (which
  // helps a young player), then the challenge of chasing them.
  const countT = Math.sqrt(t);
  return {
    maxFireflies: Math.round(FIREFLY_COUNT_MIN + (FIREFLY_COUNT_MAX - FIREFLY_COUNT_MIN) * countT),
    speedMultiplier: SPEED_MULT_MIN + (SPEED_MULT_MAX - SPEED_MULT_MIN) * t,
  };
}

/**
 * Creates a random spawn position within the play area.
 *
 * X is drawn from the depth-dependent half-width rather than a fixed range:
 * the old `SPAWN.xMin/xMax = +/-5` was up to 2.3x the frame half-width at the
 * near end of the box, so a large share of every spawn landed off screen.
 *
 * @returns A Vector3 inside the visible play volume.
 */
export function randomSpawnPos(): Vector3 {
  const y = randomRange(SPAWN.yMin, SPAWN.yMax);
  const z = randomRange(SPAWN.zMin, SPAWN.zMax);
  const halfWidth = playHalfWidthAt(viewDepth(y, z));
  return new Vector3(randomRange(-halfWidth, halfWidth), y, z);
}

/**
 * Creates a spawn position guaranteed to be in the foreground (close to camera)
 * and low enough to read as within a child's reach.
 *
 * The Y ceiling is `SPAWN.yMin + 0.75` (0.6 -> 1.35), which at the foreground
 * depths (z 1.4 -> 2.6, depth 3.6 -> 2.5) projects to ndcY -0.10 .. +0.36, i.e.
 * the middle third of the frame. The 0.8 factor on the half-width keeps these
 * "guaranteed reachable" fireflies away from the frame edge entirely.
 *
 * @returns A Vector3 in the foreground area.
 */
export function foregroundSpawnPos(): Vector3 {
  const y = randomRange(SPAWN.yMin, SPAWN.yMin + 0.75);
  const z = randomRange(FOREGROUND_Z, SPAWN.zMax);
  const halfWidth = playHalfWidthAt(viewDepth(y, z)) * 0.8;
  return new Vector3(randomRange(-halfWidth, halfWidth), y, z);
}

/** Scratch vector for the pre-clamp position in {@link containInPlayArea}. */
const _preClamp = new Vector3();

/**
 * Keeps a firefly inside the visible play volume, steering it back in rather
 * than teleporting it.
 *
 * This replaces the old "if it left the +/-8 box, respawn it somewhere random"
 * rule, which had two problems: the box was far wider than the frame (so a
 * firefly could leave the shot and legally stay gone), and a teleport makes a
 * firefly a child was tracking vanish mid-tap.
 *
 * Clamping alone is not enough for the two stateful behaviours:
 * - `drift` integrates sin/cos of `driftOffset*`; adding PI flips the sign of
 *   that axis' velocity, so it walks away from the wall instead of grinding
 *   along it.
 * - `circle` writes position absolutely from `behaviorCenter`, so a clamp would
 *   be undone on the very next frame. Translating the centre by the same delta
 *   makes the clamp stick for the rest of the revolution.
 *
 * @param fd - The firefly to contain.
 */
export function containInPlayArea(fd: FireflyData): void {
  const p = fd.sprite.position;
  _preClamp.copy(p);

  if (p.y < BOUNDS.yMin) {
    p.y = BOUNDS.yMin;
    fd.zigzagDir.y = Math.abs(fd.zigzagDir.y);
    fd.driftOffsetY += Math.PI;
  } else if (p.y > BOUNDS.yMax) {
    p.y = BOUNDS.yMax;
    fd.zigzagDir.y = -Math.abs(fd.zigzagDir.y);
    fd.driftOffsetY += Math.PI;
  }

  if (p.z < BOUNDS.zMin) {
    p.z = BOUNDS.zMin;
    fd.zigzagDir.z = Math.abs(fd.zigzagDir.z);
    fd.driftOffsetZ += Math.PI;
  } else if (p.z > BOUNDS.zMax) {
    p.z = BOUNDS.zMax;
    fd.zigzagDir.z = -Math.abs(fd.zigzagDir.z);
    fd.driftOffsetZ += Math.PI;
  }

  const halfWidth = playHalfWidthAt(viewDepth(p.y, p.z));
  if (p.x < -halfWidth) {
    p.x = -halfWidth;
    fd.zigzagDir.x = Math.abs(fd.zigzagDir.x);
    fd.driftOffsetX += Math.PI;
  } else if (p.x > halfWidth) {
    p.x = halfWidth;
    fd.zigzagDir.x = -Math.abs(fd.zigzagDir.x);
    fd.driftOffsetX += Math.PI;
  }

  const dx = p.x - _preClamp.x;
  const dy = p.y - _preClamp.y;
  const dz = p.z - _preClamp.z;
  if (dx !== 0 || dy !== 0 || dz !== 0) {
    fd.behaviorCenter.x += dx;
    fd.behaviorCenter.y = clamp(fd.behaviorCenter.y + dy, SPAWN.yMin, SPAWN.yMax);
    fd.behaviorCenter.z = clamp(fd.behaviorCenter.z + dz, SPAWN.zMin, SPAWN.zMax);
  }
}

/**
 * Picks a random behavior type with weighted distribution:
 * drift 50%, circle 30%, zigzag 20%.
 * @returns A randomly selected FireflyBehavior.
 */
export function randomBehavior(): FireflyBehavior {
  const r = Math.random();
  if (r < 0.5) return 'drift';
  if (r < 0.8) return 'circle';
  return 'zigzag';
}

/** Scratch vector to avoid per-frame allocations. */
const _tmpDir = new Vector3();

// The drift and zigzag terms below used to be raw per-frame offsets (0.008,
// 0.006, 0.004, 0.012, 0.002) with no `deltaTime` factor, so fireflies moved
// ~2x faster on a 120 Hz tablet than on a 60 Hz phone and crawled whenever the
// frame rate dipped. These are the same magnitudes re-expressed as units per
// second (the old per-frame value x 60) and multiplied by dt at the call site.
const DRIFT_RATE_X = 0.48;
const DRIFT_RATE_Y = 0.36;
const DRIFT_RATE_Z = 0.24;
const ZIGZAG_RATE = 0.72;
const ZIGZAG_WOBBLE_RATE = 0.12;

/**
 * Picks a random normalized direction for zigzag movement.
 * @returns A normalized Vector3 pointing in a random direction.
 */
function randomZigzagDir(): Vector3 {
  return new Vector3(randomRange(-1, 1), randomRange(-0.5, 0.5), randomRange(-0.5, 0.5)).normalize();
}

/**
 * Updates a firefly's position based on its behavior type.
 * @param fd - The firefly data to update.
 * @param deltaTime - Frame delta in seconds.
 * @param speedMult - Difficulty speed multiplier.
 */
export function updateFireflyBehavior(fd: FireflyData, deltaTime: number, speedMult: number): void {
  fd.time += deltaTime * fd.speed * speedMult;
  const t = fd.time;

  switch (fd.behavior) {
    case 'drift': {
      const step = deltaTime * fd.speed * speedMult;
      fd.sprite.position.x += Math.sin(t * 0.7 + fd.driftOffsetX) * DRIFT_RATE_X * step;
      fd.sprite.position.y += Math.cos(t * 0.5 + fd.driftOffsetY) * DRIFT_RATE_Y * step;
      fd.sprite.position.z += Math.sin(t * 0.3 + fd.driftOffsetZ) * DRIFT_RATE_Z * step;
      break;
    }

    case 'circle': {
      // Orbit around behaviorCenter at behaviorRadius with a gentle vertical bob
      const angularSpeed = 0.4 * fd.speed * speedMult;
      fd.behaviorAngle += angularSpeed * deltaTime;

      const cx = fd.behaviorCenter.x + Math.cos(fd.behaviorAngle) * fd.behaviorRadius;
      const cz = fd.behaviorCenter.z + Math.sin(fd.behaviorAngle) * fd.behaviorRadius;
      const cy = fd.behaviorCenter.y + Math.sin(t * 0.6) * 0.3;

      fd.sprite.position.x = cx;
      fd.sprite.position.y = cy;
      fd.sprite.position.z = cz;
      break;
    }

    case 'zigzag': {
      // Move in current direction, smoothly lerp toward a new direction periodically
      fd.zigzagTimer -= deltaTime;
      if (fd.zigzagTimer <= 0) {
        // Pick a new target direction
        _tmpDir.copy(randomZigzagDir());
        fd.zigzagDir.copy(_tmpDir);
        fd.zigzagTimer = randomRange(1.0, 2.0);
      }

      // Smooth movement — lerp current position toward zigzag direction
      const step = deltaTime * fd.speed * speedMult;
      const moveSpeed = ZIGZAG_RATE * step;
      fd.sprite.position.x += fd.zigzagDir.x * moveSpeed;
      fd.sprite.position.y += fd.zigzagDir.y * moveSpeed;
      fd.sprite.position.z += fd.zigzagDir.z * moveSpeed;

      // Add a gentle wobble so it doesn't look perfectly straight
      fd.sprite.position.y += Math.sin(t * 1.2) * ZIGZAG_WOBBLE_RATE * step;
      break;
    }
  }
}
