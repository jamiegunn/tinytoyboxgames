import { Raycaster, Vector2, type Scene, type PerspectiveCamera } from 'three';
import { DRAG_THRESHOLD_PX, WOBBLE_TAP_TOLERANCE_PX } from '@app/utils/interaction/gestureRules';
import type { MiniGameTapEvent, MiniGameDragEvent, MiniGameDragEndEvent, PickResult } from './types';

/** Return type for createInputDispatcher. */
export interface InputDispatcher {
  /** Registers the tap event handler. */
  onTap: (handler: (e: MiniGameTapEvent) => void) => void;
  /** Registers the drag event handler. */
  onDrag: (handler: (e: MiniGameDragEvent) => void) => void;
  /** Registers the drag-end event handler. */
  onDragEnd: (handler: (e: MiniGameDragEndEvent) => void) => void;
  /**
   * Pauses or resumes event delivery.
   * @param paused - Whether to suppress all input events.
   */
  setPaused: (paused: boolean) => void;
  /** Removes all pointer listeners from the canvas. */
  dispose: () => void;
}

/** Manifest subset used by the input dispatcher for mode filtering. */
interface InputManifest {
  inputModes: Array<'tap' | 'drag'>;
}

// Tap-vs-drag thresholds come from the shared interaction rules so mini-games
// and scene props read from one source. See architecture-standards.md#interactioncontroller.
// NOTE: this dispatcher's single-handler model also treats a wobble on a
// *draggable* target as a tap (more permissive than the scene controller's
// classifyGesture, which follows the doc's "no tap on draggable wobble" rule);
// that shipped game behaviour is preserved intentionally.
const DRAG_THRESHOLD = DRAG_THRESHOLD_PX;
const WOBBLE_TAP_TOLERANCE = WOBBLE_TAP_TOLERANCE_PX;

/** Minimum milliseconds between taps at the same position. */
const TAP_COOLDOWN_MS = 120;

/** Maximum pixel distance for two taps to be considered "same position". */
const TAP_PROXIMITY = 8;

/**
 * Creates an input dispatcher that translates pointer events into game-level tap and drag events.
 * Performs Three.js raycasting to provide pick results with hit mesh and world position.
 * @param canvas - The HTML canvas element to listen on.
 * @param scene - The Three.js scene for raycasting.
 * @param manifest - The mini-game manifest entry describing supported input modes.
 * @param camera - Optional camera override. If not provided, uses the scene default.
 * @returns An InputDispatcher with handler registration, pause control, and disposal.
 */
export function createInputDispatcher(canvas: HTMLCanvasElement, scene: unknown, manifest: InputManifest, camera?: PerspectiveCamera): InputDispatcher {
  let paused = false;
  let tapHandler: ((e: MiniGameTapEvent) => void) | null = null;
  let dragHandler: ((e: MiniGameDragEvent) => void) | null = null;
  let dragEndHandler: ((e: MiniGameDragEndEvent) => void) | null = null;

  // Raycaster for pick results
  const raycaster = new Raycaster();
  const ndcCoord = new Vector2();

  // Pointer tracking state
  let isDown = false;
  let lastX = 0;
  let lastY = 0;
  let totalDistance = 0;
  let isDragging = false;

  // Tap cooldown state
  let lastTapX = -9999;
  let lastTapY = -9999;
  let lastTapTime = 0;

  const supportsTap = manifest.inputModes.includes('tap');
  const supportsDrag = manifest.inputModes.includes('drag');

  /**
   * Performs a raycast from screen coordinates and returns a PickResult.
   * @param screenX - Screen X coordinate in pixels.
   * @param screenY - Screen Y coordinate in pixels.
   * @returns The pick result with hit information.
   */
  function performPick(screenX: number, screenY: number): PickResult {
    if (!camera || !scene || !(scene as Scene).children) {
      return { hit: false };
    }

    const rect = canvas.getBoundingClientRect();
    ndcCoord.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    ndcCoord.y = -((screenY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(ndcCoord, camera);
    const intersections = raycaster.intersectObjects((scene as Scene).children, true);

    if (intersections.length > 0) {
      const hit = intersections[0];
      return {
        hit: true,
        pickedMesh: hit.object,
        pickedPoint: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
        point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
      };
    }

    return { hit: false };
  }

  // Checks whether a tap at the given position is within the cooldown window.
  function isTapOnCooldown(x: number, y: number): boolean {
    const now = Date.now();
    const dx = x - lastTapX;
    const dy = y - lastTapY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < TAP_PROXIMITY && now - lastTapTime < TAP_COOLDOWN_MS;
  }

  function handlePointerDown(e: PointerEvent): void {
    if (paused) return;
    isDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
    totalDistance = 0;
    isDragging = false;
  }

  function handlePointerMove(e: PointerEvent): void {
    if (paused || !isDown) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const segmentDist = Math.sqrt(dx * dx + dy * dy);
    totalDistance += segmentDist;
    lastX = e.clientX;
    lastY = e.clientY;

    if (totalDistance >= DRAG_THRESHOLD) {
      isDragging = true;

      if (supportsDrag && dragHandler) {
        dragHandler({
          screenX: e.clientX,
          screenY: e.clientY,
          deltaX: dx,
          deltaY: dy,
          totalDistance,
          pickResult: performPick(e.clientX, e.clientY),
        });
      }
    }
  }

  function handlePointerUp(e: PointerEvent): void {
    if (paused || !isDown) {
      isDown = false;
      return;
    }

    isDown = false;

    // A gesture is treated as an intended tap when it never crossed the drag
    // threshold, OR when it wobbled slightly (toddler "smeared tap") in a game
    // that either has no drag mode or where the movement stayed tiny.
    const isWobblyTap = isDragging && (!supportsDrag || totalDistance < WOBBLE_TAP_TOLERANCE);

    if (isDragging && supportsDrag && dragEndHandler) {
      dragEndHandler({
        screenX: e.clientX,
        screenY: e.clientY,
        totalDistance,
      });
    }

    if ((!isDragging || isWobblyTap) && supportsTap && tapHandler && !isTapOnCooldown(e.clientX, e.clientY)) {
      lastTapX = e.clientX;
      lastTapY = e.clientY;
      lastTapTime = Date.now();

      tapHandler({
        screenX: e.clientX,
        screenY: e.clientY,
        pickResult: performPick(e.clientX, e.clientY),
      });
    }

    isDragging = false;
    totalDistance = 0;
  }

  /** Resets gesture state when the browser cancels a pointer (e.g. iPadOS system gesture). */
  function handlePointerCancel(): void {
    isDown = false;
    isDragging = false;
    totalDistance = 0;
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerCancel);

  return {
    onTap(handler: (e: MiniGameTapEvent) => void): void {
      tapHandler = handler;
    },

    onDrag(handler: (e: MiniGameDragEvent) => void): void {
      dragHandler = handler;
    },

    onDragEnd(handler: (e: MiniGameDragEndEvent) => void): void {
      dragEndHandler = handler;
    },

    setPaused(p: boolean): void {
      paused = p;
      if (p) {
        // Reset tracking state when pausing to avoid stuck gestures
        isDown = false;
        isDragging = false;
        totalDistance = 0;
      }
    },

    dispose(): void {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
      tapHandler = null;
      dragHandler = null;
      dragEndHandler = null;
    },
  };
}
