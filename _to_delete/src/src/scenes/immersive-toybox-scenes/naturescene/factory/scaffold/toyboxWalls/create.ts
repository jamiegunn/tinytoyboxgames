import { Scene, Color, Mesh, Group, PlaneGeometry, CylinderGeometry } from 'three';
import { createFeltMaterial, createWoodMaterial } from '@app/utils/materialFactory';

// ── Toybox Enclosure ───────────────────────────────────────────────────────────

/**
 * Creates low felt-lined walls with a wood rim to create the toybox interior feel.
 *
 * @param scene - The Three.js scene to add the toybox walls to.
 * @returns The root group that owns the toybox wall meshes.
 */
export function createToyboxWalls(scene: Scene): Group {
  const root = new Group();
  root.name = 'toybox_walls_root';
  scene.add(root);

  const wallMat = createFeltMaterial('toyboxWallMat', new Color(0.55, 0.38, 0.65));
  const rimMat = createWoodMaterial('toyboxRimMat', new Color(0.5, 0.32, 0.18));
  const wallHeight = 3.0;
  const halfW = 7.5;
  const halfD = 6.5;

  // Wall definitions: [x, z, width, rotY, faceRotY]
  // Front wall (i=0) omitted — camera looks from that side
  const walls: [number, number, number, number, number][] = [
    [0, halfD, halfW * 2, 0, Math.PI], // back
    [-halfW, 0, halfD * 2, Math.PI / 2, Math.PI / 2], // left
    [halfW, 0, halfD * 2, Math.PI / 2, -Math.PI / 2], // right
  ];

  walls.forEach(([x, z, width, rotY, faceRotY], i) => {
    // Felt wall panel
    const panel = new Mesh(new PlaneGeometry(width, wallHeight), wallMat);
    panel.name = `toyboxWall_${i}`;
    panel.position.set(x, wallHeight / 2, z);
    panel.rotation.y = faceRotY;
    panel.receiveShadow = true;
    root.add(panel);

    // Wood rim along the top edge
    const rim = new Mesh(new CylinderGeometry(0.08, 0.08, width, 8), rimMat);
    rim.name = `toyboxRim_${i}`;
    rim.position.set(x, wallHeight, z);
    rim.rotation.z = Math.PI / 2;
    rim.rotation.y = rotY;
    if (i === 0) rim.rotation.y = 0; // back wall rim runs along X
    root.add(rim);
  });

  // Corner posts — only back two corners (front corners omitted with front wall)
  const corners = [
    [-halfW, halfD],
    [halfW, halfD],
  ];
  corners.forEach(([cx, cz], ci) => {
    const post = new Mesh(new CylinderGeometry(0.12, 0.12, wallHeight + 0.1, 8), rimMat);
    post.name = `toyboxCorner_${ci}`;
    post.position.set(cx, wallHeight / 2, cz);
    post.castShadow = true;
    root.add(post);
  });

  return root;
}
