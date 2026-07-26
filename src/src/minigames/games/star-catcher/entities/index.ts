/**
 * Entity construction for the generated Star Catcher minigame.
 *
 * The template uses one small tappable target family because it is the
 * simplest way to produce a playable baseline. The target visuals are still
 * kept in their own module so future games can replace or expand them without
 * turning `index.ts` into a geometry file.
 */

import { Color, ExtrudeGeometry, Mesh, MeshStandardMaterial, Scene, Shape } from 'three';
import { clamp01, randomRange } from '../helpers';
import type { TemplateTargetKind, TemplateTargetState } from '../types';

/**
 * Maximum off-axis tilt, in radians, applied by the tumble.
 *
 * Defect 5: the star only ever mutated `rotation.z`, so an extruded solid read
 * as a flat sticker. X and Y are now animated too — but as *bounded
 * oscillations*, never free spins. At 0.42 rad (~24 degrees) the face still
 * presents cos(24 deg) ~= 0.91 of its silhouette, so the star always stays a
 * recognisable star and can never rotate edge-on and momentarily vanish. A
 * target that disappears for half a second is not something a 3-year-old aiming
 * at it can be asked to cope with.
 */
const TUMBLE_TILT_RAD = 0.42;

/** Seconds the catch animation plays before the star is returned to the pool. */
const CATCH_DURATION_SECONDS = 0.42;

/** Seconds the timeout / floor fade-out plays before recycling. */
const FADE_DURATION_SECONDS = 0.55;

/** Fraction of the catch animation spent popping outward before shrinking away. */
const CATCH_POP_FRACTION = 0.3;

/** Peak scale multiplier at the top of the catch pop. */
const CATCH_POP_SCALE = 1.6;

/** Victory spin rate (rad/s) during the catch animation. */
const CATCH_SPIN_RAD_PER_SECOND = 9;

/** How fast a caught star rises out of frame (world units/second). */
const CATCH_RISE_SPEED = 1.6;

/**
 * Builds a rounded five-point star geometry centred on the origin, lying in
 * the XY plane so it faces the camera and twirls face-on.
 *
 * @returns An extruded, centred five-point star geometry.
 */
function buildStarGeometry(): ExtrudeGeometry {
  const outer = 0.34;
  const inner = 0.15;
  const points = 5;
  const shape = new Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  geometry.center();
  return geometry;
}

// The authored resting scale for a kind. Bonus stars are visibly bigger so the
// higher-value target is legible without reading a number.
function baseScaleFor(kind: TemplateTargetKind): number {
  return kind === 'bonus' ? 1.2 : 1;
}

/**
 * Creates a pooled target entity and adds it to the shared scene.
 *
 * @param scene - The shell-owned Three.js scene.
 * @returns A pooled target state object ready for activation.
 */
export function createTarget(scene: Scene): TemplateTargetState {
  const material = new MeshStandardMaterial({
    color: new Color(1, 0.95, 0.72),
    emissive: new Color(1, 0.86, 0.5),
    emissiveIntensity: 1.6,
    roughness: 0.35,
    metalness: 0.05,
    // Always transparent, even though opacity is 1 for the whole falling life of
    // a star. Flipping `transparent` at runtime forces a shader recompile, and
    // the frame that hitches would be the frame the child just scored on — so
    // the despawn fade (defect 2) buys its alpha up front instead. `depthWrite`
    // stays on, so stars still sort correctly against each other.
    transparent: true,
    opacity: 1,
  });
  material.name = 'star-catcher_targetMat';

  const mesh = new Mesh(buildStarGeometry(), material);
  mesh.name = 'star-catcher_target';
  mesh.visible = false;
  // Glowing stars don't cast hard shadows — that read as dirt smudges.
  mesh.castShadow = false;
  scene.add(mesh);

  return {
    mesh,
    active: false,
    kind: 'standard',
    phase: 'falling',
    phaseTime: 0,
    points: 1,
    bobPhase: 0,
    fallSpeed: 0,
    rotationSpeed: 0,
    lifetimeRemaining: 0,
  };
}

/**
 * Activates a pooled target at a new position with the correct authored values
 * for the requested kind.
 *
 * Fall speeds are authored against the visible drop: the top of the frame sits
 * at y ~= 3.9 at the play depth and stars are retired at y = 0.25, so a star is
 * on screen for 3.65 / speed seconds — **5.6-7.3s for a standard star and
 * 4.3-5.6s for a bonus star**. That is deliberately generous: a 3-year-old
 * needs to see a star, decide, reach, and land a finger on it, and every one of
 * those steps is slow.
 *
 * @param target - Target state being activated.
 * @param kind - Target kind for this spawn.
 * @param x - World X spawn position.
 * @param y - World Y spawn position.
 * @param z - World Z spawn position.
 */
export function activateTarget(target: TemplateTargetState, kind: TemplateTargetKind, x: number, y: number, z: number): void {
  target.active = true;
  target.kind = kind;
  target.phase = 'falling';
  target.phaseTime = 0;
  target.points = kind === 'bonus' ? 3 : 1;
  target.bobPhase = randomRange(0, Math.PI * 2);
  target.fallSpeed = kind === 'bonus' ? randomRange(0.65, 0.85) : randomRange(0.5, 0.65);
  target.rotationSpeed = randomRange(0.8, 1.6);
  // Reaching the floor is what retires a star now, so this is only a safety net
  // against a star that somehow never gets there. The slowest star needs
  // (4.4 - 0.25) / 0.5 = 8.3s, so 12s can never cut a legitimate fall short.
  target.lifetimeRemaining = 12;

  target.mesh.visible = true;
  target.mesh.position.set(x, y, z);
  target.mesh.rotation.set(0, 0, 0);
  target.mesh.scale.setScalar(baseScaleFor(kind));

  const material = target.mesh.material as MeshStandardMaterial;
  material.opacity = 1;
  if (kind === 'bonus') {
    // Bright golden hero star.
    material.color.setRGB(1, 0.8, 0.32);
    material.emissive.setRGB(1, 0.72, 0.28);
    material.emissiveIntensity = 2.2;
  } else {
    // Warm cream-gold star.
    material.color.setRGB(1, 0.95, 0.72);
    material.emissive.setRGB(1, 0.86, 0.5);
    material.emissiveIntensity = 1.6;
  }
}

// Bounded multi-axis tumble. See TUMBLE_TILT_RAD for why X and Y oscillate
// rather than spin: the star has to read as a solid object without ever
// presenting its edge to the camera.
function applyTumble(target: TemplateTargetState, elapsedTime: number, deltaTime: number): void {
  target.mesh.rotation.z += target.rotationSpeed * deltaTime;
  target.mesh.rotation.x = Math.sin(elapsedTime * 0.9 + target.bobPhase) * TUMBLE_TILT_RAD;
  target.mesh.rotation.y = Math.sin(elapsedTime * 1.27 + target.bobPhase * 1.7) * TUMBLE_TILT_RAD;
}

// Plays whichever despawn animation the target has entered (defect 2). A catch
// pops, spins and lifts away; a timeout or a landing fades out instead of
// popping, because nothing was achieved and a celebration would misreport it.
function updateDespawnAnimation(target: TemplateTargetState, deltaTime: number): void {
  target.phaseTime += deltaTime;

  const material = target.mesh.material as MeshStandardMaterial;
  const baseScale = baseScaleFor(target.kind);

  if (target.phase === 'caught') {
    const progress = clamp01(target.phaseTime / CATCH_DURATION_SECONDS);
    const pop =
      progress < CATCH_POP_FRACTION
        ? 1 + (progress / CATCH_POP_FRACTION) * (CATCH_POP_SCALE - 1)
        : CATCH_POP_SCALE * (1 - (progress - CATCH_POP_FRACTION) / (1 - CATCH_POP_FRACTION));

    target.mesh.scale.setScalar(baseScale * Math.max(0, pop));
    target.mesh.rotation.z += CATCH_SPIN_RAD_PER_SECOND * deltaTime;
    target.mesh.position.y += CATCH_RISE_SPEED * deltaTime;
    material.emissiveIntensity = 2.6 + progress * 2.4;
    material.opacity = 1 - clamp01((progress - 0.6) / 0.4);
    return;
  }

  const progress = clamp01(target.phaseTime / FADE_DURATION_SECONDS);
  target.mesh.scale.setScalar(baseScale * (1 - progress * 0.35));
  // Keep settling downward while it dims, so it reads as "drifted away" rather
  // than "was deleted".
  target.mesh.position.y -= target.fallSpeed * deltaTime * 0.5;
  material.opacity = 1 - progress;
  material.emissiveIntensity = 1.4 * (1 - progress);
}

/**
 * Updates one active target's authored motion for the current frame.
 *
 * @param target - Target being animated.
 * @param elapsedTime - Seconds since the run started.
 * @param deltaTime - Frame delta in seconds.
 */
export function updateTargetMotion(target: TemplateTargetState, elapsedTime: number, deltaTime: number): void {
  if (!target.active) return;

  if (target.phase !== 'falling') {
    updateDespawnAnimation(target, deltaTime);
    return;
  }

  target.lifetimeRemaining -= deltaTime;
  // Defect 1: this line used to be `position.y += fallSpeed * dt * 0.22`, which
  // made every star in "Catch falling stars before they drift away!" drift
  // *upward* at 0.08-0.16 u/s from a fixed spawn at y = 0.55. Stars now spawn
  // above the frame and fall.
  target.mesh.position.y -= target.fallSpeed * deltaTime;
  target.mesh.position.x += Math.sin(elapsedTime * 1.6 + target.bobPhase) * deltaTime * 0.18;

  applyTumble(target, elapsedTime, deltaTime);

  const material = target.mesh.material as MeshStandardMaterial;
  const pulse = 0.5 + (Math.sin(elapsedTime * 3 + target.bobPhase) * 0.5 + 0.5) * 0.5;
  material.emissiveIntensity = target.kind === 'bonus' ? 2.0 + pulse : 1.4 + pulse;
}

/**
 * Starts the catch animation on a falling star.
 *
 * @param target - The star that was caught.
 * @returns True when the star was catchable and is now celebrating.
 */
export function beginCatch(target: TemplateTargetState): boolean {
  if (!target.active || target.phase !== 'falling') return false;
  target.phase = 'caught';
  target.phaseTime = 0;
  return true;
}

/**
 * Starts the gentle fade-out used when a star lands or times out.
 *
 * @param target - The star that is leaving without being caught.
 */
export function beginFadeOut(target: TemplateTargetState): void {
  if (!target.active || target.phase !== 'falling') return;
  target.phase = 'fading';
  target.phaseTime = 0;
}

/**
 * Reports whether a despawning target has finished its animation and can be
 * handed back to the pool.
 *
 * @param target - Target being checked.
 * @returns True once the target's despawn animation has played out.
 */
export function isDespawnComplete(target: TemplateTargetState): boolean {
  if (target.phase === 'caught') return target.phaseTime >= CATCH_DURATION_SECONDS;
  if (target.phase === 'fading') return target.phaseTime >= FADE_DURATION_SECONDS;
  return false;
}

/**
 * Resets a target when it is returned to the entity pool.
 *
 * This is the recycle step only. It is deliberately instantaneous — the visible
 * exit already happened in `updateDespawnAnimation`, which is what defect 2 was
 * missing when this function was the *entire* response to catching a star.
 *
 * @param target - Target state being recycled.
 */
export function resetTarget(target: TemplateTargetState): void {
  target.active = false;
  target.kind = 'standard';
  target.phase = 'falling';
  target.phaseTime = 0;
  target.points = 1;
  target.bobPhase = 0;
  target.fallSpeed = 0;
  target.rotationSpeed = 0;
  target.lifetimeRemaining = 0;
  target.mesh.visible = false;
  target.mesh.position.set(0, -10, 0);
  target.mesh.rotation.set(0, 0, 0);
  target.mesh.scale.setScalar(1);

  const material = target.mesh.material as MeshStandardMaterial;
  material.emissiveIntensity = 1;
  material.opacity = 1;
}

/**
 * Disposes the target permanently when the pool is torn down.
 *
 * @param target - Target state being permanently destroyed.
 */
export function disposeTarget(target: TemplateTargetState): void {
  target.mesh.geometry.dispose();
  (target.mesh.material as MeshStandardMaterial).dispose();
  target.mesh.removeFromParent();
}
