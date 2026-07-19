import { Color, Vector3 } from 'three';
import { createDisposeCollector } from '@app/utils/sceneHelpers';
import type { RoomBuildContext, RoomContentResult } from '@app/utils/roomSceneFactory';
import { createInteractiveToybox } from '@app/toyboxes/framework';
import { createInteractiveDoorway } from '@app/scenes/world/places/house/shared/interactiveDoorway';
import { createCeiling } from './room/ceiling';
import { createFloor } from './room/floor';
import { createWalls } from './room/walls';
import { createKitchenDecor } from './decor';
import { createSampleCounter } from './decor/sampleCounter';
import { LEFT_WALL_FACE_X, LIVING_ROOM_DOOR_Z } from './layout';
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

  const decor = createKitchenDecor(scene, dispatcher);
  disposer.add({ dispose: decor.cleanup });

  // Doorway back to the Living Room, on the left wall (interior faces -X).
  disposer.add(
    createInteractiveDoorway({
      scene,
      dispatcher,
      nav,
      destination: 'living-room',
      id: 'kitchen_livingRoomDoor',
      position: new Vector3(LEFT_WALL_FACE_X, 0, LIVING_ROOM_DOOR_Z),
      rotationY: -Math.PI / 2,
      palette: {
        door: new Color(0.62, 0.68, 0.52),
        frame: new Color(0.9, 0.88, 0.85),
        panel: new Color(0.54, 0.6, 0.44),
        knob: new Color(0.75, 0.65, 0.4),
      },
    }),
  );

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
    floorTargets: [floor, decor.rug],
    cleanup: () => {
      disposer.disposeAll();
    },
  };
}
