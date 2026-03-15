import type { SceneId } from '@app/scenes/sceneCatalog';

export type { SceneId } from '@app/scenes/sceneCatalog';

/** Identifier for each in-world mini-game. */
export type MiniGameId = 'little-shark' | 'bubble-pop' | 'fireflies';

/** Read-only snapshot of the current navigation state. */
export interface NavigationState {
  currentScene: SceneId;
  isTransitioning: boolean;
  activeMiniGame: MiniGameId | null;
}

/** Actions available for scene and mini-game navigation. */
export interface NavigationActions {
  /** Transitions to the specified scene. No-ops while a transition is in progress. */
  navigateTo: (scene: SceneId) => void;
  /** Launches a mini-game overlay within the current world scene. */
  launchMiniGame: (gameId: MiniGameId) => void;
  /** Exits the currently active mini-game and returns to the world scene. */
  exitMiniGame: () => void;
}
