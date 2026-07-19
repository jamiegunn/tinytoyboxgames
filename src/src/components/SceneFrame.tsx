import { useRef, useEffect, type ReactNode } from 'react';
import { WebGLRenderer, Scene } from 'three';
import { useNavigation } from './SceneRouter';
import { useResponsive } from './ResponsiveProvider';
import { useAudio } from './AudioProvider';
import type { NavigationActions } from '@app/types/scenes';
import type { CameraHandle } from '@app/utils/cameraPresets';
import { getSceneLoader } from '@app/scenes/sceneCatalog';
import { createConfiguredRenderer, applyDefaultEnvironment } from '@app/utils/rendererFactory';
import { createFrameClock, type FrameClock } from '@app/utils/frameClock';
import { createDisposalScope, type DisposalScope } from '@app/utils/disposal';
import { setSceneParticleEngine } from '@app/utils/particles/registry';
import { setSceneIdleAnimator } from '@app/utils/idle/registry';
import { setSceneRuntime } from '@app/utils/sceneRuntime';

/**
 * Per-scene lifecycle handed to `createScene` — a frame clock ticked by the
 * render loop and a disposal scope torn down on scene unload. See
 * architecture-standards.md#frameclock and #disposalscope.
 */
export interface SceneLifecycle {
  clock: FrameClock;
  disposal: DisposalScope;
}

// Scene factory registry — lazy-loaded per scene. The optional `lifecycle`
// arg is backward compatible: scenes that ignore it keep working.
interface SceneModule {
  createScene: (
    scene: Scene,
    canvas: HTMLCanvasElement,
    nav: NavigationActions,
    lifecycle?: SceneLifecycle,
  ) => { cameraHandle: CameraHandle; dispose: () => void };
}

/**
 * Manages the Three.js renderer lifecycle directly.
 * Lazy-loads scene modules on navigation and handles audio transitions.
 *
 * @param children - React children rendered as overlays on top of the canvas.
 * @returns The canvas element wrapped with overlay children.
 */
export function SceneFrame({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraHandleRef = useRef<CameraHandle | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const animFrameRef = useRef<number>(0);
  // Per-scene frame clock (ticked by the render loop) and disposal scope
  // (torn down on scene unload). See architecture-standards.md.
  const clockRef = useRef<FrameClock | null>(null);
  const scopeRef = useRef<DisposalScope | null>(null);

  const { currentScene, activeMiniGame, navigateTo, launchMiniGame, exitMiniGame } = useNavigation();
  useResponsive();
  const { startSceneAudio, stopSceneAudio, playSound, isAudioUnlocked } = useAudio();

  // While a minigame overlay is active the hub scene is fully covered — pause
  // its render loop so only one WebGL pipeline burns battery at a time.
  const renderPausedRef = useRef(false);
  useEffect(() => {
    renderPausedRef.current = activeMiniGame !== null;
  }, [activeMiniGame]);

  // Stable refs for async callbacks
  const navRef = useRef<NavigationActions>({ navigateTo, launchMiniGame, exitMiniGame });
  const audioRef = useRef({ startSceneAudio, stopSceneAudio, playSound });

  useEffect(() => {
    navRef.current = { navigateTo, launchMiniGame, exitMiniGame };
  }, [navigateTo, launchMiniGame, exitMiniGame]);

  useEffect(() => {
    audioRef.current = { startSceneAudio, stopSceneAudio, playSound };
  }, [startSceneAudio, stopSceneAudio, playSound]);

  // Create renderer once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = createConfiguredRenderer(canvas, { stencil: true });
    rendererRef.current = renderer;

    const scene = new Scene();
    applyDefaultEnvironment(renderer, scene);
    sceneRef.current = scene;

    // Render loop
    let lastTime = performance.now();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      if (!renderPausedRef.current && cameraHandleRef.current && sceneRef.current) {
        // Advance the active scene's clock only while it is the visible surface
        // (paused while a minigame overlay covers it).
        clockRef.current?.tick(rawDt);
        renderer.render(sceneRef.current, cameraHandleRef.current.camera);
      }
    };
    animate();

    // Resize handler
    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      cameraHandleRef.current?.resize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', onResize);
      if (disposeRef.current) {
        disposeRef.current();
        disposeRef.current = null;
      }
      scopeRef.current?.dispose();
      scopeRef.current = null;
      clockRef.current = null;
      if (cameraHandleRef.current) {
        cameraHandleRef.current.dispose();
        cameraHandleRef.current = null;
      }
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Load scene when currentScene changes
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    let cancelled = false;

    const loadScene = async () => {
      const loader = getSceneLoader(currentScene) as () => Promise<SceneModule>;
      if (!loader) return;

      try {
        const module = await loader();
        if (cancelled) return;

        // Dispose previous scene contents
        if (disposeRef.current) {
          audioRef.current.playSound('sfx_shared_transition_whoosh');
          audioRef.current.stopSceneAudio();
          disposeRef.current();
          disposeRef.current = null;
          scopeRef.current?.dispose();
          scopeRef.current = null;
          cameraHandleRef.current?.dispose();
          cameraHandleRef.current = null;

          // Clear the scene
          while (scene.children.length > 0) {
            scene.remove(scene.children[0]);
          }
        }

        const canvas = renderer.domElement;
        const nav = navRef.current;
        // Fresh clock + disposal scope for this scene instance.
        const clock = createFrameClock();
        const scope = createDisposalScope();
        clockRef.current = clock;
        scopeRef.current = scope;
        // Register this scene's particle engine before createScene runs, so any
        // effects it wires up can resolve getParticleEngine(scene). Bound to the
        // fresh clock+scope, so the previous scene's engine is already gone.
        // See architecture-standards.md#particleengine.
        setSceneParticleEngine(scene, clock, scope);
        // Idle animator, whose looping tweens are killed by the same scope.
        // See architecture-standards.md#idleanimator.
        setSceneIdleAnimator(scene, scope);
        // Publish clock+scope for deep effects to share the pump. See #frameclock.
        setSceneRuntime(scene, clock, scope);
        const result = module.createScene(scene, canvas, nav, { clock, disposal: scope });
        cameraHandleRef.current = result.cameraHandle;
        disposeRef.current = result.dispose;
      } catch (e) {
        console.error(`[SceneFrame] Error loading scene ${currentScene}:`, e);
      }

      audioRef.current.playSound('sfx_shared_transition_arrive');
      audioRef.current.startSceneAudio(currentScene);
    };

    loadScene();

    return () => {
      cancelled = true;
    };
  }, [currentScene]);

  // Start audio when first unlocked — unless a minigame is already open
  // (e.g. a deep link straight into a game), in which case the game owns
  // the soundstage and the scene beds start on exit instead.
  useEffect(() => {
    if (isAudioUnlocked && activeMiniGame === null) {
      audioRef.current.startSceneAudio(currentScene);
    }
  }, [isAudioUnlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hand the soundstage over to minigames: fade the scene's music/ambient out
  // when a game opens (each game owns its own audio identity), and restore the
  // scene's beds when the game exits. The stop happens synchronously at game
  // launch, well before the lazy-loaded game's own playMusic can run, so a
  // game bed started during setup is never clobbered.
  const prevMiniGameRef = useRef<typeof activeMiniGame>(null);
  useEffect(() => {
    const wasActive = prevMiniGameRef.current !== null;
    const isActive = activeMiniGame !== null;
    if (!wasActive && isActive) {
      audioRef.current.stopSceneAudio();
    } else if (wasActive && !isActive && isAudioUnlocked) {
      audioRef.current.startSceneAudio(currentScene);
    }
    prevMiniGameRef.current = activeMiniGame;
  }, [activeMiniGame, currentScene, isAudioUnlocked]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
      {children}
    </div>
  );
}
