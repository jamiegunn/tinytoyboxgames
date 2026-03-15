import { Scene, Color, Vector3, type Object3D } from 'three';
import { createGameCamera, createGameLighting } from '@app/minigames/shared/sceneSetup';
import type { GameCamera, GameLights } from '@app/minigames/shared/sceneSetup';
import { buildSkyGradient } from '@app/minigames/shared/meshBuilders';
import type { EnvironmentObjects, StarMesh } from '../types';
import { buildMoon, buildStar } from './scenery';
import type { MeshStandardMaterial } from 'three';

/**
 * Scene-level setup: camera + lighting rig and night sky assembly.
 */

/** Lighting rig returned by setupSceneLighting for teardown disposal. */
export interface SceneLightingRig {
  camera: GameCamera;
  lights: GameLights;
}

/**
 * Creates the twilight camera and lighting rig for the bubble-pop scene.
 * @param _scene - The Three.js scene.
 * @returns The camera and light objects for later disposal.
 */
export function setupSceneLighting(_scene: Scene): SceneLightingRig {
  const camera = createGameCamera({
    name: 'bubblePop',
    radius: 10.0,
    beta: 1.4,
    fov: 0.9,
    target: new Vector3(0, 2, 0),
  });

  const lights = createGameLighting({
    name: 'bubblePop',
    direction: new Vector3(0.3, -1, -0.3).normalize(),
    directionalIntensity: 0.25,
    hemisphericIntensity: 0.35,
  });

  return { camera, lights };
}

/**
 * Assembles the night sky dreamscape: twilight gradient, crescent moon,
 * and twinkling stars.
 * @param scene - The Three.js scene.
 * @returns Environment objects for per-frame update and disposal.
 */
export function buildEnvironment(scene: Scene): EnvironmentObjects {
  const meshes: Object3D[] = [];
  const stars: StarMesh[] = [];

  // Twilight sky gradient — disable raycasting so it doesn't intercept bubble taps
  const sky = buildSkyGradient(new Color(0.04, 0.06, 0.12), new Color(0.12, 0.06, 0.18), 28);
  scene.add(sky);
  sky.position.z = 10;
  sky.raycast = () => {};
  meshes.push(sky);

  // Crescent moon — disable raycasting on moon and its children
  const moon = buildMoon(scene);
  moon.position.set(4.5, 7.5, 8);
  moon.traverse((child) => {
    child.raycast = () => {};
  });
  meshes.push(moon);

  // Get the moon material from the first child
  let moonMat: MeshStandardMaterial | null = null;
  moon.traverse((child) => {
    if (child.name === 'moonFull' && (child as import('three').Mesh).material) {
      moonMat = (child as import('three').Mesh).material as MeshStandardMaterial;
    }
  });

  // Stars — disable raycasting so they don't intercept bubble taps
  for (let i = 0; i < 20; i++) {
    const star = buildStar(scene, i);
    star.mesh.position.set(-7 + Math.random() * 14, 3 + Math.random() * 8, 7 + Math.random() * 3);
    if (star.mesh.position.x > 3 && star.mesh.position.y > 6) {
      star.mesh.position.x -= 4;
    }
    star.mesh.raycast = () => {};
    meshes.push(star.mesh);
    stars.push(star);
  }

  return { meshes, stars, moon, moonMat };
}
