import type { Color, Mesh, MeshStandardMaterial, PointLight } from 'three';

export interface FireflyInstance {
  mesh: Mesh;
  material: MeshStandardMaterial;
  glow: PointLight;
  glowColor: Color;
}
