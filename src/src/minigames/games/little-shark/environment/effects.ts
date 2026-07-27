import type { Object3D, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { CAUSTIC_LIGHT_COUNT } from '../types';
import type { SceneEnvironment } from './setup';
import type { CausticLight } from './scenery';

/**
 * Per-frame environment animation — caustic light movement, seaweed sway,
 * anemone tentacle waving, and shark proximity reactions.
 */

/** Peak sway multiplier applied to a seaweed the child has just tapped. */
const SEAWEED_BOOST_AMPLITUDE = 4.0;

/** Sway speed multiplier applied to a boosted seaweed. */
const SEAWEED_BOOST_SPEED = 3.5;

/** Duration a seaweed tap boost lasts, mirrored from interactions.ts. */
const SEAWEED_BOOST_DURATION = 1.2;

/**
 * Animates caustic emissive spheres in an orbit around the shark, with
 * intensity pulsing.
 *
 * Defect 10: the orbit used to be centred on the world origin at radius ~3.5.
 * The shark roams ±50 units, so the child saw these for the first few seconds
 * of a session and never again. They now travel with the shark.
 *
 * @param causticLights - Array of caustic light objects.
 * @param elapsedTime - Total elapsed game time in seconds.
 * @param sharkPosX - Shark X position — the orbit centre.
 * @param sharkPosZ - Shark Z position — the orbit centre.
 */
export function updateCausticLights(causticLights: readonly CausticLight[], elapsedTime: number, sharkPosX = 0, sharkPosZ = 0): void {
  for (let i = 0; i < causticLights.length; i++) {
    const cl = causticLights[i];
    const phase = elapsedTime * 0.3 + (i * Math.PI * 2) / CAUSTIC_LIGHT_COUNT;
    cl.mesh.position.x = sharkPosX + Math.cos(phase) * (5.0 + Math.sin(elapsedTime * 0.15 + i) * 2.0);
    cl.mesh.position.z = sharkPosZ + Math.sin(phase) * (5.0 + Math.cos(elapsedTime * 0.2 + i) * 2.0);
    // Pulse around the build-time opacity of CAUSTIC_SPHERE_ALPHA set in
    // buildCausticLights (environment/scenery.ts); the ±0.05 swing is a visible
    // shimmer without pushing the peak past the overlay budget documented there.
    //
    // This used to drive emissiveIntensity, which the spheres no longer have —
    // they are MeshBasicMaterial now, so opacity is the only channel that
    // changes how much of the frame they cover.
    const intensity = 0.12 + 0.05 * Math.sin(elapsedTime * 0.8 + i * 1.5);
    cl.intensity = intensity;
    const mat = cl.mesh.material as MeshBasicMaterial;
    if (mat) mat.opacity = intensity;
  }
}

/**
 * Turns the god-ray planes to face the camera.
 *
 * Defect 10: the rays were vertical planes given a fixed random Y rotation at
 * build time. Edge-on to the camera they vanished entirely, which is most of
 * the time now that the follow camera actually swings around (see defect 2).
 *
 * @param waterSurface - The water parent group that owns the ray planes.
 * @param camera - The active camera the rays should face.
 */
export function updateGodRays(waterSurface: Object3D, camera: PerspectiveCamera): void {
  for (const child of waterSurface.children) {
    if (!child.name.startsWith('lightRay_')) continue;
    // Billboard about Y only — the rays must stay vertical, they are shafts of
    // light from the surface, not free-floating sprites.
    const dx = camera.position.x - (waterSurface.position.x + child.position.x);
    const dz = camera.position.z - (waterSurface.position.z + child.position.z);
    child.rotation.y = Math.atan2(dx, dz);
  }
}

/**
 * Applies organic sinusoidal sway to seaweed meshes.
 *
 * Defect 4: `boosts` is the map that `InteractionState.update` has always
 * returned and that the game loop used to throw away at the call site, so
 * tapping seaweed made a sound and nothing else. Boosted plants now thrash.
 *
 * @param seaweeds - Array of seaweed meshes.
 * @param elapsedTime - Total elapsed game time in seconds.
 * @param boosts - Map of tapped seaweed roots to remaining boost seconds.
 */
export function updateSeaweedSway(seaweeds: readonly Object3D[], elapsedTime: number, boosts?: ReadonlyMap<Object3D, number>): void {
  for (let i = 0; i < seaweeds.length; i++) {
    const weed = seaweeds[i];
    // Fronds sway more than stalks
    const isStalk = weed.name.includes('seaweed_') && !weed.name.includes('frond') && !weed.name.includes('base');
    let amplitude = isStalk ? 0.06 : 0.12;
    let speed = 0.6 + (i % 3) * 0.15;
    // Boost decays with its timer so the plant settles rather than snapping back
    const remaining = boosts?.get(weed) ?? 0;
    if (remaining > 0) {
      const strength = Math.min(1, remaining / SEAWEED_BOOST_DURATION);
      amplitude *= 1 + (SEAWEED_BOOST_AMPLITUDE - 1) * strength;
      speed *= 1 + (SEAWEED_BOOST_SPEED - 1) * strength;
    }
    weed.rotation.z += (Math.sin(elapsedTime * speed + i * 0.9) * amplitude - weed.rotation.z) * (remaining > 0 ? 0.25 : 0.03);
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
      // Defect 10: this was `+= sin(t * 10) * 0.003 * strength`. Accumulating a
      // term that alternates sign every ~0.3s cancels itself out, and 0.003 rad
      // is 0.17 degrees regardless. Assign an absolute angle at an amplitude a
      // child can actually see (0.16 rad ~ 9 degrees) at a slower beat.
      coral.rotation.z = Math.sin(elapsedTime * 8) * 0.16 * strength;
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
