/**
 * Shared scene-local types for Pirate Cove.
 *
 * Holds only the types that genuinely cross feature boundaries.
 */

import { Group, type Camera, type Scene, type Vector3 } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import type { PirateCoveMaterials } from './materials';

/** Placement data shared by staged props. */
export interface EntityPlacement {
  position: Vector3;
  rotY?: number;
  scale?: number;
}

/**
 * Shared context passed into scene composers.
 *
 * This is the main dependency injection surface for authored props. Composers
 * destructure only what they need from this typed object.
 */
export interface ComposeContext {
  scene: Scene;
  canvas: HTMLCanvasElement;
  camera: Camera;
  dispatcher: WorldTapDispatcher;
  materials: PirateCoveMaterials;
}

/**
 * Creates a positioned root group for one entity and adds it to the scene.
 *
 * @param name - Debug-friendly root group name.
 * @param placement - World placement for the entity root.
 * @param scene - The Three.js scene that should own the entity.
 * @returns The created root group.
 */
export function createEntityRoot(name: string, placement: EntityPlacement, scene: Scene): Group {
  const root = new Group();
  root.name = name;
  root.position.copy(placement.position);
  root.rotation.y = placement.rotY ?? 0;
  root.scale.setScalar(placement.scale ?? 1);
  scene.add(root);
  return root;
}
