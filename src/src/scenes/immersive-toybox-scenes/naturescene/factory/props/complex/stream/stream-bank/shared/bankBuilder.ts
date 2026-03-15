import { createBankSamples } from './samples';
import { addGrassCap, addGrassHighlight, addLowerBank, addShadowBand, addSlopeFace, addWetBand } from './layers';
import { addBankReeds } from './reeds';
import { addBankShoreStones } from './shoreStones';
import type { StreamBankFrame, StreamBankMaterials, StreamBankParent } from './types';

/**
 * Assembles a complete stream bank for one side of the stream.
 *
 * This is the single source of truth for bank assembly. Both the left and right
 * entry-points delegate here; the only per-side differences are:
 *
 *   sideSign  — drives all lateral geometry (which way the bank fans outward)
 *   side      — used only for mesh naming and per-side seed offsets so the two
 *               banks look visually distinct rather than mirrored.
 *
 * Layer order is load-bearing for correct depth sorting; do not reorder.
 *
 * @param parent    - The parent object to attach bank meshes to
 * @param getFrame  - Function returning a stream bank frame at parameter t
 * @param materials - Shared bank material set
 * @param sideSign  - Side multiplier: -1 for the left bank, 1 for the right bank
 */
export function addStreamBank(parent: StreamBankParent, getFrame: (t: number) => StreamBankFrame, materials: StreamBankMaterials, sideSign: -1 | 1): void {
  const side = sideSign < 0 ? 'left' : 'right';
  const samples = createBankSamples(getFrame, sideSign);

  addWetBand(parent, samples, materials);
  addLowerBank(parent, samples, materials);
  addSlopeFace(parent, samples, materials);
  addShadowBand(parent, samples, materials);
  addGrassCap(parent, samples, materials);
  addGrassHighlight(parent, samples, materials);
  addBankShoreStones(parent, samples, materials, side);
  addBankReeds(parent, samples, materials, side);
}
