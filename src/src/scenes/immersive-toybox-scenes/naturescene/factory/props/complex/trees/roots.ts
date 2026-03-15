import { Mesh, Group, CylinderGeometry, type ShaderMaterial } from 'three';
import { lerp } from '@app/utils/mathHelpers';
import { deformTrunk } from './trunk';
import {
  ROOT_COUNT_MIN,
  ROOT_COUNT_RANGE,
  ROOT_LENGTH_MIN,
  ROOT_LENGTH_MAX,
  ROOT_THICKNESS_SCALE_MIN,
  ROOT_THICKNESS_SCALE_MAX,
  ROOT_THINNING_MIN,
  ROOT_THINNING_MAX,
  ROOT_DISTANCE_FACTOR,
  ROOT_Y_FACTOR,
  ROOT_ANGLE_JITTER,
  ROOT_ROTATION_MIN,
  ROOT_ROTATION_MAX,
} from './constants';

function addRoot(index: number, count: number, rng: () => number, seed: number, baseRadius: number, barkMaterial: ShaderMaterial, parent: Group): void {
  const angle = (index / count) * Math.PI * 2 + (rng() - 0.5) * ROOT_ANGLE_JITTER;
  const rootLength = lerp(ROOT_LENGTH_MIN, ROOT_LENGTH_MAX, rng());
  const thickRadius = baseRadius * lerp(ROOT_THICKNESS_SCALE_MIN, ROOT_THICKNESS_SCALE_MAX, rng());
  const thinRadius = thickRadius * lerp(ROOT_THINNING_MIN, ROOT_THINNING_MAX, rng());

  const geometry = new CylinderGeometry(thinRadius, thickRadius, rootLength, 6, 4);
  deformTrunk(geometry, seed + index * 17, thickRadius, thinRadius);

  const rootMesh = new Mesh(geometry, barkMaterial);
  const distance = baseRadius * ROOT_DISTANCE_FACTOR;
  rootMesh.position.set(Math.cos(angle) * distance, rootLength * ROOT_Y_FACTOR, Math.sin(angle) * distance);
  rootMesh.rotation.z = Math.cos(angle) * lerp(ROOT_ROTATION_MIN, ROOT_ROTATION_MAX, rng());
  rootMesh.rotation.x = -Math.sin(angle) * lerp(ROOT_ROTATION_MIN, ROOT_ROTATION_MAX, rng());
  rootMesh.castShadow = true;
  parent.add(rootMesh);
}

/**
 * Adds several exposed roots around the base of the procedural tree.
 *
 * @param parent - Parent group that receives the root meshes.
 * @param barkMaterial - Bark shader material shared with the trunk.
 * @param rng - Deterministic random source for this tree instance.
 * @param seed - Seed used to vary root deformation between branches.
 * @param baseRadius - The trunk base radius used to scale root thickness and spread.
 */
export function addRoots(parent: Group, barkMaterial: ShaderMaterial, rng: () => number, seed: number, baseRadius: number): void {
  const rootCount = ROOT_COUNT_MIN + Math.floor(rng() * ROOT_COUNT_RANGE);
  for (let i = 0; i < rootCount; i++) {
    addRoot(i, rootCount, rng, seed, baseRadius, barkMaterial, parent);
  }
}
