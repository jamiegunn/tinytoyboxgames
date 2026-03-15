import { Color } from 'three';

/** Movement pattern identifier for species-specific behaviors. */
export type FishMovement = 'sineDrift' | 'boids' | 'erratic' | 'bottomCrawl' | 'curious';

/** Unique species identifier. */
export type FishSpeciesId = 'clownfish' | 'blueTang' | 'pufferfish' | 'seahorse' | 'goldenAngelfish';

/** Definition of a fish species — visual and behavioral parameters. */
export interface FishSpecies {
  id: FishSpeciesId;
  displayName: string;
  bodyShape: 'round' | 'slim' | 'flat' | 'long' | 'tiny';
  colorPalette: Color[];
  scale: number;
  speed: number;
  points: number;
  movement: FishMovement;
  hitRadius: number;
  hasDodge: boolean;
  /** Spawn weight where higher values mean more common (0–1 range). */
  rarity: number;
  /** Number of fish that spawn together (1 = solo). */
  schoolSize: number;
}

/** Frozen registry of all fish species keyed by species ID. */
const SPECIES_REGISTRY: Readonly<Record<FishSpeciesId, FishSpecies>> = Object.freeze({
  clownfish: {
    id: 'clownfish',
    displayName: 'Clownfish',
    bodyShape: 'round',
    colorPalette: [new Color(1.0, 0.5, 0.15), new Color(1.0, 0.9, 0.2)],
    scale: 0.55,
    speed: 1.0,
    points: 1,
    movement: 'sineDrift',
    hitRadius: 1.0,
    hasDodge: false,
    rarity: 0.35,
    schoolSize: 1,
  },
  blueTang: {
    id: 'blueTang',
    displayName: 'Blue Tang',
    bodyShape: 'slim',
    colorPalette: [new Color(0.2, 0.6, 1.0), new Color(0.1, 0.2, 0.7)],
    scale: 0.5,
    speed: 1.2,
    points: 1,
    movement: 'boids',
    hitRadius: 0.9,
    hasDodge: false,
    rarity: 0.25,
    schoolSize: 3,
  },
  pufferfish: {
    id: 'pufferfish',
    displayName: 'Pufferfish',
    bodyShape: 'round',
    colorPalette: [new Color(0.82, 0.71, 0.55), new Color(0.5, 0.5, 0.2)],
    scale: 0.6,
    speed: 0.7,
    points: 2,
    movement: 'erratic',
    hitRadius: 1.2,
    hasDodge: false,
    rarity: 0.15,
    schoolSize: 1,
  },
  seahorse: {
    id: 'seahorse',
    displayName: 'Seahorse',
    bodyShape: 'long',
    colorPalette: [new Color(1.0, 0.9, 0.2), new Color(1.0, 0.5, 0.7), new Color(0.2, 0.8, 0.3)],
    scale: 0.45,
    speed: 0.5,
    points: 3,
    movement: 'curious',
    hitRadius: 0.8,
    hasDodge: false,
    rarity: 0.15,
    schoolSize: 1,
  },
  goldenAngelfish: {
    id: 'goldenAngelfish',
    displayName: 'Golden Angelfish',
    bodyShape: 'flat',
    colorPalette: [new Color(1.0, 0.85, 0.2), new Color(0.9, 0.65, 0.1)],
    scale: 0.65,
    speed: 1.0,
    points: 5,
    movement: 'sineDrift',
    hitRadius: 1.5,
    hasDodge: true,
    rarity: 0.1,
    schoolSize: 1,
  },
});

/**
 * Look up a fish species by its unique identifier.
 *
 * @param id - The species identifier to look up.
 * @returns The matching species definition.
 */
export function getSpecies(id: FishSpeciesId): FishSpecies {
  return SPECIES_REGISTRY[id];
}

/**
 * Return all registered fish species as an array.
 *
 * @returns An array containing all five species definitions.
 */
export function getAllSpecies(): FishSpecies[] {
  return Object.values(SPECIES_REGISTRY);
}

/**
 * Select a random species using rarity-weighted probabilities.
 *
 * @param excludeGolden - When true, omits goldenAngelfish and renormalizes the remaining weights.
 * @returns A randomly selected species weighted by rarity.
 */
export function pickRandomSpecies(excludeGolden?: boolean): FishSpecies {
  const candidates = excludeGolden ? getAllSpecies().filter((s) => s.id !== 'goldenAngelfish') : getAllSpecies();

  const totalWeight = candidates.reduce((sum, s) => sum + s.rarity, 0);
  let roll = Math.random() * totalWeight;

  for (const species of candidates) {
    roll -= species.rarity;
    if (roll <= 0) {
      return species;
    }
  }

  // Fallback to last candidate (guards against floating-point drift).
  return candidates[candidates.length - 1];
}

/**
 * Pick a random color from a species' color palette.
 *
 * @param species - The species whose palette to sample.
 * @returns A randomly selected color from the palette.
 */
export function getSpeciesColor(species: FishSpecies): Color {
  const index = Math.floor(Math.random() * species.colorPalette.length);
  return species.colorPalette[index];
}
