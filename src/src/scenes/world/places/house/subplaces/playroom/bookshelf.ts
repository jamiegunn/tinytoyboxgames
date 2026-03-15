import { BoxGeometry, Color, Mesh, SphereGeometry, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { BOOKSHELF_CENTER_X, BOOKSHELF_Z } from './layout';
import { createTeddyBear } from './bookshelf-items/teddyBear';
import { createDeskLamp } from './bookshelf-items/deskLamp';
import { createWoodenDuck } from './bookshelf-items/woodenDuck';
import { createRubberDuck } from './bookshelf-items/rubberDuck';
import { createToyCar } from './bookshelf-items/toyCar';
import { createTeapot } from './bookshelf-items/teapot';
import { createPlushStar } from './bookshelf-items/plushStar';

/**
 * Creates the bookshelf against the back wall with books, decorative shelf props, and bookshelf items.
 * @param scene - The Three.js scene to add the bookshelf to
 * @param keyLight - The directional light for shadow casting
 */
export function createBookshelf(scene: Scene, keyLight: DirectionalLight): void {
  // Light natural wood / warm cream shelf
  const shelfMat = createWoodMaterial('hub_shelfMat', new Color(0.82, 0.72, 0.58));

  // Frame (back panel)
  const back = new Mesh(new BoxGeometry(3.0, 2.5, 0.08), shelfMat);
  back.name = 'shelfBack';
  back.position.set(BOOKSHELF_CENTER_X, 1.25, BOOKSHELF_Z + 0.25);
  back.castShadow = true;
  scene.add(back);

  // Shelves (3 horizontal)
  const shelfYs = [0.0, 0.8, 1.6];
  for (let i = 0; i < shelfYs.length; i++) {
    const shelf = new Mesh(new BoxGeometry(2.9, 0.08, 0.5), shelfMat);
    shelf.name = `shelf${i}`;
    shelf.position.set(BOOKSHELF_CENTER_X, shelfYs[i], BOOKSHELF_Z);
    scene.add(shelf);
  }

  // Side panels
  [-1.45, 1.45].forEach((xOff, i) => {
    const side = new Mesh(new BoxGeometry(0.08, 2.5, 0.5), shelfMat);
    side.name = `shelfSide${i}`;
    side.position.set(BOOKSHELF_CENTER_X + xOff, 1.25, BOOKSHELF_Z);
    scene.add(side);
  });

  // Top panel
  const top = new Mesh(new BoxGeometry(3.0, 0.08, 0.52), shelfMat);
  top.name = 'shelfTop';
  top.position.set(BOOKSHELF_CENTER_X, 2.5, BOOKSHELF_Z);
  scene.add(top);

  // Books
  const bookColors = [
    new Color(0.85, 0.15, 0.15),
    new Color(0.2, 0.4, 0.85),
    new Color(0.2, 0.65, 0.25),
    new Color(0.95, 0.8, 0.15),
    new Color(0.95, 0.5, 0.1),
    new Color(0.5, 0.25, 0.7),
    new Color(0.2, 0.7, 0.65),
    new Color(0.9, 0.5, 0.6),
    new Color(0.5, 0.35, 0.2),
    new Color(0.7, 0.15, 0.55),
    new Color(0.15, 0.55, 0.5),
    new Color(0.8, 0.35, 0.0),
    new Color(0.35, 0.3, 0.65),
    new Color(0.6, 0.75, 0.2),
    new Color(0.25, 0.35, 0.6),
  ];
  const bookMats = bookColors.map((c, i) => createGlossyPaintMaterial(`hub_bookMat${i}`, c));

  function addBook(name: string, x: number, baseY: number, h: number, w: number, d: number, matIdx: number, rot: number) {
    const book = new Mesh(new BoxGeometry(w, h, d), bookMats[matIdx]);
    book.name = name;
    book.position.set(BOOKSHELF_CENTER_X + x, baseY + h / 2, BOOKSHELF_Z - 0.05);
    book.rotation.z = rot;
    scene.add(book);
  }

  // Bottom shelf: 6 books
  const bottomBooks = [
    { x: -1.2, h: 0.48, w: 0.11, mat: 9, rot: -0.03 },
    { x: -1.0, h: 0.42, w: 0.13, mat: 10, rot: 0.04 },
    { x: -0.8, h: 0.5, w: 0.12, mat: 0, rot: 0.03 },
    { x: -0.45, h: 0.45, w: 0.1, mat: 1, rot: -0.02 },
    { x: -0.15, h: 0.55, w: 0.14, mat: 2, rot: 0.05 },
    { x: 0.2, h: 0.4, w: 0.11, mat: 3, rot: -0.04 },
  ];
  for (const b of bottomBooks) {
    addBook(`book_b${b.mat}`, b.x, 0.04, b.h, b.w, 0.3, b.mat, b.rot);
  }

  // Middle shelf: 5 books
  const midBooks = [
    { x: -1.1, h: 0.44, w: 0.12, mat: 11, rot: 0.02 },
    { x: -0.88, h: 0.5, w: 0.1, mat: 12, rot: -0.04 },
    { x: -0.6, h: 0.45, w: 0.13, mat: 4, rot: -0.03 },
    { x: -0.25, h: 0.5, w: 0.1, mat: 5, rot: 0.04 },
    { x: 0.1, h: 0.38, w: 0.12, mat: 6, rot: -0.02 },
  ];
  for (const b of midBooks) {
    addBook(`book_m${b.mat}`, b.x, 0.84, b.h, b.w, 0.3, b.mat, b.rot);
  }

  // Top shelf: 4 books
  const topBooks = [
    { x: -1.15, h: 0.38, w: 0.11, mat: 13, rot: 0.03 },
    { x: -0.95, h: 0.42, w: 0.12, mat: 14, rot: -0.02 },
    { x: -0.7, h: 0.35, w: 0.1, mat: 7, rot: 0.02 },
    { x: -0.45, h: 0.4, w: 0.12, mat: 8, rot: -0.03 },
  ];
  for (const b of topBooks) {
    addBook(`book_t${b.mat}`, b.x, 1.64, b.h, b.w, 0.28, b.mat, b.rot);
  }

  // Top shelf: tiny moon lamp
  const moonLampMat = createPlasticMaterial('hub_moonLampMat', new Color(1.0, 0.95, 0.8));
  moonLampMat.emissive = new Color(0.25, 0.2, 0.1);
  const moonLamp = new Mesh(new SphereGeometry(0.05, 8, 8), moonLampMat);
  moonLamp.name = 'shelfMoonLamp';
  moonLamp.position.set(BOOKSHELF_CENTER_X + 0.7, 1.72, BOOKSHELF_Z - 0.1);
  scene.add(moonLamp);

  // ── Top shelf: toy block ───────────────────────────────────────────────────
  const blockMat = createGlossyPaintMaterial('hub_blockMat', new Color(0.2, 0.5, 0.9));
  const block = new Mesh(new BoxGeometry(0.12, 0.12, 0.12), blockMat);
  block.name = 'shelfBlock';
  block.position.set(BOOKSHELF_CENTER_X + 0.0, 1.7, BOOKSHELF_Z - 0.08);
  block.rotation.y = 0.25;
  scene.add(block);

  // Letter "A" on the block front — simple raised rectangle
  const letterMat = createGlossyPaintMaterial('hub_blockLetterMat', new Color(1.0, 0.95, 0.3));
  const letterBar = new Mesh(new BoxGeometry(0.04, 0.055, 0.005), letterMat);
  letterBar.name = 'shelfBlockLetter';
  letterBar.position.set(0, 0, 0.063);
  block.add(letterBar);

  // Bookshelf items
  createTeddyBear(scene, keyLight);
  createDeskLamp(scene, keyLight);
  createWoodenDuck(scene);
  createRubberDuck(scene);
  createToyCar(scene);
  createTeapot(scene);
  createPlushStar(scene);
}
