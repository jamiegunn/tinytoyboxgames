import { Vector3 } from 'three';
import type { MiniGameManifestEntry } from './types';
import { fovRadiansToDegrees } from '@app/utils/camera/cameraDescriptor';

/** Mini-game manifest entries for the nature world. */
const manifest: MiniGameManifestEntry[] = [
  {
    id: 'bubble-pop',
    displayName: 'Bubble Pop',
    description: 'Pop shimmering bubbles in the night sky!',

    inputModes: ['tap'],
    themeColor: '#A8E0FF',
    iconAssetId: 'bubble_pop_icon',
    musicId: 'mus_bubble_pop_background',
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
    musicId: 'mus_fireflies_background',
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
    musicId: 'mus_little_shark_background',
    // Initial 3/4 overhead view (CAMERA_RADIUS_LANDSCAPE=10); the follow cam
    // takes over each frame. azimuth π reproduces the old game camera's −Z.
    camera: { kind: 'orbit', target: new Vector3(0, 0.5, 0), azimuth: Math.PI, polar: 0.95, distance: 10.0, fov: fovRadiansToDegrees(0.85) },
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
    description: 'Catch falling stars before they drift away!',

    inputModes: ['tap'],
    themeColor: '#8FD3FF',
    iconAssetId: 'star_catcher_icon',
    musicId: 'mus_star_catcher_background',
    // Authored hilltop view; azimuth π reproduces the old game camera's −Z.
    camera: { kind: 'orbit', target: new Vector3(0, 0.65, 0), azimuth: Math.PI, polar: 1.16, distance: 7.4, fov: fovRadiansToDegrees(0.9) },
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
    musicId: 'mus_cannonball_splash_background',
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
  // Return a copy so callers can never mutate the canonical registry — the
  // manifest is a static, generator-owned catalog (like SCENE_CATALOG), not a
  // runtime-mutable list. The `registerManifestEntry` escape hatch was removed.
  return [...manifest];
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
