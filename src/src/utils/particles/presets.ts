/**
 * Particle presets — the data behind every effect the engine can emit.
 *
 * See architecture-standards.md#particleengine. Each preset is a faithful port
 * of a legacy effect (`utils/particles.ts`, `utils/particleFactory.ts`,
 * `minigames/shared/particleFx.ts`, plus the owl's inline systems), so the
 * migration preserves the *shipped* look. Two deliberate, documented choices:
 *
 * 1. Emission is a cone `[phiMin, phiMax]` around an `axis`, sampled
 *    area-correctly (cosφ uniform). The legacy `direction1/direction2` boxes
 *    were converted to cones by sampling the box corners for their angular
 *    spread about the box centroid (the axis); symmetric boxes become the full
 *    sphere `[0, π]`. Gravity was a vertical vector `(0, g, 0)` and is now the
 *    scalar `-g` (the engine subtracts: `v.y -= gravity·dt`).
 *
 * 2. `size` is `0.1` for every preset. The legacy `PointsMaterial` path
 *    (`gl_PointSize = size` uniform, no per-vertex size attribute) rendered
 *    every system at the class default 0.1 regardless of its configured size
 *    range — so 0.1 *is* the shipped look. The authored ranges are preserved in
 *    the porting comments; realising true per-effect sizing is a future,
 *    separately-reviewed change (it would need a size shader).
 */

import { Color, Vector3 } from 'three';
import type { ParticlePreset } from './engine';

/** Uniform render size — matches the legacy PointsMaterial default (see header). */
const SIZE = 0.1;

// ── Scene effects (ported from utils/particles.ts + particleFactory.ts) ───────

/** Golden upward sparkle burst — generic scene tap feedback (was particles.createSparkleBurst). */
export const SCENE_SPARKLE: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 40,
  capacity: 64,
  lifetime: [0.3, 0.8],
  speed: [1, 2.5],
  cone: [0, 0.82], // legacy box (±1.5, 2..3, ±1.5) → ~47° upward cone
  gravity: 1, // was (0, -1, 0)
  size: SIZE, // authored 0.03–0.08
  colors: [new Color(1, 0.95, 0.5), new Color(1, 0.8, 0.3)],
  opacity: [0.8, 1],
};

/** Soft brown dust puff that drifts up and fades (was particles.createDustPuff). */
export const SCENE_DUST: ParticlePreset = {
  texture: 'circle',
  blending: 'normal',
  count: 12,
  capacity: 24,
  lifetime: [0.3, 0.6],
  speed: [0.3, 0.6],
  cone: [0, 0.955], // ±0.5, 0.5..1, ±0.5 → ~55° cone
  gravity: -0.3, // was (0, 0.3, 0) — floats up
  size: SIZE, // authored 0.04–0.1
  colors: [new Color(0.6, 0.55, 0.4), new Color(0.5, 0.45, 0.35)],
  opacity: [0.25, 0.4],
};

/** Ambient warm dust motes drifting in a lit room (was particles.createDustMotes; stream). */
export const DUST_MOTES: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 1,
  capacity: 48,
  lifetime: [4, 8],
  speed: [0.01, 0.03],
  cone: [0, Math.PI], // near-still isotropic drift
  gravity: 0.02, // was (0, -0.02, 0)
  size: SIZE, // authored 0.02–0.06
  colors: [new Color(1, 0.95, 0.8), new Color(1, 0.9, 0.75)],
  opacity: [0.15, 0.3],
};
/** Continuous emit rate (particles/sec) for {@link DUST_MOTES}. */
export const DUST_MOTES_RATE = 5;

/** Yellow pollen puff floating up from a flower (was POLLEN_BURST). */
export const POLLEN: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 20,
  capacity: 30,
  lifetime: [0.5, 1.2],
  speed: [0.1, 0.3],
  cone: [0, 0.955],
  gravity: -0.15, // was (0, 0.15, 0)
  size: SIZE, // authored 0.015–0.04
  colors: [new Color(1, 0.95, 0.5), new Color(0.9, 0.85, 0.3)],
  opacity: [0.3, 0.6],
};

/** Blue outward water ripple at a stream tap (was WATER_RIPPLE). */
export const WATER_RIPPLE: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 15,
  capacity: 24,
  lifetime: [0.4, 0.8],
  speed: [0.2, 0.5],
  cone: [0, 1.295], // ~74° — wide, near-horizontal splay
  gravity: 0,
  size: SIZE, // authored 0.02–0.06
  colors: [new Color(0.5, 0.7, 0.9), new Color(0.4, 0.6, 0.8)],
  opacity: [0.3, 0.5],
};

/** Slow green forest-floor spores drifting up (was GLOW_SPORES; stream). */
export const GLOW_SPORES: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 1,
  capacity: 48,
  lifetime: [4, 8],
  speed: [0.01, 0.03],
  cone: [0, 1.13],
  gravity: -0.05, // was (0, 0.05, 0)
  size: SIZE, // authored 0.02–0.05
  colors: [new Color(0.5, 0.8, 0.3), new Color(0.3, 0.7, 0.2)],
  opacity: [0.2, 0.4],
};
/** Continuous emit rate (particles/sec) for {@link GLOW_SPORES}. */
export const GLOW_SPORES_RATE = 4;

/** Pirate cannon confetti fired down-range (was cannon CONFETTI_BURST). */
export const CANNON_CONFETTI: ParticlePreset = {
  texture: 'circle',
  blending: 'normal',
  count: 30,
  capacity: 48,
  lifetime: [0.6, 1.4],
  speed: [0.8, 1.5],
  cone: [0, 0.488], // ~28° tight cone
  axis: new Vector3(0, 0.447, -0.894), // up-and-forward (−Z), from the legacy box
  gravity: 0.8, // was (0, -0.8, 0)
  size: SIZE, // authored 0.02–0.06
  colors: [new Color(1, 0.4, 0.5), new Color(0.3, 0.6, 1)],
  opacity: [0.8, 1],
};

/** Treasure-chest gold sparkle rising on open (was treasureChest GOLD_SPARKLE_BURST). */
export const TREASURE_GOLD: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 25,
  capacity: 40,
  lifetime: [0.5, 1.2],
  speed: [0.2, 0.6],
  cone: [0, 0.955],
  gravity: -0.2, // was (0, 0.2, 0)
  size: SIZE, // authored 0.015–0.05
  colors: [new Color(1, 0.9, 0.4), new Color(0.9, 0.75, 0.2)],
  opacity: [0.4, 0.9],
};

// ── Minigame effects (ported from minigames/shared/particleFx.ts) ─────────────

/**
 * Radial star sparkle burst, colour supplied per call (was particleFx.createSparkleBurst).
 * Callers override `colors` (single tint) and often `count`.
 */
export const SPARKLE: ParticlePreset = {
  texture: 'star',
  blending: 'additive',
  count: 20,
  capacity: 256, // shared across all overlapping bursts (short-lived)
  lifetime: [0.15, 0.35],
  speed: [2, 4],
  cone: [0, Math.PI], // full sphere
  gravity: 2, // was (0, -2, 0)
  size: SIZE, // authored 0.08–0.1
  colors: [new Color(1, 1, 1)],
  opacity: [0, 1], // random start alpha 0..1, matching legacy alpha1:1 alpha2:0
};

/** Small radial fragment pop, colour per call (was particleFx.createBubblePopEffect). */
export const BUBBLE_POP: ParticlePreset = {
  texture: 'circle',
  blending: 'normal',
  count: 15,
  capacity: 128,
  lifetime: [0.1, 0.3],
  speed: [2, 4],
  cone: [0, Math.PI],
  gravity: 3, // was (0, -3, 0)
  size: SIZE, // authored 0.04–0.08
  colors: [new Color(1, 1, 1)],
  opacity: [0, 1],
};

/** Continuous glow trail following a moving entity, colour per call (was createGlowTrail; stream). */
export const GLOW_TRAIL: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 1,
  capacity: 64,
  lifetime: [0.3, 0.8],
  speed: [0.3, 0.5],
  cone: [0, Math.PI],
  gravity: 0,
  size: SIZE, // authored 0.03–0.06
  colors: [new Color(1, 1, 1)],
  opacity: [0.6, 1],
};
/** Default emit rate (particles/sec) for {@link GLOW_TRAIL}. */
export const GLOW_TRAIL_RATE = 25;

/** Gold pickup sparkle for collectibles (was particleFx.createStarCollect). */
export const STAR_COLLECT: ParticlePreset = {
  texture: 'star',
  blending: 'additive',
  count: 10,
  capacity: 96,
  lifetime: [0.5, 0.8],
  speed: [2, 4],
  cone: [0, 0.847], // ~49° upward
  gravity: 1, // was (0, -1, 0)
  size: SIZE, // authored 0.08–0.15
  colors: [new Color(1, 0.85, 0.2), new Color(1, 0.7, 0.1)],
  opacity: [1, 1],
};

/** Low-rate firefly glow surrounding a moving entity, colour per call (was createFireflyGlow; stream). */
export const FIREFLY_GLOW: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 1,
  capacity: 256, // every firefly streams into this one shared batch
  lifetime: [0.5, 1.2],
  speed: [0.05, 0.15],
  cone: [0, Math.PI],
  gravity: 0,
  size: SIZE, // authored 0.02–0.04
  colors: [new Color(1, 1, 1)],
  opacity: [0.6, 0.9],
};
/** Default emit rate (particles/sec) for {@link FIREFLY_GLOW}. */
export const FIREFLY_GLOW_RATE = 4;

// ── Owl entity effects (ported from entities/owl/effects.ts inline systems) ───

/** Owl tap-reaction sparkle (was owl spawnAlertBurst). */
export const OWL_ALERT: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 8,
  capacity: 16,
  lifetime: [0.25, 0.45],
  speed: [0.15, 0.5],
  cone: [0, 0.704],
  gravity: 0.2, // was (0, -0.2, 0)
  size: SIZE, // authored 0.012–0.035
  colors: [new Color(1, 0.95, 0.8), new Color(1, 0.88, 0.6)],
  opacity: [0.4, 0.7],
};

/** Owl flight trail following the bird (was owl startFlightTrail; stream). */
export const OWL_TRAIL: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 1,
  capacity: 20,
  lifetime: [0.2, 0.45],
  speed: [0.06, 0.18],
  cone: [0, Math.PI],
  gravity: 0.15, // was (0, -0.15, 0)
  size: SIZE, // authored 0.01–0.03
  colors: [new Color(1, 0.95, 0.8), new Color(1, 0.88, 0.6)],
  opacity: [0.25, 0.45],
};
/** Emit rate (particles/sec) for {@link OWL_TRAIL}. */
export const OWL_TRAIL_RATE = 12;

/** Owl celebratory landing burst (was owl spawnLandingBurst). */
export const OWL_LANDING: ParticlePreset = {
  texture: 'circle',
  blending: 'additive',
  count: 18,
  capacity: 28,
  lifetime: [0.3, 0.6],
  speed: [0.15, 0.4],
  cone: [0, 1.17],
  gravity: 0.1, // was (0, -0.1, 0)
  size: SIZE, // authored 0.015–0.04
  colors: [new Color(1, 0.95, 0.7), new Color(1, 0.8, 0.4)],
  opacity: [0.3, 0.8],
};

/** Named registry of all presets (see architecture-standards.md#particleengine). */
export const PARTICLES = {
  sceneSparkle: SCENE_SPARKLE,
  sceneDust: SCENE_DUST,
  dustMotes: DUST_MOTES,
  pollen: POLLEN,
  waterRipple: WATER_RIPPLE,
  glowSpores: GLOW_SPORES,
  cannonConfetti: CANNON_CONFETTI,
  treasureGold: TREASURE_GOLD,
  sparkle: SPARKLE,
  bubblePop: BUBBLE_POP,
  glowTrail: GLOW_TRAIL,
  starCollect: STAR_COLLECT,
  fireflyGlow: FIREFLY_GLOW,
  owlAlert: OWL_ALERT,
  owlTrail: OWL_TRAIL,
  owlLanding: OWL_LANDING,
} as const;
