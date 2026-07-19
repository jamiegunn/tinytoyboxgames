/**
 * The registered scene descriptors — the canonical declarative description of
 * each immersive toybox scene, in the schema from `sceneDescriptor.ts`.
 *
 * See architecture-standards.md#scenedescriptor. These reproduce the values the
 * scenes' hand-written `environment.ts` files declare today (Nature, Pirate
 * Cove), folded into the one schema: camera (§7), lighting rig (§6), ground,
 * backdrop skydome, audio, and mini-game portals. The catalog
 * (`sceneCatalog.ts`) stays the generator-owned registration surface for route
 * loading; the contract test cross-checks each descriptor's camera pose and
 * audio ids against the catalog so the two can never drift apart.
 *
 * Import-light on purpose (only `three` at runtime; every `@app/*` reference is
 * a type) so the contract test can load and validate the *actual* registry
 * behaviourally under `node --test`. The scene camera fov is 50°, matching
 * `createSceneCamera` in cameraPresets.ts.
 */

import { Color, Vector3 } from 'three';
import type { SceneId } from '@app/scenes/sceneCatalog';
import type { SceneDescriptor } from './sceneDescriptor';

/** Nature — forest-floor diorama with a migrated gradient sky backdrop. */
const NATURE: SceneDescriptor = {
  id: 'nature',
  camera: {
    kind: 'orbit',
    target: new Vector3(0, 0.3, 0),
    azimuth: Math.PI,
    polar: 1.2,
    distance: 10,
    fov: 50,
  },
  lighting: {
    key: { direction: new Vector3(-0.4, -1, 0.6), intensity: 0.7, color: new Color(0.95, 0.9, 0.7) },
    fill: { skyColor: new Color(0.6, 0.8, 0.55), groundColor: new Color(0.15, 0.12, 0.08), intensity: 0.45 },
    accents: [{ position: new Vector3(1, 2.5, -1), intensity: 0.2, color: new Color(0.6, 0.9, 0.5) }],
  },
  ground: { color: new Color(0.28, 0.4, 0.18), width: 16, depth: 14 },
  backdrop: {
    radius: 40,
    center: new Vector3(0, 0, 0),
    topColor: new Color(0.28, 0.48, 0.68),
    horizonColor: new Color(0.4, 0.6, 0.72),
    bottomColor: new Color(0.35, 0.5, 0.62),
    horizonSharpness: 1.0,
  },
  audio: { musicId: 'mus_nature_background', ambientId: 'amb_nature_stream' },
  portals: [
    { gameId: 'bubble-pop', position: new Vector3(-3, 0, -2), color: new Color(0.66, 0.88, 1) },
    { gameId: 'little-shark', position: new Vector3(3, 0, -1), color: new Color(0.1, 0.44, 0.71) },
    { gameId: 'fireflies', position: new Vector3(3.5, 0, -4), color: new Color(0.95, 0.85, 0.3) },
    { gameId: 'star-catcher', position: new Vector3(-2.2, 0, -4.8), color: new Color(0.75, 0.8, 1) },
  ],
};

/** Pirate Cove — warm-afternoon ship deck over open ocean (no skydome; the
 * ocean/clear-colour is the backdrop, so `backdrop` is intentionally omitted). */
const PIRATE_COVE: SceneDescriptor = {
  id: 'pirate-cove',
  camera: {
    kind: 'orbit',
    target: new Vector3(0, 0.3, 0),
    azimuth: Math.PI,
    polar: 1.2,
    distance: 10,
    fov: 50,
  },
  lighting: {
    key: { direction: new Vector3(-0.4, -1, 0.5), intensity: 0.85, color: new Color(1.0, 0.9, 0.65) },
    fill: { skyColor: new Color(0.4, 0.6, 0.85), groundColor: new Color(0.12, 0.1, 0.08), intensity: 0.4 },
    accents: [{ position: new Vector3(-2.0, 2.8, -1.5), intensity: 0.28, color: new Color(1.0, 0.7, 0.35) }],
  },
  ground: { color: new Color(0.55, 0.38, 0.22), width: 16, depth: 14 },
  audio: { musicId: 'mus_pirate_cove_background', ambientId: 'amb_pirate_cove_shore' },
  portals: [{ gameId: 'cannonball-splash', position: new Vector3(4.0, 0, 1.0), color: new Color(0.16, 0.44, 0.66) }],
};

/**
 * The registered descriptors, keyed by scene id. Covers the immersive toybox
 * scenes the SceneDescriptor schema governs (and whose backdrops the capstone
 * migrated). The room scenes remain on the world/room factories.
 */
export const SCENE_DESCRIPTORS: Partial<Record<SceneId, SceneDescriptor>> = {
  nature: NATURE,
  'pirate-cove': PIRATE_COVE,
};

/**
 * Looks up a registered scene descriptor.
 *
 * @param id - The scene id.
 * @returns The descriptor, or undefined when the scene has none registered.
 */
export function getSceneDescriptor(id: SceneId): SceneDescriptor | undefined {
  return SCENE_DESCRIPTORS[id];
}
