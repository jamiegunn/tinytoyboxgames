import { Color } from 'three';
import { createFeltMaterial, createPlasticMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import type { StreamBankMaterials } from './types';

/**
 * Creates the complete set of shared materials used by stream bank meshes.
 * @returns A StreamBankMaterials object containing all bank surface materials
 */
export function createBankMaterials(): StreamBankMaterials {
  return {
    wet: getOrCreateMaterial('streamBankWetMat', () => createPlasticMaterial('streamBankWetMat', new Color(0.13, 0.1, 0.07))),
    soilDark: getOrCreateMaterial('streamBankSoilDarkMat', () => createFeltMaterial('streamBankSoilDarkMat', new Color(0.24, 0.18, 0.12))),
    soil: getOrCreateMaterial('streamBankSoilMat', () => createFeltMaterial('streamBankSoilMat', new Color(0.39, 0.31, 0.21))),
    grass: getOrCreateMaterial('streamBankGrassMat', () => createFeltMaterial('streamBankGrassMat', new Color(0.22, 0.38, 0.17))),
    grassLight: getOrCreateMaterial('streamBankGrassLightMat', () => createFeltMaterial('streamBankGrassLightMat', new Color(0.31, 0.48, 0.22))),
    shoreStones: [
      getOrCreateMaterial('streamShoreStoneA', () => createPlasticMaterial('streamShoreStoneA', new Color(0.46, 0.42, 0.37))),
      getOrCreateMaterial('streamShoreStoneB', () => createPlasticMaterial('streamShoreStoneB', new Color(0.56, 0.52, 0.45))),
      getOrCreateMaterial('streamShoreStoneC', () => createPlasticMaterial('streamShoreStoneC', new Color(0.4, 0.42, 0.39))),
      getOrCreateMaterial('streamShoreStoneD', () => createPlasticMaterial('streamShoreStoneD', new Color(0.32, 0.36, 0.29))),
    ],
    reed: getOrCreateMaterial('reedMat', () => createFeltMaterial('reedMat', new Color(0.28, 0.47, 0.19))),
    cattail: getOrCreateMaterial('streamCattailMat', () => createFeltMaterial('streamCattailMat', new Color(0.43, 0.3, 0.17))),
  };
}
