import { useCallback, useEffect, useRef, useState } from 'react';
import { WebGLRenderer, Scene, PerspectiveCamera, Color } from 'three';
import type { MiniGameId } from '@app/types/scenes';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createScoreManager } from './ScoreManager';
import { createComboTracker } from './ComboTracker';
import { createDifficultyController } from './DifficultyController';
import { createSpawnScheduler } from './SpawnScheduler';
import { createCelebrationSystem } from './CelebrationSystem';
import { createInputDispatcher, type InputDispatcher } from './InputDispatcher';
import { createEntityPool } from './EntityPool';
import { MiniGameHUD } from './MiniGameHUD';
import { LoadingScreen } from './LoadingScreen';
import type { AudioBridge, EntityPoolConfig, IMiniGame, MiniGameContext, MiniGameManifestEntry, ViewportInfo } from './types';

/** Props for the MiniGameShell component. */
interface MiniGameShellProps {
  gameId: MiniGameId;
  manifest: MiniGameManifestEntry;
  onExit: () => void;
}

/** Maximum delta time in seconds to prevent large jumps after tab switch. */
const MAX_DELTA_TIME = 0.1;

/**
 * Disposes all geometries and materials in a Three.js scene.
 * Traverses the entire scene graph and releases GPU resources.
 *
 * @param scene - The Three.js scene to clean up.
 */
function disposeScene(scene: Scene): void {
  scene.traverse((obj) => {
    if ('geometry' in obj && obj.geometry) {
      (obj.geometry as { dispose: () => void }).dispose();
    }
    if ('material' in obj && obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of materials) {
        if (m && typeof m.dispose === 'function') {
          m.dispose();
        }
      }
    }
  });
}

/**
 * Hosts a mini-game instance with its own Three.js renderer, scene, and shared systems.
 * Manages the full lifecycle: load, setup, start, update loop, pause/resume, teardown.
 * Renders the MiniGameHUD overlay on top of the game canvas.
 *
 * @param props - Shell configuration including game manifest and exit callback.
 * @returns The game canvas with HUD overlay.
 */
export function MiniGameShell({ gameId, manifest, onExit }: MiniGameShellProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const gameRef = useRef<IMiniGame | null>(null);
  const inputRef = useRef<InputDispatcher | null>(null);
  const mountedRef = useRef(true);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // Progress state will be driven by round-based games in Phase 4.5
  const [progress, _setProgress] = useState(0);

  /** Handles clean exit by tearing down the game and disposing renderer resources. */
  const handleExit = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.teardown();
      gameRef.current = null;
    }
    if (sceneRef.current) {
      disposeScene(sceneRef.current);
      sceneRef.current = null;
    }
    if (rendererRef.current) {
      rendererRef.current.setAnimationLoop(null);
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    cameraRef.current = null;
    onExit();
  }, [onExit]);

  useEffect(() => {
    mountedRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    const scene = new Scene();
    scene.background = new Color(0x1a1a2e);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Build shared systems
    const combo = createComboTracker(manifest.comboWindowSeconds);
    const scoreManager = createScoreManager(combo);
    const difficulty = createDifficultyController({
      rampStart: 50,
      rampEnd: 500,
      specialItemThreshold: manifest.hasSpecialItems ? 200 : undefined,
    });
    const spawner = createSpawnScheduler();
    const celebration = createCelebrationSystem((id: string) => triggerSound(id));

    const audio: AudioBridge = {
      playSound: (id: string) => triggerSound(id),
      playMusic: () => {
        // TODO: Phase 4.5 -- wire to AudioProvider music system
      },
      stopMusic: () => {
        // TODO: Phase 4.5
      },
      get isMuted() {
        return false; // TODO: read from audio provider
      },
    };

    const viewport: ViewportInfo = {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      orientation: canvas.clientWidth >= canvas.clientHeight ? 'landscape' : 'portrait',
      scaleFactor: window.devicePixelRatio || 1,
      isMobile: 'ontouchstart' in window,
    };

    const context: MiniGameContext = {
      scene,
      renderer,
      camera,
      canvas,
      viewport,
      score: scoreManager,
      combo,
      celebration,
      audio,
      difficulty,
      spawner,
      createPool: <T,>(config: EntityPoolConfig<T>) => createEntityPool(config),
    };

    // Subscribe to score and combo changes
    const unsubScore = scoreManager.onScoreChanged((newScore) => {
      if (mountedRef.current) {
        setScore(newScore);
        difficulty.update(newScore);
      }
    });

    const unsubCombo = combo.onComboChanged((newStreak) => {
      if (mountedRef.current) {
        setStreak(newStreak);
      }
    });

    // Load and start the game
    let cancelled = false;

    const initGame = async () => {
      console.log(`[MiniGameShell] initGame START for: ${gameId}`);
      try {
        console.log(`[MiniGameShell] Loading module...`);
        const module = await manifest.load();
        console.log(`[MiniGameShell] Module loaded:`, Object.keys(module));
        if (cancelled || !mountedRef.current) {
          console.warn(`[MiniGameShell] Cancelled after load`);
          return;
        }

        console.log(`[MiniGameShell] Calling createGame...`);
        const game = module.createGame(context);
        gameRef.current = game;
        console.log(`[MiniGameShell] createGame returned, calling setup...`);

        await game.setup(context);
        console.log(`[MiniGameShell] setup() complete`);
        if (cancelled || !mountedRef.current) {
          console.warn(`[MiniGameShell] Cancelled after setup`);
          return;
        }

        // Set up input dispatching -- wire game lifecycle methods to pointer events
        // Pass the shell camera so the dispatcher can perform raycasting
        const dispatcher = createInputDispatcher(canvas, scene, manifest, camera);
        inputRef.current = dispatcher;
        dispatcher.onTap((e) => game.onTap(e));
        if (manifest.inputModes.includes('drag')) {
          dispatcher.onDrag((e) => game.onDrag?.(e));
          dispatcher.onDragEnd((e) => game.onDragEnd?.(e));
        }

        game.start();
        console.log(`[MiniGameShell] game.start() called, game running`);

        if (mountedRef.current) {
          setIsLoading(false);
        }

        // Start render loop with clamped deltaTime
        let lastTime = performance.now();
        renderer.setAnimationLoop(() => {
          const now = performance.now();
          const rawDelta = (now - lastTime) / 1000;
          lastTime = now;
          const deltaTime = Math.min(rawDelta, MAX_DELTA_TIME);

          if (gameRef.current) {
            gameRef.current.update(deltaTime);
          }
          if (sceneRef.current && cameraRef.current) {
            renderer.render(sceneRef.current, cameraRef.current);
          }
        });
      } catch (err) {
        console.error(`[MiniGameShell] FAILED to load mini-game "${gameId}":`, err);
        if (mountedRef.current) {
          handleExit();
        }
      }
    };

    initGame();

    // Pause/resume on visibility change
    const handleVisibility = () => {
      if (!gameRef.current) return;
      if (document.hidden) {
        gameRef.current.pause();
        spawner.pauseAll();
        inputRef.current?.setPaused(true);
      } else {
        gameRef.current.resume();
        spawner.resumeAll();
        inputRef.current?.setPaused(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return;
      const c = canvasRef.current;
      const w = c.clientWidth;
      const h = c.clientHeight;
      rendererRef.current.setSize(w, h, false);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      if (gameRef.current) {
        gameRef.current.onResize({
          width: w,
          height: h,
          orientation: w >= h ? 'landscape' : 'portrait',
          scaleFactor: window.devicePixelRatio || 1,
          isMobile: 'ontouchstart' in window,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', handleResize);
      unsubScore();
      unsubCombo();
      spawner.clearAll();

      if (inputRef.current) {
        inputRef.current.dispose();
        inputRef.current = null;
      }
      if (gameRef.current) {
        gameRef.current.teardown();
        gameRef.current = null;
      }
      if (sceneRef.current) {
        disposeScene(sceneRef.current);
        sceneRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      cameraRef.current = null;
    };
  }, [gameId, manifest, handleExit]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          outline: 'none',
          touchAction: 'none',
        }}
      />
      <LoadingScreen displayName={manifest.displayName} themeColor={manifest.themeColor} visible={isLoading} />
      {!isLoading && (
        <MiniGameHUD
          score={score}
          streak={streak}
          showScore={manifest.showScore}
          showProgressBar={manifest.showProgressBar}
          progress={progress}
          onExit={handleExit}
        />
      )}
    </div>
  );
}
