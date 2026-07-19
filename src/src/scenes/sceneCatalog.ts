/**
 * Central scene catalog for every camera-enterable destination in the app.
 *
 * This file is intentionally the single registration surface for scene-level
 * metadata that the runtime needs before it can lazy-load scene code:
 *
 * - route validation
 * - lazy scene loading
 * - default scene fallback
 * - camera presets
 * - scene-level audio lookup
 *
 * The immersive scene generator updates this file directly so new scenes do not
 * require hand-edits across multiple disconnected maps.
 */

/** Camera preset data stored as plain values so the catalog stays serializable. */
export interface SceneCameraPresetDefinition {
  /**
   * Azimuth θ, radians, in the native three.js `Spherical` convention
   * (θ=0 → +Z, θ=π → −Z) — the same convention as CameraDescriptor. `π` is the
   * −Z front view these scenes use. See architecture-standards.md#cameradescriptor.
   */
  azimuth: number;
  /** Polar angle in radians from the camera target. */
  polar: number;
  /** Distance between the camera and the target point. */
  distance: number;
  /** Look-at target stored as an XYZ tuple. */
  target: readonly [number, number, number];
  /** Optional camera-control clamps for scenes that need tighter framing. */
  constraints?: {
    maxAzimuthRange?: number;
    minPolar?: number;
    maxPolar?: number;
    minDistance?: number;
    maxDistance?: number;
    panRangeX?: number;
    minTargetY?: number;
    maxTargetY?: number;
    ceilingY?: number;
  };
}

/**
 * Returns the mini-game ids that a scene is allowed to launch.
 *
 * @param sceneId - Registered scene identifier.
 * @returns Read-only array of game ids registered for that scene.
 */
export function getGamesForScene(sceneId: SceneId): readonly string[] {
  return SCENE_CATALOG[sceneId].games ?? [];
}

/**
 * Returns true when a scene is allowed to launch the given game.
 *
 * @param sceneId - Registered scene identifier.
 * @param gameId - Mini-game identifier to check.
 * @returns True when the game is registered under this scene.
 */
export function isGameInScene(sceneId: SceneId, gameId: string): boolean {
  const games: readonly string[] = SCENE_CATALOG[sceneId].games ?? [];
  return games.includes(gameId);
}

/** Optional scene-level music and ambient bed identifiers. */
export interface SceneAudioDefinition {
  /** Background music sound id. Empty string disables music. */
  musicId: string;
  /** Ambient loop sound id. Empty string disables ambient. */
  ambientId: string;
}

/**
 * Shared registration fields for one navigable scene.
 *
 * The lazy loader is intentionally typed loosely here. The runtime validates
 * the loaded module at the call site in `SceneFrame`, which avoids a circular
 * type dependency between the catalog and the navigation/runtime contracts.
 */
interface SceneDefinitionBase {
  /** Human-readable label used in docs, tooling, and generated comments. */
  displayName: string;
  /** Semantic role of the scene within the world hierarchy. */
  kind: 'landing' | 'immersive-toybox';
  /** Lazy module loader used by `SceneFrame`. */
  loader: () => Promise<unknown>;
  /** Camera preset consumed by `createSceneCamera`. */
  cameraPreset: SceneCameraPresetDefinition;
  /** Optional audio configuration consumed by the audio provider. */
  audio: SceneAudioDefinition | null;
  /** Mini-game ids this scene is allowed to launch. Empty or omitted means none. */
  games?: readonly string[];
}

/** Registration record for one navigable scene. */
export interface SceneDefinition extends SceneDefinitionBase {
  /**
   * Scene the HUD back button returns to. Omitted means the default
   * (`playroom`), so only scenes that sit deeper in the house hierarchy need
   * to declare it.
   */
  backTarget?: SceneId;
}

/**
 * Authoring-time entry shape used by the catalog's `satisfies` check.
 *
 * `backTarget` stays a plain string here because `SceneId` derives from the
 * catalog itself, which would make `SceneDefinition` circular at this point.
 * The `_sceneDefinitionContract` check below the catalog re-validates every
 * entry as a full `SceneDefinition` with a registered `backTarget`.
 */
interface SceneCatalogEntryInput extends SceneDefinitionBase {
  /** Scene the HUD back button returns to (validated as a `SceneId` below). */
  backTarget?: string;
}

/**
 * Canonical registry of scene metadata.
 *
 * Generator note:
 * Insert new room scene entries immediately above the room marker and new
 * immersive scene entries immediately above the immersive marker so the
 * generators each have one deterministic edit surface to manage.
 */
export const SCENE_CATALOG = {
  playroom: {
    displayName: 'Playroom',
    kind: 'landing',
    loader: () => import('@app/scenes/world/places/house/subplaces/playroom'),
    cameraPreset: { azimuth: Math.PI, polar: 1.19, distance: 14, target: [0, 0.5, 0] },
    audio: { musicId: 'mus_hub_background', ambientId: 'amb_hub_room_tone' },
    games: [],
  },
  kitchen: {
    displayName: 'Kitchen',
    kind: 'landing',
    loader: () => import('@app/scenes/world/places/house/subplaces/kitchen'),
    cameraPreset: { azimuth: Math.PI, polar: 1.19, distance: 14, target: [0, 0.5, 0] },
    audio: { musicId: 'mus_kitchen_background', ambientId: 'amb_hub_room_tone' },
    games: [],
    backTarget: 'living-room',
  },
  'living-room': {
    displayName: 'Living Room',
    kind: 'landing',
    loader: () => import('@app/scenes/world/places/house/subplaces/living-room'),
    cameraPreset: { azimuth: Math.PI, polar: 1.19, distance: 14, target: [0, 0.5, 0] },
    audio: { musicId: 'mus_living_room_background', ambientId: 'amb_hub_room_tone' },
    games: [],
  },
  // __ROOM_SCENE_GENERATOR_ENTRY_MARKER__
  nature: {
    displayName: 'Nature',
    kind: 'immersive-toybox',
    loader: () => import('@app/scenes/immersive-toybox-scenes/naturescene'),
    cameraPreset: { azimuth: Math.PI, polar: 1.2, distance: 10, target: [0, 0.3, 0] },
    audio: { musicId: 'mus_nature_background', ambientId: 'amb_nature_stream' },
    games: ['bubble-pop', 'fireflies', 'little-shark', 'star-catcher'],
  },
  'pirate-cove': {
    displayName: 'Pirate Cove',
    kind: 'immersive-toybox',
    loader: () => import('@app/scenes/immersive-toybox-scenes/pirate-cove'),
    cameraPreset: {
      azimuth: Math.PI,
      polar: 1.2,
      distance: 10,
      target: [0, 0.3, 0],
      constraints: {
        maxAzimuthRange: 0.12,
        minPolar: 1.14,
        maxPolar: 1.24,
        minDistance: 9,
        maxDistance: 10,
        panRangeX: 1.4,
        minTargetY: 0.2,
        maxTargetY: 0.45,
        ceilingY: 4.8,
      },
    },
    audio: { musicId: 'mus_pirate_cove_background', ambientId: 'amb_pirate_cove_shore' },
    games: ['cannonball-splash'],
  },
  // __IMMERSIVE_SCENE_GENERATOR_ENTRY_MARKER__
} as const satisfies Record<string, SceneCatalogEntryInput>;

/** Scene identifier union derived directly from the canonical catalog. */
export type SceneId = keyof typeof SCENE_CATALOG;

/**
 * Compile-time contract: every catalog entry is a full `SceneDefinition`,
 * including that every declared `backTarget` is a registered scene id.
 */
const _sceneDefinitionContract: Record<SceneId, SceneDefinition> = SCENE_CATALOG;
void _sceneDefinitionContract;

/** Default scene loaded when a route is absent or invalid. */
export const DEFAULT_SCENE_ID: SceneId = 'playroom';

/** Stable array of scene ids for route validation and tooling. */
export const SCENE_IDS = Object.keys(SCENE_CATALOG) as SceneId[];

/**
 * Returns true when the provided string matches a registered scene id.
 *
 * @param candidate - Raw route segment to validate.
 * @returns True when the candidate is a registered scene id.
 */
export function isSceneId(candidate: string): candidate is SceneId {
  return candidate in SCENE_CATALOG;
}

/**
 * Looks up the lazy loader for a scene.
 *
 * @param sceneId - Registered scene identifier.
 * @returns The lazy module loader for the requested scene.
 */
export function getSceneLoader(sceneId: SceneId): () => Promise<unknown> {
  return SCENE_CATALOG[sceneId].loader;
}

/**
 * Looks up the camera preset for a scene.
 *
 * @param sceneId - Registered scene identifier.
 * @returns Camera preset data for the scene.
 */
export function getSceneCameraPreset(sceneId: SceneId): SceneCameraPresetDefinition {
  return SCENE_CATALOG[sceneId].cameraPreset;
}

/**
 * Looks up optional audio metadata for a scene.
 *
 * @param sceneId - Raw scene identifier.
 * @returns Scene audio metadata, or null when the scene has no registered audio.
 */
export function getSceneAudioDefinition(sceneId: string): SceneAudioDefinition | null {
  if (!isSceneId(sceneId)) {
    return null;
  }

  return SCENE_CATALOG[sceneId].audio;
}
