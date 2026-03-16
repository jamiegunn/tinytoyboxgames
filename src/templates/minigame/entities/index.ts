/**
 * Entity construction for the generated __GAME_DISPLAY_NAME__ minigame.
 *
 * The template uses one small tappable target family because it is the
 * simplest way to produce a playable baseline. The target visuals are still
 * kept in their own module so future games can replace or expand them without
 * turning `index.ts` into a geometry file.
 */

import { Color, IcosahedronGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { randomRange } from '../helpers';
import type { TemplateTargetKind, TemplateTargetState } from '../types';

/**
 * Creates a pooled target entity and adds it to the shared scene.
 *
 * @param scene - The shell-owned Three.js scene.
 * @returns A pooled target state object ready for activation.
 */
export function createTarget(scene: Scene): TemplateTargetState {
  const material = new MeshStandardMaterial({
    color: new Color(0.82, 0.92, 1),
    emissive: new Color(0.14, 0.2, 0.32),
    roughness: 0.4,
    metalness: 0.12,
  });
  material.name = '__GAME_ID___targetMat';

  const mesh = new Mesh(new IcosahedronGeometry(0.28, 0), material);
  mesh.name = '__GAME_ID___target';
  mesh.visible = false;
  mesh.castShadow = true;
  scene.add(mesh);

  return {
    mesh,
    active: false,
    kind: 'standard',
    points: 1,
    bobPhase: 0,
    driftSpeed: 0,
    rotationSpeed: 0,
    lifetimeRemaining: 0,
  };
}

/**
 * Activates a pooled target at a new position with the correct authored values
 * for the requested kind.
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
  target.points = kind === 'bonus' ? 3 : 1;
  target.bobPhase = randomRange(0, Math.PI * 2);
  target.driftSpeed = kind === 'bonus' ? randomRange(0.52, 0.72) : randomRange(0.38, 0.56);
  target.rotationSpeed = randomRange(0.8, 1.6);
  target.lifetimeRemaining = kind === 'bonus' ? randomRange(3.5, 4.4) : randomRange(4.2, 5.8);

  target.mesh.visible = true;
  target.mesh.position.set(x, y, z);
  target.mesh.rotation.set(0, 0, 0);
  target.mesh.scale.setScalar(kind === 'bonus' ? 1.2 : 1);

  const material = target.mesh.material as MeshStandardMaterial;
  if (kind === 'bonus') {
    material.color.setRGB(1, 0.82, 0.42);
    material.emissive.setRGB(0.32, 0.18, 0.04);
  } else {
    material.color.setRGB(0.82, 0.92, 1);
    material.emissive.setRGB(0.14, 0.2, 0.32);
  }
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

  target.lifetimeRemaining -= deltaTime;
  target.mesh.position.y += target.driftSpeed * deltaTime * 0.22;
  target.mesh.position.x += Math.sin(elapsedTime * 1.6 + target.bobPhase) * deltaTime * 0.18;
  target.mesh.rotation.y += target.rotationSpeed * deltaTime;
  target.mesh.rotation.x += target.rotationSpeed * 0.45 * deltaTime;

  const material = target.mesh.material as MeshStandardMaterial;
  const pulse = 0.7 + Math.sin(elapsedTime * 3 + target.bobPhase) * 0.3;
  material.emissiveIntensity = target.kind === 'bonus' ? 1 + pulse * 0.6 : 0.7 + pulse * 0.35;
}

/**
 * Resets a target when it is returned to the entity pool.
 *
 * @param target - Target state being recycled.
 */
export function resetTarget(target: TemplateTargetState): void {
  target.active = false;
  target.kind = 'standard';
  target.points = 1;
  target.bobPhase = 0;
  target.driftSpeed = 0;
  target.rotationSpeed = 0;
  target.lifetimeRemaining = 0;
  target.mesh.visible = false;
  target.mesh.position.set(0, -10, 0);
  target.mesh.rotation.set(0, 0, 0);
  target.mesh.scale.setScalar(1);

  const material = target.mesh.material as MeshStandardMaterial;
  material.emissiveIntensity = 1;
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
