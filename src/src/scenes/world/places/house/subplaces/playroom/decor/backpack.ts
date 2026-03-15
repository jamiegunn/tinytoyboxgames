import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';

/**
 * Creates a child's backpack leaning in the back-left corner of the room.
 * @param scene - The Three.js scene to add the backpack to
 * @param _keyLight - The directional light (unused)
 */
export function createBackpack(scene: Scene, _keyLight: DirectionalLight): void {
  const root = new Group();
  root.name = 'backpack_root';
  root.position.set(5.2, 0, 8.2);
  root.rotation.y = Math.PI - 0.4 + Math.PI / 4; // rotated 45° more
  scene.add(root);

  const mainMat = createFeltMaterial('hub_backpackMainMat', new Color(0.2, 0.45, 0.78));
  const pocketMat = createFeltMaterial('hub_backpackPocketMat', new Color(0.25, 0.5, 0.82));
  const strapMat = createFeltMaterial('hub_backpackStrapMat', new Color(0.18, 0.4, 0.7));
  const buckMat = createToyMetalMaterial('hub_backpackBuckleMat', new Color(0.75, 0.7, 0.55));
  const zipMat = createToyMetalMaterial('hub_backpackZipMat', new Color(0.8, 0.75, 0.6));
  const accentMat = createFeltMaterial('hub_backpackAccentMat', new Color(0.9, 0.35, 0.25));

  // Main body — soft rounded box, leaning back
  const body = new Mesh(new BoxGeometry(0.7, 0.9, 0.35), mainMat);
  body.name = 'backpackBody';
  body.position.set(0, 0.5, 0);
  body.rotation.x = 0.25; // leaning back against wall
  body.castShadow = true;
  root.add(body);

  // Top flap — slightly rounded
  const flapGeo = new BoxGeometry(0.68, 0.08, 0.32);
  const flap = new Mesh(flapGeo, mainMat);
  flap.name = 'backpackFlap';
  flap.position.set(0, 0.47, 0.02);
  flap.rotation.x = 0.1;
  body.add(flap);

  // Buckle on flap
  const buckle = new Mesh(new BoxGeometry(0.08, 0.06, 0.02), buckMat);
  buckle.name = 'backpackBuckle';
  buckle.position.set(0, -0.02, 0.17);
  flap.add(buckle);

  // Front pocket
  const pocket = new Mesh(new BoxGeometry(0.5, 0.35, 0.04), pocketMat);
  pocket.name = 'backpackPocket';
  pocket.position.set(0, -0.15, 0.18);
  body.add(pocket);

  // Pocket zipper line
  const zipper = new Mesh(new BoxGeometry(0.35, 0.015, 0.005), zipMat);
  zipper.name = 'backpackZipper';
  zipper.position.set(0, 0.16, 0.02);
  pocket.add(zipper);

  // Zipper pull
  const zipPull = new Mesh(new CylinderGeometry(0.012, 0.012, 0.03, 6), zipMat);
  zipPull.name = 'backpackZipPull';
  zipPull.position.set(0.18, 0.16, 0.025);
  zipPull.rotation.z = Math.PI / 2;
  pocket.add(zipPull);

  // Straps — two loops hanging loose on the back
  [-1, 1].forEach((side) => {
    // Upper strap
    const upper = new Mesh(new BoxGeometry(0.08, 0.5, 0.03), strapMat);
    upper.name = `backpackStrap${side}`;
    upper.position.set(side * 0.22, 0.1, -0.19);
    upper.rotation.x = -0.15;
    body.add(upper);

    // Lower strap (hangs loose)
    const lower = new Mesh(new BoxGeometry(0.08, 0.25, 0.03), strapMat);
    lower.name = `backpackStrapLower${side}`;
    lower.position.set(0, -0.35, 0.02);
    lower.rotation.x = 0.3;
    upper.add(lower);

    // Strap buckle
    const sBuckle = new Mesh(new BoxGeometry(0.06, 0.04, 0.015), buckMat);
    sBuckle.name = `backpackStrapBuckle${side}`;
    sBuckle.position.y = -0.13;
    lower.add(sBuckle);
  });

  // Handle — small loop on top
  const handle = new Mesh(new CylinderGeometry(0.02, 0.02, 0.15, 6), strapMat);
  handle.name = 'backpackHandle';
  handle.position.set(0, 0.52, -0.05);
  handle.rotation.z = Math.PI / 2;
  body.add(handle);

  // Red accent patch — star shape (simplified as circle)
  const star = new Mesh(new SphereGeometry(0.06, 5, 5), accentMat);
  star.name = 'backpackStar';
  star.position.set(0, -0.05, 0.19);
  star.scale.set(1, 1, 0.3);
  body.add(star);

  // Bottom reinforcement
  const bottom = new Mesh(new BoxGeometry(0.7, 0.06, 0.35), createFeltMaterial('hub_backpackBottomMat', new Color(0.15, 0.35, 0.62)));
  bottom.name = 'backpackBottom';
  bottom.position.y = -0.47;
  body.add(bottom);
}
