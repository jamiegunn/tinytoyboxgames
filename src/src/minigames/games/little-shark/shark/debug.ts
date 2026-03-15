/**
 * Debug visualization helpers for shark movement.
 * Shows a red sphere at the lunge target and a green arrow for facing direction.
 * TEMPORARY — remove when done debugging.
 */
import { Mesh, SphereGeometry, CylinderGeometry, MeshStandardMaterial, Color, type Scene } from 'three';
import type { SharkMoveState } from './movement';

/** Mutable debug state. */
export interface SharkDebugState {
  targetMarker: Mesh | null;
  facingArrow: Mesh | null;
  facingArrowMat: MeshStandardMaterial | null;
  targetMat: MeshStandardMaterial | null;
}

/**
 * Creates debug visualization meshes.
 * @param scene - Three.js scene.
 * @returns Debug state with meshes.
 */
export function createSharkDebug(scene: Scene): SharkDebugState {
  // Red sphere at lunge target
  const targetGeo = new SphereGeometry(0.3 / 2, 8, 8);
  const targetMat = new MeshStandardMaterial({
    color: new Color(1, 0.2, 0.2),
    emissive: new Color(1, 0.1, 0.1),
    opacity: 0.7,
    transparent: true,
  });
  targetMat.name = 'debug_targetMat';
  const targetMarker = new Mesh(targetGeo, targetMat);
  targetMarker.name = 'debug_target';
  targetMarker.visible = false;
  scene.add(targetMarker);

  // Green arrow showing facing direction
  const arrowGeo = new CylinderGeometry(0, 0.12 / 2, 1.2, 8);
  const facingArrowMat = new MeshStandardMaterial({
    color: new Color(0.2, 1, 0.2),
    emissive: new Color(0.1, 0.8, 0.1),
    opacity: 0.7,
    transparent: true,
  });
  facingArrowMat.name = 'debug_facingMat';
  const facingArrow = new Mesh(arrowGeo, facingArrowMat);
  facingArrow.name = 'debug_facing';
  scene.add(facingArrow);

  return { targetMarker, facingArrow, facingArrowMat, targetMat };
}

/**
 * Updates debug visualization each frame.
 * @param debug - Debug state.
 * @param state - Shark movement state.
 */
export function updateSharkDebug(debug: SharkDebugState, state: SharkMoveState): void {
  if (debug.targetMarker) {
    if (state.swimPhase !== 'idle') {
      debug.targetMarker.visible = true;
      debug.targetMarker.position.set(state.swimDestX, 0.3, state.swimDestZ);
      if (debug.targetMat) {
        if (state.swimPhase === 'rotating') {
          debug.targetMat.emissive = new Color(1, 0.1, 0.1);
        } else {
          debug.targetMat.emissive = new Color(1, 0.9, 0.1);
        }
      }
    } else {
      debug.targetMarker.visible = false;
    }
  }

  if (debug.facingArrow) {
    debug.facingArrow.position.set(state.posX, 0.5, state.posZ);
    debug.facingArrow.rotation.x = 0;
    debug.facingArrow.rotation.y = -state.rotY + Math.PI / 2;
    debug.facingArrow.rotation.z = -Math.PI / 2;

    if (debug.facingArrowMat) {
      if (state.swimPhase === 'rotating') {
        debug.facingArrowMat.emissive = new Color(0.9, 0.4, 0.1);
      } else if (state.swimPhase === 'swimming') {
        debug.facingArrowMat.emissive = new Color(0.1, 0.1, 0.9);
      } else if (state.isBeingDragged) {
        debug.facingArrowMat.emissive = new Color(0.9, 0.9, 0.1);
      } else {
        debug.facingArrowMat.emissive = new Color(0.1, 0.8, 0.1);
      }
    }
  }
}

/**
 * Disposes debug visualization meshes.
 * @param debug - Debug state.
 */
export function disposeSharkDebug(debug: SharkDebugState): void {
  if (debug.targetMarker) {
    debug.targetMarker.geometry?.dispose();
    debug.targetMarker.removeFromParent();
  }
  if (debug.facingArrow) {
    debug.facingArrow.geometry?.dispose();
    debug.facingArrow.removeFromParent();
  }
  debug.targetMat?.dispose();
  debug.facingArrowMat?.dispose();
}
