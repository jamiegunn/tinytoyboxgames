import { Fog, Vector3, type Camera, type Scene } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createWorldScene } from '@app/utils/worldSceneFactory';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { buildSceneBase, createDisposeCollector } from '@app/utils/sceneHelpers';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES, GLOW_SPORES_RATE } from '@app/utils/particles/presets';
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

/** Fixed forest-floor emit point for ambient spores (matches the legacy origin emitter). */
const SPORE_ORIGIN = new Vector3(0, 0, 0);

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

      // Continuous ambient spores drifting up from the forest-floor origin.
      // The shared batch is freed by SceneFrame's disposal scope; we only stop
      // the stream here. See architecture-standards.md#particleengine.
      const spores = getParticleEngine(sc).stream(PARTICLES.glowSpores, () => SPORE_ORIGIN, GLOW_SPORES_RATE);
      disposer.add({ dispose: () => spores.stop() });

      // Firefly system
      const { instances: fireflyInstances, killAnimations, dispose: disposeFireflies } = createFireflies(sc, FIREFLY_CONFIG);
      const fireflyCleanup = setupFireflyTap(sc, dispatcher, fireflyInstances);
      disposer.add({ dispose: fireflyCleanup });
      disposer.add({ dispose: killAnimations });
      disposer.add({ dispose: disposeFireflies });

      return forestFloor;
    },
  });

  // Gentle depth fog matched to the clear colour: the camera orbits ~10 units
  // out, so fog starts beyond the tabletop play area and only softens the
  // toybox walls and sky backdrop into the background.
  scene.fog = new Fog(NATURE_ENVIRONMENT.clearColor.clone(), 14, 30);

  return {
    cameraHandle: result.cameraHandle,
    dispose: () => {
      // SceneFrame reuses one Scene object across scene switches — clear the
      // fog here so it never bleeds into the next scene.
      scene.fog = null;
      disposer.disposeAll();
      result.dispose();
    },
  };
}
