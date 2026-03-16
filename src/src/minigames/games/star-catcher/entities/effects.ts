/**
 * Local entity-adjacent effects for the generated minigame.
 *
 * The template keeps these tiny authored effects near the entity layer because
 * they are presentation details of taps, not scoring rules.
 */

import { Color, Mesh, MeshStandardMaterial, TorusGeometry, Vector3, type Scene } from 'three';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import type { TransientPulseState } from '../types';

/**
 * Creates a short-lived pulse ring at the given world position.
 *
 * This is the miss-tap fallback effect used by the template when a player taps
 * somewhere that does not hit a valid target.
 *
 * @param scene - The shell-owned Three.js scene.
 * @param position - World-space pulse origin.
 * @param pulses - Mutable list of active transient pulses.
 */
export function createMissPulse(scene: Scene, position: Vector3, pulses: TransientPulseState[]): void {
  const material = new MeshStandardMaterial({
    color: new Color(0.8, 0.92, 1),
    emissive: new Color(0.14, 0.22, 0.32),
    transparent: true,
    opacity: 0.8,
    roughness: 0.3,
    metalness: 0.08,
  });
  material.name = 'star-catcher_missPulseMat';

  const mesh = new Mesh(new TorusGeometry(0.2, 0.03, 10, 24), material);
  mesh.name = 'star-catcher_missPulse';
  mesh.rotation.x = Math.PI / 2;
  mesh.position.copy(position);
  scene.add(mesh);

  pulses.push({
    mesh,
    age: 0,
    duration: 0.45,
  });
}

/**
 * Advances and disposes any transient miss pulses.
 *
 * @param pulses - Mutable list of active transient pulses.
 * @param deltaTime - Frame delta in seconds.
 */
export function updateTransientPulses(pulses: TransientPulseState[], deltaTime: number): void {
  for (let index = pulses.length - 1; index >= 0; index -= 1) {
    const pulse = pulses[index];
    pulse.age += deltaTime;

    const progress = Math.min(1, pulse.age / pulse.duration);
    pulse.mesh.scale.setScalar(1 + progress * 1.6);

    const material = pulse.mesh.material as MeshStandardMaterial;
    material.opacity = 0.8 * (1 - progress);

    if (progress >= 1) {
      disposeMeshDeep(pulse.mesh);
      pulses.splice(index, 1);
    }
  }
}

/**
 * Tears down any active transient pulses.
 *
 * @param pulses - Mutable list of active transient pulses.
 */
export function disposeTransientPulses(pulses: TransientPulseState[]): void {
  for (const pulse of pulses) {
    disposeMeshDeep(pulse.mesh);
  }
  pulses.length = 0;
}
