import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { SIDE_TABLE_X, SIDE_TABLE_Z } from '../layout';

/**
 * Creates the little round side table beside the couch, topped with a short
 * stack of storybooks and a mug of cocoa. Quiet set dressing — the couch,
 * fire, lamp, and cat carry the room's interactivity.
 *
 * @param scene - The Three.js scene that receives the table group.
 */
export function createSideTable(scene: Scene): void {
  const root = new Group();
  root.name = 'livingRoom_sideTable';
  root.position.set(SIDE_TABLE_X, 0, SIDE_TABLE_Z);
  scene.add(root);

  const woodMat = createWoodMaterial('livingRoom_sideTableMat', new Color(0.55, 0.4, 0.26));

  const top = new Mesh(new CylinderGeometry(0.42, 0.42, 0.06, 18), woodMat);
  top.name = 'sideTableTop';
  top.position.y = 0.72;
  top.castShadow = true;
  root.add(top);

  const column = new Mesh(new CylinderGeometry(0.05, 0.05, 0.66, 10), woodMat);
  column.name = 'sideTableColumn';
  column.position.y = 0.39;
  root.add(column);

  const foot = new Mesh(new CylinderGeometry(0.24, 0.28, 0.06, 16), woodMat);
  foot.name = 'sideTableFoot';
  foot.position.y = 0.03;
  root.add(foot);

  // Storybook stack.
  const bookColors = [new Color(0.85, 0.4, 0.35), new Color(0.42, 0.6, 0.82)];
  bookColors.forEach((color, index) => {
    const book = new Mesh(new BoxGeometry(0.32, 0.05, 0.24), createGlossyPaintMaterial(`livingRoom_tableBookMat${index}`, color));
    book.name = `sideTableBook${index}`;
    book.position.set(-0.1, 0.78 + index * 0.05, 0.05);
    book.rotation.y = index * 0.35;
    book.castShadow = true;
    root.add(book);
  });

  // Cocoa mug.
  const mug = new Mesh(new CylinderGeometry(0.06, 0.055, 0.1, 12), createPlasticMaterial('livingRoom_mugMat', new Color(0.95, 0.9, 0.8)));
  mug.name = 'sideTableMug';
  mug.position.set(0.18, 0.8, -0.08);
  mug.castShadow = true;
  root.add(mug);
}
