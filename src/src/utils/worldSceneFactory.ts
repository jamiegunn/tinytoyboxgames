import { Scene, Color, Mesh, Vector3, type DirectionalLight, type Camera } from 'three';
import type { NavigationActions, MiniGameId, SceneId } from '@app/types/scenes';
import { buildGamePortals } from '@app/minigames/framework/gamePortal';
import { createSceneCamera, type CameraHandle } from '@app/utils/cameraPresets';
import { createSceneLighting, wireFloorTap, type LightingConfig, type FloorTapConfig, type SceneLighting } from '@app/utils/sceneHelpers';
import { clearMaterialCache } from '@app/utils/materialFactory';
import { createWorldTapDispatcher, type WorldTapDispatcher } from '@app/utils/worldTapDispatcher';

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
 * Data-driven configuration for a toybox interior world scene.
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
 * Creates a fully configured toybox interior world scene from data-driven configuration.
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

  // Lighting
  const lighting = createSceneLighting(scene, config.lighting);

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

  const dispose = () => {
    portalCleanups.forEach((fn) => fn());
    owlCleanup();
    dispatcher.dispose();
    cameraHandle.dispose();
    // Traverse and dispose all geometries/materials
    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
    clearMaterialCache();
  };

  return { scene, cameraHandle, lighting, dispose };
}
