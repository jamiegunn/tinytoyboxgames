/**
 * Entity construction for the generated Star Catcher minigame.
 *
 * The template uses one small tappable target family because it is the
 * simplest way to produce a playable baseline. The target visuals are still
 * kept in their own module so future games can replace or expand them without
 * turning `index.ts` into a geometry file.
 */

import { Color, ExtrudeGeometry, Mesh, MeshStandardMaterial, Scene, Shape } from 'three';
import { randomRange } from '../helpers';
import type { TemplateTargetKind, TemplateTargetState } from '../types';

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
  // Twirl in the view plane (Z) so the star face never turns edge-on.
  target.mesh.rotation.z += target.rotationSpeed * deltaTime;

  const material = target.mesh.material as MeshStandardMaterial;
  const pulse = 0.5 + (Math.sin(elapsedTime * 3 + target.bobPhase) * 0.5 + 0.5) * 0.5;
  material.emissiveIntensity = target.kind === 'bonus' ? 2.0 + pulse : 1.4 + pulse;
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
