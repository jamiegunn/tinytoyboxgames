import { type Scene } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createRoomScene } from '@app/utils/roomSceneFactory';
import { PLAYROOM_ENVIRONMENT } from './environment';
import { buildPlayroomContents } from './room';

/**
 * Creates the Playroom landing scene by delegating shared lifecycle ownership
 * to `createRoomScene` and authored room composition to `buildPlayroomContents`.
 *
 * This keeps Playroom aligned with the room-template direction: the room root
 * is now a thin orchestration boundary instead of a bespoke pile of camera,
 * lighting, owl, and interaction setup.
 *
 * @param scene - The Three.js scene provided by `SceneFrame`.
 * @param canvas - Canvas element used for camera controls and raycasting.
 * @param nav - Navigation actions for scene transitions.
 * @returns Camera and dispose handles for the Playroom scene.
 */
export function createScene(scene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions) {
  const result = createRoomScene(scene, canvas, nav, {
    sceneId: 'playroom',
    clearColor: PLAYROOM_ENVIRONMENT.clearColor,
    lighting: PLAYROOM_ENVIRONMENT.lighting,
    floorTap: PLAYROOM_ENVIRONMENT.floorTap,
    enableLegacyClickScan: true,
    buildContents: buildPlayroomContents,
  });

  return {
    cameraHandle: result.cameraHandle,
    dispose: result.dispose,
  };
}
