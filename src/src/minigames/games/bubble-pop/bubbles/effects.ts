import { Scene, Color, Vector3, type ShaderMaterial } from 'three';
import { createSparkleBurst } from '@app/minigames/shared/particleFx';
import type { BubbleState } from '../types';
import { SIZE_VARIANTS, GIANT_SCALE, WOBBLE_AMPLITUDE, SPAWN_ANIM_DURATION, SWAY_AMPLITUDE, SWAY_FREQUENCY, BUBBLE_COLORS, GOLDEN_COLOR } from '../types';
import { randomRange } from '../helpers';
import { tmpVec3 } from '../tempPool';
import { sampleFlowFieldInto, DEFAULT_FLOW_CONFIG, type FlowFieldConfig } from '../physics/flowField';

/**
 * Per-frame animation and one-shot visual effects for bubbles — motion,
 * wobble, iridescence, pop bursts, and sparkles. Concerned only with how
 * bubbles LOOK and MOVE, not what they ARE (lifecycle.ts) or how game rules
 * decide what happens to them (rules.ts).
 */

/** Reusable flow field sample output — avoids per-frame allocation. */
const _flowSample = { vx: 0, vy: 0 };

/**
 * Per-frame bubble motion: combines flow field drift with residual sway
 * and subtle depth drift. Skipped during spawn animation.
 * @param bubble - The bubble to move.
 * @param elapsedTime - Total elapsed game time in seconds.
 * @param deltaTime - Frame delta time in seconds.
 * @param flowConfig - Flow field parameters. Defaults to DEFAULT_FLOW_CONFIG.
 */
export function updateBubbleMotion(bubble: BubbleState, elapsedTime: number, deltaTime: number, flowConfig: FlowFieldConfig = DEFAULT_FLOW_CONFIG): void {
  if (bubble.spawning) return;

  // Sample flow field for organic drift
  sampleFlowFieldInto(bubble.mesh.position.x, bubble.mesh.position.y, elapsedTime, flowConfig, _flowSample);

  // Flow field provides the primary motion; bubble.speed scales the effect
  const speedFactor = bubble.speed / 0.3; // normalize around default baseRise
  bubble.mesh.position.x += _flowSample.vx * speedFactor * deltaTime;
  bubble.mesh.position.y += _flowSample.vy * speedFactor * deltaTime;

  // Retain subtle sway and depth drift as secondary motion
  bubble.mesh.position.x += Math.sin(elapsedTime * SWAY_FREQUENCY + bubble.phase) * SWAY_AMPLITUDE * 0.3 * deltaTime;
  bubble.mesh.position.z += Math.sin(elapsedTime * 0.3 + bubble.phase * 2) * 0.02 * deltaTime;
}

/**
 * Per-frame squash-stretch wobble and spawn entrance animation for a single bubble.
 * @param bubble - The bubble to animate.
 * @param time - Elapsed game time in seconds.
 * @param deltaTime - Frame delta time in seconds.
 */
export function updateBubbleWobble(bubble: BubbleState, time: number, deltaTime: number): void {
  bubble.age += deltaTime;

  const wobble = Math.sin(time * bubble.wobbleSpeed + bubble.wobblePhase) * WOBBLE_AMPLITUDE;
  const baseScale = (SIZE_VARIANTS[bubble.sizeVariant] / 0.5) * (bubble.kind === 'giant' ? GIANT_SCALE : 1);

  // Spawn animation: elastic ease-out from 0 to full size
  if (bubble.spawning) {
    const t = Math.min(1, bubble.age / SPAWN_ANIM_DURATION);
    let ease: number;
    if (t < 1) {
      ease = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.5);
    } else {
      ease = 1;
    }

    const spawnScale = baseScale * ease;
    bubble.mesh.scale.setScalar(Math.max(0, spawnScale));

    if (t >= 1) {
      bubble.spawning = false;
    }
    return;
  }

  const sx = baseScale * (1 + wobble);
  const sy = baseScale * (1 - wobble * 0.7);
  const sz = baseScale * (1 + wobble * 0.3);
  bubble.mesh.scale.set(sx, sy, sz);
}

/**
 * Per-frame iridescence update: drives the bubble shader's uTime and uColor uniforms.
 * Rainbow kind cycles base color, golden shimmers, normal uses slow time drift.
 * @param activeBubbles - The array of currently active bubbles.
 */
export function updateIridescence(activeBubbles: readonly BubbleState[]): void {
  const t = performance.now() * 0.001;
  for (const bubble of activeBubbles) {
    if (!bubble.active) continue;
    const mat = bubble.mesh.material as ShaderMaterial;
    if (!mat?.uniforms) continue;

    mat.uniforms.uTime.value = t;

    if (bubble.kind === 'rainbow') {
      const r = Math.sin(t * 3.0 + bubble.phase) * 0.5 + 0.5;
      const g = Math.sin(t * 3.0 + bubble.phase + 2.1) * 0.5 + 0.5;
      const b = Math.sin(t * 3.0 + bubble.phase + 4.2) * 0.5 + 0.5;
      (mat.uniforms.uColor.value as Color).setRGB(r, g, b);
    } else if (bubble.kind === 'golden') {
      const shimmer = Math.sin(t * 4.0 + bubble.phase) * 0.15;
      (mat.uniforms.uColor.value as Color).setRGB(1.0 + shimmer, 0.85 + shimmer * 0.5, 0.3);
    }
  }
}

/** Active pop animations driven by the game loop. */
const activePops: { bubble: BubbleState; timer: number; duration: number; onComplete: () => void }[] = [];

/** Pop animation duration in seconds. */
const POP_ANIM_DURATION = 0.1;

/**
 * Initiates a pop animation: scale-up burst -> hide -> callback.
 * The animation is ticked by `tickPopAnimations` inside the game update loop
 * rather than using requestAnimationFrame.
 * Triggers kind-specific particle effects (sparkle bursts).
 * @param scene - The Three.js scene.
 * @param bubble - The bubble that was tapped.
 * @param onComplete - Callback invoked after the pop animation completes.
 */
export function popBubbleEffect(scene: Scene, bubble: BubbleState, onComplete: () => void): void {
  // Quick scale-up
  bubble.mesh.scale.multiplyScalar(1.3);

  // Register for game-loop-driven animation
  activePops.push({ bubble, timer: 0, duration: POP_ANIM_DURATION, onComplete });

  const sizeScale = SIZE_VARIANTS[bubble.sizeVariant] / 0.5;
  const burstScale = sizeScale * (bubble.kind === 'giant' ? GIANT_SCALE : 1);
  // Use tmpVec3 for the position copy (sparkle burst needs a stable ref so copy once)
  const popPos = tmpVec3(0).copy(bubble.mesh.position);
  // createSparkleBurst stores the position internally, so passing a temp is safe
  createSparkleBurst(scene, popPos, bubble.baseColor, Math.round(20 * burstScale));

  if (bubble.kind === 'golden') {
    createSparkleBurst(scene, popPos, GOLDEN_COLOR, 35);
  } else if (bubble.kind === 'rainbow') {
    for (let i = 0; i < 3; i++) {
      const c = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      const offset = tmpVec3(1).set(randomRange(-0.3, 0.3), randomRange(-0.3, 0.3), 0);
      const burstPos = tmpVec3(2).copy(popPos).add(offset);
      createSparkleBurst(scene, burstPos, c, 12);
    }
  } else if (bubble.kind === 'giant') {
    createSparkleBurst(scene, popPos, bubble.baseColor, 40);
  }
}

/**
 * Advances all active pop animations. Call once per frame from the game update loop.
 * @param deltaTime - Frame delta time in seconds.
 */
export function tickPopAnimations(deltaTime: number): void {
  for (let i = activePops.length - 1; i >= 0; i--) {
    const pop = activePops[i];
    pop.timer += deltaTime;
    if (pop.timer >= pop.duration) {
      pop.bubble.mesh.visible = false;
      pop.onComplete();
      // Swap-remove
      activePops[i] = activePops[activePops.length - 1];
      activePops.pop();
    }
  }
}

/**
 * Clears all pending pop animations. Call during teardown.
 */
export function clearPopAnimations(): void {
  activePops.length = 0;
}

/** Cached fallback sparkle color — avoids allocation on every missed tap. */
const FALLBACK_SPARKLE_COLOR = new Color(0.7, 0.8, 1.0);

/**
 * Creates a first-tap fallback sparkle at a world position.
 * Ensures every tap produces a visual response even on empty space.
 * @param scene - The Three.js scene.
 * @param position - World position for the sparkle.
 */
export function createTapFallbackSparkle(scene: Scene, position: Vector3): void {
  createSparkleBurst(scene, position, FALLBACK_SPARKLE_COLOR, 8);
}

/**
 * Disposes the cached pop texture. Call during teardown.
 */
export function disposePopTexture(): void {
  // No-op in Three.js — particle textures are managed by shared particleFx
}
