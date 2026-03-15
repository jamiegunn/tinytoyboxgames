import { Color, Vector3 } from 'three';
import type { WorldPortalDef } from '@app/utils/worldSceneFactory';
import type { FloorTapConfig, LightingConfig } from '@app/utils/sceneHelpers';

interface NatureEnvironmentConfig {
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

export const NATURE_ENVIRONMENT: NatureEnvironmentConfig = {
  clearColor: new Color(0.04, 0.08, 0.04),
  lighting: {
    keyDirection: new Vector3(-0.4, -1, 0.6),
    keyIntensity: 0.7,
    keyColor: new Color(0.95, 0.9, 0.7),
    fillIntensity: 0.45,
    fillColor: new Color(0.6, 0.8, 0.55),
    fillGroundColor: new Color(0.15, 0.12, 0.08),
    accentPosition: new Vector3(1, 2.5, -1),
    accentIntensity: 0.2,
    accentColor: new Color(0.6, 0.9, 0.5),
  },
  floorTap: {
    owlPosition: new Vector3(0, 0.35, -0.5),
  },
  portals: [
    { gameId: 'bubble-pop', position: new Vector3(-3, 0, -2), color: new Color(0.66, 0.88, 1) },
    { gameId: 'little-shark', position: new Vector3(3, 0, -1), color: new Color(0.1, 0.44, 0.71) },
    { gameId: 'fireflies', position: new Vector3(3.5, 0, -4), color: new Color(0.95, 0.85, 0.3) },
  ],
  ground: {
    color: new Color(0.28, 0.4, 0.18),
    width: 16,
    depth: 14,
  },
};
