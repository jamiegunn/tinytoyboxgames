/**
 * Storybook Garden scene entrypoint.
 *
 * This file is intentionally the orchestration boundary for the generated
 * immersive scene. It does not own low-level mesh details, and it does not own
 * scene-global runtime behavior like camera creation, portal construction, or
 * owl wiring. Those concerns are delegated deliberately so every immersive
 * scene reads the same way.
 *
 * Normative references:
 * - ADR-0011: the owl must be present via the shared world-scene runtime
 * - ADR-0012: immersive scenes must preserve the canonical template ceremony
 * - ADR-0013: the template, generator, and tests must stay aligned
 */

import { type Camera, type Scene } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createWorldScene } from '@app/utils/worldSceneFactory';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { buildSceneBase, createDisposeCollector } from '@app/utils/sceneHelpers';
import { IMMERSIVE_SCENE_ENVIRONMENT } from './environment';
import { createImmersiveSceneMaterials } from './materials';
import type { ComposeContext } from './types';
import type { DisposeFn } from './factory/composeHelpers';
import { createSceneShell } from './factory/scaffold/sceneShell';
import { createSkyBackdrop } from './factory/scaffold/skyBackdrop';
import { composeSampleSimpleProps } from './factory/props/simple/sampleSimple';
import { composeSampleInteractiveProps } from './factory/props/interactive/sampleInteractive';

/**
 * Creates the generated immersive scene and returns the camera handle plus a
 * complete disposal path.
 *
 * The body of this function is intentionally verbose because it teaches future
 * scene authors exactly where each responsibility belongs:
 *
 * - root-level scene config comes from `environment.ts`
 * - scene-wide shared materials come from `materials.ts`
 * - staging and prop composition happen through typed `ComposeContext`
 * - runtime scaffolding is delegated to `createWorldScene`
 *
 * @param scene - The Three.js scene instance owned by `SceneFrame`.
 * @param canvas - The canvas element used for camera controls and raycasting.
 * @param nav - Navigation actions used by portals and scene transitions.
 * @returns The camera handle and a dispose function for scene teardown.
 */
export function createScene(scene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions) {
  const disposer = createDisposeCollector();

  const result = createWorldScene(scene, canvas, nav, {
    sceneId: 'storybook-garden',
    clearColor: IMMERSIVE_SCENE_ENVIRONMENT.clearColor,
    lighting: IMMERSIVE_SCENE_ENVIRONMENT.lighting,
    portals: IMMERSIVE_SCENE_ENVIRONMENT.portals,
    floorTap: IMMERSIVE_SCENE_ENVIRONMENT.floorTap,
    buildContents: (sc: Scene, cvs: HTMLCanvasElement, cam: Camera, _keyLight, dispatcher: WorldTapDispatcher) => {
      const materials = createImmersiveSceneMaterials();
      const ctx: ComposeContext = {
        scene: sc,
        canvas: cvs,
        camera: cam,
        dispatcher,
        materials,
      };

      const propComposers: Array<(composeContext: ComposeContext) => DisposeFn> = [composeSampleSimpleProps, composeSampleInteractiveProps];

      // The shell and backdrop establish the "inside a toybox" feeling before
      // any authored props are placed. These are scaffold concerns, not prop
      // concerns, so they live under `factory/scaffold`.
      createSceneShell(sc, {
        width: IMMERSIVE_SCENE_ENVIRONMENT.ground.width,
        depth: IMMERSIVE_SCENE_ENVIRONMENT.ground.depth,
        wallHeight: 3,
        materials,
      });
      createSkyBackdrop(sc, {
        width: 28,
        height: 12,
        y: 5,
        z: -6,
        material: materials.skyBackdrop,
      });

      // The shared scene base helper owns the actual ground mesh that the world
      // runtime later uses for floor-tap / owl fly-to behavior.
      const { ground } = buildSceneBase(sc, {
        groundMaterial: 'felt',
        groundColor: IMMERSIVE_SCENE_ENVIRONMENT.ground.color,
        groundWidth: IMMERSIVE_SCENE_ENVIRONMENT.ground.width,
        groundDepth: IMMERSIVE_SCENE_ENVIRONMENT.ground.depth,
      });

      // Every composer returns a dispose function, even when that function is a
      // no-op. That single contract keeps `index.ts` simple as the scene grows.
      propComposers.forEach((compose) => {
        disposer.add({ dispose: compose(ctx) });
      });

      return ground;
    },
  });

  return {
    cameraHandle: result.cameraHandle,
    dispose: () => {
      disposer.disposeAll();
      result.dispose();
    },
  };
}
