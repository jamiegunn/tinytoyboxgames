/**
 * Right-bank reed entry-point — delegates to the shared implementation.
 *
 * Left and right bank modules are kept as separate UI modules so they can be
 * independently extended or tested. The actual logic lives in shared/reeds.ts;
 * the 'right' argument there controls mesh naming and the seed offset that gives
 * the right bank its own distinct random layout (not a mirror of the left).
 */
import { addBankReeds } from '../shared/reeds';
import type { StreamBankMaterials, StreamBankParent, StreamBankSample } from '../shared/types';

/**
 * Adds procedurally placed reed and cattail meshes along the right stream bank.
 * @param parent - The parent object to attach reed meshes to
 * @param samples - Array of bank sample points along the stream
 * @param materials - Shared bank material set
 */
export function addRightReeds(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials): void {
  addBankReeds(parent, samples, materials, 'right');
}
