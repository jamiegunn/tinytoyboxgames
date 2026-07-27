import { Vector3, type PerspectiveCamera } from 'three';
import { randomRange } from '@app/minigames/shared/mathUtils';
import type { SpawnBand } from './types';
import { FALLBACK_SPAWN_BAND, MAX_BUBBLE_RADIUS, SIZE_VARIANTS } from './types';

export { randomRange };

/** Scratch vector for the unprojection — computeSpawnBand only runs on resize. */
const _edgePoint = new Vector3();

/**
 * Measures the horizontal spawn band from the live shell camera.
 *
 * Bubbles used to spawn across a hard-coded x in [-4.5, 4.5]. The shell camera
 * (fov 60, 5 units back) frames only about +/-1.4 units at the bubble plane in
 * portrait, so most bubbles were born off screen — invisible, untappable, and
 * still eating pool budget.
 *
 * The fix clamps the spawn band rather than wiring up the unused
 * CAMERA_RADIUS_PORTRAIT / CAMERA_RADIUS_LANDSCAPE constants (now deleted).
 * Those two describe an orbit radius, and bubble-pop deliberately declares no
 * manifest camera: the shell owns the view, `onResize` is documented as
 * "Camera + projection are owned by the shell", and the game's previous
 * private camera was already removed as dead code (see environment/setup.ts).
 * Reintroducing a game-owned camera to reach a fixed spawn band would be the
 * larger and riskier change; measuring the band the shell actually gives us is
 * a handful of lines and stays correct if the shell's framing ever changes.
 *
 * @param camera - The live shell camera.
 * @returns Spawn extents in world units for the current viewport.
 */
export function computeSpawnBand(camera: PerspectiveCamera): SpawnBand {
  // lookAt() leaves matrixWorld stale until the first render, and unproject
  // reads it — refresh before measuring.
  camera.updateMatrixWorld();

  // Cast the ray through the right edge of the frame at the vertical centre,
  // then intersect it with the plane the bubbles float on (z = 0).
  _edgePoint.set(1, 0, 0.5).unproject(camera);
  const dz = _edgePoint.z - camera.position.z;
  if (!Number.isFinite(dz) || Math.abs(dz) < 1e-6) return FALLBACK_SPAWN_BAND;

  const t = -camera.position.z / dz;
  const halfExtent = Math.abs(camera.position.x + (_edgePoint.x - camera.position.x) * t);
  if (!Number.isFinite(halfExtent) || halfExtent <= 0) return FALLBACK_SPAWN_BAND;

  // Inset by the largest ordinary bubble radius so a bottom spawn is framed
  // whole. Giants (0.72) may graze the edge, which is fine — they are the
  // easiest thing on screen to hit, and tap forgiveness covers the rest.
  const inset = SIZE_VARIANTS[SIZE_VARIANTS.length - 1];
  return {
    halfWidth: Math.max(0.35, halfExtent - inset),
    edgeX: halfExtent + MAX_BUBBLE_RADIUS,
  };
}
