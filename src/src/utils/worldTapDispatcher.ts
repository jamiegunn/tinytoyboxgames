import { Raycaster, Vector2, Vector3, type Camera, type Object3D } from 'three';

type SimpleHandler = () => void;
type PointHandler = (point: Vector3) => void;
type Handler = { type: 'simple'; fn: SimpleHandler } | { type: 'point'; fn: PointHandler };

/**
 * Centralized tap dispatcher for world scenes.
 * One canvas listener, one raycast per pointer event, mesh→callback registry.
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
 * Creates a centralized tap dispatcher that replaces per-object pointerdown
 * listeners with a single listener + single raycast per event.
 *
 * @param canvas - The canvas element to attach the pointer listener to.
 * @param camera - The camera used for raycasting.
 * @returns A WorldTapDispatcher instance.
 */
export function createWorldTapDispatcher(canvas: HTMLCanvasElement, camera: Camera): WorldTapDispatcher {
  const registry = new Map<Object3D, Handler>();
  const raycaster = new Raycaster();
  const pointer = new Vector2();

  const onPointerDown = (event: PointerEvent) => {
    if (registry.size === 0) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const targets = [...registry.keys()];
    const intersects = raycaster.intersectObjects(targets, true);
    if (intersects.length === 0) return;

    // Walk ancestry of the closest hit to find a registered target
    const hit = intersects[0];
    let obj: Object3D | null = hit.object;
    while (obj) {
      const entry = registry.get(obj);
      if (entry) {
        if (entry.type === 'simple') {
          entry.fn();
        } else {
          entry.fn(hit.point);
        }
        return;
      }
      obj = obj.parent;
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);

  const register = (target: Object3D, handler: () => void): (() => void) => {
    registry.set(target, { type: 'simple', fn: handler });
    return () => {
      registry.delete(target);
    };
  };

  const registerWithPoint = (target: Object3D, handler: (point: Vector3) => void): (() => void) => {
    registry.set(target, { type: 'point', fn: handler });
    return () => {
      registry.delete(target);
    };
  };

  const dispose = () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    registry.clear();
  };

  return { register, registerWithPoint, dispose };
}
