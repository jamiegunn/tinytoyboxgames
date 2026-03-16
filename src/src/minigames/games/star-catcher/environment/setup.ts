/**
 * Environment setup for the generated Star Catcher minigame.
 *
 * This file owns the static authored scene shell: camera pose, lights, floor,
 * backdrop, and a tiny amount of non-gameplay ambience. The game loop can call
 * back into `updateTemplateEnvironment` for gentle visual motion, but actual
 * scoring and spawn behavior belong elsewhere.
 */

import { BoxGeometry, Color, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, Vector3 } from 'three';
import { createGameCamera, createGameLighting, disposeGameRig } from '@app/minigames/shared/sceneSetup';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import type { TemplateEnvironmentRig } from '../types';

/**
 * Copies the authored game camera onto the shell-owned camera so rendering and
 * raycasting use the same viewpoint.
 *
 * @param source - Authored camera built by the minigame.
 * @param target - Shell-owned camera provided through context.
 */
function copyCameraPose(source: PerspectiveCamera, target: PerspectiveCamera): void {
  target.position.copy(source.position);
  target.rotation.copy(source.rotation);
  target.fov = source.fov;
  target.near = source.near;
  target.far = source.far;
  target.updateProjectionMatrix();
}

/**
 * Creates the default environment used by the generated minigame template.
 *
 * @param scene - The shell-owned Three.js scene.
 * @param shellCamera - The shell-owned camera that actually renders the game.
 * @returns The authored environment rig for later update and teardown.
 */
export function setupTemplateEnvironment(scene: Scene, shellCamera: PerspectiveCamera): TemplateEnvironmentRig {
  const authoredCamera = createGameCamera(
    {
      name: 'star-catcher',
      beta: 1.16,
      radius: 7.4,
      target: new Vector3(0, 0.65, 0),
      fov: 0.9,
    },
    shellCamera.aspect,
  );
  copyCameraPose(authoredCamera, shellCamera);

  const lights = createGameLighting({
    name: 'star-catcher',
    direction: new Vector3(-0.6, -1, 0.5),
    directionalIntensity: 0.85,
    hemisphericIntensity: 0.48,
    pointPosition: new Vector3(0, 3.2, 1.4),
    pointIntensity: 0.28,
  });
  scene.add(lights.directionalLight);
  scene.add(lights.ambientLight);
  scene.add(lights.pointLight);

  const floorMaterial = new MeshStandardMaterial({
    color: new Color(0.22, 0.33, 0.56),
    emissive: new Color(0.02, 0.04, 0.08),
    roughness: 0.9,
    metalness: 0.02,
  });
  floorMaterial.name = 'star-catcher_floorMat';
  const floor = new Mesh(new PlaneGeometry(10.5, 8.5), floorMaterial);
  floor.name = 'star-catcher_floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  const backdropMaterial = new MeshStandardMaterial({
    color: new Color(0.08, 0.12, 0.24),
    emissive: new Color(0.03, 0.05, 0.12),
    roughness: 0.82,
    metalness: 0.03,
  });
  backdropMaterial.name = 'star-catcher_backdropMat';
  const backdrop = new Mesh(new PlaneGeometry(11.5, 5.8), backdropMaterial);
  backdrop.name = 'star-catcher_backdrop';
  backdrop.position.set(0, 2.15, -3.2);
  scene.add(backdrop);

  const leftAccentMaterial = new MeshStandardMaterial({
    color: new Color(0.45, 0.61, 0.88),
    emissive: new Color(0.06, 0.1, 0.16),
    roughness: 0.55,
    metalness: 0.08,
  });
  leftAccentMaterial.name = 'star-catcher_leftAccentMat';
  const leftAccent = new Mesh(new BoxGeometry(0.45, 1.5, 0.45), leftAccentMaterial);
  leftAccent.name = 'star-catcher_leftAccent';
  leftAccent.position.set(-3.2, 0.75, -2.7);
  leftAccent.castShadow = true;
  leftAccent.receiveShadow = true;
  scene.add(leftAccent);

  const rightAccentMaterial = new MeshStandardMaterial({
    color: new Color(0.9, 0.74, 0.4),
    emissive: new Color(0.12, 0.08, 0.02),
    roughness: 0.58,
    metalness: 0.06,
  });
  rightAccentMaterial.name = 'star-catcher_rightAccentMat';
  const rightAccent = new Mesh(new BoxGeometry(0.35, 1.15, 0.35), rightAccentMaterial);
  rightAccent.name = 'star-catcher_rightAccent';
  rightAccent.position.set(3.05, 0.58, -2.45);
  rightAccent.castShadow = true;
  rightAccent.receiveShadow = true;
  scene.add(rightAccent);

  return {
    authoredCamera,
    lights,
    floor,
    backdrop,
    accents: [leftAccent, rightAccent],
  };
}

/**
 * Applies small authored-only animation to the environment.
 *
 * This is intentionally subtle. The environment should feel alive without
 * competing with gameplay state or making the game hard to read.
 *
 * @param rig - The authored environment returned from setup.
 * @param elapsedTime - Seconds since the current run started.
 */
export function updateTemplateEnvironment(rig: TemplateEnvironmentRig, elapsedTime: number): void {
  rig.backdrop.rotation.y = Math.sin(elapsedTime * 0.12) * 0.03;

  for (let index = 0; index < rig.accents.length; index += 1) {
    const accent = rig.accents[index];
    accent.rotation.y = Math.sin(elapsedTime * 0.6 + index) * 0.12;
    accent.position.y = (index === 0 ? 0.75 : 0.58) + Math.sin(elapsedTime * 1.2 + index * 0.7) * 0.04;
  }
}

/**
 * Tears down the authored environment and detaches all environment-owned
 * resources from the scene.
 *
 * @param rig - Environment created during setup.
 */
export function teardownTemplateEnvironment(rig: TemplateEnvironmentRig | null): void {
  if (!rig) return;

  for (const accent of rig.accents) {
    disposeMeshDeep(accent);
  }
  disposeMeshDeep(rig.floor);
  disposeMeshDeep(rig.backdrop);
  disposeGameRig(rig.authoredCamera, rig.lights);
}
