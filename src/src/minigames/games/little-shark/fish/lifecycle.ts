import { Scene, Color, Vector3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { buildShark as buildSharkMesh, buildFish as buildFishMesh } from '@app/minigames/shared/animalBuilder';
import { createGlowTrail } from '@app/minigames/shared/particleFx';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import type { FishState, FishKind } from '../types';
import { FISH_COLORS, GOLDEN_COLOR, GOLDEN_SCALE, FISH_BASE_SPEED_MIN, FISH_BASE_SPEED_MAX, MIN_SPAWN_DISTANCE } from '../types';
import { randomRange, randomPositionAwayFrom } from '../helpers';

/**
 * Fish entity lifecycle — creation, disposal, and shark construction.
 */

/** Counter for unique mesh naming. */
let meshIndex = 0;

/** Component handles returned by {@link buildSharkEntity}. */
export interface SharkComponents {
  sharkRoot: Mesh;
  sharkBody: Object3D | null;
  sharkGlowTrail: ReturnType<typeof createGlowTrail>;
  /** Tail fin meshes (for wag animation). */
  tailFins: Object3D[];
  /** Eye white meshes (for blink animation). */
  eyes: Object3D[];
}

/**
 * Builds the player shark entity with glow trail and explicit component handles.
 * @param scene - The Three.js scene.
 * @param sharkPos - Initial shark world position.
 * @returns Shark root mesh, body child mesh, glow trail, and component arrays.
 */
export function buildSharkEntity(scene: Scene, sharkPos: Vector3): SharkComponents {
  const sharkGroup = buildSharkMesh(`shark_${meshIndex++}`, sharkPos.clone());
  scene.add(sharkGroup);
  const sharkRoot = sharkGroup as unknown as Mesh;

  let sharkBody: Object3D | null = null;
  const tailFins: Object3D[] = [];
  const eyes: Object3D[] = [];
  sharkRoot.traverse((child) => {
    if (child.name.includes('_body')) sharkBody = child;
    if (child.name.includes('tailFin')) tailFins.push(child);
    if (child.name.includes('eyeWhite')) eyes.push(child);
  });

  const sharkGlowTrail = createGlowTrail(scene, sharkRoot, new Color(0.3, 0.6, 1.0), 25);

  return { sharkRoot, sharkBody, sharkGlowTrail, tailFins, eyes };
}

/**
 * Creates a fish entity using the shared animalBuilder.
 * @param scene - The Three.js scene.
 * @param sharkPos - Current shark position (used to spawn away from).
 * @param kind - The fish kind to create.
 * @returns A fresh FishState.
 */
export function createFish(scene: Scene, sharkPos: Vector3, kind: FishKind): FishState {
  const prefix = kind === 'golden' ? 'golden' : 'fish';
  const color = kind === 'golden' ? GOLDEN_COLOR : FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)];

  const [spawnX, spawnZ] = randomPositionAwayFrom(sharkPos.x, sharkPos.z, MIN_SPAWN_DISTANCE);
  const fishGroup = buildFishMesh(`${prefix}_${meshIndex++}`, new Vector3(spawnX, 0, spawnZ), color);
  scene.add(fishGroup);
  const root = fishGroup as unknown as Mesh;

  // Standard fish are much smaller than the shark
  if (kind === 'standard') {
    root.scale.setScalar(0.55);
  }

  if (kind === 'golden') {
    root.scale.setScalar(GOLDEN_SCALE * 0.6);
    let bodyChild: Object3D | null = null;
    root.traverse((child) => {
      if (child.name.includes('_body')) bodyChild = child;
    });
    if (bodyChild && (bodyChild as Mesh).material && 'emissive' in ((bodyChild as Mesh).material as object)) {
      ((bodyChild as Mesh).material as MeshStandardMaterial).emissive = new Color(0.4, 0.35, 0.05);
    }
  }

  let bodyPickMesh: Object3D | null = null;
  root.traverse((child) => {
    if (child.name.includes('_body')) bodyPickMesh = child;
  });

  return {
    root,
    bodyPickMesh: bodyPickMesh ?? root,
    kind,
    active: true,
    driftPhaseX: Math.random() * Math.PI * 2,
    driftPhaseZ: Math.random() * Math.PI * 2,
    driftSpeed: randomRange(FISH_BASE_SPEED_MIN, FISH_BASE_SPEED_MAX),
    driftCenterX: spawnX,
    driftCenterZ: spawnZ,
    despawnTimer: -1,
    dodgeCount: 0,
    dodgeCooldown: 0,
    isTargeted: false,
    spawning: false,
    spawnTimer: 0,
    spawnEdgeX: 0,
    spawnEdgeZ: 0,
  };
}

/**
 * Resets a pooled fish for reuse.
 * @param fish - The fish state to reset.
 * @param sharkPos - Current shark position.
 */
export function resetFishForSpawn(fish: FishState, sharkPos: Vector3): void {
  const [spawnX, spawnZ] = randomPositionAwayFrom(sharkPos.x, sharkPos.z, MIN_SPAWN_DISTANCE);
  fish.root.position.set(spawnX, 0, spawnZ);
  fish.root.scale.setScalar(0.55);
  fish.root.visible = true;

  // Randomize color
  const color = FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)];
  fish.root.traverse((child) => {
    if (child.name.includes('_body') && (child as Mesh).material && 'color' in ((child as Mesh).material as object)) {
      ((child as Mesh).material as MeshStandardMaterial).color = color;
    }
  });

  fish.active = true;
  fish.driftPhaseX = Math.random() * Math.PI * 2;
  fish.driftPhaseZ = Math.random() * Math.PI * 2;
  fish.driftSpeed = randomRange(FISH_BASE_SPEED_MIN, FISH_BASE_SPEED_MAX);
  fish.driftCenterX = spawnX;
  fish.driftCenterZ = spawnZ;
  fish.despawnTimer = -1;
  fish.dodgeCount = 0;
  fish.dodgeCooldown = 0;
  fish.isTargeted = false;
  fish.spawning = false;
  fish.spawnTimer = 0;
  fish.spawnEdgeX = 0;
  fish.spawnEdgeZ = 0;
}

/**
 * Hides a fish and marks it inactive for pooling.
 * @param fish - The fish to deactivate.
 */
export function deactivateFish(fish: FishState): void {
  fish.active = false;
  fish.root.visible = false;
}

/**
 * Disposes a fish entity permanently.
 * @param fish - The fish to dispose.
 */
export function disposeFish(fish: FishState): void {
  disposeMeshDeep(fish.root);
}

/**
 * Resets the mesh index counter.
 */
export function resetMeshIndex(): void {
  meshIndex = 0;
}
