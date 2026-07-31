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
    // Was 0, which made ComboTracker's multiplier permanently 1x — the combo
    // dots in the HUD could never appear. 2.5s is a comfortable toddler cadence.
    comboWindowSeconds: 2.5,
    hasSpecialItems: false,
    // 10 points a normal pop, 100 a giant: 60 is about six pops in, 600 a long sitting.
    difficultyRamp: { start: 60, end: 600 },
    mode: 'endless',
    // Was false: with the score rendered as a bare numeral there was nothing
    // worth showing a pre-reader. The counting display is legible, so show it.
    showScore: true,
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
    // 1 point a catch, 5 for a golden. Five catches to warm up, forty-five for a full session.
    difficultyRamp: { start: 5, end: 45 },
    specialItemScore: 10,
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
    // Initial 3/4 overhead view; the follow cam takes over each frame. azimuth
    // π reproduces the old game camera's −Z. This 10.0 is the only camera
    // distance the game has — it used to cite a `CAMERA_RADIUS_LANDSCAPE=10`
    // constant in little-shark/types.ts, which nothing read and which implied
    // a portrait counterpart the game never branched on. The constant is gone;
    // the number lives here.
    camera: { kind: 'orbit', target: new Vector3(0, 0.5, 0), azimuth: Math.PI, polar: 0.95, distance: 10.0, fov: fovRadiansToDegrees(0.85) },
    comboWindowSeconds: 2.5,
    hasSpecialItems: true,
    // 1 point a fish, 5 for a golden — the same shape as fireflies.
    difficultyRamp: { start: 4, end: 40 },
    specialItemScore: 12,
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
    // 1 point a star. The spawn bands at level 0.35/0.7 now land at 17 and 29 stars.
    difficultyRamp: { start: 4, end: 40 },
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
    // 10-20 a hit: six hits to warm up. specialItemScore matches the golden barrel's own unlock.
    difficultyRamp: { start: 60, end: 600 },
    specialItemScore: 180,
    mode: 'endless',
    showScore: true,
    showProgressBar: false,
    load: () => import('@app/minigames/games/cannonball-splash'),
  },
  // __MINIGAME_GENERATOR_ENTRY_MARKER__
];

// NOT HERE DELIBERATELY: `getManifest(): ReadonlyArray<MiniGameManifestEntry>`,
// which returned `[...manifest]` so callers could not mutate the registry.
// Nothing ever called it. The allowlist entry that parked it said "callers read
// the exported array directly" — that was never possible: `manifest` above is
// declared `const`, not `export const`, so there is no direct read to prefer.
// Both importers of this module take `getGameEntry` (SceneRouter.tsx:4,
// MiniGameRouter.tsx:2) and neither wants the whole list.
//
// The defensive copy it existed to provide is not owed to anyone yet. If a
// caller ever does need the whole catalog, reinstate this rather than exporting
// `manifest` — a shared mutable array is the failure the copy was guarding.

/**
 * Looks up a single manifest entry by mini-game identifier.
 *
 * @param id - The mini-game identifier to search for.
 * @returns The matching manifest entry, or undefined if not found.
 */
export function getGameEntry(id: string): MiniGameManifestEntry | undefined {
  return manifest.find((e) => e.id === id);
}
