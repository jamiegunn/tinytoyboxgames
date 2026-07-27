import { Color, Vector3 } from 'three';
import type { WorldPortalDef } from '@app/utils/worldSceneFactory';
import type { FloorTapConfig, LightingConfig } from '@app/utils/sceneHelpers';
import type { SceneSkyFogConfig } from '@app/utils/skyRig';

/**
 * The Nature scene's sky gradient and the depth fog derived from it.
 *
 * These two travel together because they are one decision. The skydome is drawn
 * with `fog: false` and is opaque (see `skyRig.ts`), so whatever the renderer
 * clears to is painted over before the frame lands — a fog colour that is not
 * the skydome's own horizon colour makes distant geometry recede toward a colour
 * that is nowhere on screen. `fog.color` is therefore not written as a literal;
 * it is `sky.horizonColor`, and `tests/room/scene-sky-fog-contract.test.mjs`
 * builds the real skydome and reads the rendered horizon band back to prove it.
 *
 * The distances are camera-relative, not world-relative: three.js fogs on
 * view-space depth (`vFogDepth = -mvPosition.z`), so `near: 17` cannot be read
 * against the ground's 21.3-unit half-diagonal. It deliberately does NOT clear
 * the ground's far edge — this surface is 28x32 and its far corners stand behind
 * treeline row 0 at z = 13.5, making them backdrop. Measured over all nine
 * shipping aspects and the full camera envelope (`.probe/fog-depths.mjs`): every
 * portal <= 0.137 fogged, play centre <= 0.160, treeline row 0 at 0.288-0.802,
 * last row at 0.662-1.000. Props stay clear, the treeline recedes into the sky,
 * and the ground's own far edge hazes out instead of ending in a hard shelf.
 */
export const NATURE_SKY_FOG: SceneSkyFogConfig = {
  sky: {
    radius: 40,
    center: new Vector3(0, 0, 0),
    topColor: new Color(0.28, 0.48, 0.68),
    horizonColor: new Color(0.4, 0.6, 0.72),
    bottomColor: new Color(0.35, 0.5, 0.62),
    horizonSharpness: 1.0,
  },
  fog: { near: 17, far: 34 },
};

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
    keyIntensity: 1.15,
    keyColor: new Color(1.0, 0.94, 0.72),
    fillIntensity: 0.3,
    fillColor: new Color(0.6, 0.8, 0.55),
    fillGroundColor: new Color(0.15, 0.12, 0.08),
    accentPosition: new Vector3(1, 2.5, -1),
    accentIntensity: 0.2,
    accentColor: new Color(0.6, 0.9, 0.5),
  },
  floorTap: {
    owlPosition: new Vector3(0, 0.35, -0.5),
  },
  // Portal placement is framing-constrained, not decorative. The four portals are
  // the only things in this scene a child can tap to start a game, and at the
  // authored positions the fireflies portal projected outside the frame on every
  // phone aspect (and three of the four fell off an iPad in portrait). These
  // positions keep all four inside NDC at all nine aspects in
  // `.probe/treeline-fit.mjs`; `tests/room/scene-ground-coverage.test.mjs` holds
  // them there.
  portals: [
    { gameId: 'bubble-pop', position: new Vector3(-2.6, 0, -1.8), color: new Color(0.66, 0.88, 1) },
    { gameId: 'little-shark', position: new Vector3(2.6, 0, -1.0), color: new Color(0.1, 0.44, 0.71) },
    { gameId: 'fireflies', position: new Vector3(2.5, 0, -2.8), color: new Color(0.95, 0.85, 0.3) },
    { gameId: 'star-catcher', position: new Vector3(-2.0, 0, -3.8), color: new Color(0.75, 0.8, 1) },
  ],
  // The forest floor is sized so the camera can never see past its edge. At
  // 16x14 the bottom edge of a portrait frame landed 0.5u short of the near
  // edge, so the lowest 54 rows of a 480x854 render were sky. See
  // `.probe/ground-reach.mjs` and the ground-coverage test.
  ground: {
    color: new Color(0.28, 0.4, 0.18),
    width: 28,
    depth: 32,
  },
};
