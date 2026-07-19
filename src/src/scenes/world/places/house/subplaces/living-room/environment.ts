import { Color, Vector3 } from 'three';
import type { RoomEnvironmentConfig } from '@app/utils/roomSceneFactory';
import { BACK_WALL_FACE_Z, CEILING_Y, FIREPLACE_X, FLOOR_LAMP_X, FLOOR_LAMP_Z, LEFT_WALL_FACE_X, RIGHT_WALL_FACE_X } from './layout';

/**
 * Centralized environment config for the Living Room.
 *
 * The lighting leans warmer than the other rooms: the fireplace and floor lamp
 * each get an authored point light so the hearth reads as the room's glow
 * source. Decor never adds its own lights — glow placement lives here.
 */
export const ROOM_ENVIRONMENT: RoomEnvironmentConfig = {
  clearColor: new Color(0.16, 0.12, 0.1),
  lighting: {
    keyDirection: new Vector3(-0.45, -0.82, 0.35),
    keyIntensity: 1.35,
    keyColor: new Color(1.0, 0.88, 0.66),
    fillIntensity: 0.28,
    fillColor: new Color(0.95, 0.9, 0.88),
    accentPosition: new Vector3(-2.5, 3.5, -4.5),
    accentIntensity: 0.22,
    accentColor: new Color(1.0, 0.86, 0.68),
    extraPointLights: [
      {
        // Fireplace glow, just in front of the hearth opening.
        position: new Vector3(FIREPLACE_X, 1.3, BACK_WALL_FACE_Z - 1.0),
        intensity: 0.55,
        color: new Color(1.0, 0.62, 0.3),
        distance: 8,
      },
      {
        // Floor-lamp pool of light beside the couch.
        position: new Vector3(FLOOR_LAMP_X, 2.4, FLOOR_LAMP_Z),
        intensity: 0.28,
        color: new Color(1.0, 0.88, 0.62),
        distance: 6,
      },
    ],
  },
  floorTap: {
    owlPosition: new Vector3(0, 0.35, 1.2),
    flightBounds: {
      minX: RIGHT_WALL_FACE_X + 0.45,
      maxX: LEFT_WALL_FACE_X - 0.45,
      minZ: -8.5,
      maxZ: BACK_WALL_FACE_Z - 0.45,
      minY: 0.3,
      maxY: CEILING_Y - 1.0,
    },
    ceilingY: CEILING_Y,
    firstTapSoundId: 'sfx_shared_sparkle_burst',
    repeatTapSoundId: 'sfx_shared_tap_fallback',
  },
};
