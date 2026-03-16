/**
 * Scene-owned environment configuration for Pirate Cove.
 *
 * A friendly, whimsical pirate ship deck surrounded by ocean. The lighting
 * evokes a warm afternoon sun with cool ocean reflections and a lantern accent.
 */

import { Color, Vector3 } from 'three';
import type { WorldPortalDef } from '@app/utils/worldSceneFactory';
import type { FloorTapConfig, LightingConfig } from '@app/utils/sceneHelpers';

/** Typed contract describing the scene's authored environment values. */
interface PirateCoveEnvironmentConfig {
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
 * Pirate Cove environment: deep ocean blue-teal background, warm golden key
 * light (afternoon sun), cool blue fill (ocean reflection), and a warm orange
 * lantern accent. The ground is a warm brown wooden ship deck.
 */
export const PIRATE_COVE_ENVIRONMENT: PirateCoveEnvironmentConfig = {
  clearColor: new Color(0.05, 0.15, 0.25),
  lighting: {
    keyDirection: new Vector3(-0.4, -1, 0.5),
    keyIntensity: 0.85,
    keyColor: new Color(1.0, 0.9, 0.65),
    fillIntensity: 0.4,
    fillColor: new Color(0.4, 0.6, 0.85),
    fillGroundColor: new Color(0.12, 0.1, 0.08),
    accentPosition: new Vector3(-2.0, 2.8, -1.5),
    accentIntensity: 0.28,
    accentColor: new Color(1.0, 0.7, 0.35),
  },
  floorTap: {
    owlPosition: new Vector3(0, 0.35, -0.5),
    owlBoundsMargin: 0.5,
    ceilingY: 4.8,
  },
  portals: [
    {
      gameId: 'cannonball-splash',
      position: new Vector3(4.0, 0, 1.0),
      color: new Color(0.16, 0.44, 0.66),
    },
  ],
  ground: {
    color: new Color(0.55, 0.38, 0.22),
    width: 16,
    depth: 14,
  },
};
