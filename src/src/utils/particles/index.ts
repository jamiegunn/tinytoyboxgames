/**
 * Particle system — public surface.
 *
 * See architecture-standards.md#particleengine. Import the engine, presets, and
 * the per-scene registry from here.
 */

export { createParticleEngine } from './engine';
export type { ParticleEngine, ParticlePreset, EmitOverrides, StreamHandle } from './engine';
export { getParticleTexture } from './texture';
export type { ParticleTextureKind } from './texture';
export * from './presets';
export { getParticleEngine, setSceneParticleEngine } from './registry';
