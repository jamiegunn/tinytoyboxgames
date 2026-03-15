import { Mesh, Color, PlaneGeometry, MeshBasicMaterial, DoubleSide, AdditiveBlending } from 'three';
import type { PerspectiveCamera } from 'three';

// ---------------------------------------------------------------------------
// Vignette pulse — brief edge-darkening overlay
// ---------------------------------------------------------------------------

/** Mutable state for the vignette screen effect. */
export interface VignetteState {
  mesh: Mesh;
  intensity: number;
  timer: number;
  duration: number;
  active: boolean;
}

/**
 * Create a full-screen vignette quad parented to the camera.
 *
 * @param camera - The perspective camera the quad attaches to.
 * @returns Initialised vignette state with opacity at zero.
 */
export function createVignette(camera: PerspectiveCamera): VignetteState {
  const geometry = new PlaneGeometry(2, 2);
  const material = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 999;
  mesh.position.set(0, 0, -0.5);
  mesh.raycast = () => {}; // Prevent raycaster from hitting screen-space overlays
  camera.add(mesh);

  return { mesh, intensity: 0, timer: 0, duration: 0.3, active: false };
}

/**
 * Trigger a vignette pulse that fades in then out.
 *
 * @param state - Vignette state to activate.
 * @param duration - Total effect duration in seconds (default 0.3).
 * @param intensity - Peak opacity of the darkening overlay (default 0.25).
 */
export function triggerVignette(state: VignetteState, duration = 0.3, intensity = 0.25): void {
  state.duration = duration;
  state.intensity = intensity;
  state.timer = 0;
  state.active = true;
}

/**
 * Advance the vignette animation by one frame.
 *
 * Ramps opacity up to intensity over the first 30 % of the duration, holds for
 * 20 %, then ramps down over the remaining 50 %.
 *
 * @param state - Vignette state to update.
 * @param dt - Delta time in seconds since the last frame.
 */
export function updateVignette(state: VignetteState, dt: number): void {
  if (!state.active) return;

  state.timer += dt;
  const t = Math.min(state.timer / state.duration, 1);
  const material = state.mesh.material as MeshBasicMaterial;

  if (t < 0.3) {
    // Ramp up
    material.opacity = state.intensity * (t / 0.3);
  } else if (t < 0.5) {
    // Hold
    material.opacity = state.intensity;
  } else {
    // Ramp down
    material.opacity = state.intensity * (1 - (t - 0.5) / 0.5);
  }

  if (t >= 1) {
    material.opacity = 0;
    state.active = false;
  }
}

// ---------------------------------------------------------------------------
// Speed lines — radial blur hint during lunge
// ---------------------------------------------------------------------------

/** Mutable state for the speed-line screen effect. */
export interface SpeedLineState {
  lines: Mesh[];
  active: boolean;
  timer: number;
  duration: number;
}

/**
 * Create a set of radially arranged speed-line quads parented to the camera.
 *
 * @param camera - The perspective camera the lines attach to.
 * @param count - Number of speed lines to create (default 8).
 * @returns Initialised speed-line state with all lines invisible.
 */
export function createSpeedLines(camera: PerspectiveCamera, count = 8): SpeedLineState {
  const lines: Mesh[] = [];
  const radius = 0.3;

  for (let i = 0; i < count; i++) {
    const geometry = new PlaneGeometry(0.002, 0.3);
    const material = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 999;
    mesh.raycast = () => {}; // Prevent raycaster from hitting screen-space overlays

    const angle = (i / count) * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -0.5);
    mesh.rotation.z = angle;

    camera.add(mesh);
    lines.push(mesh);
  }

  return { lines, active: false, timer: 0, duration: 0.3 };
}

/**
 * Trigger the speed-line effect.
 *
 * @param state - Speed-line state to activate.
 * @param duration - Total effect duration in seconds (default 0.3).
 */
export function triggerSpeedLines(state: SpeedLineState, duration = 0.3): void {
  state.duration = duration;
  state.timer = 0;
  state.active = true;

  // Reset scale to baseline
  for (const line of state.lines) {
    line.scale.set(1, 1, 1);
  }
}

/**
 * Advance the speed-line animation by one frame.
 *
 * Lines fade in quickly (first 0.05 s) to opacity 0.4, then fade out over the
 * remaining duration while stretching outward.
 *
 * @param state - Speed-line state to update.
 * @param dt - Delta time in seconds since the last frame.
 */
export function updateSpeedLines(state: SpeedLineState, dt: number): void {
  if (!state.active) return;

  state.timer += dt;
  const t = Math.min(state.timer / state.duration, 1);

  const fadeInEnd = Math.min(0.05 / state.duration, 1);
  let opacity: number;

  if (t < fadeInEnd) {
    // Quick fade in
    opacity = 0.4 * (t / fadeInEnd);
  } else {
    // Fade out over remaining duration
    opacity = 0.4 * (1 - (t - fadeInEnd) / (1 - fadeInEnd));
  }

  // Slight outward stretch — lines grow longer as they fade
  const stretchY = 1 + t * 0.5;

  for (const line of state.lines) {
    (line.material as MeshBasicMaterial).opacity = Math.max(opacity, 0);
    line.scale.y = stretchY;
  }

  if (t >= 1) {
    for (const line of state.lines) {
      (line.material as MeshBasicMaterial).opacity = 0;
    }
    state.active = false;
  }
}

// ---------------------------------------------------------------------------
// Color flash — brief full-screen additive color tint
// ---------------------------------------------------------------------------

/** Mutable state for the color-flash screen effect. */
export interface ColorFlashState {
  mesh: Mesh;
  timer: number;
  duration: number;
  peakIntensity: number;
  active: boolean;
}

/**
 * Create a full-screen additive-blended quad for colour flash effects.
 *
 * @param camera - The perspective camera the quad attaches to.
 * @returns Initialised colour-flash state with opacity at zero.
 */
export function createColorFlash(camera: PerspectiveCamera): ColorFlashState {
  const geometry = new PlaneGeometry(2, 2);
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: DoubleSide,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 999;
  mesh.position.set(0, 0, -0.5);
  mesh.raycast = () => {}; // Prevent raycaster from hitting screen-space overlays
  camera.add(mesh);

  return { mesh, timer: 0, duration: 0.2, peakIntensity: 0, active: false };
}

/**
 * Trigger a brief additive colour overlay.
 *
 * @param state - Colour-flash state to activate.
 * @param color - The tint colour (e.g. warm gold for a golden catch).
 * @param duration - Total effect duration in seconds (default 0.2).
 * @param intensity - Peak additive opacity (default 0.15).
 */
export function triggerColorFlash(state: ColorFlashState, color: Color, duration = 0.2, intensity = 0.15): void {
  const material = state.mesh.material as MeshBasicMaterial;
  material.color.copy(color);
  material.opacity = intensity;

  state.duration = duration;
  state.peakIntensity = intensity;
  state.timer = 0;
  state.active = true;
}

/**
 * Advance the colour-flash animation by one frame.
 *
 * Uses a sharp attack (first 10 % of duration) followed by exponential decay
 * to zero.
 *
 * @param state - Colour-flash state to update.
 * @param dt - Delta time in seconds since the last frame.
 */
export function updateColorFlash(state: ColorFlashState, dt: number): void {
  if (!state.active) return;

  state.timer += dt;
  const t = Math.min(state.timer / state.duration, 1);
  const material = state.mesh.material as MeshBasicMaterial;

  if (t < 0.1) {
    // Sharp attack — ramp to peak
    material.opacity = state.peakIntensity * (t / 0.1);
  } else {
    // Exponential decay over remaining 90 %
    const decayT = (t - 0.1) / 0.9;
    material.opacity = state.peakIntensity * Math.exp(-4 * decayT);
  }

  if (t >= 1) {
    material.opacity = 0;
    state.active = false;
  }
}

// ---------------------------------------------------------------------------
// Disposal
// ---------------------------------------------------------------------------

/**
 * Dispose all screen-effect meshes, geometries, and materials.
 *
 * @param vignette - Vignette state to clean up.
 * @param speedLines - Speed-line state to clean up.
 * @param colorFlash - Colour-flash state to clean up.
 */
export function disposeScreenFx(vignette: VignetteState, speedLines: SpeedLineState, colorFlash: ColorFlashState): void {
  const disposeMesh = (mesh: Mesh): void => {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    (mesh.material as MeshBasicMaterial).dispose();
  };

  disposeMesh(vignette.mesh);
  disposeMesh(colorFlash.mesh);

  for (const line of speedLines.lines) {
    disposeMesh(line);
  }
  speedLines.lines.length = 0;
}
