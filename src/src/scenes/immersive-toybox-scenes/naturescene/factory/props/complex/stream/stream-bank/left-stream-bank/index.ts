import { addStreamBank } from '../shared/bankBuilder';
import type { StreamBankFrame, StreamBankMaterials, StreamBankParent } from '../shared/types';

/**
 * Entry-point for the left stream bank.
 *
 * The left bank is a distinct UI module from the right bank (they occupy
 * opposite sides of the stream and have independent random layouts), but
 * all assembly logic lives in the shared bank builder to avoid duplication.
 * sideSign -1 fans the bank geometry to the left; the 'left' label controls
 * mesh naming and seed offsets so patterns differ from the right side.
 *
 * @param parent - The parent object to attach bank meshes to
 * @param getFrame - Function returning a stream bank frame at parameter t
 * @param materials - Shared bank material set
 */
export function addLeftStreamBank(parent: StreamBankParent, getFrame: (t: number) => StreamBankFrame, materials: StreamBankMaterials): void {
  addStreamBank(parent, getFrame, materials, -1);
}
