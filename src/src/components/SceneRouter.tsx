import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SceneId, MiniGameId, NavigationState, NavigationActions } from '@app/types/scenes';
import { DEFAULT_SCENE_ID, isSceneId, isGameInScene } from '@app/scenes/sceneCatalog';
import { getGameEntry } from '@app/minigames/framework/MiniGameManifest';

interface SceneRouterContextValue extends NavigationState, NavigationActions {}

const SceneRouterCtx = createContext<SceneRouterContextValue | null>(null);

/**
 * Parses the URL hash into a scene and optional mini-game.
 * Hash format: #/{sceneId} or #/{sceneId}/{miniGameId}
 *
 * @returns An object with the parsed scene and mini-game, falling back to playroom.
 */
function parseHash(): { scene: SceneId; game: MiniGameId | null } {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return { scene: DEFAULT_SCENE_ID, game: null };

  const parts = hash.split('/');
  const scenePart = parts[0];
  const gamePart = parts[1] ?? null;

  if (!isSceneId(scenePart)) return { scene: DEFAULT_SCENE_ID, game: null };
  const scene = scenePart;

  if (gamePart) {
    const entry = getGameEntry(gamePart);
    if (entry && isGameInScene(scene, entry.id)) {
      return { scene, game: entry.id };
    }
  }

  return { scene, game: null };
}

/**
 * Updates the URL hash to reflect the current navigation state.
 * Uses replaceState to avoid polluting the history stack on every state change.
 *
 * @param scene - The current scene ID.
 * @param game - The active mini-game ID, or null.
 */
function writeHash(scene: SceneId, game: MiniGameId | null): void {
  const path = game ? `#/${scene}/${game}` : `#/${scene}`;
  if (window.location.hash !== path && `#${window.location.hash}` !== path) {
    window.history.pushState(null, '', path);
  }
}

/**
 * Provides access to the current navigation state and actions.
 *
 * @returns Combined navigation state and actions from SceneRouter context.
 * @throws If called outside of a SceneRouter provider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useNavigation(): SceneRouterContextValue {
  const ctx = useContext(SceneRouterCtx);
  if (!ctx) throw new Error('useNavigation must be used within SceneRouter');
  return ctx;
}

/**
 * Manages scene navigation state with URL hash synchronization.
 * Reads the initial route from the URL hash on mount, updates the hash on
 * navigation, and listens for popstate events (browser back/forward).
 *
 * @param children - React children that consume navigation context.
 * @returns A context provider wrapping the children.
 */
export function SceneRouter({ children }: { children: ReactNode }) {
  const [currentScene, setCurrentScene] = useState<SceneId>(() => parseHash().scene);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeMiniGame, setActiveMiniGame] = useState<MiniGameId | null>(() => parseHash().game);

  const transitioningRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track current state in refs so popstate handler sees latest values
  const sceneRef = useRef(currentScene);
  const gameRef = useRef(activeMiniGame);

  const navigateTo = useCallback((scene: SceneId) => {
    console.log(`[SceneRouter] navigateTo called: ${scene}, transitioning=${transitioningRef.current}`);
    if (transitioningRef.current) {
      console.warn(`[SceneRouter] BLOCKED — still transitioning`);
      return;
    }
    transitioningRef.current = true;
    setIsTransitioning(true);
    setCurrentScene(scene);
    setActiveMiniGame(null);
    sceneRef.current = scene;
    gameRef.current = null;
    writeHash(scene, null);
    console.log(`[SceneRouter] Scene set to: ${scene}`);
    transitionTimerRef.current = setTimeout(() => {
      transitioningRef.current = false;
      setIsTransitioning(false);
      transitionTimerRef.current = null;
      console.log(`[SceneRouter] Transition complete for: ${scene}`);
    }, 600);
  }, []);

  const launchMiniGame = useCallback((gameId: MiniGameId) => {
    console.log(`[SceneRouter] launchMiniGame called: ${gameId}`);
    setActiveMiniGame(gameId);
    gameRef.current = gameId;
    writeHash(sceneRef.current, gameId);
  }, []);

  const exitMiniGame = useCallback(() => {
    setActiveMiniGame(null);
    gameRef.current = null;
    writeHash(sceneRef.current, null);
  }, []);

  // Listen for browser back/forward navigation
  useEffect(() => {
    function onPopState() {
      const { scene, game } = parseHash();
      // Only update if the state actually changed
      if (scene !== sceneRef.current) {
        transitioningRef.current = true;
        setIsTransitioning(true);
        setCurrentScene(scene);
        setActiveMiniGame(game);
        sceneRef.current = scene;
        gameRef.current = game;
        setTimeout(() => {
          transitioningRef.current = false;
          setIsTransitioning(false);
        }, 600);
      } else if (game !== gameRef.current) {
        setActiveMiniGame(game);
        gameRef.current = game;
      }
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const value: SceneRouterContextValue = {
    currentScene,
    isTransitioning,
    activeMiniGame,
    navigateTo,
    launchMiniGame,
    exitMiniGame,
  };

  return <SceneRouterCtx.Provider value={value}>{children}</SceneRouterCtx.Provider>;
}
