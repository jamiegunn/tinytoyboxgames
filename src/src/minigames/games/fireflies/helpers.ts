import { Vector3 } from 'three';
import { randomRange } from '@app/minigames/shared/mathUtils';
import type { DifficultyTier, FireflyBehavior, FireflyData } from './types';
import { SPAWN, FOREGROUND_Z } from './types';

export { randomRange };

/**
 * Returns the difficulty tier for a given score.
 * @param score - The current player score.
 * @returns The difficulty tier with maxFireflies and speedMultiplier.
 */
export function getDifficultyTier(score: number): DifficultyTier {
  if (score > 50) return { maxFireflies: 14, speedMultiplier: 1.2 };
  if (score > 35) return { maxFireflies: 12, speedMultiplier: 1.15 };
  if (score > 20) return { maxFireflies: 10, speedMultiplier: 1.1 };
  if (score > 10) return { maxFireflies: 8, speedMultiplier: 1.05 };
  return { maxFireflies: 7, speedMultiplier: 1.0 };
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
      fd.sprite.position.x += Math.sin(t * 0.7 + fd.driftOffsetX) * 0.008 * fd.speed * speedMult;
      fd.sprite.position.y += Math.cos(t * 0.5 + fd.driftOffsetY) * 0.006 * fd.speed * speedMult;
      fd.sprite.position.z += Math.sin(t * 0.3 + fd.driftOffsetZ) * 0.004 * fd.speed * speedMult;
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
      const moveSpeed = 0.012 * fd.speed * speedMult;
      fd.sprite.position.x += fd.zigzagDir.x * moveSpeed;
      fd.sprite.position.y += fd.zigzagDir.y * moveSpeed;
      fd.sprite.position.z += fd.zigzagDir.z * moveSpeed;

      // Add a gentle wobble so it doesn't look perfectly straight
      fd.sprite.position.y += Math.sin(t * 1.2) * 0.002 * fd.speed * speedMult;
      break;
    }
  }
}
