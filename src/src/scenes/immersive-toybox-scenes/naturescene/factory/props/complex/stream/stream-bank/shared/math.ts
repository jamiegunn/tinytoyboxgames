export { seededRng as seeded } from '@app/utils/seededRng';
export { lerp, smooth01 } from '@app/utils/mathHelpers';
import { smooth01 } from '@app/utils/mathHelpers';

/**
 * Computes a blend factor that fades to zero near both ends of a [0, 1] range.
 * @param t - The parameter along the stream (0 to 1)
 * @returns A blend factor that tapers at both endpoints
 */
export function getEndBlend(t: number): number {
  return Math.min(smooth01(t / 0.12), smooth01((1 - t) / 0.12));
}
