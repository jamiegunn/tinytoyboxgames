import { Scene, Color, DirectionalLight, AmbientLight, PointLight } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createSceneCamera, type CameraHandle } from '@app/utils/cameraPresets';
import { configureShadows } from '@app/utils/sceneHelpers';
import { createRoom } from './room';

/**
 * Creates the playroom landing scene. Sets up the rendering pipeline (camera, lighting,
 * shadows) then delegates all room contents and interactions to createRoom.
 *
 * @param scene - The Three.js scene (provided by SceneFrame).
 * @param canvas - The canvas element for camera controls and raycasting.
 * @param nav - Navigation actions for transitioning to world scenes.
 * @returns Camera handle and dispose function for lifecycle management.
 */
export function createScene(scene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions): { cameraHandle: CameraHandle; dispose: () => void } {
  scene.background = new Color(0.12, 0.15, 0.22);

  // ── Camera ──
  const cameraHandle = createSceneCamera(canvas, 'playroom');

  // ── Lighting — warm afternoon sunlight ──
  const keyLight = new DirectionalLight(new Color(1.0, 0.92, 0.75), 1.0);
  keyLight.position.set(5, 8, -3); // Position opposite to light direction
  keyLight.target.position.set(0, 0, 0);
  scene.add(keyLight);
  scene.add(keyLight.target);
  configureShadows(keyLight);

  const fillLight = new AmbientLight(new Color(0.9, 0.92, 1.0), 0.55);
  scene.add(fillLight);

  const rimLight = new PointLight(new Color(1.0, 0.95, 0.85), 0.3);
  rimLight.position.set(0, 4, -5);
  scene.add(rimLight);

  const bounceLight = new PointLight(new Color(1.0, 0.95, 0.8), 0.2);
  bounceLight.position.set(-4, 2, 7);
  bounceLight.distance = 8;
  scene.add(bounceLight);

  // ── Room contents (structure, furnishings, toyboxes, owl, interactions) ──
  const roomCleanup = createRoom(scene, canvas, cameraHandle.camera, keyLight, nav);

  const dispose = () => {
    roomCleanup();
    cameraHandle.dispose();
  };

  return { cameraHandle, dispose };
}
