/**
 * Left-bank shore-stones entry-point — delegates to the shared implementation.
 *
 * Left and right bank modules are kept as separate UI modules so they can be
 * independently extended or tested. The actual logic lives in shared/shoreStones.ts;
 * the 'left' argument there controls mesh naming and the seed offset that gives
 * the left bank its own distinct stone scatter (not a mirror of the right).
 */
import { addBankShoreStones } from '../shared/shoreStones';
import type { StreamBankMaterials, StreamBankParent, StreamBankSample } from '../shared/types';

/**
 * Adds procedurally scattered shore stones and pebbles along the left stream bank.
 * @param parent - The parent object to attach stone meshes to
 * @param samples - Array of bank sample points along the stream
 * @param materials - Shared bank material set
 */
export function addLeftShoreStones(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials): void {
  addBankShoreStones(parent, samples, materials, 'left');
}
