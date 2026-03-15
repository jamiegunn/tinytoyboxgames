import { BufferGeometry, Float32BufferAttribute, Mesh, type MeshStandardMaterial, type Vector3 } from 'three';
import { fbm3 } from '@app/utils/noise3d';
import type { StreamBankParent, StreamBankSample, StripOptions } from './types';

/**
 * Creates a strip BufferGeometry between inner and outer edge functions across bank samples.
 * @param samples - Array of bank sample points along the stream
 * @param innerFor - Function returning the inner edge position for a sample
 * @param outerFor - Function returning the outer edge position for a sample
 * @param options - Strip configuration including segment count, arch height, noise, and jitter
 * @returns A BufferGeometry for the strip mesh
 */
export function createStripGeometry(
  samples: StreamBankSample[],
  innerFor: (sample: StreamBankSample) => Vector3,
  outerFor: (sample: StreamBankSample) => Vector3,
  options: StripOptions,
): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const reverseWinding = samples[0]?.sideSign > 0;

  samples.forEach((sample, row) => {
    const inner = innerFor(sample);
    const outer = outerFor(sample);

    for (let col = 0; col <= options.acrossSegments; col++) {
      const across = col / options.acrossSegments;
      const point = inner.clone().lerp(outer, across);
      const arch = Math.sin(across * Math.PI);
      const noise = fbm3(sample.t * 8.4 + across * 3.2, sample.sideSign * 0.8, 6.1, 3, 0.5, 2.0);

      point.y += arch * (options.archHeight + noise * options.noiseHeight);
      point.addScaledVector(sample.frame.tangent, arch * noise * options.flowJitter);

      positions.push(point.x, point.y, point.z);
      uvs.push(across, row / (samples.length - 1));
    }
  });

  const rowSize = options.acrossSegments + 1;
  for (let row = 0; row < samples.length - 1; row++) {
    for (let col = 0; col < options.acrossSegments; col++) {
      const a = row * rowSize + col;
      const b = a + rowSize;
      const c = b + 1;
      const d = a + 1;

      if (reverseWinding) {
        indices.push(a, d, b);
        indices.push(b, d, c);
      } else {
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Creates a named mesh from a strip geometry and adds it to the parent.
 * @param parent - The parent object to attach the mesh to
 * @param name - The mesh name for identification
 * @param geometry - The strip BufferGeometry
 * @param material - The material to apply to the mesh
 * @param castShadow - Whether the mesh casts shadows (defaults to true)
 */
export function addStripMesh(parent: StreamBankParent, name: string, geometry: BufferGeometry, material: MeshStandardMaterial, castShadow = true): void {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
}
