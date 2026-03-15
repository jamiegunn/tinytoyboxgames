import { simplex2 } from './noise';

/**
 * 2D flow field driven by simplex noise.
 * Bubbles sample the field at their position to get a velocity contribution,
 * producing organic, non-linear drift patterns.
 */

/** Flow field tuning parameters. */
export interface FlowFieldConfig {
  /** Spatial frequency — higher = more turbulent. Default 0.15. */
  frequency: number;
  /** Time evolution speed — how fast the field changes. Default 0.3. */
  timeScale: number;
  /** Strength multiplier for the velocity output. Default 0.4. */
  strength: number;
  /** Base upward drift added to all samples (replaces linear y-movement). */
  baseRise: number;
}

/** Default flow field configuration for gentle bubble motion. */
export const DEFAULT_FLOW_CONFIG: FlowFieldConfig = {
  frequency: 0.15,
  timeScale: 0.3,
  strength: 0.4,
  baseRise: 0.3,
};

/**
 * Samples the flow field at a 2D position and time.
 * Returns velocity components via the out parameter (no allocation).
 * @param x - World X position.
 * @param y - World Y position.
 * @param time - Elapsed game time in seconds.
 * @param config - Flow field parameters.
 * @param outVx - Reference for X velocity output.
 * @param outVy - Reference for Y velocity output.
 * @returns A tuple-like object with vx and vy.
 */
export function sampleFlowField(x: number, y: number, time: number, config: FlowFieldConfig): { vx: number; vy: number } {
  const f = config.frequency;
  const t = time * config.timeScale;

  // Two noise samples offset in space give orthogonal-ish velocity components
  const vx = simplex2(x * f + t, y * f + 100) * config.strength;
  const vy = simplex2(x * f + 200, y * f + t) * config.strength + config.baseRise;

  return { vx, vy };
}

/**
 * Samples the flow field into pre-existing output object (zero-allocation version).
 * @param x - World X position.
 * @param y - World Y position.
 * @param time - Elapsed game time.
 * @param config - Flow field parameters.
 * @param out - Object with vx/vy fields to write into.
 */
export function sampleFlowFieldInto(x: number, y: number, time: number, config: FlowFieldConfig, out: { vx: number; vy: number }): void {
  const f = config.frequency;
  const t = time * config.timeScale;
  out.vx = simplex2(x * f + t, y * f + 100) * config.strength;
  out.vy = simplex2(x * f + 200, y * f + t) * config.strength + config.baseRise;
}
