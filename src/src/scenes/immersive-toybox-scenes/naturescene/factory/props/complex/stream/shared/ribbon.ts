import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { RibbonOptions, StreamContext } from './types';

/**
 * @internal
 * @param t - Position along the stream curve (0–1).
 * @param across - Lateral position across the ribbon.
 * @returns A small wobble offset value.
 */
function edgeWobble(t: number, across: number): number {
  return Math.sin(t * 18 + across * 6.5) * 0.04 + Math.cos(t * 9 - across * 11) * 0.025;
}

/**
 * Creates a ribbon-shaped BufferGeometry that follows the stream's spline curve.
 * @param context - The stream context providing curve and width data
 * @param options - Configuration for segment counts, width, edge jitter, and height
 * @returns A BufferGeometry with position, uv, aAcrossSpan, and aFlowSpan attributes
 */
export function createRibbonGeometry(context: StreamContext, options: RibbonOptions): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const acrossSpans: number[] = [];
  const flowSpans: number[] = [];

  for (let row = 0; row <= options.lengthSegments; row++) {
    const t = row / options.lengthSegments;
    const frame = context.getFrame(t);
    const width = options.widthFor(t);
    const flowSpan = frame.tangent.clone().multiplyScalar(context.curveLength);
    const acrossSpan = frame.side.clone().multiplyScalar(width);
    const endBlend = context.getEndBlend(t);

    for (let col = 0; col <= options.widthSegments; col++) {
      const across = col / options.widthSegments;
      const bankFactor = Math.abs(across - 0.5) * 2;
      const centerOffset = (across - 0.5) * width;
      const edgeSign = across < 0.5 ? -1 : across > 0.5 ? 1 : 0;
      const jitter = edgeSign * (options.edgeJitter ?? 0) * Math.pow(bankFactor, 1.15) * edgeWobble(t, across) * endBlend;
      const point = frame.point.clone().addScaledVector(frame.side, centerOffset + jitter);
      const height = options.heightFor ? options.heightFor(t, bankFactor) : 0;

      positions.push(point.x, height, point.z);
      uvs.push(across, t);
      acrossSpans.push(acrossSpan.x, acrossSpan.y, acrossSpan.z);
      flowSpans.push(flowSpan.x, flowSpan.y, flowSpan.z);
    }
  }

  const rowSize = options.widthSegments + 1;
  for (let row = 0; row < options.lengthSegments; row++) {
    for (let col = 0; col < options.widthSegments; col++) {
      const a = row * rowSize + col;
      const b = a + rowSize;
      const c = b + 1;
      const d = a + 1;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aAcrossSpan', new Float32BufferAttribute(acrossSpans, 3));
  geometry.setAttribute('aFlowSpan', new Float32BufferAttribute(flowSpans, 3));
  geometry.computeVertexNormals();

  return geometry;
}
