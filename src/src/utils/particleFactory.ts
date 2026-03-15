import { Color, Vector3, type Scene } from 'three';
import { SimpleParticleSystem } from './particles';

/**
 * Configuration for a one-shot particle burst effect.
 * All burst-type particle systems across scenes follow this same skeleton;
 * the only differences are the parameter values.
 */
export interface BurstConfig {
  /** Maximum particle capacity. */
  capacity: number;
  /** Number of particles to emit in the burst. */
  emitCount: number;
  /** Particle lifetime range [min, max] in seconds. */
  lifetime: [number, number];
  /** Particle size range [min, max]. */
  size: [number, number];
  /** Start colour (RGB). */
  color1: Color;
  /** Start alpha. */
  alpha1: number;
  /** End colour (RGB). */
  color2: Color;
  /** End alpha. */
  alpha2: number;
  /** Gravity vector. */
  gravity: Vector3;
  /** Minimum emission direction. */
  direction1: Vector3;
  /** Maximum emission direction. */
  direction2: Vector3;
  /** Emission power range [min, max]. */
  emitPower: [number, number];
  /** Blend mode. @default 'additive' */
  blendMode?: 'additive' | 'normal';
}

/**
 * Creates a one-shot burst particle effect at the given origin.
 * The particle system self-disposes after the burst completes.
 *
 * @param scene - The Three.js scene.
 * @param origin - World-space emission point.
 * @param config - Burst configuration.
 */
export function createBurstEffect(scene: Scene, origin: Vector3, config: BurstConfig): void {
  const ps = new SimpleParticleSystem(config.capacity, config.blendMode ?? 'additive');
  ps.configure({
    emitterPosition: origin,
    minLifeTime: config.lifetime[0],
    maxLifeTime: config.lifetime[1],
    minSize: config.size[0],
    maxSize: config.size[1],
    color1: config.color1,
    alpha1: config.alpha1,
    color2: config.color2,
    alpha2: config.alpha2,
    gravity: config.gravity,
    direction1: config.direction1,
    direction2: config.direction2,
    minEmitPower: config.emitPower[0],
    maxEmitPower: config.emitPower[1],
  });
  ps.burst(config.emitCount);
  ps.stop();
  ps.start(scene, true);
}

/** Pollen burst — upward-floating yellow spores (Nature flowers). */
export const POLLEN_BURST: BurstConfig = {
  capacity: 25,
  emitCount: 20,
  lifetime: [0.5, 1.2],
  size: [0.015, 0.04],
  color1: new Color(1, 0.95, 0.5),
  alpha1: 0.6,
  color2: new Color(0.9, 0.85, 0.3),
  alpha2: 0.3,
  gravity: new Vector3(0, 0.15, 0),
  direction1: new Vector3(-0.3, 0.3, -0.3),
  direction2: new Vector3(0.3, 0.6, 0.3),
  emitPower: [0.1, 0.3],
};

/** Water ripple — outward-flowing blue rings (Nature stream). */
export const WATER_RIPPLE: BurstConfig = {
  capacity: 20,
  emitCount: 15,
  lifetime: [0.4, 0.8],
  size: [0.02, 0.06],
  color1: new Color(0.5, 0.7, 0.9),
  alpha1: 0.5,
  color2: new Color(0.4, 0.6, 0.8),
  alpha2: 0.3,
  gravity: new Vector3(0, 0, 0),
  direction1: new Vector3(-0.5, 0.2, -0.5),
  direction2: new Vector3(0.5, 0.4, 0.5),
  emitPower: [0.2, 0.5],
};

/** Glitter cascade — downward-falling sparkly particles (Creative glitter jars). */
export const GLITTER_CASCADE: BurstConfig = {
  capacity: 50,
  emitCount: 40,
  lifetime: [0.5, 1.5],
  size: [0.01, 0.04],
  color1: new Color(1, 0.9, 0.5),
  alpha1: 1,
  color2: new Color(0.9, 0.5, 0.8),
  alpha2: 0.8,
  gravity: new Vector3(0, -0.5, 0),
  direction1: new Vector3(-0.5, 0.5, -0.5),
  direction2: new Vector3(0.5, 1, 0.5),
  emitPower: [0.3, 0.8],
};

/**
 * Creates a colour-matched burst effect from a base colour.
 * Used for paint blob splat effects where the particle colours match the paint.
 *
 * @param scene - The Three.js scene.
 * @param origin - World-space emission point.
 * @param color - The base colour to derive particle tinting from.
 */
export function createColorBurstEffect(scene: Scene, origin: Vector3, color: Color): void {
  createBurstEffect(scene, origin, {
    capacity: 40,
    emitCount: 30,
    lifetime: [0.3, 0.7],
    size: [0.03, 0.08],
    color1: color.clone(),
    alpha1: 1,
    color2: color.clone().multiplyScalar(0.8),
    alpha2: 0.8,
    gravity: new Vector3(0, -1, 0),
    direction1: new Vector3(-1.5, 2, -1.5),
    direction2: new Vector3(1.5, 3, 1.5),
    emitPower: [1, 2],
  });
}

// ── Continuous Particle Systems ───────────────────────────────────────────────

/**
 * Configuration for a continuous ambient particle system (not a one-shot burst).
 */
export interface ContinuousConfig {
  /** Maximum particle capacity. */
  capacity: number;
  /** Continuous emit rate (particles per second). */
  emitRate: number;
  /** Particle lifetime range [min, max] in seconds. */
  lifetime: [number, number];
  /** Particle size range [min, max]. */
  size: [number, number];
  /** Start colour. */
  color1: Color;
  /** Start alpha. */
  alpha1: number;
  /** End colour. */
  color2: Color;
  /** End alpha. */
  alpha2: number;
  /** Gravity vector. */
  gravity: Vector3;
  /** Minimum emission direction. */
  direction1: Vector3;
  /** Maximum emission direction. */
  direction2: Vector3;
  /** Emission power range [min, max]. */
  emitPower: [number, number];
  /** Blend mode. @default 'additive' */
  blendMode?: 'additive' | 'normal';
}

/** Glow spores — slow ambient green spores floating across the forest floor (Nature). */
export const GLOW_SPORES: ContinuousConfig = {
  capacity: 30,
  emitRate: 4,
  lifetime: [4, 8],
  size: [0.02, 0.05],
  color1: new Color(0.5, 0.8, 0.3),
  alpha1: 0.4,
  color2: new Color(0.3, 0.7, 0.2),
  alpha2: 0.2,
  gravity: new Vector3(0, 0.05, 0),
  direction1: new Vector3(-0.03, 0.02, -0.03),
  direction2: new Vector3(0.03, 0.05, 0.03),
  emitPower: [0.01, 0.03],
};

/**
 * Creates a continuous ambient particle system from a preset config.
 * The caller is responsible for stopping and disposing the returned system.
 *
 * @param scene - The Three.js scene.
 * @param config - Continuous particle configuration.
 * @returns The running SimpleParticleSystem instance (caller must dispose).
 */
export function createContinuousEffect(scene: Scene, config: ContinuousConfig): SimpleParticleSystem {
  const ps = new SimpleParticleSystem(config.capacity, config.blendMode ?? 'additive');
  ps.configure({
    emitRate: config.emitRate,
    minLifeTime: config.lifetime[0],
    maxLifeTime: config.lifetime[1],
    minSize: config.size[0],
    maxSize: config.size[1],
    color1: config.color1,
    alpha1: config.alpha1,
    color2: config.color2,
    alpha2: config.alpha2,
    gravity: config.gravity,
    direction1: config.direction1,
    direction2: config.direction2,
    minEmitPower: config.emitPower[0],
    maxEmitPower: config.emitPower[1],
  });
  ps.start(scene);
  return ps;
}
