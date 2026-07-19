import { Vector3, type Camera, type Object3D } from 'three';
import { createDisposalScope } from '@app/utils/disposal';
import { createInteractionController } from '@app/utils/interaction/interactionController';

/**
 * Centralized tap dispatcher for world scenes.
 *
 * Now a thin adapter over the unified {@link createInteractionController}
 * (see architecture-standards.md#interactioncontroller), so scene props gain the
 * shared child-UX rules — smear-tap forgiveness, the small-target proximity
 * fallback, and gesture-aware tap-vs-drag (a camera pan that starts on a prop no
 * longer also taps it). The register/registerWithPoint/dispose API is unchanged,
 * so every scene call site is untouched.
 */
export interface WorldTapDispatcher {
  /** Register a mesh as tappable. Returns an unregister function. */
  register(target: Object3D, handler: () => void): () => void;
  /** Register with world-space hit point (for floor tap / owl flyTo). */
  registerWithPoint(target: Object3D, handler: (point: Vector3) => void): () => void;
  /** Remove all registrations and the canvas listener. */
  dispose(): void;
}

/**
 * Creates a world tap dispatcher backed by the shared interaction controller.
 *
 * @param canvas - The canvas element to attach the pointer listener to.
 * @param camera - The camera used for raycasting.
 * @returns A WorldTapDispatcher instance.
 */
export function createWorldTapDispatcher(canvas: HTMLCanvasElement, camera: Camera): WorldTapDispatcher {
  const scope = createDisposalScope();
  const controller = createInteractionController(canvas, camera, scope);
  const scratch = new Vector3();

  return {
    register(target: Object3D, handler: () => void): () => void {
      return controller.register(target, () => handler());
    },
    registerWithPoint(target: Object3D, handler: (point: Vector3) => void): () => void {
      return controller.register(target, (hit) => {
        // Raycast gives the world hit point; the proximity fallback gives null,
        // in which case use the target's own world position.
        handler(hit.point ?? target.getWorldPosition(scratch));
      });
    },
    dispose(): void {
      scope.dispose();
    },
  };
}
