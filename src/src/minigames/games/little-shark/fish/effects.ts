import type { FishState } from '../types';
import {
  BOUNDS,
  FISH_DESPAWN_SCALE_DURATION,
  GOLDEN_SCALE,
  EAT_ANIM_DURATION,
  SHARK_BODY_SCALE_X,
  GOLDEN_DODGE_DISTANCE,
  GOLDEN_DODGE_COOLDOWN,
  GOLDEN_MAX_DODGES,
  GOLDEN_TIRED_SPEED_MULTIPLIER,
} from '../types';
import { clamp } from '../helpers';

/**
 * Per-frame animation for fish entities — drift movement, dodge behavior,
 * and despawn scaling. Concerned only with how fish LOOK and MOVE, not
 * what they ARE (lifecycle.ts) or how game rules decide what happens (orchestrator).
 */

/**
 * Updates a fish's drift movement using sine/cosine phase oscillation.
 * Includes gentle startle when shark is nearby.
 * @param fish - The fish to animate.
 * @param dt - Frame delta time (already time-scaled).
 * @param speedMultiplier - Difficulty-driven speed multiplier.
 * @param sharkPosX - Shark X position for startle check.
 * @param sharkPosZ - Shark Z position for startle check.
 * @returns void
 */
export function updateFishDrift(fish: FishState, dt: number, speedMultiplier: number, sharkPosX?: number, sharkPosZ?: number): void {
  // Tired golden fish drifts slower
  let effectiveMultiplier = speedMultiplier;
  if (fish.kind === 'golden' && fish.dodgeCount >= GOLDEN_MAX_DODGES) {
    effectiveMultiplier *= GOLDEN_TIRED_SPEED_MULTIPLIER;
  }

  fish.driftPhaseX += dt * fish.driftSpeed * effectiveMultiplier * 0.3;
  fish.driftPhaseZ += dt * fish.driftSpeed * effectiveMultiplier * 0.25;

  const targetX = fish.driftCenterX + Math.sin(fish.driftPhaseX) * 2.0;
  const targetZ = fish.driftCenterZ + Math.cos(fish.driftPhaseZ) * 2.0;

  // Gentle startle: speed up drift slightly when shark is near
  let effectiveSpeed = fish.driftSpeed * effectiveMultiplier;
  if (sharkPosX !== undefined && sharkPosZ !== undefined) {
    const sdx = fish.root.position.x - sharkPosX;
    const sdz = fish.root.position.z - sharkPosZ;
    const sharkDist = Math.sqrt(sdx * sdx + sdz * sdz);
    if (sharkDist < 1.5) {
      effectiveSpeed *= 1.3;
      if (sharkDist < 1.0) {
        fish.driftPhaseX += (Math.random() - 0.5) * 0.3;
        fish.driftPhaseZ += (Math.random() - 0.5) * 0.3;
      }
    }
  }

  return applyMovement(fish, targetX, targetZ, effectiveSpeed * dt);
}

/**
 * Updates golden fish dodge behavior. The golden fish darts sideways
 * when the shark gets close, up to GOLDEN_MAX_DODGES times.
 * @param fish - The golden fish state.
 * @param sharkPosX - Shark X position.
 * @param sharkPosZ - Shark Z position.
 * @param dt - Frame delta time.
 */
export function updateGoldenDodge(fish: FishState, sharkPosX: number, sharkPosZ: number, dt: number): void {
  if (!fish.active || fish.kind !== 'golden') return;

  if (fish.dodgeCooldown > 0) {
    fish.dodgeCooldown -= dt;
    return;
  }

  if (fish.dodgeCount >= GOLDEN_MAX_DODGES) return;

  const dx = fish.root.position.x - sharkPosX;
  const dz = fish.root.position.z - sharkPosZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 2.0 && dist > 0.01 && !fish.isTargeted) {
    // Dodge perpendicular to approach vector
    const perpX = -dz / dist;
    const perpZ = dx / dist;
    const side = Math.random() > 0.5 ? 1 : -1;

    fish.root.position.x += perpX * side * GOLDEN_DODGE_DISTANCE;
    fish.root.position.z += perpZ * side * GOLDEN_DODGE_DISTANCE;

    fish.root.position.x = clamp(fish.root.position.x, -BOUNDS, BOUNDS);
    fish.root.position.z = clamp(fish.root.position.z, -BOUNDS, BOUNDS);

    fish.dodgeCount++;
    fish.dodgeCooldown = GOLDEN_DODGE_COOLDOWN;

    fish.driftCenterX = fish.root.position.x;
    fish.driftCenterZ = fish.root.position.z;
  }
}

/**
 * Animates a fish's despawn: scale-to-zero over FISH_DESPAWN_SCALE_DURATION.
 * @param fish - The fish despawning.
 * @param dt - Frame delta time (already time-scaled).
 * @returns True when the despawn animation is complete and the fish can be disposed.
 */
export function updateDespawnAnimation(fish: FishState, dt: number): boolean {
  fish.despawnTimer -= dt;
  const s = clamp(fish.despawnTimer / FISH_DESPAWN_SCALE_DURATION, 0, 1);
  const baseScale = fish.kind === 'golden' ? GOLDEN_SCALE * 0.6 : 0.55;
  fish.root.scale.setScalar(s * baseScale);

  if (fish.despawnTimer <= 0) {
    fish.root.scale.setScalar(0);
    return true;
  }
  return false;
}

/**
 * Updates the shark's jaw-snap eat animation (body X scale pulse).
 * @param sharkBody - The shark body mesh.
 * @param eatAnimTimer - Current timer value.
 * @param dt - Frame delta time (already time-scaled).
 * @returns Updated eatAnimTimer value.
 */
export function updateEatAnimation(sharkBody: { scale: { x: number } }, eatAnimTimer: number, dt: number): number {
  eatAnimTimer -= dt;
  const t = clamp(eatAnimTimer / EAT_ANIM_DURATION, 0, 1);
  sharkBody.scale.x = SHARK_BODY_SCALE_X + 0.2 * Math.sin(t * Math.PI);

  if (eatAnimTimer <= 0) {
    sharkBody.scale.x = SHARK_BODY_SCALE_X;
    return -1;
  }
  return eatAnimTimer;
}

// ── Internal helpers ────────────────────────────────────────────────

// Lerp fish position toward target and rotate to face movement direction
function applyMovement(fish: FishState, targetX: number, targetZ: number, moveSpeed: number): void {
  const fmx = targetX - fish.root.position.x;
  const fmz = targetZ - fish.root.position.z;
  const fmDist = Math.sqrt(fmx * fmx + fmz * fmz);

  if (fmDist > 0.01) {
    const fStep = Math.min(moveSpeed, fmDist);
    fish.root.position.x += (fmx / fmDist) * fStep;
    fish.root.position.z += (fmz / fmDist) * fStep;

    // Rotate to face movement
    fish.root.rotation.y = Math.atan2(fmz, fmx);
  }

  // Keep in bounds
  fish.root.position.x = clamp(fish.root.position.x, -BOUNDS, BOUNDS);
  fish.root.position.z = clamp(fish.root.position.z, -BOUNDS, BOUNDS);

  // Wrap drift center if fish drifts far
  if (Math.abs(fish.root.position.x - fish.driftCenterX) > 4) {
    fish.driftCenterX = fish.root.position.x;
  }
  if (Math.abs(fish.root.position.z - fish.driftCenterZ) > 4) {
    fish.driftCenterZ = fish.root.position.z;
  }
}
