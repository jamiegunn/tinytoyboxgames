import type { MiniGameManifestEntry } from './types';

/** Mini-game manifest entries for the nature world. */
const manifest: MiniGameManifestEntry[] = [
  {
    id: 'bubble-pop',
    displayName: 'Bubble Pop',
    description: 'Pop shimmering bubbles in the night sky!',

    inputModes: ['tap'],
    themeColor: '#A8E0FF',
    iconAssetId: 'bubble_pop_icon',
    comboWindowSeconds: 0,
    hasSpecialItems: false,
    mode: 'endless',
    showScore: false,
    showProgressBar: false,
    load: () => import('@app/minigames/games/bubble-pop'),
  },
  {
    id: 'fireflies',
    displayName: 'Fireflies',
    description: 'Catch glowing fireflies in a jar!',

    inputModes: ['tap'],
    themeColor: '#FFD700',
    iconAssetId: 'fireflies_icon',
    comboWindowSeconds: 3.5,
    hasSpecialItems: true,
    mode: 'endless',
    showScore: true,
    showProgressBar: false,
    load: () => import('@app/minigames/games/fireflies'),
  },
  {
    id: 'little-shark',
    displayName: 'Little Shark',
    description: 'Chase and munch colorful fish!',

    inputModes: ['tap', 'drag'],
    themeColor: '#1A6FB5',
    iconAssetId: 'little_shark_icon',
    comboWindowSeconds: 2.5,
    hasSpecialItems: true,
    mode: 'endless',
    showScore: true,
    showProgressBar: false,
    load: () => import('@app/minigames/games/little-shark'),
  },
  {
    id: 'star-catcher',
    displayName: 'Star Catcher',
    description: 'TODO: write a description for Star Catcher.',

    inputModes: ['tap'],
    themeColor: '#8FD3FF',
    iconAssetId: 'star_catcher_icon',
    comboWindowSeconds: 3,
    hasSpecialItems: false,
    mode: 'endless',
    showScore: true,
    showProgressBar: false,
    load: () => import('@app/minigames/games/star-catcher'),
  },
  {
    id: 'cannonball-splash',
    displayName: 'Cannonball Splash',
    description: 'Fire cannonballs at floating targets and make the biggest splash!',

    inputModes: ['tap'],
    themeColor: '#2A6FA8',
    iconAssetId: 'cannonball_splash_icon',
    comboWindowSeconds: 3,
    hasSpecialItems: true,
    mode: 'endless',
    showScore: true,
    showProgressBar: false,
    load: () => import('@app/minigames/games/cannonball-splash'),
  },
  // __MINIGAME_GENERATOR_ENTRY_MARKER__
];

/**
 * Returns the full mini-game manifest as a read-only array.
 *
 * @returns All registered mini-game manifest entries.
 */
export function getManifest(): ReadonlyArray<MiniGameManifestEntry> {
  return manifest;
}

/**
 * Looks up a single manifest entry by mini-game identifier.
 *
 * @param id - The mini-game identifier to search for.
 * @returns The matching manifest entry, or undefined if not found.
 */
export function getGameEntry(id: string): MiniGameManifestEntry | undefined {
  return manifest.find((e) => e.id === id);
}

/**
 * Registers a new mini-game manifest entry at runtime.
 *
 * @param entry - The manifest entry to add to the registry.
 */
export function registerManifestEntry(entry: MiniGameManifestEntry): void {
  manifest.push(entry);
}
