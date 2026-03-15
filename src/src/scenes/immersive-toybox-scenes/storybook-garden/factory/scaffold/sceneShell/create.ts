/**
 * Creates the felt-and-wood toybox walls for Storybook Garden.
 *
 * The geometry here is intentionally aligned with the visual language used by
 * `naturescene`: low felt side walls, a warm wood rim, and back-corner posts.
 * That keeps generated immersive scenes visually consistent with the first
 * authored toybox world instead of inventing a second shell style.
 */

import { CylinderGeometry, Group, Mesh, PlaneGeometry, type Scene } from 'three';
import type { ImmersiveSceneMaterials } from '../../../materials';

/** Options controlling the generated shell dimensions and materials. */
export interface SceneShellBuildOptions {
  width: number;
  depth: number;
  wallHeight: number;
  materials: Pick<ImmersiveSceneMaterials, 'shellWall' | 'shellTrim'>;
}

/**
 * Builds the three visible Nature-style toybox walls plus wood trim.
 *
 * The front wall is omitted on purpose because the camera looks in from that
 * side, just like Nature. The ground plane extends slightly past the wall
 * panels so the scene reads like the inside of a toybox instead of a closed
 * room.
 *
 * @param scene - Scene that should receive the shell geometry.
 * @param options - Dimensions and shared materials for the shell.
 * @returns The root group containing every shell mesh.
 */
export function createSceneShell(scene: Scene, options: SceneShellBuildOptions): Group {
  const root = new Group();
  root.name = 'scene_shell';

  const wallInset = 0.5;
  const halfWallWidth = Math.max(options.width / 2 - wallInset, 0.5);
  const halfWallDepth = Math.max(options.depth / 2 - wallInset, 0.5);

  const walls: Array<{
    name: string;
    x: number;
    z: number;
    width: number;
    rimRotationY: number;
    faceRotationY: number;
  }> = [
    {
      name: 'scene_shell_back_wall',
      x: 0,
      z: halfWallDepth,
      width: halfWallWidth * 2,
      rimRotationY: 0,
      faceRotationY: Math.PI,
    },
    {
      name: 'scene_shell_left_wall',
      x: -halfWallWidth,
      z: 0,
      width: halfWallDepth * 2,
      rimRotationY: Math.PI / 2,
      faceRotationY: Math.PI / 2,
    },
    {
      name: 'scene_shell_right_wall',
      x: halfWallWidth,
      z: 0,
      width: halfWallDepth * 2,
      rimRotationY: Math.PI / 2,
      faceRotationY: -Math.PI / 2,
    },
  ];

  walls.forEach((wall) => {
    const panel = new Mesh(new PlaneGeometry(wall.width, options.wallHeight), options.materials.shellWall);
    panel.name = wall.name;
    panel.position.set(wall.x, options.wallHeight / 2, wall.z);
    panel.rotation.y = wall.faceRotationY;
    panel.receiveShadow = true;
    root.add(panel);

    const rim = new Mesh(new CylinderGeometry(0.08, 0.08, wall.width, 8), options.materials.shellTrim);
    rim.name = `${wall.name}_rim`;
    rim.position.set(wall.x, options.wallHeight, wall.z);
    rim.rotation.z = Math.PI / 2;
    rim.rotation.y = wall.rimRotationY;
    rim.castShadow = true;
    root.add(rim);
  });

  [
    [-halfWallWidth, halfWallDepth],
    [halfWallWidth, halfWallDepth],
  ].forEach(([x, z], index) => {
    const post = new Mesh(new CylinderGeometry(0.12, 0.12, options.wallHeight + 0.1, 8), options.materials.shellTrim);
    post.name = `scene_shell_corner_post_${index}`;
    post.position.set(x, options.wallHeight / 2, z);
    post.castShadow = true;
    root.add(post);
  });

  scene.add(root);
  return root;
}
