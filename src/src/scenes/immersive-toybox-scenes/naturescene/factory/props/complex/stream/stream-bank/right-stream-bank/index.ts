import { addStreamBank } from '../shared/bankBuilder';
import type { StreamBankFrame, StreamBankMaterials, StreamBankParent } from '../shared/types';

/**
 * Entry-point for the right stream bank.
 *
 * The right bank is a distinct UI module from the left bank (they occupy
 * opposite sides of the stream and have independent random layouts), but
 * all assembly logic lives in the shared bank builder to avoid duplication.
 * sideSign +1 fans the bank geometry to the right; the 'right' label controls
 * mesh naming and seed offsets so patterns differ from the left side.
 *
 * @param parent - The parent object to attach bank meshes to
 * @param getFrame - Function returning a stream bank frame at parameter t
 * @param materials - Shared bank material set
 */
export function addRightStreamBank(parent: StreamBankParent, getFrame: (t: number) => StreamBankFrame, materials: StreamBankMaterials): void {
  addStreamBank(parent, getFrame, materials, 1);
}
