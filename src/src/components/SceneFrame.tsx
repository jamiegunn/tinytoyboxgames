import { useRef, useEffect, type ReactNode } from 'react';
import { WebGLRenderer, Scene } from 'three';
import { useNavigation } from './SceneRouter';
import { useResponsive } from './ResponsiveProvider';
import { useAudio } from './AudioProvider';
import type { NavigationActions } from '@app/types/scenes';
import type { CameraHandle } from '@app/utils/cameraPresets';
import { getSceneLoader } from '@app/scenes/sceneCatalog';

// Scene factory registry â€” lazy-loaded per scene
interface SceneModule {
  createScene: (scene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions) => { cameraHandle: CameraHandle; dispose: () => void };
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

  const { currentScene, navigateTo, launchMiniGame, exitMiniGame } = useNavigation();
  useResponsive();
  const { startSceneAudio, stopSceneAudio, playSound, isAudioUnlocked } = useAudio();

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

    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      stencil: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    const scene = new Scene();
    sceneRef.current = scene;

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (cameraHandleRef.current && sceneRef.current) {
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
          cameraHandleRef.current?.dispose();
          cameraHandleRef.current = null;

          // Clear the scene
          while (scene.children.length > 0) {
            scene.remove(scene.children[0]);
          }
        }

        const canvas = renderer.domElement;
        const nav = navRef.current;
        const result = module.createScene(scene, canvas, nav);
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

  // Start audio when first unlocked
  useEffect(() => {
    if (isAudioUnlocked) {
      audioRef.current.startSceneAudio(currentScene);
    }
  }, [isAudioUnlocked]); // eslint-disable-line react-hooks/exhaustive-deps

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
