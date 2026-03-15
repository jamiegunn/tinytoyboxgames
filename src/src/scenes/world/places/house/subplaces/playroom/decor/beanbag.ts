import { Color, Group, Mesh, SphereGeometry, CircleGeometry, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';

/**
 * Creates a soft pink beanbag chair — a large, amorphous fabric sack that
 * slumps on the floor with a sunken seat area and a puffy backrest.
 * Built from many overlapping soft ellipsoids for an organic, lumpy look.
 * @param scene - The Three.js scene to add the beanbag to
 * @param _keyLight - The directional light (unused)
 */
export function createBeanbag(scene: Scene, _keyLight: DirectionalLight): void {
  const mat = createFeltMaterial('hub_beanbagMat', new Color(0.92, 0.6, 0.7));
  const shadeMat = createFeltMaterial('hub_beanbagShadeMat', new Color(0.84, 0.52, 0.62));
  const lightMat = createFeltMaterial('hub_beanbagLightMat', new Color(0.96, 0.68, 0.76));

  const root = new Group();
  root.name = 'beanbag_root';
  root.position.set(-4.5, 0, -3.5);
  root.rotation.y = 0.3;
  scene.add(root);

  // Ground shadow disc
  const shadowGeo = new CircleGeometry(0.7, 16);
  const shadowMat = createFeltMaterial('hub_beanbagShadow', new Color(0.15, 0.12, 0.1));
  shadowMat.opacity = 0.25;
  shadowMat.transparent = true;
  const shadow = new Mesh(shadowGeo, shadowMat);
  shadow.name = 'beanbag_shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  root.add(shadow);

  // Large base mass — the heavy bottom that spreads on the floor
  const baseGeo = new SphereGeometry(1, 18, 14);
  baseGeo.scale(0.65, 0.28, 0.6);
  const base = new Mesh(baseGeo, mat);
  base.name = 'beanbag_base';
  base.position.y = 0.18;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  // Lower skirt — wider, flatter ring that sits at floor level (the spread)
  const skirtGeo = new SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.4);
  skirtGeo.scale(0.72, 0.18, 0.68);
  const skirt = new Mesh(skirtGeo, shadeMat);
  skirt.name = 'beanbag_skirt';
  skirt.position.y = 0.06;
  skirt.castShadow = true;
  root.add(skirt);

  // Seat depression — slightly darker area where you sit, sinks in
  const seatGeo = new SphereGeometry(1, 12, 8);
  seatGeo.scale(0.38, 0.08, 0.34);
  const seat = new Mesh(seatGeo, shadeMat);
  seat.name = 'beanbag_seat';
  seat.position.set(0.04, 0.36, 0.08);
  root.add(seat);

  // Backrest — the tall puff behind where you lean
  const backGeo = new SphereGeometry(1, 14, 12);
  backGeo.scale(0.44, 0.48, 0.32);
  const back = new Mesh(backGeo, mat);
  back.name = 'beanbag_back';
  back.position.set(0, 0.32, -0.2);
  back.rotation.x = 0.2;
  back.castShadow = true;
  root.add(back);

  // Backrest top — lighter highlight on top of the backrest
  const backTopGeo = new SphereGeometry(1, 10, 8);
  backTopGeo.scale(0.32, 0.18, 0.22);
  const backTop = new Mesh(backTopGeo, lightMat);
  backTop.name = 'beanbag_backTop';
  backTop.position.set(0, 0.62, -0.22);
  backTop.rotation.x = 0.15;
  root.add(backTop);

  // Left arm bulge — fabric bunching on the side
  const armLGeo = new SphereGeometry(1, 10, 8);
  armLGeo.scale(0.2, 0.28, 0.36);
  const armL = new Mesh(armLGeo, mat);
  armL.name = 'beanbag_armL';
  armL.position.set(-0.46, 0.22, -0.02);
  armL.rotation.z = 0.2;
  armL.castShadow = true;
  root.add(armL);

  // Right arm bulge
  const armRGeo = new SphereGeometry(1, 10, 8);
  armRGeo.scale(0.18, 0.26, 0.34);
  const armR = new Mesh(armRGeo, mat);
  armR.name = 'beanbag_armR';
  armR.position.set(0.44, 0.2, 0);
  armR.rotation.z = -0.18;
  armR.castShadow = true;
  root.add(armR);

  // Front sag — the low front edge that droops forward
  const frontGeo = new SphereGeometry(1, 10, 8);
  frontGeo.scale(0.4, 0.15, 0.18);
  const front = new Mesh(frontGeo, mat);
  front.name = 'beanbag_front';
  front.position.set(0, 0.14, 0.45);
  front.rotation.x = -0.25;
  front.castShadow = true;
  root.add(front);

  // Wrinkle lumps — small irregularities across the surface for organic feel
  const wrinklePositions = [
    { pos: [0.18, 0.38, 0.15], s: [0.1, 0.04, 0.08] },
    { pos: [-0.2, 0.36, 0.12], s: [0.09, 0.035, 0.07] },
    { pos: [0.3, 0.26, -0.08], s: [0.07, 0.04, 0.1] },
    { pos: [-0.32, 0.28, 0.1], s: [0.08, 0.035, 0.06] },
    { pos: [0.1, 0.42, -0.32], s: [0.12, 0.04, 0.08] },
    { pos: [-0.14, 0.44, -0.28], s: [0.1, 0.035, 0.09] },
  ];
  wrinklePositions.forEach((w, wi) => {
    const geo = new SphereGeometry(1, 6, 4);
    geo.scale(w.s[0], w.s[1], w.s[2]);
    const wrinkle = new Mesh(geo, wi % 2 === 0 ? lightMat : shadeMat);
    wrinkle.name = `beanbag_wrinkle${wi}`;
    wrinkle.position.set(w.pos[0], w.pos[1], w.pos[2]);
    root.add(wrinkle);
  });

  // Seam lines — fabric panel edges visible on the surface
  const seamPositions = [
    { pos: [0, 0.5, -0.16], rot: [0, 0.5, 0], sx: 0.42 },
    { pos: [0, 0.48, -0.14], rot: [0, -0.5, 0], sx: 0.38 },
    { pos: [0.2, 0.34, 0.1], rot: [0, 0.8, Math.PI / 2], sx: 0.3 },
    { pos: [-0.2, 0.32, 0.08], rot: [0, -0.7, Math.PI / 2], sx: 0.28 },
  ];
  seamPositions.forEach((sp, si) => {
    const seamGeo = new SphereGeometry(1, 6, 4);
    seamGeo.scale(sp.sx, 0.006, 0.012);
    const seam = new Mesh(seamGeo, shadeMat);
    seam.name = `beanbag_seam${si}`;
    seam.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    seam.rotation.set(sp.rot[0], sp.rot[1], sp.rot[2]);
    root.add(seam);
  });
}
