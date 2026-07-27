/**
 * Pirate Cove scene entrypoint.
 *
 * A friendly, whimsical pirate ship deck surrounded by ocean. All geometry is
 * procedural. Tappable props include a cannon, treasure chest, and ship wheel.
 *
 * Normative references:
 * - ADR-0011: the owl must be present via the shared world-scene runtime
 * - ADR-0012: immersive scenes must preserve the canonical template ceremony
 * - ADR-0013: the template, generator, and tests must stay aligned
 */

import { BoxGeometry, Color, Group, type Camera, Mesh, MeshStandardMaterial, type PerspectiveCamera, Shape, ShapeGeometry, type Scene } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createWorldScene } from '@app/utils/worldSceneFactory';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createDisposeCollector } from '@app/utils/sceneHelpers';
import { createWoodMaterial } from '@app/utils/materialFactory';
import { createGradientSkydome, createCelestialBody, createCloudPuff, createSkyMatchedFog, projectAboveHorizon } from '@app/utils/skyRig';
import { PIRATE_COVE_ENVIRONMENT, PIRATE_COVE_SKY_FOG } from './environment';
import { HULL_OUTLINE, HULL_PLAN, hullZRangeAt } from './hullPlan';
import { createPirateCoveMaterials } from './materials';
import type { ComposeContext } from './types';
import type { DisposeFn } from './factory/composeHelpers';
import { createSceneShell, setupSailTap } from './factory/scaffold/sceneShell';
import { createOcean, setupSeaTap } from './factory/scaffold/sea';
import { startAmbientMotion } from './factory/scaffold/ambientMotion';
import { composeBarrels } from './factory/props/simple/barrels';
import { composeAnchor } from './factory/props/simple/anchor';
import { composeRopeCoils } from './factory/props/simple/ropeCoils';
import { composeRailStowage } from './factory/props/simple/railStowage';
import { composeParrots } from './factory/props/simple/parrot';
import { composeCannons } from './factory/props/interactive/cannon';
import { composeTreasureChests } from './factory/props/interactive/treasureChest';
import { composeShipWheels } from './factory/props/interactive/shipWheel';

/**
 * Creates the Pirate Cove toybox interior world scene: a friendly ship deck
 * with interactive pirate-themed props.
 *
 * @param scene - The Three.js scene instance owned by `SceneFrame`.
 * @param canvas - The canvas element used for camera controls and raycasting.
 * @param nav - Navigation actions used by portals and scene transitions.
 * @returns The camera handle and a dispose function for scene teardown.
 */
export function createScene(scene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions) {
  const disposer = createDisposeCollector();

  const result = createWorldScene(scene, canvas, nav, {
    sceneId: 'pirate-cove',
    clearColor: PIRATE_COVE_ENVIRONMENT.clearColor,
    lighting: PIRATE_COVE_ENVIRONMENT.lighting,
    portals: PIRATE_COVE_ENVIRONMENT.portals,
    floorTap: PIRATE_COVE_ENVIRONMENT.floorTap,
    buildContents: (sc: Scene, cvs: HTMLCanvasElement, cam: Camera, _keyLight, dispatcher: WorldTapDispatcher) => {
      const materials = createPirateCoveMaterials();
      const ctx: ComposeContext = {
        scene: sc,
        canvas: cvs,
        camera: cam,
        dispatcher,
        materials,
      };

      const propComposers: Array<(composeContext: ComposeContext) => DisposeFn> = [
        // Simple props
        composeBarrels,
        composeAnchor,
        composeRopeCoils,
        // Spare spars along both side rails. The only furniture allowed outboard
        // of the narrowest shipping frame: it is elongated (7.2 : 1 against a
        // barrel's 1.0 : 1), so the frame edge shortens it instead of mutilating
        // it, and it is gone entirely by aspect 0.461 rather than lingering as a
        // fragment. Measured by rendering, not argued — see `staging/railStowage.ts`.
        composeRailStowage,
        composeParrots,
        // Interactive props
        composeCannons,
        composeTreasureChests,
        composeShipWheels,
      ];

      // Ship railings, mast, sail and rigging. The shell takes no dimensions:
      // the hull lives in `./hullPlan` and nothing else is allowed to restate it.
      const shellRoot = createSceneShell(sc, { wallHeight: 2, materials });
      // The sail answers, as one target for both of its sheets. See
      // `factory/scaffold/sceneShell/interaction.ts`.
      const unsailTap = setupSailTap(dispatcher, shellRoot);
      if (unsailTap) disposer.add({ dispose: unsailTap });

      // Everything that is not the ship — sea, skydome, sun, clouds — hangs off
      // one group so the ambient rig can roll and heave the world around a rigid
      // deck. See factory/scaffold/ambientMotion for why that is the right way
      // round.
      const seaAndSky = new Group();
      seaAndSky.name = 'sea_and_sky';
      sc.add(seaAndSky);
      const ocean = createOcean();
      seaAndSky.add(ocean);
      // The sea answers. It is registered as a BACKGROUND surface, so it is
      // arbitrated after every prop and can never take a tap away from one —
      // see `factory/scaffold/sea/interaction.ts` for the whole argument, and
      // `.probe/render/r6-map.mjs` for the measurement that demanded it.
      disposer.add({ dispose: setupSeaTap(dispatcher, ocean, seaAndSky, cam as PerspectiveCamera, cvs) });

      // Sky rig: a gradient skydome (afternoon blue → warm horizon → sea),
      // a warm sun, and drifting clouds — all placed in screen space against
      // the scene camera via the shared rig (see utils/skyRig).
      const skyCam = cam as PerspectiveCamera;
      // The gradient lives in `PIRATE_COVE_SKY_FOG` next to the fog distances
      // derived from it, so the dome's horizon colour and the scene's fog colour
      // cannot become two different literals in two different files.
      const skydome = createGradientSkydome(PIRATE_COVE_SKY_FOG.sky);
      seaAndSky.add(skydome);

      // Sun and clouds are placed by ELEVATION above the camera's horizontal
      // plane, not by screen fraction. Over an infinite sea the horizon is
      // exactly zero elevation at every camera pose, so this is the only
      // placement rule under which "above the water" is true by construction.
      // The previous rig authored screen y 0.10 / 0.20 / 0.30 for the clouds
      // against a camera whose horizon sat at screen y 0.083; all three were
      // below the waterline by arithmetic, and 4.82% of the portrait sea band
      // rendered cloud-white. See `projectAboveHorizon` in utils/skyRig.
      //
      // The visible band of sky is narrow and its size is known: the camera
      // pitches 18.4 degrees below horizontal and the vertical field of view is
      // 50 degrees, so sky runs from 0 degrees of elevation (the horizon, at NDC
      // y 0.713) to 6.6 degrees (the top edge). Every elevation below is inside
      // that band with room for the element's own angular radius.
      const sun = createCelestialBody({
        radius: 1.4,
        color: new Color(1.0, 0.93, 0.74),
        emissive: new Color(1.0, 0.84, 0.5),
        // 1.2 blew the sun's modal pixel to a clipped (255, 255, 255) — a hole
        // punched in the sky, only 72 RGB units from the clouds beside it. A sun
        // has to be warmer than a cloud, which it cannot be once it saturates.
        emissiveIntensity: 0.55,
        haloScale: 1.6,
        haloColor: new Color(1.0, 0.8, 0.42),
        haloOpacity: 0.2,
      });
      sun.root.position.copy(projectAboveHorizon(skyCam, 0.82, 4.2, 36));
      seaAndSky.add(sun.root);

      const cloudColor = new Color(0.99, 0.98, 0.96);
      // screenX, elevation (degrees), distance, scale. Scale and distance set
      // the puff's angular half-height (~0.66 * scale / distance radians below
      // its centre); each elevation clears that with margin.
      const cloudSpots: Array<[number, number, number, number]> = [
        [0.16, 4.0, 30, 1.6],
        [0.42, 5.0, 33, 2.0],
        [0.62, 3.4, 27, 1.4],
      ];
      const clouds: Group[] = [];
      for (const [sx, elevation, dist, scl] of cloudSpots) {
        const cloud = createCloudPuff({ color: cloudColor, opacity: 0.92, scale: scl });
        cloud.position.copy(projectAboveHorizon(skyCam, sx, elevation, dist));
        seaAndSky.add(cloud);
        clouds.push(cloud);
      }

      // Ship deck floor — the hull outline, filled. Both the outline and the
      // rails in `sceneShell` read the same `HULL_OUTLINE`; neither restates it.
      // The old code derived five constants here and five identical constants
      // there, under a comment asserting the two agreed.
      //
      // Shape draws in x/y; after rotateX(-PI/2) shape-y maps to world -z, so a
      // shape vertex is (worldX, -worldZ).
      const hullShape = new Shape();
      HULL_OUTLINE.forEach(([x, z], i) => {
        if (i === 0) hullShape.moveTo(x, -z);
        else hullShape.lineTo(x, -z);
      });
      hullShape.closePath();

      const groundGeo = new ShapeGeometry(hullShape);
      groundGeo.rotateX(-Math.PI / 2); // lay flat
      const groundMat = createWoodMaterial('groundMat', PIRATE_COVE_ENVIRONMENT.ground.color);
      const ground = new Mesh(groundGeo, groundMat);
      ground.receiveShadow = true;
      sc.add(ground);

      // Plank seam lines — thin dark strips running transom-to-stem (along z).
      // They are the deck's own perspective cue: on a 1 : 2.40 hull the seams
      // converge toward the stem alongside the rails instead of stopping short
      // at a flat bow.
      const seamMat = new MeshStandardMaterial({
        color: new Color(0.18, 0.12, 0.07),
        metalness: 0,
        roughness: 0.9,
      });
      const plankWidth = 0.8;
      const seamW = 0.04;
      const seamY = 0.005;

      const halfBeam = HULL_PLAN.beam / 2;
      for (let x = -(halfBeam - 0.1); x <= halfBeam - 0.1; x += plankWidth) {
        const range = hullZRangeAt(Math.abs(x));
        if (!range) continue;
        const [zMin, zMax] = range;
        const len = zMax - zMin - 0.2;
        if (len <= 0) continue;

        const seam = new Mesh(new BoxGeometry(seamW, 0.01, len), seamMat);
        seam.name = 'deck_seam';
        seam.position.set(x, seamY, (zMin + zMax) / 2);
        seam.receiveShadow = true;
        sc.add(seam);
      }

      // Wire up all prop composers
      propComposers.forEach((compose) => {
        disposer.add({ dispose: compose(ctx) });
      });

      // Ambient motion LAST, because it animates the parrot and the parrot is
      // staged by a composer. Every tween it starts is owned by the scene's
      // disposal scope via the idle registry, so there is nothing to add to
      // `disposer` here.
      startAmbientMotion(sc, { seaAndSky, clouds, sun, shellRoot });

      return ground;
    },
  });

  // Fog must converge on a colour the player can actually see. The old fog was
  // the environment's `clearColor` (0.05, 0.15, 0.25), which is never on screen
  // for one frame: the skydome is built with `fog: false` (skyRig.ts) and is
  // opaque, so the clear colour is painted over before anything reaches the
  // canvas. The ocean therefore darkened as it receded while the sky above it
  // brightened, and the horizon rendered as a 213-RGB-unit step across eight
  // pixel rows -- the largest colour edge anywhere in the frame, larger than
  // any material boundary on the ship.
  //
  // The fix is the skydome's own `horizonColor`, so the sea converges on the
  // sky it meets. `createSkyMatchedFog` reads it from the same config object the
  // dome is built from — the colour is not passed in and cannot be overridden.
  // See docs review round 2 and `.probe/pc-seam.py`.
  scene.fog = createSkyMatchedFog(PIRATE_COVE_SKY_FOG);

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
