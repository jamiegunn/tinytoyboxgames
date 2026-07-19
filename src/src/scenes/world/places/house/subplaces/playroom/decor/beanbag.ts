import { Color, Group, Mesh, SphereGeometry, CircleGeometry, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';

/**
 * Creates a soft pink beanbag chair with the iconic slouchy silhouette: a
 * rounded fabric sack that spreads at the floor, a distinctly taller slumped
 * backrest to lean into, and a sunken seat well in the front — the three cues
 * that make a beanbag read as a *chair* rather than a lump.
 *
 * @param scene - The Three.js scene to add the beanbag to.
 * @param _keyLight - The directional light (unused).
 */
export function createBeanbag(scene: Scene, _keyLight: DirectionalLight): void {
  const mat = createFeltMaterial('hub_beanbagMat', new Color(0.92, 0.6, 0.7));
  const shadeMat = createFeltMaterial('hub_beanbagShadeMat', new Color(0.82, 0.5, 0.6));
  const lightMat = createFeltMaterial('hub_beanbagLightMat', new Color(0.96, 0.68, 0.76));

  const root = new Group();
  root.name = 'beanbag_root';
  root.position.set(-4.5, 0, -3.5);
  root.rotation.y = 0.35;
  scene.add(root);

  // Contact shadow disc.
  const shadowMat = createFeltMaterial('hub_beanbagShadow', new Color(0.15, 0.12, 0.1));
  shadowMat.opacity = 0.22;
  shadowMat.transparent = true;
  const shadow = new Mesh(new CircleGeometry(0.85, 20), shadowMat);
  shadow.name = 'beanbag_shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  root.add(shadow);

  // Wide floor spread — the heavy bottom that slumps and pools on the floor.
  const baseGeo = new SphereGeometry(1, 20, 14);
  baseGeo.scale(0.9, 0.34, 0.85);
  const base = new Mesh(baseGeo, mat);
  base.name = 'beanbag_base';
  base.position.y = 0.26;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  // Main rounded body — the big sack you sink into.
  const bodyGeo = new SphereGeometry(1, 22, 18);
  bodyGeo.scale(0.72, 0.6, 0.68);
  const body = new Mesh(bodyGeo, mat);
  body.name = 'beanbag_body';
  body.position.y = 0.56;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // Tall slouched backrest — clearly higher at the back, the read-as-a-chair cue.
  const backGeo = new SphereGeometry(1, 18, 16);
  backGeo.scale(0.58, 0.62, 0.42);
  const back = new Mesh(backGeo, mat);
  back.name = 'beanbag_back';
  back.position.set(0, 0.86, -0.26);
  back.rotation.x = 0.24;
  back.castShadow = true;
  root.add(back);

  // Backrest crown — lighter puff catching the key on top of the lean.
  const crownGeo = new SphereGeometry(1, 14, 12);
  crownGeo.scale(0.42, 0.26, 0.3);
  const crown = new Mesh(crownGeo, lightMat);
  crown.name = 'beanbag_crown';
  crown.position.set(0, 1.16, -0.28);
  crown.rotation.x = 0.2;
  root.add(crown);

  // Seat well — a darker sunken dish in the front where a child sits.
  const seatGeo = new SphereGeometry(1, 16, 12);
  seatGeo.scale(0.48, 0.12, 0.42);
  const seat = new Mesh(seatGeo, shadeMat);
  seat.name = 'beanbag_seat';
  seat.position.set(0, 0.86, 0.18);
  root.add(seat);

  // Front roll — the low fabric lip that droops forward over the floor.
  const frontGeo = new SphereGeometry(1, 14, 10);
  frontGeo.scale(0.56, 0.24, 0.24);
  const front = new Mesh(frontGeo, mat);
  front.name = 'beanbag_front';
  front.position.set(0, 0.42, 0.52);
  front.rotation.x = -0.28;
  front.castShadow = true;
  root.add(front);

  // Side arm bulges — fabric bunching where the sides rise around the seat.
  [-1, 1].forEach((side, i) => {
    const armGeo = new SphereGeometry(1, 12, 10);
    armGeo.scale(0.24, 0.34, 0.42);
    const arm = new Mesh(armGeo, i === 0 ? shadeMat : mat);
    arm.name = `beanbag_arm${i}`;
    arm.position.set(side * 0.6, 0.6, 0.12);
    arm.rotation.z = -side * 0.22;
    arm.castShadow = true;
    root.add(arm);
  });
}
