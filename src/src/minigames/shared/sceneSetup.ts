import { Color, DirectionalLight, HemisphereLight, PointLight, type Scene, Vector3 } from 'three';
import { createLightingRig } from '@app/utils/lighting/lightingRig';
import type { DisposalScope } from '@app/utils/disposal';

// Mini-game cameras are declared as a CameraDescriptor in the manifest and
// built by the shell — see utils/camera/cameraDescriptor.ts and
// architecture-standards.md#cameradescriptor. The old Babylon-spherical
// createGameCamera lived here and has been retired.

/** Configuration for the standard three-light mini-game rig. */
export interface GameLightingOptions {
  /** Light name prefix (e.g. 'fireflies'). */
  name: string;
  /** Directional light direction (will be normalized). Default (-1, -3, 2). */
  direction?: Vector3;
  /** Directional light intensity. Default 0.7. */
  directionalIntensity?: number;
  /** Ambient fill intensity. Default 0.5. */
  hemisphericIntensity?: number;
  /** Point light position. Default (0, 4, -1). */
  pointPosition?: Vector3;
  /** Point light intensity. Default 0.3. */
  pointIntensity?: number;
}

/** The three lights returned by createGameLighting (fill is a hemisphere — flat when sky===ground). */
export interface GameLightingRig {
  directionalLight: DirectionalLight;
  ambientLight: HemisphereLight;
  pointLight: PointLight;
}

/**
 * Creates the standard mini-game lighting by mapping the game vocabulary onto
 * the unified {@link createLightingRig} (see architecture-standards.md#lightingrig).
 * A thin adapter — the rig adds the lights to the scene and scope-owns them, so
 * the caller no longer adds or disposes them. The game's flat ambient fill is a
 * hemisphere with `sky === ground`.
 *
 * @param scene - The scene to add the lights to.
 * @param opts - Lighting configuration.
 * @param scope - Disposal scope that frees the lights (and shadow map) on teardown.
 * @returns The three light instances (already added to the scene).
 */
export function createGameLighting(scene: Scene, opts: GameLightingOptions, scope: DisposalScope): GameLightingRig {
  const white = new Color(0xffffff);
  const rig = createLightingRig(
    scene,
    {
      key: { direction: opts.direction ?? new Vector3(-1, -3, 2), intensity: opts.directionalIntensity ?? 0.7, color: white },
      fill: { skyColor: white, groundColor: white, intensity: opts.hemisphericIntensity ?? 0.5 },
      accents: [{ position: opts.pointPosition ?? new Vector3(0, 4, -1), intensity: opts.pointIntensity ?? 0.3, color: white }],
      // Preserve the mini-games' tighter shadow frustum/near for crisper local shadows.
      shadow: { near: 0.5, frustum: 5 },
    },
    scope,
  );
  return { directionalLight: rig.key, ambientLight: rig.fill, pointLight: rig.accents[0] };
}

// ── Backward-compat type alias used by game setup modules ────────────────────
/** @deprecated Use GameLightingRig instead. */
export type GameLights = GameLightingRig;
