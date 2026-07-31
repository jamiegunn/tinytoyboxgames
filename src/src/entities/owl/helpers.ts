import { Color, DoubleSide, MeshStandardMaterial } from 'three';

// ── Generic helpers ──────────────────────────────────────────────────────────

/**
 * Returns a random duration between minMs and maxMs.
 *
 * @param minMs - Minimum duration in milliseconds.
 * @param maxMs - Maximum duration in milliseconds.
 * @returns A random duration in the given range.
 */
export function randomInterval(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

// NOT HERE DELIBERATELY: jitter(amount).
//
// A symmetric random offset helper with no caller. The owl's idle motion comes
// from the shared idle animator, whose wobble is PHASE-based and so repeats
// smoothly frame to frame. A per-frame random jitter would have fought it and
// produced exactly the twitch that phase-based idle exists to avoid.

// ── Material wrappers — three surface families ───────────────────────────────

/**
 * Matte feather surface — high roughness, zero metallic.
 * Used for all plumage: body, head, wings, tail, lids.
 *
 * @param name - Material name identifier.
 * @param color - Surface color.
 * @returns A MeshStandardMaterial configured for matte feathers.
 */
export function matteFeather(name: string, color: Color): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    color,
    metalness: 0.0,
    roughness: 0.82,
  });
  mat.name = name;
  return mat;
}

/**
 * Glossy eye surface — very low roughness for wet-look eyeballs, iris, cornea.
 *
 * @param name - Material name identifier.
 * @param color - Surface color.
 * @param alpha - Opacity (1.0 = fully opaque).
 * @returns A MeshStandardMaterial configured for glossy eye surfaces.
 */
export function glossyEye(name: string, color: Color, alpha = 1.0): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    color,
    metalness: 0.02,
    roughness: 0.08,
    opacity: alpha,
    transparent: alpha < 1,
    depthWrite: alpha >= 1,
  });
  mat.name = name;
  return mat;
}

/**
 * Keratin surface — moderate roughness, slightly waxy. Beak and talons.
 *
 * @param name - Material name identifier.
 * @param color - Surface color.
 * @returns A MeshStandardMaterial configured for keratin surfaces.
 */
export function keratin(name: string, color: Color): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    color,
    metalness: 0.0,
    roughness: 0.55,
    side: DoubleSide,
  });
  mat.name = name;
  return mat;
}
