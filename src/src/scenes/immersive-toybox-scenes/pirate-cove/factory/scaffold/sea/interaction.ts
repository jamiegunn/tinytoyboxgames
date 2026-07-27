/**
 * Making the sea answer.
 *
 * THE CHARGE THIS CLOSES. A sampled map of what a tap does across the frame
 * (`.probe/render/r6-map.mjs`) found that the largest single thing in Pirate
 * Cove — the water, which fills a full-width band of every shipping viewport —
 * returned NOTHING at every sample. Nature's ground and Nature's stream both
 * answer. A child who taps the ocean on a pirate ship is doing the most
 * obvious thing in the scene, and the scene had nothing to say back.
 *
 * WHY `background: true`, WHICH IS THE ENTIRE DESIGN. `interactionController.ts`
 * documents what happens when a large surface competes on equal terms with small
 * props: the ground wins 52–62% of the canvas and every prop's catchment
 * collapses to its own footprint. A background registration is arbitrated last —
 * `pickRegistered` keeps only the nearest background hit and fires it only when
 * nothing non-background was struck, and `pickByProximity` skips background
 * entries outright, so the sea can never steal a near-miss from a barrel. This
 * is the same flag Nature's stream carries, for the same reason.
 *
 * (That skip also retires a guard this fix was designed with and does not need.
 * `registerWithPoint` falls back to the TARGET'S OWN WORLD POSITION when the
 * controller hands it a proximity match with no ray hit, and for a 400 x 400
 * plane that origin is the middle of the world, under the deck — a splash in
 * the wrong place entirely. It is unreachable: proximity never selects a
 * background entry, so the point is always a real intersection.)
 *
 * WHY THIS DOES NOT REUSE THE FLOOR TAP. The scene already hands a floor target
 * to the world-scene runtime, whose handler flies the owl to the tapped point.
 * Pointing that at the ocean would fly the owl off the ship and out to sea. The
 * water gets its own handler, and the owl stays aboard.
 */

import { Vector3, type Mesh, type Object3D, type PerspectiveCamera } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createSeaRipples } from './ripple';

/**
 * Registers the ocean as a tappable background surface that splashes.
 *
 * @param dispatcher - Shared world tap dispatcher.
 * @param ocean - The sea mesh, already parented to the sea-and-sky group.
 * @param parent - That group, which the ripples are parented to so they ride the swell.
 * @param camera - Live scene camera, read per tap to size the ripple by depth.
 * @param canvas - Live canvas, read per tap for its pixel height.
 * @returns Cleanup function that unregisters the handler and frees the ripple pool.
 */
export function setupSeaTap(dispatcher: WorldTapDispatcher, ocean: Mesh, parent: Object3D, camera: PerspectiveCamera, canvas: HTMLCanvasElement): () => void {
  const ripples = createSeaRipples(parent, camera, canvas);

  const unregister = dispatcher.registerWithPoint(
    ocean,
    (point: Vector3) => {
      triggerSound('sfx_shared_splash');
      ripples.splash(point);
    },
    { background: true },
  );

  return () => {
    unregister();
    ripples.dispose();
  };
}
