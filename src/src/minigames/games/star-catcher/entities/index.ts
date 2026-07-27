/**
 * Entity construction for the generated Star Catcher minigame.
 *
 * The template uses one small tappable target family because it is the
 * simplest way to produce a playable baseline. The target visuals are still
 * kept in their own module so future games can replace or expand them without
 * turning `index.ts` into a geometry file.
 */

import { Color, ExtrudeGeometry, Mesh, MeshStandardMaterial, Scene, Shape, type Vector3 } from 'three';
import { clamp01, randomRange } from '../helpers';
import type { TemplateTargetKind, TemplateTargetState } from '../types';

/**
 * Outer radius of the star silhouette, in world units.
 *
 * Exported because the catch forgiveness in `rules/` sizes its screen-space
 * radius from the star's actual projected size rather than a flat pixel
 * constant. Trimmed from 0.34 because the play field moved much closer to the
 * camera: at 0.34 the nearest bonus star would have spanned 232 px of an 810 px
 * frame. At 0.30 the range across the field is 96-172 px, still far above the
 * ~2 cm floor a small child needs and no longer crowding the frame.
 */
export const STAR_OUTER_RADIUS = 0.3;

/** Seconds a landed star lies glowing in the grass, still catchable. */
export const REST_DURATION_SECONDS = 2.6;

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
  const outer = STAR_OUTER_RADIUS;
  const inner = STAR_OUTER_RADIUS * 0.44;
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
    depth: 0.062,
    bevelEnabled: true,
    bevelThickness: 0.026,
    bevelSize: 0.026,
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
    // Halved from 1.6. The night around the stars is now roughly 3.3x darker
    // (see `environment/setup.ts`), and at 1.6 the ACES curve clipped every star
    // to a flat #f2f0e7 — the standard and bonus stars were the same white
    // blob. At 0.7-1.05 they render #e3dfce vs the bonus #ecddae, so the
    // higher-value target is legible by colour as well as by size.
    emissiveIntensity: 0.85,
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
    driftX: 0,
    landingY: 0,
    rotationSpeed: 0,
    lifetimeRemaining: 0,
  };
}

/**
 * Activates a pooled target on a trajectory solved from the live camera.
 *
 * Everything about the flight path is now decided by the caller in screen
 * space (`entities/lifecycle.ts`) rather than authored here: where the star
 * appears, which patch of hillside it is aimed at, how fast it falls so its
 * *apparent* speed matches every other star, and how much world X it must
 * travel per unit of fall to hold a straight vertical line on screen.
 *
 * @param target - Target state being activated.
 * @param kind - Target kind for this spawn.
 * @param position - World-space spawn position.
 * @param driftX - World X travelled per world unit of fall.
 * @param landingY - World Y of the hillside this star is aimed at.
 * @param fallSpeed - Downward speed in world units per second.
 */
export function activateTarget(
  target: TemplateTargetState,
  kind: TemplateTargetKind,
  position: Vector3,
  driftX: number,
  landingY: number,
  fallSpeed: number,
): void {
  target.active = true;
  target.kind = kind;
  target.phase = 'falling';
  target.phaseTime = 0;
  target.points = kind === 'bonus' ? 3 : 1;
  target.bobPhase = randomRange(0, Math.PI * 2);
  target.fallSpeed = fallSpeed;
  target.driftX = driftX;
  target.landingY = landingY;
  target.rotationSpeed = randomRange(0.8, 1.6);
  // Landing is what ends the fall now, so this is only a safety net against a
  // star that somehow never gets there. The whole drop is ~3.9 units and the
  // slowest star manages ~0.45 u/s, so 12s can never cut a legitimate fall short.
  target.lifetimeRemaining = 12;

  target.mesh.visible = true;
  target.mesh.position.copy(position);
  target.mesh.rotation.set(0, 0, 0);
  target.mesh.scale.setScalar(baseScaleFor(kind));

  const material = target.mesh.material as MeshStandardMaterial;
  material.opacity = 1;
  if (kind === 'bonus') {
    // Deep golden hero star; renders ~#ecddae against the night sky.
    material.color.setRGB(1, 0.78, 0.3);
    material.emissive.setRGB(1, 0.62, 0.18);
    material.emissiveIntensity = 1.15;
  } else {
    // Warm cream star; renders ~#e3dfce.
    material.color.setRGB(1, 0.95, 0.72);
    material.emissive.setRGB(1, 0.86, 0.5);
    material.emissiveIntensity = 0.85;
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
    // Scaled with the rest of the star emissives for the darker night.
    material.emissiveIntensity = 1.4 + progress * 1.3;
    material.opacity = 1 - clamp01((progress - 0.6) / 0.4);
    return;
  }

  const progress = clamp01(target.phaseTime / FADE_DURATION_SECONDS);
  target.mesh.scale.setScalar(baseScale * (1 - progress * 0.35));
  // Sink gently into the grass while it dims, so a star that was never caught
  // reads as "settled away" rather than "was deleted".
  target.mesh.position.y -= deltaTime * 0.28;
  material.opacity = 1 - progress;
  material.emissiveIntensity = 0.8 * (1 - progress);
}

// A landed star: it has come to rest in the grass and is still catchable for
// REST_DURATION_SECONDS. It breathes and turns slowly in place rather than
// holding a dead pose, both so it keeps drawing the eye and so the bottom of
// the frame — which used to be numerically motionless — is alive.
function updateRestingMotion(target: TemplateTargetState, elapsedTime: number, deltaTime: number): void {
  target.phaseTime += deltaTime;

  const baseScale = baseScaleFor(target.kind);
  const breathe = Math.sin(elapsedTime * 2.2 + target.bobPhase) * 0.5 + 0.5;
  target.mesh.position.y = target.landingY + breathe * 0.05;
  target.mesh.scale.setScalar(baseScale * (0.94 + breathe * 0.08));
  target.mesh.rotation.z += target.rotationSpeed * 0.35 * deltaTime;
  target.mesh.rotation.x = Math.sin(elapsedTime * 0.7 + target.bobPhase) * TUMBLE_TILT_RAD * 0.4;
  target.mesh.rotation.y = Math.sin(elapsedTime * 0.9 + target.bobPhase * 1.7) * TUMBLE_TILT_RAD * 0.4;

  const material = target.mesh.material as MeshStandardMaterial;
  const base = target.kind === 'bonus' ? 0.95 : 0.7;
  const span = target.kind === 'bonus' ? 0.45 : 0.35;
  material.emissiveIntensity = base + breathe * span;
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

  if (target.phase === 'resting') {
    updateRestingMotion(target, elapsedTime, deltaTime);
    return;
  }

  if (target.phase !== 'falling') {
    updateDespawnAnimation(target, deltaTime);
    return;
  }

  target.lifetimeRemaining -= deltaTime;
  // Defect 1: this line used to be `position.y += fallSpeed * dt * 0.22`, which
  // made every star in "Catch falling stars before they drift away!" drift
  // *upward* at 0.08-0.16 u/s from a fixed spawn at y = 0.55. Stars now spawn
  // above the frame and fall.
  const fall = target.fallSpeed * deltaTime;
  target.mesh.position.y -= fall;
  // `driftX` is the exact world X rate that holds a constant screen column for
  // this camera. The sine term on top is a small readable sway, kept well under
  // the drift so the star never leaves its lane.
  target.mesh.position.x += target.driftX * fall + Math.sin(elapsedTime * 1.6 + target.bobPhase) * deltaTime * 0.09;

  applyTumble(target, elapsedTime, deltaTime);

  const material = target.mesh.material as MeshStandardMaterial;
  const pulse = Math.sin(elapsedTime * 3 + target.bobPhase) * 0.5 + 0.5;
  material.emissiveIntensity = target.kind === 'bonus' ? 0.95 + pulse * 0.45 : 0.7 + pulse * 0.35;
}

/**
 * Starts the catch animation on a falling star.
 *
 * @param target - The star that was caught.
 * @returns True when the star was catchable and is now celebrating.
 */
export function beginCatch(target: TemplateTargetState): boolean {
  if (!target.active || !isCatchable(target)) return false;
  target.phase = 'caught';
  target.phaseTime = 0;
  return true;
}

/**
 * Reports whether a target is in a phase that can still be scored.
 *
 * A star already playing its catch or fade animation still has a mesh in the
 * scene, and letting it score twice would award points for a star that is
 * visibly gone. A landed, resting star is very much still fair game.
 *
 * @param target - Target being checked.
 * @returns True while the star is falling or resting in the grass.
 */
export function isCatchable(target: TemplateTargetState): boolean {
  return target.phase === 'falling' || target.phase === 'resting';
}

/**
 * Settles a star onto the patch of hillside it was aimed at.
 *
 * @param target - The star that has reached its landing height.
 */
export function beginRest(target: TemplateTargetState): void {
  if (!target.active || target.phase !== 'falling') return;
  target.phase = 'resting';
  target.phaseTime = 0;
  target.mesh.position.y = target.landingY;
}

/**
 * Starts the gentle fade-out used when a star gives up without being caught.
 *
 * @param target - The star that is leaving without being caught.
 */
export function beginFadeOut(target: TemplateTargetState): void {
  if (!target.active || !isCatchable(target)) return;
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
  target.driftX = 0;
  target.landingY = 0;
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
