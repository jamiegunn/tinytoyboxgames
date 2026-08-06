import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { clampAzimuth, resolveRotationRange } from '@app/utils/scene/rotationRange';
import { resolveOpeningTurn } from '@app/utils/scene/openingTurn';
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
 * applying the portrait pull-back, the opening turn, the preset's distance
 * constraints, and the ceiling clamp — exactly as {@link createSceneCamera} does.
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
  // The opening turn is part of the pose, not part of the range: see
  // `@app/utils/scene/openingTurn`. It is added HERE and not to `preset.azimuth`
  // so that everything measuring how far a room may be TURNED keeps measuring
  // from the room's own axis.
  const azimuth = preset.azimuth + resolveOpeningTurn(aspect, sceneId);
  const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, azimuth)));
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
 * Creates a PerspectiveCamera with turn, tilt and zoom.
 *
 * A drag turns the view about the middle of the scene and tilts it; pinch or
 * wheel zooms. There is no pan — the pivot is fixed, so the room turns about its
 * own centre rather than about wherever the player last dragged to.
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

  // THE PIVOT, AND IT DOES NOT MOVE. Turning a room means turning it about the
  // middle of the room, which is also how a person describes it. This used to be
  // a pannable target, so the reachable camera set was the product of "how far
  // aside the player has dragged" and "how far they have turned" — and the
  // binding case was always both at once. Measured that way the Playroom could
  // only afford ±10.7° of rotation before the camera swung outboard of a side
  // wall. With the pivot fixed that product does not exist.
  const target = p.target.clone();

  // Azimuth is stored in the native three.js Spherical convention (θ=0 → +Z), so
  // no offset is applied here. See architecture-standards.md#cameradescriptor.
  // OPENING TURN, AND ONLY ON THE OPENING THETA. `resolveOpeningTurn` says how
  // crooked a room opens so that a phone's narrow frame has a toybox — and so the
  // halo above it — in view without the child having to know to drag first. It is
  // deliberately NOT folded into `p.azimuth`, because `clampSpherical` below
  // measures the turn budget from `p.azimuth` and that budget belongs to the room,
  // not to wherever the camera was put down. Fold it in and the far exit falls out
  // of reach, which is the mistake the first solve made.
  const spherical = new Spherical(radiusForAspect(preset, aspect), p.polar, p.azimuth + resolveOpeningTurn(aspect, sceneId));

  // ROTATION RANGE IS DERIVED, NOT AUTHORED. `maxAzimuthRange` used to be a
  // per-scene constant and the Playroom's was a third larger than its own walls
  // can take — measured against every shipping aspect and every reachable pan
  // and tilt, that room passes the camera through a side wall at ±10.7° and it
  // was authored at ±14.3°. Nothing caught it because no test has ever looked at
  // a room's camera envelope.
  //
  // See `@app/utils/scene/rotationRange`, which owns the number and the argument
  // for it, and `tests/room/rotation-range.test.mjs`, which recomputes every
  // scene's geometric limit and fails if the shipped range exceeds one.
  //
  // IT IS ALSO A FUNCTION OF ASPECT, WHICH IS WHY IT IS A `let`. A narrow
  // viewport sees less of the room's width, so it has to turn further to bring
  // the way out of the room within reach; a wide one takes the room in at once
  // and passes the end of a side wall sooner. Resizing the window changes the
  // answer, so `resize` recomputes it and re-clamps — a camera left holding the
  // portrait range after a rotate to landscape would swing past a wall end.
  let maxAzimuthRange = resolveRotationRange(aspect, sceneId);
  const minPolar = preset.constraints?.minPolar ?? Math.max(0.9, p.polar - 0.1);
  const maxPolar = preset.constraints?.maxPolar ?? Math.min(1.35, p.polar + 0.1);
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
    spherical.theta = clampAzimuth(spherical.theta, baseTheta, maxAzimuthRange);
    spherical.phi = MathUtils.clamp(spherical.phi, minPolar, maxPolar);
    spherical.radius = MathUtils.clamp(spherical.radius, minDistance, maxDistance);
  };

  updateCameraPosition();

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  const activePointers = new Map<number, { x: number; y: number }>();
  let lastPinchDist = 0;
  const pinchSpeed = 0.015;
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

    // A DRAG TURNS THE ROOM. It used to pan, and rotation was on SHIFT+DRAG —
    // which on a tablet, where there is no shift key, meant the view could not be
    // turned at all. Panning is gone entirely, so the plain drag is free for the
    // gesture a child would actually try.
    spherical.theta -= dx * rotateSpeed;
    spherical.phi -= dy * tiltSpeed;
    clampSpherical();

    updateCameraPosition();
  };

  const onPointerUp = (e: PointerEvent) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      lastPinchDist = 0;
    }
    if (activePointers.size === 0) {
      isDragging = false;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    spherical.radius += e.deltaY * 0.01;
    clampSpherical();
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

  // Recenter returns the camera to the pose the room OPENED at, turn included —
  // not to the room's axis. A child who has dragged themselves into a corner and
  // pressed recenter should land back where the room started, looking at a
  // toybox, not at the pose the room has never actually shown them.
  const recenter = () => {
    spherical.set(radiusForAspect(preset, camera.aspect), p.polar, p.azimuth + resolveOpeningTurn(camera.aspect, sceneId));
    clampSpherical();
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
    maxAzimuthRange = resolveRotationRange(newAspect, sceneId);
    // Both limits just moved, so re-clamp rather than only re-clamping the
    // radius: a device rotated from portrait to landscape narrows the turn
    // budget from ±30° to ±5°, and a camera already turned 20° would otherwise
    // sit outside its own range showing the void until the next drag.
    clampSpherical();
    updateCameraPosition();
  };

  return { camera, dispose, recenter, resize };
}
