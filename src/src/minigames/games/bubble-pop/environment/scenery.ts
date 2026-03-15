import { Scene, Color, Mesh, SphereGeometry, CircleGeometry, MeshStandardMaterial, DoubleSide, Group } from 'three';
import type { StarMesh } from '../types';

/**
 * Low-level mesh builders for the night sky environment.
 * Pure constructors — no state, no per-frame updates, no orchestration.
 */

/**
 * Builds a crescent moon from overlapping spheres with a soft halo.
 * @param scene - The Three.js scene.
 * @returns The moon group mesh.
 */
export function buildMoon(scene: Scene): Mesh {
  const parent = new Group();
  parent.name = 'bubble_pop_mesh_moon';

  const mat = new MeshStandardMaterial({
    color: new Color(1.0, 0.97, 0.85),
    metalness: 0,
    roughness: 0.3,
    emissive: new Color(0.6, 0.55, 0.35),
  });
  mat.name = 'moonMat';

  // Full moon sphere
  const fullGeo = new SphereGeometry(0.9, 24, 24);
  const full = new Mesh(fullGeo, mat);
  full.name = 'moonFull';
  parent.add(full);

  // Shadow sphere to carve the crescent shape
  const shadowMat = new MeshStandardMaterial({
    color: new Color(0.04, 0.06, 0.12),
    metalness: 0,
    roughness: 1,
    emissive: new Color(0.02, 0.03, 0.06),
  });
  shadowMat.name = 'moonShadowMat';
  const shadowGeo = new SphereGeometry(0.8, 24, 24);
  const shadow = new Mesh(shadowGeo, shadowMat);
  shadow.name = 'moonShadow';
  shadow.position.set(0.5, 0.3, -0.2);
  parent.add(shadow);

  // Soft glow halo
  const haloGeo = new CircleGeometry(1.5, 32);
  const haloMat = new MeshStandardMaterial({
    color: new Color(1.0, 0.95, 0.7),
    emissive: new Color(0.3, 0.28, 0.15),
    opacity: 0.12,
    transparent: true,
    side: DoubleSide,
  });
  haloMat.name = 'moonHaloMat';
  const halo = new Mesh(haloGeo, haloMat);
  halo.name = 'moonHalo';
  halo.position.z = 0.1;
  parent.add(halo);

  scene.add(parent);
  return parent as unknown as Mesh;
}

/**
 * Builds a single twinkling star mesh with randomised twinkle parameters.
 * @param scene - The Three.js scene.
 * @param index - Star index for naming.
 * @returns A StarMesh with twinkle parameters.
 */
export function buildStar(scene: Scene, index: number): StarMesh {
  const size = 0.04 + Math.random() * 0.08;
  const geo = new SphereGeometry(size / 2, 6, 6);

  const warmth = Math.random();
  const coldColor = new Color(0.8, 0.85, 1.0);
  const warmColor = new Color(1.0, 0.95, 0.7);
  const color = coldColor.clone().lerp(warmColor, warmth);
  const baseIntensity = 0.3 + Math.random() * 0.5;

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
