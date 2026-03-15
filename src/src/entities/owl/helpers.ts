import { Color, DoubleSide, MeshStandardMaterial } from 'three';

// ── Generic helpers ──────────────────────────────────────────────────────────

/**
 * Tiny random offset for natural organic variation.
 *
 * @param base - The base value.
 * @param range - The maximum deviation from base.
 * @returns A value randomly offset from base within the given range.
 */
export function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range;
}

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
