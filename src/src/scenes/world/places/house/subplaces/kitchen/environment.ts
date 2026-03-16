import { Color, Vector3 } from 'three';
import type { RoomEnvironmentConfig } from '@app/utils/roomSceneFactory';
import { BACK_WALL_FACE_Z, CEILING_Y, LEFT_WALL_FACE_X, RIGHT_WALL_FACE_X } from './layout';

/**
 * Centralized environment config for the generated room.
 */
export const ROOM_ENVIRONMENT: RoomEnvironmentConfig = {
  clearColor: new Color(0.18, 0.16, 0.15),
  lighting: {
    keyDirection: new Vector3(-0.45, -0.82, 0.35),
    keyIntensity: 0.95,
    keyColor: new Color(1.0, 0.93, 0.82),
    fillIntensity: 0.5,
    fillColor: new Color(0.92, 0.92, 0.96),
    accentPosition: new Vector3(-2.5, 3.5, -4.5),
    accentIntensity: 0.22,
    accentColor: new Color(1.0, 0.88, 0.72),
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
