import type { Material, Object3D, Mesh } from 'three';

/**
 * Recursively disposes an Object3D, all its descendants, and their
 * geometries and materials.
 *
 * @param obj - The root object to dispose. May be null.
 */
export function disposeMeshDeep(obj: Object3D | null): void {
  if (!obj) return;

  obj.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m: Material) => m.dispose());
      } else {
        (mesh.material as Material).dispose();
      }
    }
  });

  obj.removeFromParent();
}
