import { Vector3 } from 'three';
import { addStripMesh, createStripGeometry } from './strip';
import type { StreamBankMaterials, StreamBankParent, StreamBankSample } from './types';

function sideLabel(samples: StreamBankSample[]): string {
  return samples[0]?.sideSign < 0 ? 'left' : 'right';
}

/**
 * Adds a grass cap strip mesh to the stream bank.
 * @param parent - The parent object to attach the mesh to
 * @param samples - Array of bank sample points (side is derived from sideSign)
 * @param materials - Shared bank material set
 */
export function addGrassCap(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials): void {
  addStripMesh(
    parent,
    `streamBankGrass_${sideLabel(samples)}`,
    createStripGeometry(
      samples,
      (sample) => sample.crest,
      (sample) => sample.shoulder,
      {
        acrossSegments: 4,
        archHeight: 0.008,
        noiseHeight: 0.003,
        flowJitter: 0.014,
      },
    ),
    materials.grass,
  );
}

/**
 * Adds a lighter grass highlight strip to the stream bank.
 * @param parent - The parent object to attach the mesh to
 * @param samples - Array of bank sample points (side is derived from sideSign)
 * @param materials - Shared bank material set
 */
export function addGrassHighlight(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials): void {
  addStripMesh(
    parent,
    `streamBankGrassHighlight_${sideLabel(samples)}`,
    createStripGeometry(
      samples,
      (sample) =>
        sample.crest
          .clone()
          .lerp(sample.shoulder, 0.24)
          .add(new Vector3(0, 0.003, 0)),
      (sample) =>
        sample.crest
          .clone()
          .lerp(sample.shoulder, 0.76)
          .add(new Vector3(0, 0.003, 0)),
      {
        acrossSegments: 3,
        archHeight: 0.004,
        noiseHeight: 0.0015,
        flowJitter: 0.008,
      },
    ),
    materials.grassLight,
    false,
  );
}

/**
 * Adds the lower bank strip mesh to the stream bank.
 * @param parent - The parent object to attach the mesh to
 * @param samples - Array of bank sample points (side is derived from sideSign)
 * @param materials - Shared bank material set
 */
export function addLowerBank(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials): void {
  addStripMesh(
    parent,
    `streamBankLower_${sideLabel(samples)}`,
    createStripGeometry(
      samples,
      (sample) => sample.wetEdge,
      (sample) => sample.toe,
      {
        acrossSegments: 3,
        archHeight: 0.005,
        noiseHeight: 0.002,
        flowJitter: 0.01,
      },
    ),
    materials.soilDark,
  );
}

/**
 * Adds a dark shadow band strip to the stream bank for depth shading.
 * @param parent - The parent object to attach the mesh to
 * @param samples - Array of bank sample points (side is derived from sideSign)
 * @param materials - Shared bank material set
 */
export function addShadowBand(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials): void {
  addStripMesh(
    parent,
    `streamBankShadow_${sideLabel(samples)}`,
    createStripGeometry(
      samples,
      (sample) =>
        sample.wetEdge
          .clone()
          .lerp(sample.toe, 0.52)
          .add(new Vector3(0, 0.003, 0)),
      (sample) =>
        sample.toe
          .clone()
          .lerp(sample.crest, 0.4)
          .add(new Vector3(0, 0.003, 0)),
      {
        acrossSegments: 3,
        archHeight: 0.004,
        noiseHeight: 0.0015,
        flowJitter: 0.01,
      },
    ),
    materials.soilDark,
    false,
  );
}

/**
 * Adds the slope face strip mesh to the stream bank.
 * @param parent - The parent object to attach the mesh to
 * @param samples - Array of bank sample points (side is derived from sideSign)
 * @param materials - Shared bank material set
 */
export function addSlopeFace(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials): void {
  addStripMesh(
    parent,
    `streamBankSlope_${sideLabel(samples)}`,
    createStripGeometry(
      samples,
      (sample) => sample.toe,
      (sample) => sample.crest,
      {
        acrossSegments: 5,
        archHeight: 0.009,
        noiseHeight: 0.004,
        flowJitter: 0.018,
      },
    ),
    materials.soil,
  );
}

/**
 * Adds the wet band strip mesh along the waterline of the stream bank.
 * @param parent - The parent object to attach the mesh to
 * @param samples - Array of bank sample points (side is derived from sideSign)
 * @param materials - Shared bank material set
 */
export function addWetBand(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials): void {
  addStripMesh(
    parent,
    `streamBankWet_${sideLabel(samples)}`,
    createStripGeometry(
      samples,
      (sample) => sample.waterEdge,
      (sample) => sample.wetEdge,
      {
        acrossSegments: 2,
        archHeight: 0.003,
        noiseHeight: 0.0015,
        flowJitter: 0.008,
      },
    ),
    materials.wet,
  );
}
