import gsap from 'gsap';
import { Mesh } from 'three';
import type { OwlBuildParts } from './types';

/**
 * Releases all owl-owned GPU resources and kills any straggling transform
 * tweens within the owl subtree.
 *
 * @param parts - Built owl parts whose resources belong to this entity.
 */
export function disposeOwl(parts: OwlBuildParts): void {
  parts.root.traverse((child) => {
    gsap.killTweensOf(child.position);
    gsap.killTweensOf(child.rotation);
    gsap.killTweensOf(child.scale);

    if (child instanceof Mesh) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }

      child.geometry.dispose();
    }
  });

  parts.root.removeFromParent();
}
