import type { SceneId } from '@app/scenes/sceneCatalog';

export type { SceneId } from '@app/scenes/sceneCatalog';

/** Hand-authored mini-games that currently have bespoke portal icon builders. */
export type BuiltInMiniGameId = 'little-shark' | 'bubble-pop' | 'fireflies' | 'cannonball-splash';

/**
 * Identifier for each in-world mini-game.
 *
 * The manifest is the real runtime source of truth. We keep the built-in union
 * for autocomplete on existing authored games, but allow generator-created
 * games to exist without editing this file every time a new template output is
 * added to the repo.
 */
export type MiniGameId = BuiltInMiniGameId | (string & {});

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
