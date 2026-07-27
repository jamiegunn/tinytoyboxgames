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

/** Vertical field of view, in degrees, shared by every scene camera. */
export const SCENE_CAMERA_FOV = 50;

/**
 * The aspect the scene framings are authored against. At or above this, the
 * camera sits at the preset's own distance; below it, the camera is pulled back
 * so the same world width stays on screen.
 */
export const PULLBACK_REFERENCE_ASPECT = 0.75;

/**
 * How far back the camera moves, as a multiple of the preset's authored
 * distance, for a given viewport aspect.
 *
 * Portrait viewports are narrower than the authored framing assumes, so the
 * camera is pulled back to keep the scene width on screen. The horizontal world
 * half-width visible at distance d is `d * aspect * tan(fov/2)`, so holding it
 * constant as `aspect` falls below the reference requires scaling d by
 * `reference / aspect` — and never scaling it *down*, which is what the
 * `Math.max` is for.
 *
 * This used to be `aspect < 1 ? (1 / aspect) * 0.75 : 1`, the same expression
 * without the floor and with the wrong guard. That version had three defects,
 * all inside the domain it is actually called with:
 * - it PUSHED THE CAMERA IN for every aspect in (0.75, 1), by up to 25% as
 *   `a -> 1`, so a near-square viewport framed *less* of the scene than a
 *   landscape one;
 * - it jumped 33.2% at exactly `a = 1`, because the `< 1` guard cut the curve
 *   off mid-fall instead of where it crosses 1;
 * - it was the identity at exactly `a = 0.75`, an iPad in portrait, so the one
 *   device class the rule was written for received no pull-back at all.
 *
 * The replacement agrees with the old rule exactly on (0, 0.75], which is the
 * half of the domain where it was right. Exported so tests assert against this
 * function rather than against their own copy of the arithmetic — the previous
 * ground-coverage suite carried an inline copy, and it was carrying the buggy
 * one. See `.probe/pullback-rule.mjs` and tests/room/camera-pullback-rule.test.mjs.
 *
 * @param aspectRatio - Viewport aspect ratio (width / height).
 * @returns A multiplier >= 1 to apply to the preset's authored distance.
 */
export function distanceMultiplierForAspect(aspectRatio: number): number {
  return Math.max(1, PULLBACK_REFERENCE_ASPECT / aspectRatio);
}

/**
 * The furthest the player can orbit out in a scene at a given aspect — the same
 * value {@link createSceneCamera} clamps to.
 *
 * This is where the bottom edge of the frame reaches furthest across the
 * ground, so an envelope check needs exactly this number and must not re-derive
 * it.
 *
 * @param sceneId - Scene whose catalog preset should be resolved.
 * @param aspect - Viewport aspect ratio (width / height).
 * @returns The maximum orbit radius in world units.
 */
export function sceneCameraMaxDistance(sceneId: SceneId, aspect: number): number {
  const preset = getSceneCameraPreset(sceneId);
  return preset.constraints?.maxDistance ?? preset.distance * distanceMultiplierForAspect(aspect);
}

// The opening orbit radius: portrait pull-back, then the preset's own distance
// clamps. This is the single source of that rule -- `resolveSceneCameraPose` and
// `createSceneCamera` both call it, so a ground-coverage test cannot pass against
// a copy of the arithmetic while the app uses different numbers.
const radiusForAspect = (preset: ReturnType<typeof getSceneCameraPreset>, aspectRatio: number): number => {
  const minDistance = preset.constraints?.minDistance ?? preset.distance * 0.2;
  const maxDistance = preset.constraints?.maxDistance ?? preset.distance * distanceMultiplierForAspect(aspectRatio);
  return MathUtils.clamp(preset.distance * distanceMultiplierForAspect(aspectRatio), minDistance, maxDistance);
};

/** The camera pose a scene opens with, before the player pans or zooms. */
export interface SceneCameraPose {
  /** World-space camera position. */
  position: Vector3;
  /** World-space look-at target. */
  target: Vector3;
  /** Orbit radius actually used, after aspect scaling and constraint clamping. */
  radius: number;
}

/**
 * Resolves the opening camera pose for a scene at a given viewport aspect,
 * applying the portrait pull-back, the preset's distance constraints, and the
 * ceiling clamp — exactly as {@link createSceneCamera} does.
 *
 * This exists so that ground-coverage checks can interrogate the pose the app
 * will actually use. Re-deriving the pose in a test would only prove the test
 * agrees with itself.
 *
 * @param sceneId - Scene whose catalog preset should be resolved.
 * @param aspect - Viewport aspect ratio (width / height).
 * @returns The resolved position, target, and orbit radius.
 */
export function resolveSceneCameraPose(sceneId: SceneId, aspect: number): SceneCameraPose {
  const preset = getSceneCameraPreset(sceneId);
  const target = new Vector3(...preset.target);
  const radius = radiusForAspect(preset, aspect);
  const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth)));
  const ceilingY = preset.constraints?.ceilingY ?? 6.0;
  if (position.y > ceilingY) {
    position.y = ceilingY;
  }
  return { position, target, radius };
}

/**
 * Where the bottom edge of the frame lands on a horizontal plane.
 *
 * A scene's ground is a finite rectangle. If the bottom edge of the viewport
 * looks *past* that rectangle the player sees whatever is underneath — in
 * practice the inside of the skydome, i.e. sky below their own feet. That is
 * invisible in landscape and glaring in portrait, because the portrait pull-back
 * moves the camera backwards while the ground stays the same size.
 *
 * `planeY` exists because not every scene's opaque floor is at y = 0. Pirate
 * Cove's deck is a 16x14 hull floating on a 400x400 ocean at `OCEAN_Y = -0.6`,
 * and a ray that misses the deck is looking at water, not at sky. Testing that
 * scene against y = 0 asks the wrong question and answers it wrongly: it would
 * report the sea as a hole in the floor.
 *
 * Returns the three plane intersections of the bottom edge (left corner,
 * centre, right corner). A component is `null` when that ray never descends to
 * the plane, which means the reach is unbounded.
 *
 * @param camera - A positioned, oriented perspective camera.
 * @param planeY - Height of the horizontal plane to intersect. Defaults to 0.
 * @returns Plane hit points for the bottom-left, bottom-centre and bottom-right view rays.
 */
export function bottomEdgeGroundReach(camera: PerspectiveCamera, planeY = 0): (Vector3 | null)[] {
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return [-1, 0, 1].map((ndcX) => {
    const dir = new Vector3(ndcX, -1, 0.5).unproject(camera).sub(camera.position).normalize();
    const drop = planeY - camera.position.y;
    // A camera below the plane, or a ray that is not descending toward it, never
    // meets it in front of the viewer.
    if (drop >= 0 || dir.y >= -1e-6) {
      return null;
    }
    return camera.position.clone().addScaledVector(dir, drop / dir.y);
  });
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

  const maxDistanceForAspect = (aspectRatio: number): number => preset.constraints?.maxDistance ?? p.distance * distanceMultiplierForAspect(aspectRatio);

  const aspect = canvas.clientWidth / canvas.clientHeight;
  const minDistance = preset.constraints?.minDistance ?? p.distance * 0.2;
  let maxDistance = maxDistanceForAspect(aspect);

  const camera = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  const target = p.target.clone();

  // Azimuth is stored in the native three.js Spherical convention (θ=0 → +Z), so
  // no offset is applied here. See architecture-standards.md#cameradescriptor.
  const spherical = new Spherical(radiusForAspect(preset, aspect), p.polar, p.azimuth);

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
    const baseTheta = p.azimuth;
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
    spherical.set(radiusForAspect(preset, camera.aspect), p.polar, p.azimuth);
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
