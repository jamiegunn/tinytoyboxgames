import type { MeshStandardMaterial } from 'three';

export interface StreamBankMaterials {
  wet: MeshStandardMaterial;
  soilDark: MeshStandardMaterial;
  soil: MeshStandardMaterial;
  grass: MeshStandardMaterial;
  grassLight: MeshStandardMaterial;
  shoreStones: MeshStandardMaterial[];
  reed: MeshStandardMaterial;
  cattail: MeshStandardMaterial;
}
