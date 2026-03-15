import { Scene, Vector3, Color, FogExp2, type Mesh, type Object3D } from 'three';
import { createGameCamera, createGameLighting, disposeGameRig } from '@app/minigames/shared/sceneSetup';
import type { GameCamera, GameLights } from '@app/minigames/shared/sceneSetup';
import { CAMERA_RADIUS_LANDSCAPE } from '../types';
import { buildOceanSurface, buildAnemones, buildRocks, buildTreasureChest, buildCausticLights } from './scenery';
import type { CausticLight } from './scenery';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import { buildReefTerrain, getTerrainHeight } from './terrain';
import { placePropsByDensity } from './placement';
import { buildCoral, buildPlant, type CoralType, type PlantType } from './coralFactory';

/**
 * Scene-level assembly: camera, lighting rig, and environment meshes.
 * Orchestrates scenery constructors and returns handles for teardown.
 */

/** All disposable resources created during scene setup. */
export interface SceneEnvironment {
  camera: GameCamera;
  lights: GameLights;
  causticLights: CausticLight[];
  reefFloor: Mesh;
  waterSurface: Object3D;
  corals: Object3D[];
  seaweeds: Object3D[];
  anemones: Mesh[];
  rocks: Object3D[];
  treasureChest: Mesh;
}

/**
 * Sets up the full underwater scene: camera, lighting, and all environment meshes.
 * @param scene - The Three.js scene.
 * @returns All environment handles for update/teardown.
 */
export function setupScene(scene: Scene): SceneEnvironment {
  // Bright cheerful Caribbean ocean background
  scene.background = new Color(0.15, 0.4, 0.65);
  // Underwater haze — fades distant geometry into the ocean background
  scene.fog = new FogExp2(new Color(0.18, 0.42, 0.6).getHex(), 0.025);

  // Camera: 3/4 overhead view
  const camera = createGameCamera({
    name: 'shark',
    radius: CAMERA_RADIUS_LANDSCAPE,
    beta: 0.95,
    fov: 0.85,
  });

  // Bright, cheerful underwater lighting — boosted for visibility
  const lights = createGameLighting({
    name: 'shark',
    direction: new Vector3(0.3, -1, 0.2).normalize(),
    directionalIntensity: 2.0,
    hemisphericIntensity: 1.5,
    pointIntensity: 0.8,
  });

  // Build environment meshes — no ocean walls for infinite reef
  const reefFloor = buildReefTerrain(scene, 60.0);
  const waterSurface = buildOceanSurface(scene);

  // Poisson-placed corals and plants across the large reef
  const placedProps = placePropsByDensity({
    radius: 55.0,
    seed: 12345,
    props: [
      { type: 'coral_brain', count: 30, minSpacing: 4.0, zone: 'middle' },
      { type: 'coral_staghorn', count: 35, minSpacing: 3.5, zone: 'middle' },
      { type: 'coral_fan', count: 25, minSpacing: 4.0, zone: 'outer' },
      { type: 'coral_tube', count: 25, minSpacing: 3.5, zone: 'inner' },
      { type: 'coral_mushroom', count: 20, minSpacing: 4.0, zone: 'outer' },
      { type: 'plant_kelp', count: 40, minSpacing: 3.0, zone: 'middle' },
      { type: 'plant_seaGrass', count: 50, minSpacing: 2.5, zone: 'any' },
      { type: 'plant_fern', count: 30, minSpacing: 3.0, zone: 'outer' },
      { type: 'plant_moss', count: 35, minSpacing: 2.5, zone: 'inner' },
    ],
  });

  const corals: Object3D[] = [];
  const seaweeds: Object3D[] = [];

  for (const prop of placedProps) {
    const y = getTerrainHeight(prop.x, prop.z);
    let group: Object3D;

    if (prop.type.startsWith('coral_')) {
      const coralType = prop.type.replace('coral_', '') as CoralType;
      group = buildCoral(coralType, undefined, prop.scaleFactor);
      corals.push(group);
    } else {
      const plantType = prop.type.replace('plant_', '') as PlantType;
      group = buildPlant(plantType, undefined, prop.scaleFactor);
      seaweeds.push(group);
    }

    group.position.set(prop.x, y, prop.z);
    group.rotation.y = prop.rotationY;
    scene.add(group);
  }

  const anemones = buildAnemones(scene);
  const rocks = buildRocks(scene);
  const treasureChest = buildTreasureChest(scene);
  const causticLights = buildCausticLights(scene);

  return {
    camera,
    lights,
    causticLights,
    reefFloor,
    waterSurface,
    corals,
    seaweeds,
    anemones,
    rocks,
    treasureChest,
  };
}

/**
 * Disposes all environment resources created by setupScene.
 * @param env - The scene environment to tear down.
 */
export function teardownScene(env: SceneEnvironment): void {
  // Dispose caustic lights
  for (const cl of env.causticLights) {
    cl.mesh.geometry?.dispose();
    (cl.mesh.material as import('three').Material)?.dispose();
    cl.mesh.removeFromParent();
  }

  // Dispose corals
  for (const c of env.corals) {
    disposeMeshDeep(c);
  }

  // Dispose seaweeds
  for (const w of env.seaweeds) {
    disposeMeshDeep(w);
  }

  // Dispose anemones
  for (const a of env.anemones) {
    disposeMeshDeep(a);
  }

  // Dispose rocks
  for (const r of env.rocks) {
    disposeMeshDeep(r);
  }

  // Dispose treasure chest
  disposeMeshDeep(env.treasureChest);

  // Dispose water surface
  disposeMeshDeep(env.waterSurface);

  // Dispose reef floor
  disposeMeshDeep(env.reefFloor);

  // Dispose lights and camera
  disposeGameRig(env.camera, env.lights);
}
