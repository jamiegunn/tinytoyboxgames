import { Mesh, Group, IcosahedronGeometry, type ShaderMaterial } from 'three';
import { simplex3, fbm3 } from '@app/utils/noise3d';
import { lerp } from '@app/utils/mathHelpers';
import {
  CANOPY_RADIUS_MIN,
  CANOPY_RADIUS_MAX,
  CANOPY_SUBDIVISION,
  CANOPY_SPREAD_MIN,
  CANOPY_SPREAD_MAX,
  CANOPY_Y_OFFSET_MIN,
  CANOPY_Y_OFFSET_MAX,
  CANOPY_Y_SCALE_MIN,
  CANOPY_Y_SCALE_MAX,
  CLUSTER_COUNT_MIN,
  CLUSTER_COUNT_RANGE,
} from './constants';

/**
 * Deforms an icosahedron into an organic leaf-cluster blob.
 *
 * @param geo - The icosahedron geometry to deform in place.
 * @param seed - Noise seed for deterministic variation.
 * @param radius - Base radius of the canopy sphere.
 */
function deformCanopy(geo: IcosahedronGeometry, seed: number, radius: number): void {
  const pos = geo.attributes.position;
  const count = pos.count;

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist < 0.001) continue;

    const nx = x / dist;
    const ny = y / dist;
    const nz = z / dist;
    const lumps = simplex3(nx * 2.5 + seed, ny * 2.5 + seed * 0.6, nz * 2.5 + seed * 1.2) * 0.35;
    const bumps = fbm3(nx * 5 + seed, ny * 5, nz * 5, 3) * 0.15;
    const rough = simplex3(nx * 12 + seed, ny * 12, nz * 12) * 0.06;
    const flattenBottom = ny < -0.3 ? (ny + 0.3) * 0.3 : 0;
    const newDist = radius * (1 + lumps + bumps + rough) + flattenBottom;

    pos.setX(i, nx * newDist);
    pos.setY(i, ny * newDist);
    pos.setZ(i, nz * newDist);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function addCanopyCluster(index: number, count: number, rng: () => number, seed: number, crownY: number, canopyMaterial: ShaderMaterial, parent: Group): void {
  const radius = lerp(CANOPY_RADIUS_MIN, CANOPY_RADIUS_MAX, rng());
  const geometry = new IcosahedronGeometry(radius, CANOPY_SUBDIVISION);
  deformCanopy(geometry, seed + index * 23, radius);

  const cluster = new Mesh(geometry, canopyMaterial);
  const theta = (index / count) * Math.PI * 2 + rng();
  const spread = lerp(CANOPY_SPREAD_MIN, CANOPY_SPREAD_MAX, rng());
  cluster.position.set(Math.cos(theta) * spread, crownY + lerp(CANOPY_Y_OFFSET_MIN, CANOPY_Y_OFFSET_MAX, rng()), Math.sin(theta) * spread);
  cluster.scale.y = lerp(CANOPY_Y_SCALE_MIN, CANOPY_Y_SCALE_MAX, rng());
  cluster.castShadow = true;
  cluster.receiveShadow = true;
  parent.add(cluster);
}

/**
 * Adds a clustered canopy of deformed leaf blobs above the tree trunk.
 *
 * @param rng - Deterministic random source for this tree instance.
 * @param seed - Seed used to vary canopy deformation between clusters.
 * @param crownY - Base canopy height above the tree root.
 * @param canopyMaterial - Shared canopy shader material.
 * @param parent - Parent group that receives canopy clusters.
 */
export function addCanopy(rng: () => number, seed: number, crownY: number, canopyMaterial: ShaderMaterial, parent: Group): void {
  const clusterCount = CLUSTER_COUNT_MIN + Math.floor(rng() * CLUSTER_COUNT_RANGE);
  for (let i = 0; i < clusterCount; i++) {
    addCanopyCluster(i, clusterCount, rng, seed, crownY, canopyMaterial, parent);
  }
}
