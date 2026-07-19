/**
 * buildScene — the one builder that turns a {@link SceneDescriptor} into a live
 * scene runtime.
 *
 * See architecture-standards.md#scenedescriptor. It composes the standardized
 * primitives in one place: the camera (§7), the lighting rig (§6), the ground,
 * the backdrop skydome (sky rig), a single FrameClock, a DisposalScope, and an
 * InteractionController. The clock and scope are published on the per-scene
 * runtime registry ({@link setSceneRuntime}) so deep call sites can reach the
 * *shared* pump instead of starting a private `requestAnimationFrame`. Every
 * resource the builder creates is registered on the scope, so `dispose()` frees
 * the whole scene — including the directional light's shadow-map render target,
 * the leak the DisposalScope was built to kill.
 */

import { Mesh, MeshStandardMaterial, PlaneGeometry, type Scene } from 'three';
import { createCamera } from '@app/utils/camera';
import { createLightingRig } from '@app/utils/lighting';
import { createGradientSkydome } from '@app/utils/skyRig';
import { createFrameClock } from '@app/utils/frameClock';
import { createDisposalScope, type DisposalScope } from '@app/utils/disposal';
import { setSceneRuntime } from '@app/utils/sceneRuntime';
import { createInteractionController } from '@app/utils/interaction';
import type { SceneDescriptor, SceneBuildContext, SceneRuntime, GroundDescriptor } from './sceneDescriptor';

/**
 * Builds the ground plane, adds it to the scene, and registers it for disposal.
 *
 * @param scene - The scene to add the ground to.
 * @param g - The ground descriptor.
 * @param scope - The scene disposal scope.
 * @returns The ground mesh.
 */
function buildGround(scene: Scene, g: GroundDescriptor, scope: DisposalScope): Mesh {
  const material = new MeshStandardMaterial({ color: g.color.clone(), roughness: 0.95, metalness: 0 });
  material.name = 'ground_mat';
  const mesh = new Mesh(new PlaneGeometry(g.width, g.depth), material);
  mesh.name = 'ground';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = g.y ?? 0;
  mesh.receiveShadow = true;
  scene.add(mesh);
  scope.object3D(mesh);
  return mesh;
}

/**
 * Composes a whole scene from its declarative descriptor.
 *
 * @param scene - The Three.js scene to populate.
 * @param d - The scene descriptor (pure data).
 * @param ctx - Runtime inputs (canvas, aspect, optional audio hooks).
 * @returns The live {@link SceneRuntime}.
 */
export function buildScene(scene: Scene, d: SceneDescriptor, ctx: SceneBuildContext): SceneRuntime {
  const clock = createFrameClock();
  const scope = createDisposalScope();
  // Publish the clock + scope so deep effects reach the shared pump/teardown.
  setSceneRuntime(scene, clock, scope);

  const camera = createCamera(d.camera, ctx.aspect);
  const lighting = createLightingRig(scene, d.lighting, scope);
  const ground = buildGround(scene, d.ground, scope);

  let sky: Mesh | null = null;
  if (d.backdrop) {
    sky = createGradientSkydome(d.backdrop);
    scene.add(sky);
    scope.object3D(sky);
  }

  const interaction = createInteractionController(ctx.canvas, camera, scope, ctx.audio);

  return {
    clock,
    scope,
    camera,
    lighting,
    ground,
    sky,
    interaction,
    portals: d.portals ?? [],
    dispose: () => scope.dispose(),
  };
}
