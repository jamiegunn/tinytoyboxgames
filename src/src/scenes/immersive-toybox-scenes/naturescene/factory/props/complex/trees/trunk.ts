import { Mesh, Group, CylinderGeometry, type ShaderMaterial } from 'three';
import { simplex3, fbm3 } from '@app/utils/noise3d';
import { lerp } from '@app/utils/mathHelpers';
import { TRUNK_RADIAL_SEGMENTS, TRUNK_HEIGHT_SEGMENTS } from './constants';

/**
 * Deforms a cylinder geometry's vertices using 3D noise to create an organic,
 * irregular trunk shape. Vertices near the base bulge outward, and higher
 * vertices pick up more detail for knobby branch stubs.
 *
 * @param geo - The cylinder geometry to deform in place.
 * @param seed - Noise seed for deterministic variation.
 * @param baseRadius - Radius at the bottom of the trunk.
 * @param topRadius - Radius at the top of the trunk.
 */
export function deformTrunk(geo: CylinderGeometry, seed: number, baseRadius: number, topRadius: number): void {
  const pos = geo.attributes.position;
  const count = pos.count;

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const height = geo.parameters.height;
    const t = (y + height / 2) / height;
    const ringRadius = lerp(baseRadius, topRadius, t);
    if (ringRadius < 0.001) continue;

    const dist = Math.sqrt(x * x + z * z);
    if (dist < 0.001) continue;

    const nx = x / dist;
    const nz = z / dist;
    const bulge = simplex3(x * 2 + seed, y * 1.5 + seed * 0.7, z * 2 + seed * 1.3) * 0.08;
    const knobs = fbm3(x * 6 + seed, y * 3, z * 6 + seed, 3) * 0.04 * (0.5 + t);
    const angle = Math.atan2(z, x);
    const furrow = Math.sin(angle * 8 + seed) * 0.015 * (1 - t * 0.5);
    const flare = Math.max(0, 1 - t * 4) * 0.06;
    const displacement = bulge + knobs + furrow + flare;

    pos.setX(i, x + nx * displacement);
    pos.setZ(i, z + nz * displacement);

    const yNoise = simplex3(x * 4 + seed * 2, y * 2, z * 4 + seed * 2) * 0.02;
    pos.setY(i, y + yNoise);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/**
 * Adds the main noise-deformed trunk mesh for a procedural tree.
 *
 * @param trunkHeight - Height of the trunk cylinder before deformation.
 * @param baseRadius - Radius at the base of the trunk.
 * @param topRadius - Radius at the top of the trunk.
 * @param seed - Noise seed for deterministic trunk deformation.
 * @param barkMaterial - Bark shader material shared by the trunk and roots.
 * @param parent - Parent group that receives the trunk mesh.
 */
export function addTrunk(trunkHeight: number, baseRadius: number, topRadius: number, seed: number, barkMaterial: ShaderMaterial, parent: Group): void {
  const trunkGeometry = new CylinderGeometry(topRadius, baseRadius, trunkHeight, TRUNK_RADIAL_SEGMENTS, TRUNK_HEIGHT_SEGMENTS);
  deformTrunk(trunkGeometry, seed, baseRadius, topRadius);

  const trunk = new Mesh(trunkGeometry, barkMaterial);
  trunk.name = 'treeTrunk';
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  parent.add(trunk);
}
