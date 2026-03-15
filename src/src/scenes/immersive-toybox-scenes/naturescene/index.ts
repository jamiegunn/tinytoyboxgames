import { type Camera, type Scene } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createWorldScene } from '@app/utils/worldSceneFactory';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { buildSceneBase, createDisposeCollector } from '@app/utils/sceneHelpers';
import { GLOW_SPORES, createContinuousEffect } from '@app/utils/particleFactory';
import { createNatureMaterials } from './materials';
import { NATURE_ENVIRONMENT } from './environment';
import type { ComposeContext } from './types';
import type { DisposeFn } from './factory/composeHelpers';
import { composeAcorns } from './factory/props/simple/acorns';
import { composeFerns } from './factory/props/simple/ferns';
import { composeGrassPatches } from './factory/props/simple/grassPatch';
import { composeLeafLitter } from './factory/props/simple/leafLitter';
import { composeMossPatches } from './factory/props/simple/mossPatch';
import { composeToadstools } from './factory/props/simple/toadstools';
import { composeButterflies } from './factory/props/interactive/butterflies';
import { composeFlowers } from './factory/props/interactive/flowers';
import { composeLeaves } from './factory/props/interactive/leaves';
import { composeLog } from './factory/props/interactive/log';
import { composeMushrooms } from './factory/props/interactive/mushrooms';
import { composeSnail } from './factory/props/interactive/snail';
import { composeStones } from './factory/props/interactive/stones';
import { composeStream } from './factory/props/complex/stream';
import { composeTrees } from './factory/props/complex/trees';
import { createSkyBackdrop } from './factory/scaffold/skyBackdrop';
import { createToyboxWalls } from './factory/scaffold/toyboxWalls';
import { createFireflies, FIREFLY_CONFIG, setupFireflyTap } from './factory/systems/fireflies';

/**
 * Creates the Nature toybox interior world scene: a forest-floor diorama
 * composed from staging data plus scene-local entity configuration.
 *
 * @param scene - The Three.js scene to populate.
 * @param canvas - The HTML canvas element for input handling.
 * @param nav - Navigation actions for scene transitions.
 * @returns An object containing the camera handle and dispose function.
 */
export function createScene(scene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions) {
  // Disposer lives at createScene scope so it survives buildContents and
  // can be wired into the final dispose chain.
  const disposer = createDisposeCollector();

  const result = createWorldScene(scene, canvas, nav, {
    sceneId: 'nature',
    clearColor: NATURE_ENVIRONMENT.clearColor,
    lighting: NATURE_ENVIRONMENT.lighting,
    portals: NATURE_ENVIRONMENT.portals,
    floorTap: NATURE_ENVIRONMENT.floorTap,
    buildContents: (sc: Scene, cvs: HTMLCanvasElement, cam: Camera, _keyLight, dispatcher: WorldTapDispatcher) => {
      const materials = createNatureMaterials();
      const ctx: ComposeContext = { scene: sc, canvas: cvs, camera: cam, dispatcher, materials };
      const propComposers: Array<(ctx: ComposeContext) => DisposeFn> = [
        composeStream,
        composeMushrooms,
        composeFlowers,
        composeLeaves,
        composeLog,
        composeStones,
        composeButterflies,
        composeTrees,
        composeGrassPatches,
        composeLeafLitter,
        composeToadstools,
        composeMossPatches,
        composeFerns,
        composeAcorns,
        composeSnail,
      ];

      createToyboxWalls(sc);
      const skyBackdrop = createSkyBackdrop(sc);
      disposer.add({ dispose: skyBackdrop.killAnimations });

      const { ground: forestFloor } = buildSceneBase(sc, {
        groundMaterial: 'felt',
        groundColor: NATURE_ENVIRONMENT.ground.color,
        groundWidth: NATURE_ENVIRONMENT.ground.width,
        groundDepth: NATURE_ENVIRONMENT.ground.depth,
      });

      // Prop composers all return a dispose function, even when it is a no-op.
      propComposers.forEach((compose) => {
        disposer.add({ dispose: compose(ctx) });
      });

      // Continuous particle effect
      const sporeSystem = createContinuousEffect(sc, GLOW_SPORES);
      disposer.add({
        dispose: () => {
          sporeSystem.stop();
          sporeSystem.dispose();
        },
      });

      // Firefly system
      const { instances: fireflyInstances, killAnimations } = createFireflies(sc, FIREFLY_CONFIG);
      const fireflyCleanup = setupFireflyTap(sc, dispatcher, fireflyInstances);
      disposer.add({ dispose: fireflyCleanup });
      disposer.add({ dispose: killAnimations });

      return forestFloor;
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
