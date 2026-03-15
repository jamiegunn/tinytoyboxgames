import type { Object3D } from 'three';
import type { MiniGameId, NavigationActions } from '@app/types/scenes';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';

/**
 * Sets up a tap trigger on a mesh that launches a mini-game when tapped.
 * Uses the centralized world tap dispatcher for input handling.
 * Plays a tap-fallback sound on activation for first-tap feedback.
 *
 * @param dispatcher - The world tap dispatcher.
 * @param mesh - The 3D object to attach the tap trigger to.
 * @param gameId - The mini-game to launch on tap.
 * @param nav - Navigation actions providing launchMiniGame.
 * @returns A cleanup function that unregisters the tap handler.
 */
export function setupMiniGameTrigger(dispatcher: WorldTapDispatcher, mesh: Object3D, gameId: MiniGameId, nav: NavigationActions): () => void {
  return dispatcher.register(mesh, () => {
    triggerSound('sfx_shared_tap_fallback');
    nav.launchMiniGame(gameId);
  });
}
