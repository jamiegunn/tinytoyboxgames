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
    minPolar?: number;
    maxPolar?: number;
    minDistance?: number;
    maxDistance?: number;
    ceilingY?: number;
  };
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

// NOT HERE DELIBERATELY: getGamesForScene(sceneId).
//
// It returned `SCENE_CATALOG[sceneId].games ?? []` and nothing called it. The
// line directly above re-inlines that same expression rather than calling it,
// which is the tell: the accessor existed, the one place that wanted the value
// did not use it, and neither reader noticed the other.
//
// If a caller ever needs the list rather than a membership test, restore it AND
// make isGameInScene call it, so the two cannot drift apart again.

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
    // THE OPENING POSE IS SOLVED, NOT AUTHORED. `.probe/room-pose-final.mjs`
    // sweeps distance x tilt x look-at and keeps only poses where every tappable
    // prop's bounding box is inside the frame AND no corner of the frame leaves
    // the set, at rest and at both ends of the rotation clamp, at every aspect
    // the letterbox can produce. Among those it takes the TIGHTEST — the props
    // as large on screen as they go. See utils/scene/stageRect.ts for the band.
    //
    // WHAT IT FIXED HERE: at the square end of the band the pose that shipped
    // framed `hub_door_doorway` off the edge — the way out of the room. It was
    // fine in landscape, which is why nobody saw it, and no test had ever asked
    // what a room's own props project to.
    cameraPreset: { azimuth: Math.PI, polar: 1.02, distance: 15, target: [0, 0, -2] },
    audio: { musicId: 'mus_hub_background', ambientId: 'amb_hub_room_tone' },
    games: [],
  },
  kitchen: {
    displayName: 'Kitchen',
    kind: 'landing',
    loader: () => import('@app/scenes/world/places/house/subplaces/kitchen'),
    // THE OPENING POSE IS SOLVED, NOT AUTHORED. `.probe/room-pose-final.mjs`
    // sweeps distance x tilt x look-at and keeps only poses where every tappable
    // prop's bounding box is inside the frame AND no corner of the frame leaves
    // the set, at rest and at both ends of the rotation clamp, at every aspect
    // the letterbox can produce. Among those it takes the TIGHTEST — the props
    // as large on screen as they go. See utils/scene/stageRect.ts for the band.
    //
    // WHAT IT FIXED HERE: at the square end of the band the pose that shipped
    // framed `toybox_kitchen-nature_root` off the edge — the way to Nature. It
    // was fine in landscape, which is why nobody saw it.
    //
    // RE-SOLVED after the room was shortened by 25%. A shorter room is a HARDER
    // one to frame, not an easier one: the camera cannot back off past the front
    // wall any more, so it has to be closer, and a closer camera needs a wider
    // frame to hold the same props — which in a 6.2-high room is a frame with
    // ceiling in it. Of 50,147 clean poses only 33,668 show no ceiling, and this
    // is the one among those that keeps every tappable furthest inside the edge
    // (0.973 NDC). See .probe/no-ceiling-solve.mjs.
    cameraPreset: { azimuth: Math.PI, polar: 1.14, distance: 9, target: [0, 2.25, -2.6] },
    audio: { musicId: 'mus_kitchen_background', ambientId: 'amb_hub_room_tone' },
    games: [],
    backTarget: 'living-room',
  },
  'living-room': {
    displayName: 'Living Room',
    kind: 'landing',
    loader: () => import('@app/scenes/world/places/house/subplaces/living-room'),
    // THE OPENING POSE IS SOLVED, NOT AUTHORED. `.probe/room-pose-final.mjs`
    // sweeps distance x tilt x look-at and keeps only poses where every tappable
    // prop's bounding box is inside the frame AND no corner of the frame leaves
    // the set, at rest and at both ends of the rotation clamp, at every aspect
    // the letterbox can produce. Among those it takes the TIGHTEST — the props
    // as large on screen as they go. See utils/scene/stageRect.ts for the band.
    //
    // WHAT IT FIXED HERE: at the square end of the band the pose that shipped
    // framed BOTH toyboxes off the edge — every way out of this room at once.
    // These two are also why the whole stage band is what it is: they stand hard
    // against the side walls, so the frame has to be wide enough to contain the
    // walls themselves — which is why, after being the binding constraint on the
    // stage aspect band, then on rotation, and finally on whether this room could
    // be framed at all once it was shortened, the two toyboxes were moved 0.9
    // inboard. See NATURE_TOYBOX_X in this room's layout.ts for what that bought.
    //
    // With them off the walls this room takes the SAME pose as the Kitchen — the
    // two shells are identical, 10.8 x 15 x 6.2, and once neither has a prop
    // pinned to a side wall the best pose for one is the best pose for the other.
    // Every tappable sits inside 0.880 NDC here against the Kitchen's 0.973.

    cameraPreset: { azimuth: Math.PI, polar: 1.14, distance: 9, target: [0, 2.25, -2.6] },
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
    // THE TARGET CONSTRAINTS ARE GONE, WITH THE PANNING THEY EXISTED FOR.
    // `maxTargetY: 1.0` trimmed the band of bare sky above the near treeline from
    // 21.6% of frame height to 16.6% in landscape — but only once the player had
    // dragged the target upward, which is no longer a thing they can do. At rest
    // the target sits where this preset puts it and always did, so the opening
    // framing is unchanged and the constant now describes a state nothing can
    // reach. An earlier `panRangeX: 3.0` went the same way for the same reason.
    cameraPreset: { azimuth: Math.PI, polar: 1.2, distance: 10, target: [0, 0.3, 0] },
    audio: { musicId: 'mus_nature_background', ambientId: 'amb_nature_stream' },
    games: ['bubble-pop', 'fireflies', 'star-catcher'],
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
        minPolar: 1.19,
        maxPolar: 1.29,
        minDistance: 11,
        maxDistance: 12,
        ceilingY: 8,
      },
    },
    audio: { musicId: 'mus_pirate_cove_background', ambientId: 'amb_pirate_cove_shore' },
    games: ['cannonball-splash', 'little-shark'],
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

/**
 * Returns true when the provided string matches a registered scene id.
 *
 * @param candidate - Raw route segment to validate.
 * @returns True when the candidate is a registered scene id.
 */
export function isSceneId(candidate: string): candidate is SceneId {
  return candidate in SCENE_CATALOG;
}

// NOT HERE DELIBERATELY: SCENE_IDS.
//
// It called itself the "stable array of scene ids for route validation and
// tooling". Route validation is `isSceneId` immediately above, which asks
// `candidate in SCENE_CATALOG` and needs no array. There was no tooling. Nothing
// imported it.
//
// Two derived lists of one truth is one too many: the moment a scene is added,
// SCENE_IDS and SCENE_CATALOG can disagree, and the array is the one that reads
// as authoritative. If an array is genuinely needed later, derive it at the call
// site rather than restoring a second source of truth.

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
