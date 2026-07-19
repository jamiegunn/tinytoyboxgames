/**
 * Scene system — public surface.
 *
 * See architecture-standards.md#scenedescriptor.
 */

export { buildScene } from './buildScene';
export { validateSceneDescriptor } from './sceneDescriptor';
export { SCENE_DESCRIPTORS, getSceneDescriptor } from './sceneDescriptors';
export type {
  SceneDescriptor,
  SceneBuildContext,
  SceneRuntime,
  GroundDescriptor,
  SkyDescriptor,
  PortalDescriptor,
  SceneAudioDescriptor,
} from './sceneDescriptor';
