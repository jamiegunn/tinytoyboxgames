import { Mesh, SphereGeometry, type MeshStandardMaterial, type Object3D } from 'three';

/**
 * Creates a sphere mesh with non-uniform mesh scaling to simulate
 * per-axis diameters.
 *
 * @param name - Mesh name identifier.
 * @param diameterX - Diameter along the X axis.
 * @param diameterY - Diameter along the Y axis.
 * @param diameterZ - Diameter along the Z axis.
 * @param segments - Number of geometry segments.
 * @param material - The material to apply to the mesh.
 * @returns The scaled sphere mesh.
 */
export function createScaledSphere(
  name: string,
  diameterX: number,
  diameterY: number,
  diameterZ: number,
  segments: number,
  material: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(new SphereGeometry(0.5, segments, segments), material);
  mesh.name = name;
  mesh.scale.set(diameterX, diameterY, diameterZ);
  return mesh;
}

/**
 * Creates an ellipsoid mesh by scaling the geometry vertices directly instead
 * of using the mesh transform. Child positions therefore stay undistorted.
 *
 * @param name - Mesh name identifier.
 * @param radiusX - Radius along the X axis.
 * @param radiusY - Radius along the Y axis.
 * @param radiusZ - Radius along the Z axis.
 * @param segments - Number of geometry segments.
 * @param material - The material to apply to the mesh.
 * @returns The ellipsoid mesh with baked vertex scaling.
 */
export function createBakedEllipsoid(name: string, radiusX: number, radiusY: number, radiusZ: number, segments: number, material: MeshStandardMaterial): Mesh {
  const geometry = new SphereGeometry(1, segments, segments);
  geometry.scale(radiusX, radiusY, radiusZ);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

/**
 * Enables both cast and receive shadows on every mesh under the given object.
 *
 * @param root - Root object to traverse.
 */
export function enableMeshShadows(root: Object3D): void {
  root.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}
