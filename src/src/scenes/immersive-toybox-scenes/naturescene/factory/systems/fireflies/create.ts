import { Scene, Vector3, Mesh, Group, SphereGeometry, PointLight, type MeshStandardMaterial } from 'three';
import { createTranslucentMaterial } from '@app/utils/materialFactory';
import { rand } from '@app/utils/randomHelpers';
import type { FireflyConfig, FireflyCreateResult, FireflyInstance } from './types';
import { startDrift, startBlink } from './animation';

/**
 * Generates a random spawn position within the nature world bounds.
 * Fireflies hover between Y 0.6 and 2.4, spread across the scene.
 * @returns A random Vector3 spawn position.
 */
function randomSpawn(): Vector3 {
  return new Vector3(rand.bipolar(10), rand.range(0.6, 2.4), rand.bipolar(8));
}

/**
 * Creates a group of fireflies with glow lights, drifting motion,
 * and pulsing emissive blink.
 *
 * Each firefly:
 * - Drifts lazily between random waypoints using GSAP
 * - Keeps a follow light parented to the mesh
 * - Pulses emissive brightness with organic timing
 *
 * @param scene - The Three.js scene to add fireflies to.
 * @param config - Firefly configuration including colors and count.
 * @returns The root group and typed per-firefly instances for interaction wiring.
 */
export function createFireflies(scene: Scene, config: FireflyConfig): FireflyCreateResult {
  const root = new Group();
  root.name = 'fireflies_root';
  scene.add(root);
  const instances: FireflyInstance[] = [];
  const killFns: (() => void)[] = [];

  for (let i = 0; i < config.count; i++) {
    const home = randomSpawn();

    const fly = new Mesh(new SphereGeometry(0.04, 6, 6), createTranslucentMaterial(`fireflyMat_${i}`, config.glowColor.clone(), 0.85));
    fly.name = `firefly_${i}`;
    fly.position.copy(home);
    const mat = fly.material as MeshStandardMaterial;
    mat.emissive = config.glowColor.clone();
    mat.emissiveIntensity = 1.0;
    root.add(fly);

    const glow = new PointLight(config.lightColor.clone(), 0.15, 2.5);
    glow.name = `fireflyGlow_${i}`;
    fly.add(glow);

    killFns.push(startDrift(fly, home));
    killFns.push(startBlink(mat, glow, config));

    instances.push({ mesh: fly, material: mat, glow, glowColor: config.glowColor.clone() });
  }

  return { root, instances, killAnimations: () => killFns.forEach((fn) => fn()) };
}
