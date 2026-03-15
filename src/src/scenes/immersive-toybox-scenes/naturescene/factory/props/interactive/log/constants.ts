/**
 * Shared log dimension constants and helper functions.
 *
 * COORDINATE CHEAT-SHEET (read before editing!)
 *
 * CylinderGeometry height runs along LOCAL Y.
 * The body mesh has rotation.z = PI/2  → local Y maps to world -X
 *                      rotation.y = 0.3 → slight yaw
 *
 * So inside the body's local frame:
 *   +Y  = along the log toward the thin/far end (world roughly -X)
 *   -Y  = along the log toward the thick/stream end (world roughly +X)
 *   +X  = radial "up" (world roughly +Y  = sky)
 *   -X  = radial "down" (world roughly -Y = ground)
 *   ±Z  = radial side-to-side
 *
 * CylinderGeometry(radiusTop, radiusBottom, height):
 *   radiusTop  = at +Y/2 (thin end,   away from stream)
 *   radiusBot  = at -Y/2 (thick end,  toward stream)
 *
 * TorusGeometry default XZ plane → naturally rings around the Y axis ✓
 */

/** Total log length. */
export const L = 1.9;

/** Radius at the thin end (+Y). */
export const Rtop = 0.22;

/** Radius at the thick / stream-facing end (-Y). */
export const Rbot = 0.28;

/**
 * Interpolated radius along the log.
 *
 * @param t - Normalised position: 0 = thick end, 1 = thin end.
 * @returns The radius at position t.
 */
export const radiusAt = (t: number): number => Rbot + (Rtop - Rbot) * t;

/**
 * Convert a local-Y coordinate to a normalised t ∈ [0, 1].
 *
 * @param y - Local-Y position along the log.
 * @returns Normalised position.
 */
export const tFromY = (y: number): number => y / L + 0.5;

// ── Root placement ──

/** Vertical offset applied to the log root so it sits above the ground plane. */
export const LOG_Y_OFFSET = 0.26;
