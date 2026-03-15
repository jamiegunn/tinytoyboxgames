import { useNavigation } from './SceneRouter';
import { MiniGameRouter } from '@app/minigames/framework/MiniGameRouter';

/**
 * Bridges the SceneRouter navigation context to the MiniGameRouter.
 * Reads the active mini-game state and renders the game overlay when a
 * mini-game is active.
 *
 * @returns The MiniGameRouter element connected to navigation context.
 */
export function MiniGameOverlay() {
  const { activeMiniGame, exitMiniGame } = useNavigation();
  return <MiniGameRouter activeGameId={activeMiniGame} onGameExit={exitMiniGame} />;
}
