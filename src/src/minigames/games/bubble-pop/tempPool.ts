import { Color, Vector3 } from 'three';

/**
 * Pre-allocated temporary objects for per-frame operations.
 * Avoids GC pressure from `new Vector3()` / `new Color()` in hot loops.
 * Each slot is overwritten every time it's used — do NOT hold references
 * across frames.
 */

const _v3: Vector3[] = [];
const _color: Color[] = [];

for (let i = 0; i < 8; i++) _v3.push(new Vector3());
for (let i = 0; i < 4; i++) _color.push(new Color());

/**
 * Returns a pre-allocated Vector3 scratch object. Index 0–7 available.
 * @param index - Slot index (0–7).
 * @returns The scratch Vector3 at the given index.
 */
export function tmpVec3(index: number): Vector3 {
  return _v3[index];
}

/**
 * Returns a pre-allocated Color scratch object. Index 0–3 available.
 * @param index - Slot index (0–3).
 * @returns The scratch Color at the given index.
 */
export function tmpColor(index: number): Color {
  return _color[index];
}
