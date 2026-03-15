import { BoxGeometry, Color, Group, Mesh, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';

/**
 * Creates a small stack of three coloured books on the floor with visible page edges.
 * @param scene - The Three.js scene to add the books to
 * @param _keyLight - The directional light (unused)
 */
export function createFloorBooks(scene: Scene, _keyLight: DirectionalLight): void {
  const pageMat = createPlasticMaterial('hub_floorBookPageMat', new Color(0.96, 0.94, 0.9));

  const bookConfigs = [
    { w: 0.6, h: 0.06, d: 0.45, color: new Color(0.2, 0.5, 0.8), rotY: 0.1 },
    { w: 0.55, h: 0.05, d: 0.4, color: new Color(0.9, 0.3, 0.3), rotY: -0.15 },
    { w: 0.5, h: 0.07, d: 0.38, color: new Color(0.3, 0.75, 0.4), rotY: 0.25 },
  ];

  const root = new Group();
  root.name = 'floorBooks_root';
  root.position.set(-4.2, 0, 5.5);
  scene.add(root);

  for (let i = 0; i < bookConfigs.length; i++) {
    const b = bookConfigs[i];
    const coverMat = createGlossyPaintMaterial(`hub_floorBookMat${i}`, b.color);

    const book = new Group();
    book.name = `floorBook${i}`;
    book.position.set(0, 0.03 + i * 0.06, 0);
    book.rotation.y = b.rotY;
    root.add(book);

    // Cover — the coloured outer shell
    const cover = new Mesh(new BoxGeometry(b.w, b.h, b.d), coverMat);
    cover.name = `floorBookCover${i}`;
    cover.castShadow = true;
    book.add(cover);

    // Page block — white pages visible on three edges (front, left, right)
    // Slightly inset from the cover on all sides except the spine (back)
    const pageW = b.w * 0.92;
    const pageH = b.h * 0.7;
    const pageD = b.d * 0.9;
    const pages = new Mesh(new BoxGeometry(pageW, pageH, pageD), pageMat);
    pages.name = `floorBookPages${i}`;
    // Shift pages slightly toward the front (away from spine)
    pages.position.set(0, 0, -0.01);
    book.add(pages);

    // Spine detail — a thin darker strip along the back edge
    const spineMat = createGlossyPaintMaterial(`hub_floorBookSpineMat${i}`, b.color.clone().multiplyScalar(0.7));
    const spine = new Mesh(new BoxGeometry(b.w * 0.04, b.h + 0.002, b.d * 0.98), spineMat);
    spine.name = `floorBookSpine${i}`;
    spine.position.set(0, 0, b.d / 2 - 0.01);
    book.add(spine);
  }
}
