import { Scene, Color, Mesh, Vector3, type DirectionalLight, type Camera } from 'three';
import type { NavigationActions, MiniGameId, SceneId } from '@app/types/scenes';
import { buildGamePortals } from '@app/minigames/framework/gamePortal';
import { createSceneCamera, type CameraHandle } from '@app/utils/cameraPresets';
import {
  createSceneLighting,
  disposeSceneResources,
  wireFloorTap,
  type LightingConfig,
  type FloorTapConfig,
  type SceneLighting,
} from '@app/utils/sceneHelpers';
import { clearMaterialCache } from '@app/utils/materialFactory';
import { createDisposalScope } from '@app/utils/disposal';
import { createWorldTapDispatcher, type WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createMissAcknowledgement } from '@app/utils/interaction/missAcknowledgement';

/**
 * Portal definition for a world scene's mini-game entry points.
 */
export interface WorldPortalDef {
  /** Mini-game identifier. */
  gameId: MiniGameId;
  /** World-space position for the portal. */
  position: Vector3;
  /** Portal accent colour. */
  color: Color;
}

/**
 * Data-driven configuration for a toybox immersive scene.
 */
export interface WorldConfig {
  /** Scene identifier (used for camera presets). */
  sceneId: SceneId;
  /** Background clear colour for the scene (used by renderer). */
  clearColor: Color;
  /** Lighting rig parameters. */
  lighting: LightingConfig;
  /** Mini-game portal definitions. */
  portals: WorldPortalDef[];
  /** Owl companion + floor-tap fallback configuration. */
  floorTap: FloorTapConfig;
  /**
   * World-specific content builder — called after scaffold is in place.
   * Receives the scene, canvas, camera, key light, and tap dispatcher. Must return the ground mesh.
   */
  buildContents: (scene: Scene, canvas: HTMLCanvasElement, camera: Camera, keyLight: DirectionalLight, dispatcher: WorldTapDispatcher) => Mesh;
}

/**
 * Result of creating a world scene, containing all handles needed for lifecycle management.
 */
export interface WorldSceneResult {
  scene: Scene;
  cameraHandle: CameraHandle;
  lighting: SceneLighting;
  dispose: () => void;
}

/**
 * Creates a fully configured toybox immersive scene from data-driven configuration.
 * Handles the shared scaffold: scene → camera → lighting → content → portals → owl/floor-tap.
 *
 * @param existingScene - The Scene instance provided by SceneFrame (renderer renders this).
 * @param canvas - The canvas element for camera controls and raycasting.
 * @param nav - Navigation actions for mini-game launches.
 * @param config - World-specific configuration.
 * @returns A WorldSceneResult with the scene, camera, and disposal function.
 */
export function createWorldScene(existingScene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions, config: WorldConfig): WorldSceneResult {
  const scene = existingScene;
  scene.background = config.clearColor;

  // Camera
  const cameraHandle = createSceneCamera(canvas, config.sceneId);

  // Centralized tap dispatcher — one listener, one raycast per event
  const dispatcher = createWorldTapDispatcher(canvas, cameraHandle.camera);

  // Lighting — owned by a local scope disposed in dispose() below, so the
  // directional shadow map is freed on scene switch. See architecture-standards.md#lightingrig.
  const lightingScope = createDisposalScope();
  const lighting = createSceneLighting(scene, config.lighting, lightingScope);

  // World-specific content — builder returns the ground mesh for floor-tap wiring
  const groundMesh = config.buildContents(scene, canvas, cameraHandle.camera, lighting.keyLight, dispatcher);

  // Mini-game portals — build and wire click handlers via dispatcher
  const portalResults = buildGamePortals(
    scene,
    config.portals.map((p) => ({
      gameId: p.gameId,
      position: p.position,
      color: p.color,
    })),
    nav,
  );

  const portalCleanups: (() => void)[] = [];
  for (const portal of portalResults) {
    for (const mesh of portal.tappableMeshes) {
      const handler = mesh.userData.onTap as (() => void) | undefined;
      if (handler) {
        const cleanup = dispatcher.register(mesh, handler);
        portalCleanups.push(cleanup);
      }
    }
  }

  // Owl companion + floor-tap fallback
  const { cleanup: owlCleanup } = wireFloorTap(scene, dispatcher, groundMesh, config.floorTap);

  // The sky half of soul.md#6. The floor answers taps that land on the world;
  // above the horizon there is no geometry to answer with, and a fifth to a
  // quarter of the canvas at the shipping viewports (20.7%-25.9% in Nature) was
  // simply inert. A sparkle on the camera ray puts the response exactly under
  // the finger and, unlike the audio fallback beside it, still arrives on a
  // muted device — which is how these are actually played.
  //
  // The depth used to be a constant 12 units along the ray, on the argument that
  // the sky has no geometry so nothing could come between. Measurement says
  // otherwise: 11.6% of the misses at 1280x720 landed behind Nature's own trunks
  // and canopies. The shared handler places the burst where the ray meets the
  // world and keeps the constant only for a ray that meets nothing.
  dispatcher.setMissHandler(createMissAcknowledgement(scene));

  const dispose = () => {
    portalCleanups.forEach((fn) => fn());
    portalResults.forEach((portal) => portal.dispose());
    owlCleanup();
    dispatcher.dispose();
    cameraHandle.dispose();
    lightingScope.dispose();
    disposeSceneResources(scene);
    clearMaterialCache();
  };

  return { scene, cameraHandle, lighting, dispose };
}
