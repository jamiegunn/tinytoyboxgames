/**
 * Creates a sunset sky backdrop for Pirate Cove.
 *
 * The backdrop is a large plane behind the scene with a warm sunset orange to
 * deep blue gradient. Stylized flat cloud shapes are added for extra whimsy.
 */

import { Color, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, Group, type Material, type Scene } from 'three';

/** Options controlling the backdrop plane placement and size. */
export interface SkyBackdropBuildOptions {
  width: number;
  height: number;
  y: number;
  z: number;
  material: Material;
}

/**
 * Builds and places a sunset sky backdrop with stylized cloud shapes.
 *
 * @param scene - Scene that should receive the backdrop mesh.
 * @param options - Dimensions, position, and material for the backdrop.
 * @returns The created backdrop group.
 */
export function createSkyBackdrop(scene: Scene, options: SkyBackdropBuildOptions): Group {
  const root = new Group();
  root.name = 'sky_backdrop_group';

  // Main backdrop plane
  const backdrop = new Mesh(new PlaneGeometry(options.width, options.height), options.material);
  backdrop.name = 'sky_backdrop';
  backdrop.position.set(0, options.y, options.z);
  root.add(backdrop);

  // Sunset horizon glow — a warm orange plane at the lower portion
  const horizonMat = new MeshStandardMaterial({
    color: new Color(1.0, 0.6, 0.25),
    metalness: 0,
    roughness: 0.5,
    transparent: true,
    opacity: 0.4,
  });
  const horizon = new Mesh(new PlaneGeometry(options.width, options.height * 0.35), horizonMat);
  horizon.name = 'sky_horizon_glow';
  horizon.position.set(0, options.y - options.height * 0.3, options.z + 0.05);
  root.add(horizon);

  // Stylized flat cloud shapes — squashed spheres
  const cloudMat = new MeshStandardMaterial({
    color: new Color(0.95, 0.85, 0.75),
    metalness: 0,
    roughness: 0.9,
    transparent: true,
    opacity: 0.5,
  });

  const cloudPlacements = [
    { x: -4, y: options.y + 2.5, z: options.z + 0.3, scaleX: 2.5, scaleY: 0.5, scaleZ: 0.8 },
    { x: 3, y: options.y + 3.0, z: options.z + 0.2, scaleX: 3.0, scaleY: 0.4, scaleZ: 0.7 },
    { x: -1.5, y: options.y + 3.8, z: options.z + 0.4, scaleX: 2.0, scaleY: 0.35, scaleZ: 0.6 },
  ];

  cloudPlacements.forEach((cloud, i) => {
    const mesh = new Mesh(new SphereGeometry(0.5, 10, 8), cloudMat);
    mesh.name = `sky_cloud_${i}`;
    mesh.position.set(cloud.x, cloud.y, cloud.z);
    mesh.scale.set(cloud.scaleX, cloud.scaleY, cloud.scaleZ);
    root.add(mesh);
  });

  scene.add(root);
  return root;
}
