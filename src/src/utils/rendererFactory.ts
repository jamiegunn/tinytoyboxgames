/**
 * Shared renderer configuration for every WebGL surface in the app.
 *
 * Both the persistent hub renderer (SceneFrame) and each minigame renderer
 * (MiniGameShell) must agree on tone mapping, color space, shadow filtering,
 * and pixel-ratio policy, or scenes will look different between contexts.
 * This factory is the single place those decisions live.
 *
 * The three settings that matter most for the "warm, toy-like, premium" look:
 * - ACES filmic tone mapping: soft highlight rolloff instead of hard clipping
 *   on emissive glows (moons, portals, fireflies).
 * - PCFSoft shadows: the soul doc's "shadows are soft" made literal.
 * - A PMREM room environment: gives StandardMaterials (especially metals)
 *   something to reflect, adding material richness at near-zero per-frame cost.
 */

import { ACESFilmicToneMapping, PCFSoftShadowMap, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer, type Texture } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getMaxPixelRatio } from './qualityTier';

/** Default environment intensity — subtle fill, not a lighting takeover. Kept
 * low so the directional key light (not the flat IBL) shapes form and the soft
 * shadows read; the per-scene hemisphere fill supplies the rest. */
const DEFAULT_ENV_INTENSITY = 0.24;

/** Options for {@link createConfiguredRenderer}. */
export interface RendererOptions {
  /** Enable the stencil buffer (needed by the hub scene pipeline). */
  stencil?: boolean;
}

/**
 * Creates a WebGLRenderer with the app-wide quality configuration applied.
 *
 * @param canvas - The target canvas element.
 * @param options - Optional renderer flags.
 * @returns A configured WebGLRenderer.
 */
export function createConfiguredRenderer(canvas: HTMLCanvasElement, options: RendererOptions = {}): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    stencil: options.stencil ?? false,
    powerPreference: 'high-performance',
  });
  // Tier-aware DPR cap — capping pixel ratio is the single biggest mobile
  // GPU saving available (DPR 3 costs 2.25x the pixels of DPR 2).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getMaxPixelRatio()));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  return renderer;
}

/**
 * PMREM environment textures are render targets tied to a specific GL
 * context, so each renderer needs its own copy.
 */
const envTextures = new WeakMap<WebGLRenderer, Texture>();

/**
 * Applies the shared neutral room environment to a scene, giving every
 * MeshStandardMaterial soft image-based fill and reflections.
 *
 * @param renderer - The renderer that will draw the scene.
 * @param scene - The scene to receive the environment.
 * @param intensity - Optional environment intensity override.
 */
export function applyDefaultEnvironment(renderer: WebGLRenderer, scene: Scene, intensity: number = DEFAULT_ENV_INTENSITY): void {
  let envTexture = envTextures.get(renderer);
  if (!envTexture) {
    const pmrem = new PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    envTextures.set(renderer, envTexture);
  }
  scene.environment = envTexture;
  scene.environmentIntensity = intensity;
}
