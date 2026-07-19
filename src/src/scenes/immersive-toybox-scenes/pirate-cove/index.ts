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

import { BoxGeometry, Color, Fog, type Camera, Mesh, MeshStandardMaterial, type PerspectiveCamera, Shape, ShapeGeometry, Vector3, type Scene } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createWorldScene } from '@app/utils/worldSceneFactory';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createDisposeCollector } from '@app/utils/sceneHelpers';
import { createWoodMaterial } from '@app/utils/materialFactory';
import { createGradientSkydome, createCelestialBody, createCloudPuff, projectToView } from '@app/utils/skyRig';
import { PIRATE_COVE_ENVIRONMENT } from './environment';
import { createPirateCoveMaterials } from './materials';
import type { ComposeContext } from './types';
import type { DisposeFn } from './factory/composeHelpers';
import { createSceneShell } from './factory/scaffold/sceneShell';
import { composeBarrels } from './factory/props/simple/barrels';
import { composeAnchor } from './factory/props/simple/anchor';
import { composeRopeCoils } from './factory/props/simple/ropeCoils';
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
        composeParrots,
        // Interactive props
        composeCannons,
        composeTreasureChests,
        composeShipWheels,
      ];

      // Ship railings and mast
      createSceneShell(sc, {
        width: PIRATE_COVE_ENVIRONMENT.ground.width,
        depth: PIRATE_COVE_ENVIRONMENT.ground.depth,
        wallHeight: 2,
        materials,
      });

      // Sky rig: a gradient skydome (afternoon blue → warm horizon → sea),
      // a warm sun, and drifting clouds — all placed in screen space against
      // the scene camera via the shared rig (see utils/skyRig).
      const skyCam = cam as PerspectiveCamera;
      const skydome = createGradientSkydome({
        radius: 60,
        center: new Vector3(0, 0, 0),
        topColor: new Color(0.26, 0.48, 0.82),
        horizonColor: new Color(0.66, 0.82, 0.93),
        bottomColor: new Color(0.13, 0.36, 0.48),
        horizonSharpness: 1.5,
      });
      sc.add(skydome);

      const sun = createCelestialBody({
        radius: 2.0,
        color: new Color(1.0, 0.96, 0.82),
        emissive: new Color(1.0, 0.9, 0.62),
        emissiveIntensity: 1.2,
        haloScale: 1.6,
        haloColor: new Color(1.0, 0.86, 0.52),
        haloOpacity: 0.22,
      });
      sun.root.position.copy(projectToView(skyCam, 0.76, 0.14, 34));
      sc.add(sun.root);

      const cloudColor = new Color(0.99, 0.98, 0.96);
      const cloudSpots: Array<[number, number, number, number]> = [
        [0.24, 0.2, 30, 1.8],
        [0.5, 0.1, 33, 2.2],
        [0.9, 0.3, 27, 1.5],
      ];
      for (const [sx, sy, dist, scl] of cloudSpots) {
        const cloud = createCloudPuff({ color: cloudColor, opacity: 0.92, scale: scl });
        cloud.position.copy(projectToView(skyCam, sx, sy, dist));
        sc.add(cloud);
      }

      // Ship deck floor — hull-shaped wood plane matching the railing outline.
      // Shape draws in x/y; after rotateX(-PI/2) shape-y maps to world -z,
      // so we negate z when writing shape y-coordinates.
      const wallInset = 0.5;
      const halfW = Math.max(PIRATE_COVE_ENVIRONMENT.ground.width / 2 - wallInset, 0.5);
      const halfD = Math.max(PIRATE_COVE_ENVIRONMENT.ground.depth / 2 - wallInset, 0.5);
      const sternCut = halfW * 0.35;
      const bowNarrow = halfW * 0.5;

      // Hull outline — matches railRuns in sceneShell exactly.
      // Shape y = -worldZ, so stern (world +z) → shape -y, bow (world -z) → shape +y.
      const hullShape = new Shape();
      hullShape.moveTo(-(halfW - sternCut), -halfD); // stern left
      hullShape.lineTo(halfW - sternCut, -halfD); // stern right
      hullShape.lineTo(halfW, -(halfD - sternCut)); // stern-right diagonal end
      hullShape.lineTo(halfW - bowNarrow, halfD); // bow right
      hullShape.lineTo(-(halfW - bowNarrow), halfD); // bow left
      hullShape.lineTo(-halfW, -(halfD - sternCut)); // left side up to stern-left diagonal
      hullShape.closePath();

      const groundGeo = new ShapeGeometry(hullShape);
      groundGeo.rotateX(-Math.PI / 2); // lay flat
      const groundMat = createWoodMaterial('groundMat', PIRATE_COVE_ENVIRONMENT.ground.color);
      const ground = new Mesh(groundGeo, groundMat);
      ground.receiveShadow = true;
      sc.add(ground);

      // Plank seam lines — thin dark strips running bow-to-stern (along z).
      // Hull vertices (world x, z):
      //   V0: (-(halfW-sternCut), halfD)   — stern left
      //   V1: ((halfW-sternCut), halfD)    — stern right
      //   V2: (halfW, halfD-sternCut)      — stern-right corner
      //   V3: ((halfW-bowNarrow), -halfD)  — bow right
      //   V4: (-(halfW-bowNarrow), -halfD) — bow left
      //   V5: (-halfW, halfD-sternCut)     — stern-left corner
      const seamMat = new MeshStandardMaterial({
        color: new Color(0.18, 0.12, 0.07),
        metalness: 0,
        roughness: 0.9,
      });
      const plankWidth = 0.8;
      const seamW = 0.04;
      const seamY = 0.005;

      // For a given |x|, compute [zFront, zBack] inside the hull.
      const hullZRange = (ax: number): [number, number] | null => {
        if (ax > halfW) return null;

        // Back (stern) z limit — stern is at +z
        let zBack: number;
        if (ax <= halfW - sternCut) {
          zBack = halfD; // under flat stern section
        } else {
          // On stern diagonal: x goes from (halfW-sternCut) to halfW,
          // z goes from halfD down to (halfD-sternCut)
          const t = (ax - (halfW - sternCut)) / sternCut;
          zBack = halfD - t * sternCut;
        }

        // Front (bow) z limit — bow is at -z
        let zFront: number;
        if (ax <= halfW - bowNarrow) {
          zFront = -halfD; // under full bow width
        } else {
          // On side edge: x goes from halfW down to (halfW-bowNarrow),
          // z goes from (halfD-sternCut) down to -halfD.
          // Parameterize by x: at ax=halfW → z=(halfD-sternCut), at ax=(halfW-bowNarrow) → z=-halfD
          const t = (halfW - ax) / bowNarrow; // t=0 at halfW, t=1 at halfW-bowNarrow
          zFront = halfD - sternCut + t * (-(halfD - sternCut) - halfD);
        }

        return zFront < zBack ? [zFront, zBack] : null;
      };

      for (let x = -(halfW - 0.1); x <= halfW - 0.1; x += plankWidth) {
        const range = hullZRange(Math.abs(x));
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

      return ground;
    },
  });

  // Gentle depth fog matched to the clear colour: the camera orbits ~10 units
  // out, so fog starts beyond the ship deck and only softens the sunset
  // backdrop (~18 units away) into the ocean haze.
  scene.fog = new Fog(PIRATE_COVE_ENVIRONMENT.clearColor.clone(), 14, 32);

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
