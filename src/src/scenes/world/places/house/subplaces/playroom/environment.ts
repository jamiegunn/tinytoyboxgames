import { Color, Vector3 } from 'three';
import type { RoomEnvironmentConfig } from '@app/utils/roomSceneFactory';
import { BACK_WALL_FACE_Z, CEILING_Y, LEFT_WALL_FACE_X, RIGHT_WALL_FACE_X } from './layout';

/**
 * Centralized Playroom environment configuration.
 */
export const PLAYROOM_ENVIRONMENT: RoomEnvironmentConfig = {
  clearColor: new Color(0.12, 0.15, 0.22),
  lighting: {
    keyDirection: new Vector3(-0.5, -0.8, 0.3),
    keyIntensity: 1.0,
    keyColor: new Color(1.0, 0.92, 0.75),
    fillIntensity: 0.55,
    fillColor: new Color(0.9, 0.92, 1.0),
    accentPosition: new Vector3(0, 4, -5),
    accentIntensity: 0.3,
    accentColor: new Color(1.0, 0.95, 0.85),
    extraPointLights: [
      {
        position: new Vector3(-4, 2, 7),
        intensity: 0.2,
        color: new Color(1.0, 0.95, 0.8),
        distance: 8,
      },
    ],
  },
  floorTap: {
    owlPosition: new Vector3(0, 0.35, 1.5),
    flightBounds: {
      minX: RIGHT_WALL_FACE_X + 0.5,
      maxX: LEFT_WALL_FACE_X - 0.5,
      minZ: -10,
      maxZ: BACK_WALL_FACE_Z - 0.5,
      minY: 0.3,
      maxY: CEILING_Y - 1.0,
    },
    ceilingY: CEILING_Y,
    firstTapSoundId: 'sfx_shared_sparkle_burst',
    repeatTapSoundId: 'sfx_shared_tap_fallback',
  },
};
