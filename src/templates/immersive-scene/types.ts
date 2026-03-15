/**
 * Shared scene-local types for __SCENE_DISPLAY_NAME__.
 *
 * The template keeps this file small on purpose. It is here to hold the tiny
 * set of types that genuinely need to cross feature boundaries, not to become a
 * dumping ground for every interface in the scene.
 */

import { Group, type Camera, type Scene, type Vector3 } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import type { ImmersiveSceneMaterials } from './materials';

/** Placement data shared by the staged example props. */
export interface EntityPlacement {
  position: Vector3;
  rotY?: number;
  scale?: number;
}

/**
 * Shared context passed into scene composers.
 *
 * This is the main dependency injection surface for authored props. It keeps
 * scene-global systems in one typed object so composers can destructure only
 * what they need instead of importing runtime helpers ad hoc.
 */
export interface ComposeContext {
  scene: Scene;
  canvas: HTMLCanvasElement;
  camera: Camera;
  dispatcher: WorldTapDispatcher;
  materials: ImmersiveSceneMaterials;
}

/**
 * Creates a positioned root group for one entity and adds it to the scene.
 *
 * This helper exists because nearly every prop builder needs the same boilerplate:
 * create a root group, apply placement, apply optional scale, and attach it to
 * the scene. Centralizing that boilerplate keeps the prop builders focused on
 * actual authored geometry.
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
