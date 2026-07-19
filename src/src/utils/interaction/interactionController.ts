/**
 * InteractionController — one tappable-object registry per surface.
 *
 * See architecture-standards.md#interactioncontroller. Subsumes the five ways a
 * thing was made tappable (`createWorldTapDispatcher`, `createInputDispatcher`,
 * `createTapInteraction`, `wireToyboxInteractions`, the room `userData.onClick`
 * scan) behind one `register(obj, handler)` API, and — crucially — makes the two
 * child-UX rules apply everywhere:
 *
 * - **Smear-tap forgiveness** and **proximity fallback** come from the shared
 *   pure {@link classifyGesture} / {@link nearestPointWithin} in `gestureRules`.
 * - **No dead tap**: if a fired handler emits no audio, the controller plays the
 *   shared fallback sound itself, so the "every tap acknowledges" rule no longer
 *   has to be remembered at every call site.
 *
 * One canvas listener, one raycast per gesture, gesture state reset on
 * `pointercancel` (iPadOS system gestures). Torn down via the DisposalScope.
 */

import { Raycaster, Vector2, Vector3, type Object3D, type Camera } from 'three';
import type { DisposalScope } from '@app/utils/disposal';
import { classifyGesture, nearestPointWithin, PROXIMITY_PX, type ScreenPoint } from './gestureRules';

/** What a fired tap handler receives. */
export interface TapHit {
  /** The registered object that was tapped (or matched by proximity). */
  object: Object3D;
  /** World-space hit point, or null when matched by the proximity fallback. */
  point: Vector3 | null;
}

/** Per-registration options. */
export interface TapOptions {
  /**
   * The target participates in dragging, so a gesture past the drag threshold is
   * a drag, not a forgiven wobble-tap. Defaults to false.
   */
  supportsDrag?: boolean;
  /**
   * The handler intentionally makes no sound (e.g. a silent reveal), so the
   * no-dead-tap fallback should be suppressed for it. Defaults to false.
   */
  silent?: boolean;
}

/** Audio hooks that let the controller enforce the no-dead-tap rule. */
export interface InteractionAudio {
  /** A monotonic count of sound-effects played so far (to detect handler audio). */
  soundCount(): number;
  /** Plays the shared tap-acknowledgement fallback sound. */
  playFallback(): void;
}

/** A per-surface tappable-object controller. */
export interface InteractionController {
  /**
   * Registers an object as tappable.
   *
   * @param obj - The object (or an ancestor of hit meshes) to fire for.
   * @param handler - Called with the {@link TapHit} on a tap.
   * @param opts - Optional per-registration behaviour.
   * @returns An unregister function.
   */
  register(obj: Object3D, handler: (hit: TapHit) => void, opts?: TapOptions): () => void;
  /** Overrides the proximity fallback radius (px). */
  setProximityRadiusPx(px: number): void;
  /** Pauses or resumes tap delivery. */
  setPaused(paused: boolean): void;
}

interface Entry {
  handler: (hit: TapHit) => void;
  opts: TapOptions;
}

/**
 * Creates an interaction controller bound to a canvas + camera, torn down by the
 * scope.
 *
 * @param canvas - The canvas to listen on.
 * @param camera - The camera used for raycasting and screen projection.
 * @param scope - Disposal scope that removes the listeners on teardown.
 * @param audio - Optional audio hooks enabling the no-dead-tap fallback.
 * @returns An {@link InteractionController}.
 */
export function createInteractionController(canvas: HTMLCanvasElement, camera: Camera, scope: DisposalScope, audio?: InteractionAudio): InteractionController {
  const registry = new Map<Object3D, Entry>();
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const worldPos = new Vector3();
  const projected = new Vector3();

  let paused = false;
  let isDown = false;
  let lastX = 0;
  let lastY = 0;
  let totalDistance = 0;
  let proximityRadius = PROXIMITY_PX;

  /**
   * Fires an entry's handler and enforces the no-dead-tap rule.
   *
   * @param obj - The registered object that was tapped.
   * @param entry - Its registry entry.
   * @param point - World hit point, or null for a proximity match.
   */
  function fire(obj: Object3D, entry: Entry, point: Vector3 | null): void {
    const before = audio && !entry.opts.silent ? audio.soundCount() : 0;
    entry.handler({ object: obj, point });
    if (audio && !entry.opts.silent && audio.soundCount() === before) {
      audio.playFallback();
    }
  }

  /**
   * Raycasts the registry at a screen point.
   *
   * @param clientX - Pointer client X.
   * @param clientY - Pointer client Y.
   * @returns The matched object + entry + world point, or null.
   */
  function pickRegistered(clientX: number, clientY: number): { obj: Object3D; entry: Entry; point: Vector3 } | null {
    if (registry.size === 0) return null;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const intersects = raycaster.intersectObjects([...registry.keys()], true);
    if (intersects.length === 0) return null;
    // Walk ancestry of the closest hit to a registered object.
    let obj: Object3D | null = intersects[0].object;
    while (obj) {
      const entry = registry.get(obj);
      if (entry) return { obj, entry, point: intersects[0].point };
      obj = obj.parent;
    }
    return null;
  }

  /**
   * Screen-space proximity fallback: nearest registered target within the radius.
   *
   * @param clientX - Pointer client X.
   * @param clientY - Pointer client Y.
   * @returns The nearest object + entry within the radius, or null.
   */
  function pickByProximity(clientX: number, clientY: number): { obj: Object3D; entry: Entry } | null {
    if (registry.size === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const tapX = clientX - rect.left;
    const tapY = clientY - rect.top;
    const objs: Object3D[] = [];
    const points: ScreenPoint[] = [];
    for (const [obj] of registry) {
      obj.getWorldPosition(worldPos);
      projected.copy(worldPos).project(camera);
      // Behind the camera → skip.
      if (projected.z > 1) continue;
      objs.push(obj);
      points.push({ x: ((projected.x + 1) / 2) * rect.width, y: ((1 - projected.y) / 2) * rect.height });
    }
    const idx = nearestPointWithin(tapX, tapY, points, proximityRadius);
    if (idx < 0) return null;
    const obj = objs[idx];
    return { obj, entry: registry.get(obj)! };
  }

  function onPointerDown(e: PointerEvent): void {
    if (paused) return;
    isDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
    totalDistance = 0;
  }

  function onPointerMove(e: PointerEvent): void {
    if (paused || !isDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    totalDistance += Math.hypot(dx, dy);
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onPointerUp(e: PointerEvent): void {
    if (!isDown) return;
    isDown = false;
    if (paused) return;

    // Raycast first: if we hit a registered target, its own drag-support setting
    // decides tap-vs-drag. On a miss, treat as a non-draggable tap for wobble.
    const picked = pickRegistered(e.clientX, e.clientY);
    const supportsDrag = picked?.entry.opts.supportsDrag ?? false;
    if (classifyGesture(totalDistance, supportsDrag) !== 'tap') return;

    if (picked) {
      fire(picked.obj, picked.entry, picked.point);
      return;
    }
    // Missed every mesh — proximity fallback for small targets.
    const near = pickByProximity(e.clientX, e.clientY);
    if (near) fire(near.obj, near.entry, null);
  }

  function onPointerCancel(): void {
    isDown = false;
    totalDistance = 0;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  scope.listener(canvas, 'pointerdown', onPointerDown as EventListener);
  scope.listener(canvas, 'pointermove', onPointerMove as EventListener);
  scope.listener(canvas, 'pointerup', onPointerUp as EventListener);
  scope.listener(canvas, 'pointercancel', onPointerCancel as EventListener);
  scope.add(() => registry.clear());

  return {
    register(obj, handler, opts): () => void {
      registry.set(obj, { handler, opts: opts ?? {} });
      return () => {
        registry.delete(obj);
      };
    },
    setProximityRadiusPx(px: number): void {
      proximityRadius = px;
    },
    setPaused(p: boolean): void {
      paused = p;
      if (p) {
        isDown = false;
        totalDistance = 0;
      }
    },
  };
}
