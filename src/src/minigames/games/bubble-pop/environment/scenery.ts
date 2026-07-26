import { Scene, Color, Mesh, SphereGeometry, MeshStandardMaterial } from 'three';
import { createCelestialBody } from '@app/utils/skyRig';
import type { StarMesh } from '../types';

/**
 * Low-level mesh builders for the night sky environment.
 * Pure constructors — no state, no per-frame updates, no orchestration.
 */

/**
 * Builds a soft glowing full moon using the shared sky rig — an emissive core
 * sphere with a soft additive halo (replaces the old flat halo disc + broken
 * crescent carve, which read as a hard pancake).
 *
 * @param scene - The Three.js scene.
 * @returns The moon group (typed as Mesh for the existing caller contract).
 */
export function buildMoon(scene: Scene): Mesh {
  const { root } = createCelestialBody({
    radius: 0.9,
    color: new Color(1.0, 0.97, 0.86),
    emissive: new Color(1.0, 0.95, 0.72),
    emissiveIntensity: 1.5,
    haloScale: 2.0,
    haloColor: new Color(1.0, 0.93, 0.72),
    haloOpacity: 0.2,
  });
  root.name = 'bubble_pop_mesh_moon';
  scene.add(root);
  return root as unknown as Mesh;
}

/**
 * Builds a single twinkling star mesh with randomised twinkle parameters.
 * @param scene - The Three.js scene.
 * @param index - Star index for naming.
 * @returns A StarMesh with twinkle parameters.
 */
export function buildStar(scene: Scene, index: number): StarMesh {
  // Sized for the sky-rig depth (~14-20 units) so stars stay visible as dots.
  const size = 0.12 + Math.random() * 0.18;
  const geo = new SphereGeometry(size / 2, 8, 8);

  const warmth = Math.random();
  const coldColor = new Color(0.8, 0.85, 1.0);
  const warmColor = new Color(1.0, 0.95, 0.7);
  const color = coldColor.clone().lerp(warmColor, warmth);
  const baseIntensity = 0.6 + Math.random() * 0.5;

  const mat = new MeshStandardMaterial({
    color: color.clone(),
    emissive: color.clone().multiplyScalar(baseIntensity),
    opacity: 0.6 + Math.random() * 0.4,
    transparent: true,
  });
  mat.name = `starMat_${index}`;

  const mesh = new Mesh(geo, mat);
  mesh.name = `bubble_pop_mesh_star_${String(index).padStart(2, '0')}`;
  scene.add(mesh);

  return {
    mesh,
    mat,
    color,
    baseIntensity,
    twinkleSpeed: 1.0 + Math.random() * 3.0,
    twinklePhase: Math.random() * Math.PI * 2,
  };
}
