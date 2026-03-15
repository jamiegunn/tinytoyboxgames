import type { Object3D, MeshStandardMaterial } from 'three';
import { CAUSTIC_LIGHT_COUNT } from '../types';
import type { SceneEnvironment } from './setup';
import type { CausticLight } from './scenery';

/**
 * Per-frame environment animation — caustic light movement, seaweed sway,
 * anemone tentacle waving, and shark proximity reactions.
 */

/**
 * Animates caustic emissive spheres in a circular orbit with intensity pulsing.
 * @param causticLights - Array of caustic light objects.
 * @param elapsedTime - Total elapsed game time in seconds.
 */
export function updateCausticLights(causticLights: readonly CausticLight[], elapsedTime: number): void {
  for (let i = 0; i < causticLights.length; i++) {
    const cl = causticLights[i];
    const phase = elapsedTime * 0.3 + (i * Math.PI * 2) / CAUSTIC_LIGHT_COUNT;
    cl.mesh.position.x = Math.cos(phase) * (3.5 + Math.sin(elapsedTime * 0.15 + i) * 1.5);
    cl.mesh.position.z = Math.sin(phase) * (3.5 + Math.cos(elapsedTime * 0.2 + i) * 1.5);
    const intensity = 0.15 + 0.08 * Math.sin(elapsedTime * 0.8 + i * 1.5);
    cl.intensity = intensity;
    const mat = cl.mesh.material as MeshStandardMaterial;
    if (mat && 'emissiveIntensity' in mat) {
      mat.emissiveIntensity = intensity;
    }
  }
}

/**
 * Applies organic sinusoidal sway to seaweed meshes.
 * @param seaweeds - Array of seaweed meshes.
 * @param elapsedTime - Total elapsed game time in seconds.
 */
export function updateSeaweedSway(seaweeds: readonly Object3D[], elapsedTime: number): void {
  for (let i = 0; i < seaweeds.length; i++) {
    const weed = seaweeds[i];
    // Fronds sway more than stalks
    const isStalk = weed.name.includes('seaweed_') && !weed.name.includes('frond') && !weed.name.includes('base');
    const amplitude = isStalk ? 0.06 : 0.12;
    const speed = 0.6 + (i % 3) * 0.15;
    weed.rotation.z += (Math.sin(elapsedTime * speed + i * 0.9) * amplitude - weed.rotation.z) * 0.03;
  }
}

/**
 * Animates anemone tentacles with gentle waving motion.
 * @param anemones - Array of anemone meshes (bases, tentacles, and tips).
 * @param elapsedTime - Total elapsed game time in seconds.
 */
export function updateAnemoneSway(anemones: readonly Object3D[], elapsedTime: number): void {
  for (let i = 0; i < anemones.length; i++) {
    const mesh = anemones[i];
    if (mesh.name.includes('tent_')) {
      // Tentacles wave independently
      const speed = 0.7 + (i % 5) * 0.2;
      const amplitude = 0.12 + (i % 3) * 0.04;
      mesh.rotation.z = Math.sin(elapsedTime * speed + i * 1.2) * amplitude;
      mesh.rotation.x = Math.cos(elapsedTime * speed * 0.7 + i * 0.8) * amplitude * 0.5;
    }
  }
}

/**
 * Animates environment objects in response to shark proximity.
 * Corals wobble and seaweed bends when the shark swims near.
 * @param sharkPosX - Shark X position.
 * @param sharkPosZ - Shark Z position.
 * @param env - Scene environment.
 * @param dt - Frame delta time.
 * @param elapsedTime - Total elapsed game time in seconds, used for deterministic oscillation.
 */
export function updateEnvironmentReactions(sharkPosX: number, sharkPosZ: number, env: SceneEnvironment, dt: number, elapsedTime: number): void {
  // Corals: wobble when shark is within 2.0 units
  for (const coral of env.corals) {
    const dx = coral.position.x - sharkPosX;
    const dz = coral.position.z - sharkPosZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 2.0) {
      const strength = (2.0 - dist) / 2.0;
      coral.rotation.z += Math.sin(elapsedTime * 10) * 0.003 * strength;
    } else {
      coral.rotation.z *= 0.95;
    }
  }

  // Seaweed: bend away when shark is within 2.5 units
  for (const weed of env.seaweeds) {
    const dx = weed.position.x - sharkPosX;
    const dz = weed.position.z - sharkPosZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 2.5 && dist > 0.01) {
      const bendDir = Math.atan2(dz, dx);
      const bendAmount = ((2.5 - dist) / 2.5) * 0.2;
      weed.rotation.z += (bendAmount * Math.cos(bendDir) - weed.rotation.z * 0.1) * dt * 5;
    }
  }

  // Anemones: tentacles pull in when shark is near
  for (const a of env.anemones) {
    if (!a.name.includes('tent_')) continue;
    const dx = a.position.x - sharkPosX;
    const dz = a.position.z - sharkPosZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 1.5) {
      const retract = ((1.5 - dist) / 1.5) * 0.3;
      a.scale.y = Math.max(0.3, 1.0 - retract);
    } else {
      a.scale.y += (1.0 - a.scale.y) * dt * 2;
    }
  }
}
