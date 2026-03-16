import { createDisposeCollector } from '@app/utils/sceneHelpers';
import type { RoomBuildContext, RoomContentResult } from '@app/utils/roomSceneFactory';
import { createInteractiveToybox } from '@app/toyboxes/framework';
import { createCeiling } from './room/ceiling';
import { createFloor } from './room/floor';
import { createWalls } from './room/walls';
import { createSampleCounter } from './decor/sampleCounter';
import { ROOM_TOYBOXES } from './toyboxes/manifest';

/**
 * Builds the authored contents for this room.
 *
 * Structural shell pieces live in `room/`, authored props and fixtures live in
 * `decor/`, and toybox declarations live in `toyboxes/`.
 *
 * @param context - Shared room runtime dependencies.
 * @returns Tappable floor targets and cleanup for room-local resources.
 */
export function buildRoomContents(context: RoomBuildContext): RoomContentResult {
  const { scene, canvas, camera, dispatcher, nav, owl } = context;
  const disposer = createDisposeCollector();

  createWalls(scene);
  createCeiling(scene);
  const floor = createFloor(scene);
  createSampleCounter(scene);

  ROOM_TOYBOXES.forEach((spec) => {
    const handle = createInteractiveToybox({
      scene,
      canvas,
      camera,
      dispatcher,
      owl,
      nav,
      spec,
    });
    disposer.add(handle);
  });

  return {
    floorTargets: [floor],
    cleanup: () => {
      disposer.disposeAll();
    },
  };
}
