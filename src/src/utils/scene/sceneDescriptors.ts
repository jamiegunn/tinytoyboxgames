/**
 * The registered scene descriptors — the canonical declarative description of
 * each immersive toybox scene, in the schema from `sceneDescriptor.ts`.
 *
 * See architecture-standards.md#scenedescriptor. The catalog (`sceneCatalog.ts`)
 * stays the generator-owned registration surface for route loading; the contract
 * test cross-checks each descriptor's camera pose and audio ids against the
 * catalog so the two can never drift apart.
 *
 * WHY THE LIGHTING, GROUND, BACKDROP AND PORTALS ARE READ, NOT WRITTEN
 * -------------------------------------------------------------------
 * This file used to reproduce those values as literals, "folded into the one
 * schema" — a second, hand-copied statement of numbers the scenes already
 * declare. Nothing checked that half. The contract test parses `sceneCatalog.ts`
 * and can therefore only cross-check what the catalog holds, which is the camera
 * pose and the audio ids. So the guarded third stayed true and the unguarded
 * two-thirds rotted, in BOTH registered scenes, silently:
 *
 *   pirate-cove  ground 16x14      the hull is 10x24 (it was re-solved; this
 *                                  file kept the retired dimensions)
 *                portal (4.0,0,1)  the real portal is at (0,0,-1.5) — and 4.0
 *                                  is 0.7 units outboard of the rail at that
 *                                  station, i.e. floating over the sea
 *                key 0.85/fill 0.4 the scene lights at 1.3 and 0.26
 *                "no skydome"      `index.ts` builds one from
 *                                  `PIRATE_COVE_SKY_FOG.sky`, radius 60
 *   nature       ground 16x14      the forest floor is 28x32 (widened so the
 *                                  camera cannot see past its near edge)
 *                all four portals  every one of them was moved to keep it in
 *                                  frame on phone aspects; none moved here
 *                key 0.7/fill 0.45 the scene lights at 1.15 and 0.3
 *
 * Not one of those was a decision made here. Each was a copy that stopped
 * tracking its original, and a copy nothing reads is worse than no copy at all,
 * because it looks like documentation. Importing the scenes' own configs makes
 * the agreement true by construction instead of by diligence. The camera and
 * audio stay literal ONLY because a test already proves them against the
 * catalog; duplication that is checked is a different thing from duplication
 * that is hoped for.
 *
 * The lighting shape genuinely differs — scenes declare a flat `LightingConfig`
 * (`keyDirection`, `keyIntensity`, ...) and the descriptor schema nests it as
 * key/fill/accents — so {@link fromLightingConfig} adapts it. That is a real
 * transformation, which is exactly why it belongs in code rather than in a
 * person's hands.
 *
 * Still import-light at runtime: `three`, plus the two scene `environment.ts`
 * modules, which themselves import nothing but `three` (everything else in them
 * is `import type`). No cycle is possible — nothing under `scenes/` imports this
 * registry. The scene camera fov is 50°, matching `createSceneCamera` in
 * cameraPresets.ts.
 */

import { Vector3 } from 'three';
import type { SceneId } from '@app/scenes/sceneCatalog';
import type { LightingConfig } from '@app/utils/sceneHelpers';
import type { LightingDescriptor } from '@app/utils/lighting';
import { NATURE_ENVIRONMENT, NATURE_SKY_FOG } from '@app/scenes/immersive-toybox-scenes/naturescene/environment';
import { PIRATE_COVE_ENVIRONMENT, PIRATE_COVE_SKY_FOG } from '@app/scenes/immersive-toybox-scenes/pirate-cove/environment';
import type { SceneDescriptor } from './sceneDescriptor';

/**
 * Adapts a scene's flat {@link LightingConfig} to the descriptor schema's nested
 * key/fill/accents rig. The two shapes hold the same rig; only the nesting and
 * the optionality differ.
 *
 * Two fields are optional on the scene side and required (or absent) on the
 * descriptor side, so the adapter has to state a rule rather than copy a value:
 * a config with no `fillGroundColor` is asking for a FLAT ambient fill, which
 * `lightingRig.ts` spells `skyColor === groundColor`; and a config with no
 * `accentPosition` wants no accent at all, so the array is omitted rather than
 * filled with a light at the origin.
 *
 * @param c - The scene-owned lighting config.
 * @returns The same rig in the descriptor schema's shape.
 */
function fromLightingConfig(c: LightingConfig): LightingDescriptor {
  const accent =
    c.accentPosition !== undefined ? [{ position: c.accentPosition, intensity: c.accentIntensity ?? 0, color: c.accentColor ?? c.fillColor }] : undefined;
  return {
    key: { direction: c.keyDirection, intensity: c.keyIntensity, color: c.keyColor },
    fill: { skyColor: c.fillColor, groundColor: c.fillGroundColor ?? c.fillColor, intensity: c.fillIntensity },
    ...(accent ? { accents: accent } : {}),
  };
}

/** Nature — forest-floor diorama with a gradient sky backdrop. */
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
  lighting: fromLightingConfig(NATURE_ENVIRONMENT.lighting),
  ground: NATURE_ENVIRONMENT.ground,
  backdrop: NATURE_SKY_FOG.sky,
  audio: { musicId: 'mus_nature_background', ambientId: 'amb_nature_stream' },
  portals: NATURE_ENVIRONMENT.portals,
};

/**
 * Pirate Cove — warm-afternoon ship deck over open ocean.
 *
 * The camera pose here is the one the catalog ships, and it is not a neutral
 * choice: polar 1.25 at distance 12 targeting y 1.5 stands the eye ON the deck
 * at (0, 5.284, -11.388), 0.6 units forward of the transom, so the gunwales run
 * past the viewer and converge on a stem 24 units away. See the preset's own
 * comment in `sceneCatalog.ts` for the measured rail angles.
 */
const PIRATE_COVE: SceneDescriptor = {
  id: 'pirate-cove',
  camera: {
    kind: 'orbit',
    target: new Vector3(0, 1.5, 0),
    azimuth: Math.PI,
    polar: 1.25,
    distance: 12,
    fov: 50,
  },
  lighting: fromLightingConfig(PIRATE_COVE_ENVIRONMENT.lighting),
  ground: PIRATE_COVE_ENVIRONMENT.ground,
  backdrop: PIRATE_COVE_SKY_FOG.sky,
  audio: { musicId: 'mus_pirate_cove_background', ambientId: 'amb_pirate_cove_shore' },
  portals: PIRATE_COVE_ENVIRONMENT.portals,
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
