/**
 * Local entity-adjacent effects for the generated minigame.
 *
 * The template keeps these tiny authored effects near the entity layer because
 * they are presentation details of taps, not scoring rules.
 */

import { AdditiveBlending, Color, Mesh, MeshBasicMaterial, TorusGeometry, Vector3, type PerspectiveCamera, type Scene } from 'three';
import { getParticleEngine, SPARKLE } from '@app/utils/particles';
import type { TransientEffectRig } from '../types';

/** Ring radius and tube thickness of the shared miss-pulse geometry. */
const RING_RADIUS = 0.2;
const RING_TUBE = 0.03;

/** Opacity a miss ring starts at before fading to nothing. */
const RING_START_OPACITY = 0.85;

/** Seconds a miss ring takes to expand and fade. */
const RING_DURATION_SECONDS = 0.45;

/** Colour of the night-sky twinkle acknowledgement. */
const TWINKLE_COLORS = [new Color(1, 0.98, 0.88)];

/**
 * Creates the pooled resources behind the miss pulse.
 *
 * Defect 8: every miss used to `new TorusGeometry(...)` and
 * `new MeshStandardMaterial(...)`, add them to the scene, then dispose both
 * 0.45s later — an allocate/upload/free cycle per tap, on the one input path a
 * frustrated child hits hardest. One geometry is now built per run and the ring
 * meshes are recycled through `idle`.
 *
 * @returns A fresh effect rig owned by the caller until teardown.
 */
export function createTransientEffects(): TransientEffectRig {
  const ringGeometry = new TorusGeometry(RING_RADIUS, RING_TUBE, 10, 24);
  ringGeometry.name = 'star-catcher_missPulseGeo';

  return {
    ringGeometry,
    active: [],
    idle: [],
  };
}

// Takes a ring mesh from the idle list, or builds one. Each mesh keeps its own
// material because concurrent pulses fade independently; the geometry — the
// expensive half — is shared.
function acquireRingMesh(rig: TransientEffectRig): Mesh {
  const pooled = rig.idle.pop();
  if (pooled) return pooled;

  const material = new MeshBasicMaterial({
    color: new Color(0.82, 0.93, 1),
    transparent: true,
    opacity: RING_START_OPACITY,
    depthWrite: false,
    // Unlit and additive. The ring used to be a MeshStandardMaterial, which on a
    // night-time hilltop lit at 0.42 hemispheric was almost invisible — exactly
    // the "dead tap" this effect exists to prevent.
    blending: AdditiveBlending,
  });
  material.name = 'star-catcher_missPulseMat';

  const mesh = new Mesh(rig.ringGeometry, material);
  mesh.name = 'star-catcher_missPulse';
  // Feedback must never intercept the next tap.
  mesh.raycast = () => {};
  return mesh;
}

/**
 * Creates a short-lived pulse ring at the given world position.
 *
 * This is the miss-tap fallback effect used when a player taps somewhere that
 * is neither a star nor a piece of the night sky.
 *
 * @param scene - The shell-owned Three.js scene.
 * @param rig - Pooled effect resources for this run.
 * @param position - World-space pulse origin.
 * @param camera - The shell camera, used to orient the ring toward the viewer.
 */
export function createMissPulse(scene: Scene, rig: TransientEffectRig, position: Vector3, camera: PerspectiveCamera): void {
  const mesh = acquireRingMesh(rig);
  mesh.position.copy(position);
  // Defect 8: the ring used to be laid flat in the XZ plane (`rotation.x = π/2`)
  // and pinned to a fixed y, so from this game's 23-degree camera it was seen
  // almost edge-on — a line, not a ring. Copying the camera's orientation makes
  // it face the child.
  mesh.quaternion.copy(camera.quaternion);
  mesh.scale.setScalar(1);

  const material = mesh.material as MeshBasicMaterial;
  material.opacity = RING_START_OPACITY;

  scene.add(mesh);
  rig.active.push({
    mesh,
    age: 0,
    duration: RING_DURATION_SECONDS,
    startScale: 1,
    endScale: 2.6,
    startOpacity: RING_START_OPACITY,
  });
}

/**
 * Emits the friendly sparkle used to acknowledge a tap on the moon or on the
 * background starfield (defect 4).
 *
 * Deliberately *not* a confetti burst: confetti is the reward for catching a
 * real star and must stay distinct, so the night sky answers with a plain white
 * additive sparkle and no score.
 *
 * @param scene - The shell-owned Three.js scene.
 * @param position - World-space origin of the twinkle.
 * @param count - Number of sparkle particles to emit.
 */
export function emitTwinkle(scene: Scene, position: Vector3, count: number): void {
  getParticleEngine(scene).emit(SPARKLE, position, { colors: TWINKLE_COLORS, count });
}

/**
 * Advances active miss pulses and parks any that have finished.
 *
 * @param rig - Pooled effect resources for this run.
 * @param deltaTime - Frame delta in seconds.
 */
export function updateTransientPulses(rig: TransientEffectRig, deltaTime: number): void {
  for (let index = rig.active.length - 1; index >= 0; index -= 1) {
    const pulse = rig.active[index];
    pulse.age += deltaTime;

    const progress = Math.min(1, pulse.age / pulse.duration);
    pulse.mesh.scale.setScalar(pulse.startScale + (pulse.endScale - pulse.startScale) * progress);

    const material = pulse.mesh.material as MeshBasicMaterial;
    material.opacity = pulse.startOpacity * (1 - progress);

    if (progress >= 1) {
      pulse.mesh.removeFromParent();
      rig.idle.push(pulse.mesh);
      rig.active.splice(index, 1);
    }
  }
}

/**
 * Parks every in-flight pulse without destroying it, so a restart starts clean
 * but the pool survives.
 *
 * @param rig - Pooled effect resources for this run.
 */
export function releaseTransientPulses(rig: TransientEffectRig): void {
  for (const pulse of rig.active) {
    pulse.mesh.removeFromParent();
    rig.idle.push(pulse.mesh);
  }
  rig.active.length = 0;
}

/**
 * Permanently frees the pooled effect resources at teardown.
 *
 * @param rig - Pooled effect resources, or null when setup never ran.
 */
export function disposeTransientEffects(rig: TransientEffectRig | null): void {
  if (!rig) return;

  releaseTransientPulses(rig);
  for (const mesh of rig.idle) {
    (mesh.material as MeshBasicMaterial).dispose();
  }
  rig.idle.length = 0;
  // Disposed once, after every mesh that shares it has been released.
  rig.ringGeometry.dispose();
}
