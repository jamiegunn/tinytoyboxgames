import type { FishState } from '../types';
import {
  BOUNDS,
  FISH_DESPAWN_SCALE_DURATION,
  GOLDEN_SCALE,
  EAT_ANIM_DURATION,
  SHARK_BODY_SCALE_X,
  GOLDEN_DODGE_DISTANCE,
  GOLDEN_DODGE_DURATION,
  GOLDEN_DODGE_COOLDOWN,
  GOLDEN_MAX_DODGES,
  GOLDEN_TIRED_SPEED_MULTIPLIER,
  STANDARD_FISH_SCALE,
} from '../types';
import { clamp } from '../helpers';

/**
 * Per-frame animation for fish entities — drift movement, dodge behavior,
 * and despawn scaling. Concerned only with how fish LOOK and MOVE, not
 * what they ARE (lifecycle.ts) or how game rules decide what happens (orchestrator).
 */

// ── Difficulty-scaled evasion (defect 3) ────────────────────────────
//
// Every one of these used to be a hard-coded constant, so a child on their
// fortieth catch met exactly the same fish as on their first. They now
// interpolate on the 0–1 evasiveness from `getFishEvasiveness`.

/** Startle radius at evasiveness 0 → 1 (world units). */
const STARTLE_RADIUS_MIN = 1.5;
const STARTLE_RADIUS_MAX = 3.0;

/** Drift speed multiplier applied while startled, at evasiveness 0 → 1. */
const STARTLE_BOOST_MIN = 1.3;
const STARTLE_BOOST_MAX = 2.2;

/** Golden fish dodge trigger radius at evasiveness 0 → 1 (world units). */
const DODGE_RADIUS_MIN = 2.0;
const DODGE_RADIUS_MAX = 3.5;

/** Extra golden dodges granted at maximum evasiveness. */
const DODGE_BONUS_MAX = 2;

/** Fraction of the dodge cooldown removed at maximum evasiveness. */
const DODGE_COOLDOWN_CUT = 0.5;

// Linear interpolation helper for the evasion bands above
function mix(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/**
 * Updates a fish's drift movement using sine/cosine phase oscillation.
 * Includes gentle startle when shark is nearby.
 * @param fish - The fish to animate.
 * @param dt - Frame delta time (already time-scaled).
 * @param speedMultiplier - Difficulty-driven speed multiplier.
 * @param sharkPosX - Shark X position for startle check.
 * @param sharkPosZ - Shark Z position for startle check.
 * @param evasiveness - Difficulty-driven evasion strength in [0, 1]. Defaults to 0.
 * @returns void
 */
export function updateFishDrift(fish: FishState, dt: number, speedMultiplier: number, sharkPosX?: number, sharkPosZ?: number, evasiveness = 0): void {
  // A dart owns the fish's position for its whole duration. Letting the drift
  // spring pull at the same time would eat part of the dodge distance and drag
  // the fish back toward the shark it is escaping.
  if (fish.dodgeTimer > 0) return;

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
    const startleRadius = mix(STARTLE_RADIUS_MIN, STARTLE_RADIUS_MAX, evasiveness);
    if (sharkDist < startleRadius) {
      effectiveSpeed *= mix(STARTLE_BOOST_MIN, STARTLE_BOOST_MAX, evasiveness);
      if (sharkDist < startleRadius * 0.67) {
        fish.driftPhaseX += (Math.random() - 0.5) * 0.3;
        fish.driftPhaseZ += (Math.random() - 0.5) * 0.3;
      }
    }
  }

  return applyMovement(fish, targetX, targetZ, effectiveSpeed * dt);
}

// Ease-out cubic. The dart leaves fast and settles, which is what a startled
// animal looks like; a linear slide reads as the fish being dragged.
function dodgeEase(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

// Advances an in-flight dart by one frame.
//
// Displacement is taken as the DIFFERENCE between the eased progress before and
// after this frame, so the total distance travelled is exactly
// GOLDEN_DODGE_DISTANCE regardless of frame rate or how the window is chopped up.
// Integrating a per-frame speed instead would drift with dt.
function advanceDodge(fish: FishState, dt: number): void {
  const before = dodgeEase(1 - fish.dodgeTimer / GOLDEN_DODGE_DURATION);
  // Snap to zero rather than trusting the subtraction: repeatedly taking 1/60
  // off 0.3 leaves a float residue, which would otherwise buy the dart a whole
  // extra frame of holding the fish still with nowhere left to travel.
  const remaining = fish.dodgeTimer - dt;
  fish.dodgeTimer = remaining > 1e-6 ? remaining : 0;
  const after = dodgeEase(1 - fish.dodgeTimer / GOLDEN_DODGE_DURATION);
  const step = (after - before) * GOLDEN_DODGE_DISTANCE;

  fish.root.position.x = clamp(fish.root.position.x + fish.dodgeDirX * step, -BOUNDS, BOUNDS);
  fish.root.position.z = clamp(fish.root.position.z + fish.dodgeDirZ * step, -BOUNDS, BOUNDS);
  fish.root.rotation.y = Math.atan2(fish.dodgeDirZ, fish.dodgeDirX);

  if (fish.dodgeTimer <= 0) {
    fish.dodgeTimer = -1;
    // Re-centre the drift spring where the fish actually ended up, or it gets
    // reeled straight back into the shark it just escaped.
    fish.driftCenterX = fish.root.position.x;
    fish.driftCenterZ = fish.root.position.z;
  }
}

/**
 * Updates golden fish dodge behavior. The golden fish darts sideways
 * when the shark gets close, up to GOLDEN_MAX_DODGES times.
 *
 * The dart is played out over GOLDEN_DODGE_DURATION rather than applied in one
 * frame. It used to be instantaneous, which made the fish blink from one place
 * to another — unwatchable, and unchaseable by the child who is meant to be
 * pursuing it.
 *
 * @param fish - The golden fish state.
 * @param sharkPosX - Shark X position.
 * @param sharkPosZ - Shark Z position.
 * @param dt - Frame delta time.
 * @param evasiveness - Difficulty-driven evasion strength in [0, 1]. Defaults to 0.
 */
export function updateGoldenDodge(fish: FishState, sharkPosX: number, sharkPosZ: number, dt: number, evasiveness = 0): void {
  if (!fish.active || fish.kind !== 'golden') return;

  // A dart in flight finishes before anything else is considered — including
  // the cooldown, which only starts ticking once the fish has landed.
  if (fish.dodgeTimer > 0) {
    advanceDodge(fish, dt);
    return;
  }

  if (fish.dodgeCooldown > 0) {
    fish.dodgeCooldown -= dt;
    return;
  }

  const maxDodges = GOLDEN_MAX_DODGES + Math.round(DODGE_BONUS_MAX * evasiveness);
  if (fish.dodgeCount >= maxDodges) return;

  const dx = fish.root.position.x - sharkPosX;
  const dz = fish.root.position.z - sharkPosZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < mix(DODGE_RADIUS_MIN, DODGE_RADIUS_MAX, evasiveness) && dist > 0.01 && !fish.isTargeted) {
    // Dodge perpendicular to approach vector
    const perpX = -dz / dist;
    const perpZ = dx / dist;
    const side = Math.random() > 0.5 ? 1 : -1;

    // Launch the dart; advanceDodge carries the fish across on later frames.
    fish.dodgeDirX = perpX * side;
    fish.dodgeDirZ = perpZ * side;
    fish.dodgeTimer = GOLDEN_DODGE_DURATION;

    fish.dodgeCount++;
    fish.dodgeCooldown = GOLDEN_DODGE_COOLDOWN * (1 - DODGE_COOLDOWN_CUT * evasiveness);

    // Start moving on the same frame the dodge is decided. Deferring to the
    // next frame leaves the fish standing still — and pointing the wrong way —
    // for the moment the shark is closest, which is the moment being watched.
    advanceDodge(fish, dt);
  }
}

/** How far a fish is thrown clear when it slips a catch it was never meant to lose. */
const ESCAPE_DISTANCE = 2.6;

/**
 * Squirts a fish out from under the shark's nose.
 *
 * Used where the shark reaches a fish it is not entitled to eat — an auto-hunt
 * the child did not ask for, or an idle drift that happened to intersect one.
 * Without this the fish would simply sit inside the shark mesh, because nothing
 * else would move it away and the contact test would keep firing every frame.
 *
 * The escape is radial rather than perpendicular, unlike the golden fish's
 * dodge: a golden is meant to stay in play and tease, whereas this fish just
 * had a predator arrive on top of it and should get out from under it. Pushing
 * the drift centre out with the fish keeps it there instead of letting the
 * drift spring reel it straight back into the shark's mouth.
 *
 * @param fish - Fish to displace.
 * @param sharkPosX - Shark world X.
 * @param sharkPosZ - Shark world Z.
 */
export function escapeFromShark(fish: FishState, sharkPosX: number, sharkPosZ: number): void {
  const dx = fish.root.position.x - sharkPosX;
  const dz = fish.root.position.z - sharkPosZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  // Directly on top of the shark: no meaningful outward direction, so pick one.
  const angle = dist > 0.01 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
  fish.root.position.x = clamp(sharkPosX + Math.cos(angle) * ESCAPE_DISTANCE, -BOUNDS, BOUNDS);
  fish.root.position.z = clamp(sharkPosZ + Math.sin(angle) * ESCAPE_DISTANCE, -BOUNDS, BOUNDS);
  fish.driftCenterX = fish.root.position.x;
  fish.driftCenterZ = fish.root.position.z;
  // A fish that has just been thrown clear must not carry on with the sideways
  // dart it was mid-way through, or it slides back across the shark's nose.
  fish.dodgeTimer = -1;
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
  const baseScale = fish.kind === 'golden' ? GOLDEN_SCALE * 0.6 : STANDARD_FISH_SCALE;
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
