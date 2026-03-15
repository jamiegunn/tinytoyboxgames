import { Color, Mesh } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';
import { createRibbonGeometry } from '../shared/ribbon';
import type { StreamContext, StreamParent } from '../shared/types';

/**
 * Builds the stream bed mesh with a felt material and adds it to the parent.
 * @param parent - The parent object to attach the bed mesh to
 * @param context - The stream context providing curve and width data
 * @returns The stream bed mesh
 */
export function createStreamBed(parent: StreamParent, context: StreamContext): Mesh {
  const bed = new Mesh(
    createRibbonGeometry(context, {
      lengthSegments: 72,
      widthSegments: 14,
      widthFor: context.getBedWidth,
      edgeJitter: 0.18,
      heightFor: (t, bankFactor) => -0.012 + bankFactor * bankFactor * 0.028 + Math.sin(t * Math.PI * 5.5 + bankFactor * 4) * 0.0025,
    }),
    createFeltMaterial('streamBedMat', new Color(0.45, 0.38, 0.28)),
  );

  bed.name = 'streamBed';
  bed.position.set(0, 0.015, 0);
  bed.receiveShadow = true;
  parent.add(bed);

  return bed;
}
