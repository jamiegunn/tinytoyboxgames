/**
 * DisposalScope — one teardown registry for a scene, game, or feature.
 *
 * See architecture-standards.md#disposalscope. Replaces the scattered
 * disposal helpers (`createDisposeCollector`, `disposeSceneResources`,
 * `disposeMeshDeep`, `disposeGameRig`) with a single LIFO registry that
 * anything allocating a resource registers its cleanup into, so teardown is
 * one call and whole classes of leak (immortal `repeat:-1` tweens, shadow-map
 * targets, stray listeners) become structurally hard to forget.
 *
 * Contract:
 * - LIFO: teardown runs in reverse registration order, so a resource is never
 *   freed before something that depends on it.
 * - Idempotent: `dispose()` is safe to call more than once.
 * - Exception-isolated: one failing teardown never aborts the rest.
 */

import { Light, Material, Mesh, type Object3D } from 'three';

/** Minimal structural type for anything killable (a GSAP tween or timeline). */
export interface Killable {
  kill: () => void;
}

/** A scoped teardown registry. */
export interface DisposalScope {
  /**
   * Registers a raw teardown function.
   *
   * @param teardown - Called once, in LIFO order, on `dispose()`.
   */
  add(teardown: () => void): void;
  /**
   * Registers an Object3D subtree to be released on teardown (geometries,
   * materials, and lights are disposed; the subtree is detached from its
   * parent).
   *
   * @param obj - The root of the subtree to dispose.
   */
  object3D(obj: Object3D): void;
  /**
   * Registers a GSAP tween or timeline (anything with `kill()`) to be killed
   * on teardown — the fix for the `repeat: -1` leak class.
   *
   * @param tween - The tween or timeline to kill.
   */
  tween(tween: Killable): void;
  /**
   * Registers a DOM event listener to be removed on teardown.
   *
   * @param target - The event target the listener is attached to.
   * @param type - The event type.
   * @param fn - The listener function.
   * @param options - Optional listener options (must match the addEventListener call).
   */
  listener(target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions | boolean): void;
  /**
   * Creates a nested scope disposed together with this one (in LIFO order, so
   * children dispose before the parent resources registered before them).
   *
   * @returns The child scope.
   */
  child(): DisposalScope;
  /** Disposes everything in reverse registration order. Idempotent. */
  dispose(): void;
}

/**
 * Disposes an Object3D subtree: geometries, materials, and lights, then
 * detaches it from its parent.
 *
 * @param obj - The root of the subtree.
 */
function disposeObject3D(obj: Object3D): void {
  obj.traverse((node) => {
    if (node instanceof Mesh) {
      node.geometry?.dispose();
      const material = node.material as Material | Material[] | undefined;
      if (Array.isArray(material)) {
        for (const m of material) m?.dispose();
      } else {
        material?.dispose();
      }
    } else if (node instanceof Light) {
      // Frees shadow-map render targets that otherwise leak across scene switches.
      node.dispose();
    }
  });
  obj.removeFromParent();
}

/**
 * Creates a new disposal scope.
 *
 * @returns A fresh {@link DisposalScope}.
 */
export function createDisposalScope(): DisposalScope {
  const teardowns: Array<() => void> = [];
  let disposed = false;

  const add = (teardown: () => void): void => {
    if (disposed) {
      // Registering after disposal would leak — run it immediately instead.
      teardown();
      return;
    }
    teardowns.push(teardown);
  };

  const scope: DisposalScope = {
    add,
    object3D(obj: Object3D): void {
      add(() => disposeObject3D(obj));
    },
    tween(tween: Killable): void {
      add(() => tween.kill());
    },
    listener(target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions | boolean): void {
      add(() => target.removeEventListener(type, fn, options));
    },
    child(): DisposalScope {
      const c = createDisposalScope();
      add(() => c.dispose());
      return c;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      // LIFO: reverse registration order.
      for (let i = teardowns.length - 1; i >= 0; i--) {
        try {
          teardowns[i]();
        } catch {
          // Exception-isolated: a failed teardown must not block the rest.
        }
      }
      teardowns.length = 0;
    },
  };

  return scope;
}
