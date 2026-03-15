import { addLeftStreamBank } from './left-stream-bank';
import { addRightStreamBank } from './right-stream-bank';
import { createBankMaterials } from './shared/materials';
import type { StreamBankFrame, StreamBankParent } from './shared/types';

/**
 * Builds left and right stream banks with shared materials.
 * @param parent - The parent object to attach bank meshes to
 * @param getFrame - Function returning a stream bank frame at parameter t
 */
export function addStreamBanks(parent: StreamBankParent, getFrame: (t: number) => StreamBankFrame): void {
  const materials = createBankMaterials();
  addLeftStreamBank(parent, getFrame, materials);
  addRightStreamBank(parent, getFrame, materials);
}
