import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { getSceneCameraPreset } from '@app/scenes/sceneCatalog';
import type { SceneId } from '@app/types/scenes';

/** Per-scene camera configuration using spherical coordinates around a target. */
interface CameraPreset {
  /** Azimuthal angle in radians (horizontal orbit). */
  azimuth: number;
  /** Polar angle in radians (vertical tilt from top). */
  polar: number;
  /** Distance from target. */
  distance: number;
  /** Look-at target position. */
  target: Vector3;
}

/**
 * Handle returned by createSceneCamera for controlling the camera.
 */
export interface CameraHandle {
  /** The Three.js PerspectiveCamera. */
  camera: PerspectiveCamera;
  /** Call to clean up event listeners. */
  dispose: () => void;
  /** Resets camera to its original preset position. */
  recenter: () => void;
  /** Updates camera aspect ratio on resize. */
  resize: (width: number, height: number) => void;
}

/**
 * Creates a PerspectiveCamera with zoom, tilt, and pan controls.
 * Left-click drag pans, Shift+drag rotates/tilts, scroll wheel zooms.
 *
 * The scene catalog can optionally tighten the camera through per-scene
 * constraints. Generated immersive scenes use that to keep the view inside
 * the intended toybox presentation instead of revealing empty space outside it.
 *
 * @param canvas - The canvas element for event binding.
 * @param sceneId - Identifies which preset to apply.
 * @returns A CameraHandle with the camera and control methods.
 */
export function createSceneCamera(canvas: HTMLCanvasElement, sceneId: SceneId): CameraHandle {
  const preset = getSceneCameraPreset(sceneId);
  const p: CameraPreset = {
    azimuth: preset.azimuth,
    polar: preset.polar,
    distance: preset.distance,
    target: new Vector3(...preset.target),
  };

  const distanceMultiplierForAspect = (aspectRatio: number): number => (aspectRatio < 1 ? (1.0 / aspectRatio) * 0.75 : 1);
  const maxDistanceForAspect = (aspectRatio: number): number => preset.constraints?.maxDistance ?? p.distance * distanceMultiplierForAspect(aspectRatio);

  const aspect = canvas.clientWidth / canvas.clientHeight;
  const portraitMultiplier = distanceMultiplierForAspect(aspect);
  const minDistance = preset.constraints?.minDistance ?? p.distance * 0.2;
  let maxDistance = maxDistanceForAspect(aspect);

  const camera = new PerspectiveCamera(50, aspect, 0.1, 100);
  const target = p.target.clone();

  // Babylon azimuth 0 = front view; Three.js theta 0 = +Z, so offset by PI.
  const spherical = new Spherical(MathUtils.clamp(p.distance * portraitMultiplier, minDistance, maxDistance), p.polar, p.azimuth + Math.PI);

  const maxAzimuthRange = preset.constraints?.maxAzimuthRange ?? 0.25;
  const minPolar = preset.constraints?.minPolar ?? Math.max(0.9, p.polar - 0.1);
  const maxPolar = preset.constraints?.maxPolar ?? Math.min(1.35, p.polar + 0.1);
  const panRangeX = preset.constraints?.panRangeX ?? 3.5;
  const minY = preset.constraints?.minTargetY ?? 0;
  const maxY = preset.constraints?.maxTargetY ?? 2.0;
  const ceilingY = preset.constraints?.ceilingY ?? 6.0;

  const updateCameraPosition = () => {
    const offset = new Vector3().setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    if (camera.position.y > ceilingY) {
      camera.position.y = ceilingY;
    }
    camera.lookAt(target);
  };

  const clampSpherical = () => {
    const baseTheta = p.azimuth + Math.PI;
    spherical.theta = MathUtils.clamp(spherical.theta, baseTheta - maxAzimuthRange, baseTheta + maxAzimuthRange);
    spherical.phi = MathUtils.clamp(spherical.phi, minPolar, maxPolar);
    spherical.radius = MathUtils.clamp(spherical.radius, minDistance, maxDistance);
  };

  const clampTargetForCeiling = () => {
    const cameraOffsetY = spherical.radius * Math.cos(spherical.phi);
    const maxTargetY = Math.min(maxY, ceilingY - cameraOffsetY);
    target.y = MathUtils.clamp(target.y, minY, Math.max(minY, maxTargetY));
  };

  updateCameraPosition();

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let shiftHeld = false;

  const activePointers = new Map<number, { x: number; y: number }>();
  let lastPinchDist = 0;
  const pinchSpeed = 0.015;
  const panSpeed = 0.015;
  const rotateSpeed = 0.004;
  const tiltSpeed = 0.005;

  const getPinchDist = (): number => {
    if (activePointers.size < 2) {
      return 0;
    }

    const pts = Array.from(activePointers.values());
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onContextMenu = (e: Event) => e.preventDefault();

  const onPointerDown = (e: PointerEvent) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      isDragging = false;
      lastPinchDist = getPinchDist();
      return;
    }

    if (e.button !== 0) {
      return;
    }

    isDragging = true;
    shiftHeld = e.shiftKey;
    lastX = e.clientX;
    lastY = e.clientY;
  };

  const onPointerMove = (e: PointerEvent) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size >= 2) {
      const dist = getPinchDist();
      if (lastPinchDist > 0 && dist > 0) {
        spherical.radius += (lastPinchDist - dist) * pinchSpeed;
        clampSpherical();
        clampTargetForCeiling();
        updateCameraPosition();
      }
      lastPinchDist = dist;
      return;
    }

    if (!isDragging) {
      return;
    }

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (shiftHeld) {
      spherical.theta -= dx * rotateSpeed;
      spherical.phi -= dy * tiltSpeed;
      clampSpherical();
    } else {
      const scaleFactor = (spherical.radius / p.distance) * panSpeed;
      target.x -= dx * scaleFactor;
      target.y += dy * scaleFactor;

      const zoomRange = Math.max(0.001, maxDistance - minDistance);
      const zoomFraction = 1 - (spherical.radius - minDistance) / zoomRange;
      const effectiveRangeX = panRangeX * Math.max(0.1, zoomFraction);
      target.x = MathUtils.clamp(target.x, -effectiveRangeX, effectiveRangeX);
    }

    clampTargetForCeiling();
    updateCameraPosition();
  };

  const onPointerUp = (e: PointerEvent) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      lastPinchDist = 0;
    }
    if (activePointers.size === 0) {
      isDragging = false;
      shiftHeld = false;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    spherical.radius += e.deltaY * 0.01;
    clampSpherical();
    clampTargetForCeiling();
    updateCameraPosition();
  };

  canvas.style.touchAction = 'none';
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('pointerdown', onPointerDown, true);
  canvas.addEventListener('pointermove', onPointerMove, true);
  canvas.addEventListener('pointerup', onPointerUp, true);
  canvas.addEventListener('pointerleave', onPointerUp, true);
  canvas.addEventListener('pointercancel', onPointerUp, true);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const recenter = () => {
    target.copy(p.target);
    spherical.set(MathUtils.clamp(p.distance * distanceMultiplierForAspect(camera.aspect), minDistance, maxDistance), p.polar, p.azimuth + Math.PI);
    updateCameraPosition();
  };

  const onRecenter = () => recenter();
  window.addEventListener('camera:recenter', onRecenter);

  const dispose = () => {
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('pointerdown', onPointerDown, true);
    canvas.removeEventListener('pointermove', onPointerMove, true);
    canvas.removeEventListener('pointerup', onPointerUp, true);
    canvas.removeEventListener('pointerleave', onPointerUp, true);
    canvas.removeEventListener('pointercancel', onPointerUp, true);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('camera:recenter', onRecenter);
  };

  const resize = (width: number, height: number) => {
    const newAspect = width / height;
    camera.aspect = newAspect;
    camera.updateProjectionMatrix();
    maxDistance = maxDistanceForAspect(newAspect);
    spherical.radius = MathUtils.clamp(spherical.radius, minDistance, maxDistance);
    updateCameraPosition();
  };

  return { camera, dispose, recenter, resize };
}
