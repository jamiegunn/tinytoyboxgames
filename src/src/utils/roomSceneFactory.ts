import { Scene, type Camera, type DirectionalLight, type Mesh, type Object3D } from 'three';
import { createOwlCompanion, type OwlCompanion } from '@app/entities/owl';
import type { NavigationActions, SceneId } from '@app/types/scenes';
import { createSceneCamera, type CameraHandle } from '@app/utils/cameraPresets';
import { clearMaterialCache } from '@app/utils/materialFactory';
import {
  createSceneLighting,
  disposeSceneResources,
  wireFloorTap,
  type FloorTapConfig,
  type LightingConfig,
  type SceneLighting,
} from '@app/utils/sceneHelpers';
import { createWorldTapDispatcher, type WorldTapDispatcher } from '@app/utils/worldTapDispatcher';

/**
 * Context object passed to a room scene's authored content builder.
 */
export interface RoomBuildContext {
  scene: Scene;
  canvas: HTMLCanvasElement;
  camera: Camera;
  keyLight: DirectionalLight;
  dispatcher: WorldTapDispatcher;
  nav: NavigationActions;
  owl: OwlCompanion;
}

/**
 * Result returned by a room scene's authored content builder.
 */
export interface RoomContentResult {
  /** One or more tappable floor meshes that should move the owl when clicked. */
  floorTargets: Mesh[];
  /** Optional authored cleanup for room-local listeners, particles, and timelines. */
  cleanup?: () => void;
}

/**
 * Data-driven configuration for a room scene such as Playroom or Kitchen.
 */
export interface RoomConfig {
  /** Registered scene id used for camera presets and routing. */
  sceneId: SceneId;
  /** Background clear color shown behind the room shell. */
  clearColor: Scene['background'];
  /** Shared lighting rig definition owned by the room runtime. */
  lighting: LightingConfig;
  /**
   * Owl spawn, flight volume, and floor-tap behavior. Room scenes are expected
   * to provide explicit flight bounds because their floor meshes are often
   * larger than the authored shell.
   */
  floorTap: FloorTapConfig & Required<Pick<FloorTapConfig, 'flightBounds'>>;
  /**
   * When `true`, the factory traverses the scene graph after content is built
   * and auto-registers any object whose `userData.onClick` is a function.
   * This exists only for Playroom's legacy interactive props. New rooms
   * should leave this off (the default) and register click targets explicitly
   * through the dispatcher.
   */
  enableLegacyClickScan?: boolean;
  /**
   * Room-authored content builder. Receives the shared runtime dependencies,
   * including the scene-owned owl companion so room-local features like
   * toyboxes can use the common fly-to choreography without re-creating it.
   */
  buildContents: (context: RoomBuildContext) => RoomContentResult;
}

/**
 * Subset of `RoomConfig` covering the environment-level settings that room
 * `environment.ts` files are expected to provide.
 */
export type RoomEnvironmentConfig = Pick<RoomConfig, 'clearColor' | 'lighting' | 'floorTap'>;

/**
 * Result of creating a room scene.
 */
export interface RoomSceneResult {
  scene: Scene;
  cameraHandle: CameraHandle;
  lighting: SceneLighting;
  dispose: () => void;
}

/**
 * Registers any scene object that already exposes a `userData.onClick`
 * callback with the centralized dispatcher.
 *
 * This provides a migration bridge away from Playroom's previous bespoke
 * scene-level raycast loop without forcing every existing interactive prop to
 * learn a new registration API in the same refactor.
 *
 * @param scene - Scene graph to scan for click-enabled objects.
 * @param dispatcher - Shared dispatcher that owns tap listeners for the room.
 * @returns Cleanup function that unregisters all discovered handlers.
 */
function registerUserDataClickTargets(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const unregisters: Array<() => void> = [];

  scene.traverse((object: Object3D) => {
    const clickHandler = object.userData.onClick as (() => void) | undefined;
    if (typeof clickHandler === 'function') {
      unregisters.push(dispatcher.register(object, clickHandler));
    }
  });

  return () => {
    unregisters.forEach((unregister) => unregister());
  };
}

/**
 * Creates a room scene with the shared runtime expected by future room
 * templates: camera, lighting, centralized tap dispatch, owl ownership, floor
 * tap fallback, and deterministic teardown.
 *
 * @param existingScene - The scene instance provided by `SceneFrame`.
 * @param canvas - Canvas used for camera controls and tap dispatch.
 * @param nav - Scene navigation actions.
 * @param config - Room-specific configuration and content builder.
 * @returns Camera, lighting, and teardown handles for the room scene.
 */
export function createRoomScene(existingScene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions, config: RoomConfig): RoomSceneResult {
  const scene = existingScene;
  scene.background = config.clearColor;

  const cameraHandle = createSceneCamera(canvas, config.sceneId);
  const dispatcher = createWorldTapDispatcher(canvas, cameraHandle.camera);
  const lighting = createSceneLighting(scene, config.lighting);
  const owl = createOwlCompanion(scene, config.floorTap.owlPosition, {
    restFacingY: config.floorTap.owlFacingY,
    flightBounds: config.floorTap.flightBounds,
  });

  const content = config.buildContents({ scene, canvas, camera: cameraHandle.camera, keyLight: lighting.keyLight, dispatcher, nav, owl });
  const unregisterSceneClicks = config.enableLegacyClickScan ? registerUserDataClickTargets(scene, dispatcher) : undefined;
  const { cleanup: floorTapCleanup } = wireFloorTap(scene, dispatcher, content.floorTargets, config.floorTap, owl);

  const dispose = () => {
    unregisterSceneClicks?.();
    floorTapCleanup();
    content.cleanup?.();
    owl.dispose();
    dispatcher.dispose();
    cameraHandle.dispose();
    disposeSceneResources(scene);
    clearMaterialCache();
  };

  return { scene, cameraHandle, lighting, dispose };
}
