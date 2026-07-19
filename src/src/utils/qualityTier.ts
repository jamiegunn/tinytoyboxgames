/**
 * Device quality tier detection.
 *
 * Derives a single quality tier ('low' | 'medium' | 'high') once at startup
 * from cheap, deterministic device signals — devicePixelRatio, CPU core
 * count, and touch capability. Renderer and shadow configuration consume
 * the tier so low-end phones get smaller shadow maps and a lower pixel-ratio
 * cap while desktops keep full quality.
 *
 * Deliberately simple: no runtime FPS watchdog, no mid-session tier changes.
 * A deterministic tier means scenes look identical across a play session and
 * shaders never recompile because a heuristic changed its mind.
 */

/** The three quality tiers the app renders at. */
export type QualityTier = 'low' | 'medium' | 'high';

/** Cached tier — computed once on first access. */
let cachedTier: QualityTier | null = null;

/**
 * Computes the quality tier from device signals.
 *
 * Heuristic:
 * - Non-touch devices with 8+ cores (desktops/laptops) → 'high'.
 * - Touch devices with few cores or very dense screens (older/cheaper
 *   phones, where DPR 3 rendering is the main GPU cost) → 'low'.
 * - Everything else (iPads, modern phones, modest desktops) → 'medium'.
 *
 * @returns The derived quality tier.
 */
function computeTier(): QualityTier {
  // Guard for non-browser environments (tests, SSR) — assume mid-tier.
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'medium';
  }

  const dpr = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  const isTouchDevice = 'ontouchstart' in window;

  if (!isTouchDevice && cores >= 8) {
    return 'high';
  }
  if (isTouchDevice && (cores <= 4 || dpr >= 3)) {
    return 'low';
  }
  return 'medium';
}

/**
 * Returns the device quality tier, computing it on first call and caching
 * the result for the rest of the session.
 *
 * @returns The quality tier for this device.
 */
export function getQualityTier(): QualityTier {
  if (cachedTier === null) {
    cachedTier = computeTier();
  }
  return cachedTier;
}

/**
 * Returns the shadow map resolution appropriate for the device tier.
 *
 * @returns Shadow map size in pixels per side (512, 1024, or 2048).
 */
export function getShadowMapSize(): number {
  switch (getQualityTier()) {
    case 'low':
      return 512;
    case 'medium':
      return 1024;
    case 'high':
      return 2048;
  }
}

/**
 * Returns the device-pixel-ratio cap for the renderer. Rendering above
 * DPR 2 costs 2.25x the pixels with no visible benefit at toy-scene detail
 * levels; low-tier devices are capped harder at 1.5.
 *
 * @returns The maximum pixel ratio the renderer should use.
 */
export function getMaxPixelRatio(): number {
  return getQualityTier() === 'low' ? 1.5 : 2;
}
