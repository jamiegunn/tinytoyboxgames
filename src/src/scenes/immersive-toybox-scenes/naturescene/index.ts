import { Vector3, type Camera, type Scene } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createWorldScene } from '@app/utils/worldSceneFactory';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { buildSceneBase, createDisposeCollector } from '@app/utils/sceneHelpers';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES, GLOW_SPORES_RATE } from '@app/utils/particles/presets';
import { createSkyMatchedFog } from '@app/utils/skyRig';
import { createNatureMaterials } from './materials';
import { NATURE_ENVIRONMENT, NATURE_SKY_FOG } from './environment';
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
import { createTreeline } from './factory/scaffold/treeline';
import { createFireflies, FIREFLY_CONFIG, setupFireflyTap } from './factory/systems/fireflies';

/** Fixed forest-floor emit point for ambient spores (matches the legacy origin emitter). */
const SPORE_ORIGIN = new Vector3(0, 0, 0);

/**
 * Creates the Nature toybox immersive scene: a forest-floor diorama
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

      const treeline = createTreeline(sc);
      disposer.add({ dispose: treeline.dispose });
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

  // Depth fog matched to the skydome's horizon colour, not to the clear colour.
  // The skydome material ignores fog and writes no depth, so the clear colour is
  // never actually on screen in this scene; fogging toward it blended the far
  // treeline toward a near-black green that appears nowhere in the frame.
  //
  // The fog does NOT start past the ground's far edge, and must not: three.js
  // fogs on view-space depth (`-mvPosition.z`), and this ground is 28x32, so its
  // far corners stand behind treeline row 0 at z = 13.5 and are backdrop by
  // construction. Measured across all nine shipping aspects and the whole camera
  // envelope (`.probe/fog-depths.mjs`): every portal <= 0.137 fogged and the play
  // centre <= 0.160, while treeline row 0 sits at 0.288-0.802 and the last row at
  // 0.662-1.000. The props a child touches are clear, the backdrop recedes, and
  // the enlarged ground's own far edge is hazed instead of reading as a hard
  // rectangular shelf. See tests/room/scene-sky-fog-contract.test.mjs.
  //
  // The colour is not passed in: `createSkyMatchedFog` reads it from the same
  // config the skydome is built from, so the two cannot drift apart. They used
  // to be the same literal written out in two different files.
  scene.fog = createSkyMatchedFog(NATURE_SKY_FOG);

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
