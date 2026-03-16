import { type Scene } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createRoomScene } from '@app/utils/roomSceneFactory';
import { ROOM_ENVIRONMENT } from './environment';
import { buildRoomContents } from './room';

/**
 * Creates the `Kitchen` room scene.
 *
 * Binds this room's environment and content builder into the shared room
 * runtime. See `environment.ts` for lighting and camera config, and `room.ts`
 * for authored content composition.
 *
 * @param scene - The Three.js scene provided by `SceneFrame`.
 * @param canvas - Canvas element used for camera controls and tap dispatch.
 * @param nav - Navigation actions for scene transitions.
 * @returns Camera and disposal handles for the generated room.
 */
export function createScene(scene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions) {
  const result = createRoomScene(scene, canvas, nav, {
    sceneId: 'kitchen',
    clearColor: ROOM_ENVIRONMENT.clearColor,
    lighting: ROOM_ENVIRONMENT.lighting,
    floorTap: ROOM_ENVIRONMENT.floorTap,
    buildContents: buildRoomContents,
  });

  return {
    cameraHandle: result.cameraHandle,
    dispose: result.dispose,
  };
}
