import type { Color, Mesh, MeshStandardMaterial, Sprite, SpriteMaterial } from 'three';

export interface FireflyInstance {
  mesh: Mesh;
  material: MeshStandardMaterial;
  /** Additive billboard sprite that fakes the local glow (no real light). */
  glowSprite: Sprite;
  /** Sprite material whose opacity carries the blink/flash animation. */
  glowMaterial: SpriteMaterial;
  glowColor: Color;
}
