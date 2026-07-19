import { Color, Vector3, type Scene } from 'three';
import { createInteractiveDoorway, type InteractiveDoorwayHandle } from '@app/scenes/world/places/house/shared/interactiveDoorway';
import { RIGHT_WALL_FACE_X } from '@app/scenes/world/places/house/subplaces/playroom/layout';
import type { NavigationActions } from '@app/types/scenes';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';

/** Door center position along the right wall. */
const DOOR_CENTER_Z = 0;

/**
 * Creates the Playroom's door on the right wall using the shared interactive
 * doorway builder. The door rests slightly ajar and, when tapped, creaks open
 * and leads into the Living Room.
 *
 * @param scene - The Three.js scene to add the door to.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @param nav - Navigation actions used to enter the Living Room.
 * @returns Doorway handle whose dispose unregisters the tap handler.
 */
export function createDoor(scene: Scene, dispatcher: WorldTapDispatcher, nav: NavigationActions): InteractiveDoorwayHandle {
  return createInteractiveDoorway({
    scene,
    dispatcher,
    nav,
    destination: 'living-room',
    id: 'hub_door',
    position: new Vector3(RIGHT_WALL_FACE_X, 0, DOOR_CENTER_Z),
    // Local +Z faces into the room: the right wall's interior faces +X.
    rotationY: Math.PI / 2,
    palette: {
      door: new Color(0.55, 0.38, 0.22),
      frame: new Color(0.9, 0.88, 0.85),
      panel: new Color(0.48, 0.32, 0.18),
      knob: new Color(0.75, 0.65, 0.4),
    },
    width: 2.0,
    height: 3.8,
  });
}
