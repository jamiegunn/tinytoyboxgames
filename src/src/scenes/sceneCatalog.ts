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
    // No `maxDistance` here, deliberately. The portrait pull-back is load-bearing:
    // capping it to pirate-cove's 10 keeps the ground in frame but pushes all
    // four portals off a phone, which is the worse defect for a player who cannot
    // read.
    //
    // `maxTargetY: 1.0` is a FRAMING choice, not an audit requirement — the
    // ground-coverage and sky/fog suites both pass with the shared 2.0 default
    // (mutation M2). What it buys is measured: it cuts the band of bare sky above
    // the near treeline canopy from 21.6% of frame height to 16.6% in landscape
    // and from 29.6% to 26.1% at 360x900. See `.probe/nature-constraint-value.mjs`.
    //
    // There used to be a `panRangeX: 3.0` here too, justified in this comment as
    // something "the ground-coverage audit needs". It was not: at the pan extreme
    // it is indistinguishable from the shared 3.5 default on every instrumented
    // metric (identical 0.114 sky fraction, identical 2 of 4 portals framed), and
    // only 4.5 degrades framing to 1 of 4. An unmeasurable constant documented as
    // load-bearing is the defect this scene's review round is about, so it is gone.
    // See tests/room/scene-ground-coverage.test.mjs.
    cameraPreset: { azimuth: Math.PI, polar: 1.2, distance: 10, target: [0, 0.3, 0], constraints: { maxTargetY: 1.0 } },
    audio: { musicId: 'mus_nature_background', ambientId: 'amb_nature_stream' },
    games: ['bubble-pop', 'fireflies', 'little-shark', 'star-catcher'],
  },
  'pirate-cove': {
    displayName: 'Pirate Cove',
    kind: 'immersive-toybox',
    loader: () => import('@app/scenes/immersive-toybox-scenes/pirate-cove'),
    // Solved JOINTLY with the hull, not tuned after it. `.probe/pc-hull-solve.mjs`
    // sweeps hull plan x camera preset x mast together and scores each candidate
    // at all nine shipping aspects; a hull that reads as a ship is a hull whose
    // rails converge, and whether they converge is a property of the pair.
    // Solving them in sequence is what produced the shipped values: a 15.3 x 13.3
    // deck seen from polar 1.2 at radius 10, whose side rails made 4.8 degrees
    // with the horizontal at the worst aspect and whose masthead and crow's nest
    // were cropped at every single aspect (0/9 and 0/9).
    //
    // This pose — polar 1.25, radius 12, target y 1.5 — carries the 10 x 24 hull
    // in `pirate-cove/hullPlan.ts`. Together they score stem 9/9, mast top 9/9,
    // crow's nest 9/9, deck under the bottom frame edge 9/9, portal 9/9.
    //
    // RAIL ANGLE, MEASURED ON THE BUILT SHIP: 30.9 degrees at the opening pose on
    // every aspect (the screen angle of a horizontal-plane line is aspect-
    // invariant under a fixed vertical FOV), falling to 11.4 degrees at the worst
    // corner of the pan/zoom/orbit envelope, mean 27.6 over 324 envelope samples
    // per aspect. Against the shipped hull's 4.8 that is 2.4x at the worst case.
    //
    // These are NOT the numbers the solver predicted. `pc-hull-solve.mjs` works on
    // a plan model of the hull and said 14.0 worst / 26.1 mean; re-measured against
    // the shell `createSceneShell` actually builds, the worst case is 2.6 degrees
    // WORSE and the mean 1.5 better. The built figures are the ones quoted here,
    // because the plan model is a prediction and the shell is the thing that
    // ships — and a comment repeating a solver's estimate of geometry it does not
    // build is the precise failure mode this whole review is about. Re-measure
    // with `.probe/pc-hull-frame.mjs`, which instantiates the real shell.
    //
    // The polar and target-y bands keep the shipped shape (-0.06/+0.04 on polar,
    // -0.10/+0.15 on target y) rather than being re-chosen: the review that moved
    // this preset was about the hull's proportions and the frame, and widening a
    // constraint nothing measured would be exactly the unjustified constant that
    // review is about. `ceilingY` rises with the eye height it clamps.
    cameraPreset: {
      azimuth: Math.PI,
      polar: 1.25,
      distance: 12,
      target: [0, 1.5, 0],
      constraints: {
        maxAzimuthRange: 0.12,
        minPolar: 1.19,
        maxPolar: 1.29,
        minDistance: 11,
        maxDistance: 12,
        panRangeX: 1.4,
        minTargetY: 1.4,
        maxTargetY: 1.65,
        ceilingY: 8,
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
