import { Mesh, SphereGeometry } from 'three';
import { lerp, seeded } from './math';
import type { StreamBankMaterials, StreamBankParent, StreamBankSample } from './types';

/**
 * Per-side seed addends that ensure left and right banks have independent stone
 * layouts rather than mirrored ones. Prime-spaced so seeded(index * 17 + offset)
 * never collides between the two sides at any sample index in a normal stream.
 *
 * LEFT = 37, RIGHT = 91.  Do not set them equal — that would mirror the banks.
 */
const SHORE_STONE_SEED_OFFSET: Record<'left' | 'right', number> = {
  left: 37,
  right: 91,
};

/**
 * Adds procedurally scattered shore stones and pebbles along one stream bank.
 *
 * This is the single implementation for both sides. The `side` parameter controls:
 * - mesh naming (so scene-inspector labels stay readable)
 * - the seed offset (so left and right produce independent random layouts)
 *
 * All lateral math is driven by `sample.sideSign`, which is already baked into
 * the samples array by `createBankSamples`.
 *
 * @param parent - The parent object to attach stone meshes to
 * @param samples - Array of bank sample points (sideSign embedded per sample)
 * @param materials - Shared bank material set
 * @param side - Which bank ('left' | 'right') — affects naming and seed only
 */
export function addBankShoreStones(parent: StreamBankParent, samples: StreamBankSample[], materials: StreamBankMaterials, side: 'left' | 'right'): void {
  const seedOffset = SHORE_STONE_SEED_OFFSET[side];

  for (let index = 3; index < samples.length - 3; index += 5) {
    const sample = samples[index];
    const rand = seeded(index * 17 + seedOffset);

    if (rand() < 0.18) continue;

    const clusterBase = sample.wetEdge.clone().lerp(sample.toe, 0.42);
    clusterBase.addScaledVector(sample.frame.side, sample.sideSign * lerp(0.006, 0.028, rand()));
    clusterBase.addScaledVector(sample.frame.tangent, (rand() - 0.5) * 0.16);
    clusterBase.y -= 0.014;

    const stoneCount = 3 + Math.floor(rand() * 3);
    for (let s = 0; s < stoneCount; s++) {
      const size = lerp(0.03, 0.078, rand());
      const stone = new Mesh(new SphereGeometry(size, 8, 7), materials.shoreStones[(index + s) % materials.shoreStones.length]);
      stone.name = `streamShoreStone_${side}_${index}_${s}`;
      stone.position.copy(clusterBase);
      stone.position.addScaledVector(sample.frame.side, sample.sideSign * ((rand() - 0.2) * 0.12));
      stone.position.addScaledVector(sample.frame.tangent, (rand() - 0.5) * 0.26);
      stone.position.y += (rand() - 0.5) * 0.008;
      stone.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI, (rand() - 0.5) * 0.2);
      stone.scale.set(0.8 + rand() * 0.55, 0.36 + rand() * 0.22, 0.7 + rand() * 0.6);
      stone.castShadow = true;
      stone.receiveShadow = true;
      parent.add(stone);

      if (rand() > 0.58) {
        const pebble = new Mesh(
          new SphereGeometry(size * lerp(0.28, 0.45, rand()), 6, 5),
          materials.shoreStones[(index + s + 1) % materials.shoreStones.length],
        );
        pebble.name = `streamShorePebble_${side}_${index}_${s}`;
        pebble.position.copy(stone.position);
        pebble.position.addScaledVector(sample.frame.side, sample.sideSign * lerp(0.015, 0.04, rand()));
        pebble.position.addScaledVector(sample.frame.tangent, (rand() - 0.5) * 0.05);
        pebble.position.y -= size * 0.08;
        pebble.scale.set(1.0, 0.55, 0.9);
        pebble.castShadow = true;
        pebble.receiveShadow = true;
        parent.add(pebble);
      }
    }
  }
}
