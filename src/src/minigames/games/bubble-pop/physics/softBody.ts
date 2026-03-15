import type { BubbleState } from '../types';
import { SIZE_VARIANTS, GIANT_SCALE } from '../types';
import type { SpatialHash } from './spatialHash';

/**
 * Soft-body repulsion — keeps bubbles from overlapping.
 * Applies gentle push-apart forces when bubbles are closer than the sum
 * of their radii. Also applies pop pressure wave impulses.
 */

/** Repulsion tuning constants. */
const REPULSION_STRENGTH = 2.0;
const REPULSION_DAMPING = 0.8;
const PRESSURE_WAVE_STRENGTH = 3.0;
const PRESSURE_WAVE_RADIUS = 3.0;

/**
 * Returns the effective world-space radius of a bubble.
 * @param bubble - The bubble state to measure.
 * @returns The computed radius in world units.
 */
function bubbleRadius(bubble: BubbleState): number {
  const baseRadius = (SIZE_VARIANTS[bubble.sizeVariant] ?? 0.55) / 2;
  return baseRadius * (bubble.kind === 'giant' ? GIANT_SCALE : 1);
}

/**
 * Applies soft-body repulsion forces between all active bubbles.
 * Uses the spatial hash for O(n) neighbor lookups.
 * @param activeBubbles - The current active bubbles.
 * @param hash - Spatial hash populated with current bubble positions.
 * @param deltaTime - Frame delta time in seconds.
 */
export function applySoftBodyRepulsion(activeBubbles: readonly BubbleState[], hash: SpatialHash<BubbleState>, deltaTime: number): void {
  const maxRadius = 0.8 * GIANT_SCALE; // largest possible bubble radius
  const queryRadius = maxRadius * 2.5; // generous to catch all potential overlaps

  for (let i = 0; i < activeBubbles.length; i++) {
    const a = activeBubbles[i];
    if (!a.active || a.spawning) continue;

    const ax = a.mesh.position.x;
    const ay = a.mesh.position.y;
    const ra = bubbleRadius(a);

    const neighbors = hash.queryRadius(ax, ay, queryRadius);
    for (let j = 0; j < neighbors.length; j++) {
      const entry = neighbors[j];
      const b = entry.item;
      if (b === a || !b.active || b.spawning) continue;

      const dx = ax - entry.x;
      const dy = ay - entry.y;
      const distSq = dx * dx + dy * dy;
      const rb = bubbleRadius(b);
      const minDist = ra + rb;
      const minDistSq = minDist * minDist;

      if (distSq < minDistSq && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        // Push apart proportional to overlap
        const force = overlap * REPULSION_STRENGTH * REPULSION_DAMPING * deltaTime;
        // Split evenly between both bubbles
        const half = force * 0.5;
        a.mesh.position.x += nx * half;
        a.mesh.position.y += ny * half;
        b.mesh.position.x -= nx * half;
        b.mesh.position.y -= ny * half;
      }
    }
  }
}

/**
 * Applies a pressure wave impulse from a pop position, pushing nearby bubbles outward.
 * @param activeBubbles - The current active bubbles.
 * @param popX - Pop world X.
 * @param popY - Pop world Y.
 * @param deltaTime - Frame delta time.
 */
export function applyPopPressureWave(activeBubbles: readonly BubbleState[], popX: number, popY: number, deltaTime: number): void {
  for (let i = 0; i < activeBubbles.length; i++) {
    const b = activeBubbles[i];
    if (!b.active || b.spawning) continue;

    const dx = b.mesh.position.x - popX;
    const dy = b.mesh.position.y - popY;
    const distSq = dx * dx + dy * dy;

    if (distSq < PRESSURE_WAVE_RADIUS * PRESSURE_WAVE_RADIUS && distSq > 0.01) {
      const dist = Math.sqrt(distSq);
      const falloff = 1 - dist / PRESSURE_WAVE_RADIUS;
      const impulse = falloff * PRESSURE_WAVE_STRENGTH * deltaTime;
      b.mesh.position.x += (dx / dist) * impulse;
      b.mesh.position.y += (dy / dist) * impulse;
    }
  }
}
