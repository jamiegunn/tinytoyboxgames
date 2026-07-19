import { Color, Vector3 } from 'three';
import { createDisposeCollector } from '@app/utils/sceneHelpers';
import type { RoomBuildContext, RoomContentResult } from '@app/utils/roomSceneFactory';
import { createInteractiveToybox } from '@app/toyboxes/framework';
import { createInteractiveDoorway } from '@app/scenes/world/places/house/shared/interactiveDoorway';
import { createCeiling } from './room/ceiling';
import { createFloor } from './room/floor';
import { createWalls } from './room/walls';
import { createLivingRoomDecor } from './decor';
import { BACK_WALL_FACE_Z, KITCHEN_DOOR_Z, LEFT_WALL_FACE_X, OUTSIDE_DOOR_X, PLAYROOM_DOOR_Z, RIGHT_WALL_FACE_X } from './layout';
import { ROOM_TOYBOXES } from './toyboxes/manifest';

/**
 * Builds the authored contents for the Living Room.
 *
 * Structural shell pieces live in `room/`, authored props and fixtures live in
 * `decor/`, toybox declarations live in `toyboxes/`, and the three doorways
 * (Playroom, Kitchen, outside) use the shared interactive doorway builder.
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

  const decor = createLivingRoomDecor(scene, dispatcher);
  disposer.add({ dispose: decor.cleanup });

  // Doorway back to the Playroom, on the left wall (interior faces -X).
  disposer.add(
    createInteractiveDoorway({
      scene,
      dispatcher,
      nav,
      destination: 'playroom',
      id: 'livingRoom_playroomDoor',
      position: new Vector3(LEFT_WALL_FACE_X, 0, PLAYROOM_DOOR_Z),
      rotationY: -Math.PI / 2,
      palette: {
        door: new Color(0.55, 0.38, 0.22),
        frame: new Color(0.9, 0.88, 0.85),
        panel: new Color(0.48, 0.32, 0.18),
        knob: new Color(0.75, 0.65, 0.4),
      },
    }),
  );

  // Doorway into the Kitchen, on the right wall (interior faces +X).
  disposer.add(
    createInteractiveDoorway({
      scene,
      dispatcher,
      nav,
      destination: 'kitchen',
      id: 'livingRoom_kitchenDoor',
      position: new Vector3(RIGHT_WALL_FACE_X, 0, KITCHEN_DOOR_Z),
      rotationY: Math.PI / 2,
      palette: {
        door: new Color(0.62, 0.68, 0.52),
        frame: new Color(0.9, 0.88, 0.85),
        panel: new Color(0.54, 0.6, 0.44),
        knob: new Color(0.75, 0.65, 0.4),
      },
    }),
  );

  // Doorway to "outside" on the back wall. The forest IS outside for now:
  // this navigates to `nature` until a dedicated backyard scene exists.
  disposer.add(
    createInteractiveDoorway({
      scene,
      dispatcher,
      nav,
      destination: 'nature',
      id: 'livingRoom_outsideDoor',
      position: new Vector3(OUTSIDE_DOOR_X, 0, BACK_WALL_FACE_Z),
      rotationY: Math.PI,
      palette: {
        door: new Color(0.36, 0.55, 0.5),
        frame: new Color(0.88, 0.84, 0.76),
        panel: new Color(0.3, 0.47, 0.43),
        knob: new Color(0.8, 0.7, 0.45),
      },
      width: 1.7,
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
