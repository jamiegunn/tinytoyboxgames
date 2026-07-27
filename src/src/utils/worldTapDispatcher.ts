import { Vector3, type Camera, type Object3D, type Ray } from 'three';
import { createDisposalScope } from '@app/utils/disposal';
import { createInteractionController, type TapOptions } from '@app/utils/interaction/interactionController';
import { soundsRequested, triggerSound } from '@app/assets/audio/sceneBridge';

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
  register(target: Object3D, handler: () => void, opts?: TapOptions): () => void;
  /** Register with world-space hit point (for floor tap / owl flyTo). */
  registerWithPoint(target: Object3D, handler: (point: Vector3) => void, opts?: TapOptions): () => void;
  /** Sets the handler for a tap that matched nothing at all. See the controller. */
  setMissHandler(fn: ((ray: Ray) => void) | null): void;
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
  // The controller has always been able to enforce soul.md#6 ("Every Tap
  // Matters") for itself, and until now nothing gave it the hooks to do it: this
  // factory omitted the argument and `buildScene`, its only other caller, has no
  // call sites at all. The result shipped: not one of the Nature scene's ~51
  // registered tap targets plays any sound, so a child taps a mushroom, watches
  // it bounce, and hears silence. The counter on the scene bridge closes that
  // without touching a single prop — any handler that already makes its own
  // noise ticks it and is left alone; every handler that does not gets the
  // shared acknowledgement it was always supposed to have.
  const controller = createInteractionController(canvas, camera, scope, {
    soundCount: soundsRequested,
    playFallback: () => triggerSound('sfx_shared_tap_fallback'),
  });
  const scratch = new Vector3();

  return {
    register(target: Object3D, handler: () => void, opts?: TapOptions): () => void {
      return controller.register(target, () => handler(), opts);
    },
    registerWithPoint(target: Object3D, handler: (point: Vector3) => void, opts?: TapOptions): () => void {
      return controller.register(
        target,
        (hit) => {
          // Raycast gives the world hit point; the proximity fallback gives null,
          // in which case use the target's own world position.
          handler(hit.point ?? target.getWorldPosition(scratch));
        },
        opts,
      );
    },
    setMissHandler(fn: ((ray: Ray) => void) | null): void {
      controller.setMissHandler(fn);
    },
    dispose(): void {
      scope.dispose();
    },
  };
}
