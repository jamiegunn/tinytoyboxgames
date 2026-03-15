import { CylinderGeometry, Mesh } from 'three';
import { lerp, seeded } from './math';
import type { StreamBankMaterials, StreamBankParent, StreamBankSample } from './types';

/**
 * Per-side seed addends that ensure left and right banks look visually distinct
 * rather than mirrored. These values were deliberately chosen to be prime-spaced
 * and non-overlapping so that seeded(index * 29 + offset) never produces the same
 * sequence on both sides at any sample index within a normal stream length.
 *
 * LEFT = 61, RIGHT = 143.  Do not set them equal — that would mirror the banks.
 */
const REED_SEED_OFFSET: Record<'left' | 'right', number> = {
  left: 61,
  right: 143,
};

/**
 * Adds procedurally placed reed and cattail meshes along one stream bank.
 *
 * This is the single implementation for both sides. The `side` parameter controls:
 * - mesh naming (so scene-inspector labels stay readable)
 * - the seed offset (so left and right produce independent random layouts)
 *
 * All lateral math is driven by `sample.sideSign`, which is already baked into
 * the samples array by `createBankSamples`.
 *
 * @param parent - The parent object to attach reed meshes to
 * @param samples - Array of bank sample points (sideSign embedded per sample)
 * @param materials - Shared bank material set
 * @param side - Which bank ('left' | 'right') — affects naming and seed only
 */
export function addBankReeds(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials, side: 'left' | 'right'): void {
  const seedOffset = REED_SEED_OFFSET[side];

  for (let index = 5; index < samples.length - 4; index += 8) {
    const sample = samples[index];
    const rand = seeded(index * 29 + seedOffset);

    if (rand() < 0.24) continue;

    const clusterBase = sample.crest.clone().lerp(sample.shoulder, 0.58);
    clusterBase.addScaledVector(sample.frame.side, sample.sideSign * lerp(0.025, 0.055, rand()));
    clusterBase.addScaledVector(sample.frame.tangent, (rand() - 0.5) * 0.18);

    const stemCount = 2 + Math.floor(rand() * 3);
    for (let stemIndex = 0; stemIndex < stemCount; stemIndex++) {
      const height = lerp(0.4, 0.82, rand());
      const reed = new Mesh(new CylinderGeometry(0.006, 0.011, height, 5), materials.reed);
      reed.name = `reed_${side}_${index}_${stemIndex}`;
      reed.position.copy(clusterBase);
      reed.position.addScaledVector(sample.frame.side, sample.sideSign * ((rand() - 0.5) * 0.06));
      reed.position.addScaledVector(sample.frame.tangent, (rand() - 0.5) * 0.14);
      reed.position.y += height / 2 - 0.045;
      reed.rotation.x = (rand() - 0.5) * 0.18;
      reed.rotation.z = (rand() - 0.5) * 0.18;
      reed.castShadow = true;
      reed.receiveShadow = true;
      parent.add(reed);

      if (rand() > 0.42) {
        const cattail = new Mesh(new CylinderGeometry(0.017, 0.015, 0.085, 6), materials.cattail);
        cattail.name = `cattail_${side}_${index}_${stemIndex}`;
        cattail.position.y = height / 2 + 0.04;
        cattail.castShadow = true;
        cattail.receiveShadow = true;
        reed.add(cattail);
      }
    }
  }
}
