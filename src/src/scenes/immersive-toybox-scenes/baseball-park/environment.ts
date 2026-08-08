/**
 * Scene-owned environment configuration for Baseball Park.
 *
 * This file is deliberately data-oriented. It owns clear color, lighting,
 * floor-tap defaults, portal placements, and ground dimensions, but it does
 * not directly create meshes. Keeping those values centralized makes scene tone
 * changes easy without turning `index.ts` into a giant literal dump.
 *
 * AXES, from the camera's point of view (measured, not assumed — see
 * `tests/framework/sceneAxes.test.mjs`):
 *
 *     +X  ->  screen LEFT      (not right)
 *     +Y  ->  screen UP
 *     +Z  ->  AWAY from the camera, deeper into the scene
 *
 * The eye sits on x = 0 looking toward +Z, so more-negative Z is nearer the
 * child, and two props near x = 0 at different depths are stacked along the
 * same view ray — the pitcher's mound in front of second base is deliberate
 * (that is what a ballpark looks like from behind home plate); anything
 * TAPPABLE stays off the centreline.
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
 * Environment for the Baseball Park: a sunny afternoon in a toybox.
 *
 * The key light is warm and high like an afternoon sun, the fill is sky blue,
 * and the clear colour matches the sky backdrop so whatever peeks past the
 * shell reads as more sky rather than as void. One Bubble Pop portal proves
 * the scene-to-play-mode contract, placed on the near-left grass where it is
 * clear of the infield diamond, the tee, and the loose balls.
 */
export const IMMERSIVE_SCENE_ENVIRONMENT: ImmersiveSceneEnvironmentConfig = {
  clearColor: new Color(0.5, 0.72, 0.9),
  lighting: {
    keyDirection: new Vector3(-0.45, -1, 0.35),
    keyIntensity: 1.1,
    keyColor: new Color(1.0, 0.95, 0.8),
    fillIntensity: 0.45,
    fillColor: new Color(0.6, 0.75, 0.95),
    fillGroundColor: new Color(0.2, 0.28, 0.14),
    accentPosition: new Vector3(2.4, 3.2, -1.8),
    accentIntensity: 0.2,
    accentColor: new Color(1.0, 0.9, 0.7),
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
    color: new Color(0.3, 0.45, 0.2),
    width: 16,
    depth: 14,
  },
};
