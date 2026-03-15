import { Color, Mesh, SphereGeometry } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { seededRng } from '@app/utils/seededRng';
import type { StreamContext, StreamParent } from '../shared/types';

/**
 * Places procedurally scattered rocks along the stream bed.
 * @param parent - The parent object to attach rock meshes to
 * @param context - The stream context providing curve and frame data
 */
export function addStreamRocks(parent: StreamParent, context: StreamContext): void {
  const rand = seededRng(7919); // fixed seed — stream rocks are always placed the same way
  const stoneColors = [new Color(0.55, 0.5, 0.42), new Color(0.48, 0.45, 0.4), new Color(0.6, 0.55, 0.48)];

  for (let i = 0; i < 14; i++) {
    const t = 0.08 + rand() * 0.84;
    const frame = context.getFrame(t);
    const stone = new Mesh(new SphereGeometry(0.04 + rand() * 0.05, 6, 5), createPlasticMaterial(`streamStone${i}`, stoneColors[i % 3]));

    stone.name = `streamStone_${i}`;
    stone.position.copy(frame.point);
    stone.position.addScaledVector(frame.side, (rand() - 0.5) * frame.waterWidth * 0.58);
    stone.position.addScaledVector(frame.tangent, (rand() - 0.5) * 0.28);
    stone.position.y = 0.014 + rand() * 0.004;
    stone.scale.y = 0.5;
    parent.add(stone);
  }
}
