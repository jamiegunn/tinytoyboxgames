import { Vector3, type Mesh, type Group } from 'three';

/**
 * Configuration for scattering decorative meshes across a ground area.
 */
export interface ScatterConfig {
  /** Number of items to scatter. */
  count: number;
  /** Factory function that creates one decorative mesh at a given position. */
  buildFn: (position: Vector3) => Mesh | Group;
  /** Width of the scatter area (X axis). @default 8 */
  width?: number;
  /** Depth of the scatter area (Z axis). @default 6 */
  depth?: number;
  /** Y-offset for all scattered items. @default 0.02 */
  yOffset?: number;
}

/**
 * Scatters decorative meshes at random positions within a rectangular area.
 * Replaces the copy-pasted scatter loops found in every world scene's index.ts.
 *
 * @param config - Scatter parameters and factory function.
 * @returns Array of created meshes/groups.
 */
export function scatterDecoratives(config: ScatterConfig): (Mesh | Group)[] {
  const width = config.width ?? 8;
  const depth = config.depth ?? 6;
  const yOffset = config.yOffset ?? 0.02;
  const results: (Mesh | Group)[] = [];

  for (let i = 0; i < config.count; i++) {
    const x = (Math.random() - 0.5) * width;
    const z = (Math.random() - 0.5) * depth;
    const mesh = config.buildFn(new Vector3(x, yOffset, z));
    results.push(mesh);
  }

  return results;
}
