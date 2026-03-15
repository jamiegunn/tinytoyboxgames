/**
 * Scene-owned environment configuration for __SCENE_DISPLAY_NAME__.
 *
 * This file is deliberately data-oriented. It owns clear color, lighting,
 * floor-tap defaults, portal placements, and ground dimensions, but it does
 * not directly create meshes. Keeping those values centralized makes scene tone
 * changes easy without turning `index.ts` into a giant literal dump.
 */

import { Color, Vector3 } from 'three';
import type { WorldPortalDef } from '@app/utils/worldSceneFactory';
import type { FloorTapConfig, LightingConfig } from '@app/utils/sceneHelpers';

/** Small typed contract describing the scene's authored environment values. */
interface ImmersiveSceneEnvironmentConfig {
  clearColor: Color;
  lighting: LightingConfig;
  floorTap: FloorTapConfig;
  portals: WorldPortalDef[];
  ground: {
    color: Color;
    width: number;
    depth: number;
  };
}

/**
 * Default environment for the generated scene.
 *
 * The template intentionally ships with exactly one Bubble Pop portal because
 * the goal is to prove the scene-to-play-mode contract, not to scaffold a full
 * minigame catalog on day one.
 */
export const IMMERSIVE_SCENE_ENVIRONMENT: ImmersiveSceneEnvironmentConfig = {
  clearColor: new Color(0.08, 0.1, 0.18),
  lighting: {
    keyDirection: new Vector3(-0.5, -1, 0.4),
    keyIntensity: 0.8,
    keyColor: new Color(0.95, 0.9, 0.8),
    fillIntensity: 0.5,
    fillColor: new Color(0.55, 0.68, 0.92),
    fillGroundColor: new Color(0.16, 0.14, 0.12),
    accentPosition: new Vector3(2.4, 3.2, -1.8),
    accentIntensity: 0.22,
    accentColor: new Color(0.7, 0.84, 1),
  },
  floorTap: {
    owlPosition: new Vector3(0, 0.35, -0.5),
    owlBoundsMargin: 0.5,
    ceilingY: 4.8,
  },
  portals: [
    {
      gameId: 'bubble-pop',
      position: new Vector3(3.1, 0, -2.35),
      color: new Color(0.66, 0.88, 1),
    },
  ],
  ground: {
    color: new Color(0.28, 0.4, 0.18),
    width: 16,
    depth: 14,
  },
};
