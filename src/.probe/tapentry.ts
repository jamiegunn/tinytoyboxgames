// Probe entry point. Bundling this single file makes the interaction handlers
// and the particle registry share ONE module instance, so an engine registered
// here is the engine `getParticleEngine(scene)` hands to the handlers. Bundling
// interactions.ts on its own would give it a private copy of the registry and
// every emit would silently go to the no-op engine -- which would have read as
// "no feedback at all" and looked like a dramatic finding.

export * from '@app/minigames/games/little-shark/interactions';
export { setSceneParticleEngine } from '@app/utils/particles/registry';
export { PARTICLES } from '@app/utils/particles/presets';
export { createSharkAnimState } from '@app/minigames/games/little-shark/shark';
