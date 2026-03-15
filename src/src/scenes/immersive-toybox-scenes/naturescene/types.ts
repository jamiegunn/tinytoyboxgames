import { Group, type Camera, type Scene, type Vector3 } from 'three';
import type { NatureMaterials } from './materials';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';

export interface EntityPlacement {
  position: Vector3;
  rotY?: number;
}

/**
 * Shared context passed to all scene composers.
 * Each composer destructures only the fields it needs.
 */
export interface ComposeContext {
  scene: Scene;
  canvas: HTMLCanvasElement;
  camera: Camera;
  dispatcher: WorldTapDispatcher;
  materials: NatureMaterials;
}

/**
 * Creates a positioned root Group for a placed entity, adds it to the scene,
 * and returns it. Eliminates the 4-line boilerplate repeated in every factory.
 *
 * @param name - Root group name for the entity.
 * @param placement - World-space placement for the entity root.
 * @param scene - The Three.js scene that should receive the root.
 * @returns The created entity root group.
 */
export function createEntityRoot(name: string, placement: EntityPlacement, scene: Scene): Group {
  const root = new Group();
  root.name = name;
  root.position.copy(placement.position);
  root.rotation.y = placement.rotY ?? 0;
  scene.add(root);
  return root;
}

/**
 * A cast entry that pairs an {@link EntityPlacement} with a variant selection.
 *
 * "Cast" follows the theater metaphor: each entry *casts* a specific variant
 * of an entity into a world-space position — declaring both **what** and
 * **where** in a single record.
 *
 * @typeParam TVariant - The variant enum type for this entity (e.g. `MushroomVariant`).
 */
export interface VariantStaging<TVariant> extends EntityPlacement {
  variant: TVariant;
}
