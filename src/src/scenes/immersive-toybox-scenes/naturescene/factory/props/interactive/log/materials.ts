/**
 * Shared material definitions for the fallen log.
 */
import { Color } from 'three';
import { createWoodMaterial, createFeltMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import type { LogMaterials } from './types';

/**
 * Creates (or retrieves from cache) all materials used by the log.
 *
 * @returns A LogMaterials bag.
 */
export function createLogMaterials(): LogMaterials {
  const barkDark = getOrCreateMaterial('logBarkDark', () => createWoodMaterial('logBarkDark', new Color(0.22, 0.14, 0.08)));
  const barkMid = getOrCreateMaterial('logBarkMid', () => createWoodMaterial('logBarkMid', new Color(0.32, 0.22, 0.12)));
  const barkLight = getOrCreateMaterial('logBarkLight', () => createWoodMaterial('logBarkLight', new Color(0.42, 0.3, 0.18)));
  const innerWood = getOrCreateMaterial('logInnerWood', () => createWoodMaterial('logInnerWood', new Color(0.55, 0.4, 0.22)));
  const heartWood = getOrCreateMaterial('logHeartWood', () => createWoodMaterial('logHeartWood', new Color(0.48, 0.32, 0.16)));
  const mossMat = getOrCreateMaterial('logMoss', () => createFeltMaterial('logMoss', new Color(0.18, 0.38, 0.12)));
  const mossLight = getOrCreateMaterial('logMossLight', () => createFeltMaterial('logMossLight', new Color(0.25, 0.45, 0.18)));
  const lichenMat = getOrCreateMaterial('logLichen', () => createFeltMaterial('logLichen', new Color(0.55, 0.62, 0.42)));

  return {
    barkDark,
    barkMid,
    barkLight,
    barkMats: [barkDark, barkMid, barkLight],
    innerWood,
    heartWood,
    mossMat,
    mossLight,
    lichenMat,
  };
}
