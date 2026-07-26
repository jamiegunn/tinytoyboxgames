import { Vector3 } from 'three';
import { randomRange } from '@app/minigames/shared/mathUtils';
import type { DifficultyTier, FireflyBehavior, FireflyData } from './types';
import { SPAWN, FOREGROUND_Z } from './types';

export { randomRange };

/** Firefly count at difficulty level 0 (a calm, uncrowded meadow). */
const FIREFLY_COUNT_MIN = 6;

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
 * @returns A Vector3 within spawn bounds.
 */
export function randomSpawnPos(): Vector3 {
  return new Vector3(randomRange(SPAWN.xMin, SPAWN.xMax), randomRange(SPAWN.yMin, SPAWN.yMax), randomRange(SPAWN.zMin, SPAWN.zMax));
}

/**
 * Creates a spawn position guaranteed to be in the foreground (close to camera).
 * Uses lower Y range so they're easy to tap for young children.
 * @returns A Vector3 in the foreground area.
 */
export function foregroundSpawnPos(): Vector3 {
  return new Vector3(randomRange(-3, 3), randomRange(0.5, 2.5), randomRange(FOREGROUND_Z, SPAWN.zMax + 1));
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
