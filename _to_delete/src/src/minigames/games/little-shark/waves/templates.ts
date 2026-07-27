import type { FishSpeciesId } from '../fish/species';

/** Formation pattern for a wave of fish. */
export type WaveFormation = 'scatter' | 'school' | 'parade' | 'circle';

/** Template defining the composition of a single wave. */
export interface WaveTemplate {
  /** Species to spawn in this wave. */
  species: FishSpeciesId[];
  /** Total fish count. */
  count: number;
  /** Spawn formation. */
  formation: WaveFormation;
  /** Speed multiplier for this wave's fish. */
  speedMult: number;
  /** Whether a golden angelfish appears. */
  hasGolden: boolean;
  /** Rest duration after this wave (seconds). */
  breathDuration: number;
  /** Optional display name for wave announcements. */
  name?: string;
}

/** All available formation patterns for random selection. */
const ALL_FORMATIONS: WaveFormation[] = ['scatter', 'school', 'parade', 'circle'];

/** Non-golden species pool for endless wave generation. */
const ENDLESS_SPECIES_POOL: FishSpeciesId[] = ['clownfish', 'blueTang', 'pufferfish', 'seahorse', 'goldenAngelfish'];

/** Hand-crafted wave templates providing a gentle difficulty progression arc. */
const WAVE_TEMPLATES: readonly WaveTemplate[] = Object.freeze([
  {
    name: 'First Friends',
    species: ['clownfish'],
    count: 3,
    formation: 'scatter',
    speedMult: 0.8,
    hasGolden: false,
    breathDuration: 4.0,
  },
  {
    name: 'More Friends',
    species: ['clownfish', 'blueTang'],
    count: 4,
    formation: 'scatter',
    speedMult: 0.9,
    hasGolden: false,
    breathDuration: 3.5,
  },
  {
    name: "School's In",
    species: ['blueTang'],
    count: 6,
    formation: 'school',
    speedMult: 1.0,
    hasGolden: false,
    breathDuration: 3.0,
  },
  {
    name: 'Slow Pokes',
    species: ['pufferfish', 'clownfish'],
    count: 4,
    formation: 'scatter',
    speedMult: 0.7,
    hasGolden: false,
    breathDuration: 3.5,
  },
  {
    name: 'Golden Moment',
    species: ['clownfish', 'blueTang'],
    count: 5,
    formation: 'scatter',
    speedMult: 1.0,
    hasGolden: true,
    breathDuration: 4.0,
  },
  {
    name: 'Curious Visitor',
    species: ['seahorse', 'clownfish'],
    count: 4,
    formation: 'scatter',
    speedMult: 0.8,
    hasGolden: false,
    breathDuration: 3.0,
  },
  {
    name: 'Big School',
    species: ['blueTang', 'clownfish'],
    count: 8,
    formation: 'school',
    speedMult: 1.1,
    hasGolden: false,
    breathDuration: 3.0,
  },
  {
    name: 'Mixed Reef',
    species: ['clownfish', 'pufferfish', 'seahorse'],
    count: 6,
    formation: 'scatter',
    speedMult: 1.0,
    hasGolden: false,
    breathDuration: 3.5,
  },
  {
    name: 'Golden Chase',
    species: ['blueTang', 'clownfish'],
    count: 6,
    formation: 'parade',
    speedMult: 1.2,
    hasGolden: true,
    breathDuration: 4.0,
  },
  {
    name: 'Reef Party',
    species: ['clownfish', 'blueTang', 'pufferfish', 'seahorse'],
    count: 8,
    formation: 'circle',
    speedMult: 1.0,
    hasGolden: true,
    breathDuration: 5.0,
  },
] as WaveTemplate[]);

/**
 * Returns the wave template for a given wave number (1-indexed).
 * Cycles back to wave 1 after wave 10.
 *
 * @param waveNumber - The 1-indexed wave number.
 * @returns The corresponding wave template.
 */
export function getWaveTemplate(waveNumber: number): WaveTemplate {
  const index = (((waveNumber - 1) % WAVE_TEMPLATES.length) + WAVE_TEMPLATES.length) % WAVE_TEMPLATES.length;
  return WAVE_TEMPLATES[index];
}

/**
 * Returns all hand-crafted templates in order.
 *
 * @returns A frozen array of all 10 wave templates.
 */
export function getAllTemplates(): readonly WaveTemplate[] {
  return WAVE_TEMPLATES;
}

/**
 * Generates a random "endless" template for waves beyond the designed set.
 * Difficulty scales gently with wave number.
 *
 * @param waveNumber - The 1-indexed wave number (typically > 10).
 * @returns A procedurally generated wave template.
 */
export function generateEndlessTemplate(waveNumber: number): WaveTemplate {
  // Fish count: 5 + floor(random * 4), capped at 10
  const count = Math.min(5 + Math.floor(Math.random() * 4), 10);

  // Pick 2-3 random species from the full pool
  const speciesCount = 2 + (Math.random() > 0.5 ? 1 : 0);
  const shuffled = [...ENDLESS_SPECIES_POOL].sort(() => Math.random() - 0.5);
  const species = shuffled.slice(0, speciesCount);

  // Random formation
  const formation = ALL_FORMATIONS[Math.floor(Math.random() * ALL_FORMATIONS.length)];

  // Speed scales gently: 1.0 + min((waveNumber - 10) * 0.03, 0.3)
  const speedMult = 1.0 + Math.min((waveNumber - 10) * 0.03, 0.3);

  // Golden every 3rd wave
  const hasGolden = waveNumber % 3 === 0;

  // Breath duration: random between 3.0 and 4.0
  const breathDuration = 3.0 + Math.random();

  return {
    species,
    count,
    formation,
    speedMult,
    hasGolden,
    breathDuration,
    name: `Endless Wave ${waveNumber}`,
  };
}
