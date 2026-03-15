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
  /** Azimuthal angle in radians around the scene target. */
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

/** Optional scene-level music and ambient bed identifiers. */
export interface SceneAudioDefinition {
  /** Background music sound id. Empty string disables music. */
  musicId: string;
  /** Ambient loop sound id. Empty string disables ambient. */
  ambientId: string;
}

/**
 * Registration record for one navigable scene.
 *
 * The lazy loader is intentionally typed loosely here. The runtime validates
 * the loaded module at the call site in `SceneFrame`, which avoids a circular
 * type dependency between the catalog and the navigation/runtime contracts.
 */
export interface SceneDefinition {
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
}

/**
 * Canonical registry of scene metadata.
 *
 * Generator note:
 * Insert new immersive scene entries immediately above the generator marker so
 * the script has one deterministic edit surface to manage.
 */
export const SCENE_CATALOG = {
  playroom: {
    displayName: 'Playroom',
    kind: 'landing',
    loader: () => import('@app/scenes/world/places/house/subplaces/playroom'),
    cameraPreset: { azimuth: 0, polar: 1.19, distance: 14, target: [0, 0.5, 0] },
    audio: { musicId: '', ambientId: '' },
  },
  nature: {
    displayName: 'Nature',
    kind: 'immersive-toybox',
    loader: () => import('@app/scenes/immersive-toybox-scenes/naturescene'),
    cameraPreset: { azimuth: 0, polar: 1.2, distance: 10, target: [0, 0.3, 0] },
    audio: { musicId: 'mus_nature_background', ambientId: 'amb_nature_stream' },
  },
  'storybook-garden': {
    displayName: 'Storybook Garden',
    kind: 'immersive-toybox',
    loader: () => import('@app/scenes/immersive-toybox-scenes/storybook-garden'),
    cameraPreset: {
      azimuth: 0,
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
    audio: null,
  },
  // __IMMERSIVE_SCENE_GENERATOR_ENTRY_MARKER__
} as const satisfies Record<string, SceneDefinition>;

/** Scene identifier union derived directly from the canonical catalog. */
export type SceneId = keyof typeof SCENE_CATALOG;

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
