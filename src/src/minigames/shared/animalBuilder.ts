import { Mesh, Group, Color, Vector3, SphereGeometry, CylinderGeometry, BoxGeometry, TorusGeometry } from 'three';
import {
  createFurMaterial,
  createSkinMaterial,
  createCartoonEyeWhiteMaterial,
  createCartoonPupilMaterial,
  createCartoonNoseMaterial,
  createInnerEarMaterial,
  createIrisMaterial,
  createAccessoryMaterial,
} from './materials';

// ---------------------------------------------------------------------------
// Short aliases for material factories (keeps call sites concise)
// ---------------------------------------------------------------------------

const furMat = createFurMaterial;
const eyeWhiteMat = createCartoonEyeWhiteMaterial;
const pupilMat = createCartoonPupilMaterial;
const noseMat = createCartoonNoseMaterial;
const innerEarMat = createInnerEarMaterial;
const irisMat = createIrisMaterial;
const skinMat = createSkinMaterial;
const accessoryMat = createAccessoryMaterial;

// ---------------------------------------------------------------------------
// Common eye builder
// ---------------------------------------------------------------------------

/** Default pink used for inner ears, cheeks, and noses. */
const PINK = new Color(1.0, 0.7, 0.75);

/**
 * Builds a single cartoon eye composed of a white sclera sphere, a colored iris sphere,
 * and a black pupil sphere.
 *
 * @param prefix - Naming prefix for all mesh parts.
 * @param side - -1 for left eye, 1 for right eye.
 * @param facePos - The center position of the face the eyes sit on.
 * @param irisColor - Color for the iris ring.
 * @param scleraRadius - Radius of the white sclera sphere.
 * @param irisRadius - Radius of the iris sphere.
 * @param pupilRadius - Radius of the pupil sphere.
 * @param spread - Horizontal distance from face center for each eye.
 * @param forwardOffset - How far forward the eyes protrude from facePos.z.
 * @returns An array of the three meshes [sclera, iris, pupil].
 */
function buildEye(
  prefix: string,
  side: number,
  facePos: Vector3,
  irisColor: Color,
  scleraRadius = 0.08,
  irisRadius = 0.045,
  pupilRadius = 0.025,
  spread = 0.1,
  forwardOffset = 0.22,
): Mesh[] {
  const suffix = side < 0 ? 'L' : 'R';

  const scleraGeo = new SphereGeometry(scleraRadius, 10, 10);
  const sclera = new Mesh(scleraGeo, eyeWhiteMat(`${prefix}_eyeWhiteMat_${suffix}`));
  sclera.name = `${prefix}_eyeWhite_${suffix}`;
  sclera.position.set(facePos.x + side * spread, facePos.y, facePos.z + forwardOffset);

  const irisGeo = new SphereGeometry(irisRadius, 8, 8);
  const iris = new Mesh(irisGeo, irisMat(`${prefix}_irisMat_${suffix}`, irisColor));
  iris.name = `${prefix}_iris_${suffix}`;
  iris.position.copy(sclera.position);
  iris.position.z += scleraRadius * 0.55;
  iris.position.x += side * 0.005;

  const pupilGeo = new SphereGeometry(pupilRadius, 8, 8);
  const pupil = new Mesh(pupilGeo, pupilMat(`${prefix}_pupilMat_${suffix}`));
  pupil.name = `${prefix}_pupil_${suffix}`;
  pupil.position.copy(iris.position);
  pupil.position.z += irisRadius * 0.5;

  return [sclera, iris, pupil];
}

// ---------------------------------------------------------------------------
// Animal builder functions
// ---------------------------------------------------------------------------

/**
 * Builds a cute cartoon bunny with expressive eyes, tall ears with pink inner,
 * a tiny pink nose, mouth, cheeks, four paws, and a fluffy tail.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the bunny.
 * @param bodyColor - Base fur color. Defaults to white.
 * @returns A parent Group containing all bunny parts.
 */
export function buildBunny(name: string, position: Vector3, bodyColor: Color = new Color(0.97, 0.97, 0.97)): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  const fur = furMat(`${name}_furMat`, bodyColor);

  // Body — slightly squashed vertically
  const bodyGeo = new SphereGeometry(0.4, 14, 14);
  const body = new Mesh(bodyGeo, fur);
  body.name = `${name}_body`;
  body.scale.set(1, 0.9, 1);
  root.add(body);

  // Head — on top, slightly forward
  const headGeo = new SphereGeometry(0.32, 14, 14);
  const head = new Mesh(headGeo, fur);
  head.name = `${name}_head`;
  head.position.set(0, 0.45, 0.08);
  root.add(head);

  const headCenter = new Vector3(0, 0.45, 0.08);

  // Eyes
  for (const side of [-1, 1]) {
    const parts = buildEye(name, side, headCenter, new Color(0.45, 0.28, 0.15), 0.08, 0.045, 0.025, 0.1, 0.28);
    for (const p of parts) root.add(p);
  }

  // Nose — tiny pink glossy sphere
  const noseGeo = new SphereGeometry(0.03, 8, 8);
  const nose = new Mesh(noseGeo, noseMat(`${name}_noseMat`, PINK));
  nose.name = `${name}_nose`;
  nose.position.set(0, 0.4, 0.42);
  root.add(nose);

  // Mouth — small flattened torus segment below nose
  const mouthGeo = new TorusGeometry(0.03, 0.004, 16, 16);
  const mouth = new Mesh(mouthGeo, pupilMat(`${name}_mouthMat`));
  mouth.name = `${name}_mouth`;
  mouth.position.set(0, 0.35, 0.4);
  mouth.scale.set(1, 0.5, 1);
  root.add(mouth);

  // Ears — tall elongated ellipsoids with inner ear
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const earGeo = new SphereGeometry(0.05, 10, 10);
    const ear = new Mesh(earGeo, fur);
    ear.name = `${name}_ear_${suffix}`;
    ear.scale.set(1, 5.0, 0.6);
    ear.position.set(side * 0.12, 0.95, 0.0);
    ear.rotation.set(0, 0, side * -0.15);
    root.add(ear);

    // Inner ear — slightly smaller pink ellipsoid
    const innerGeo = new SphereGeometry(0.035, 8, 8);
    const inner = new Mesh(innerGeo, innerEarMat(`${name}_innerEarMat_${suffix}`, PINK));
    inner.name = `${name}_innerEar_${suffix}`;
    inner.scale.set(1, 5.0, 0.4);
    inner.position.set(side * 0.12, 0.95, 0.02);
    inner.rotation.set(0, 0, side * -0.15);
    root.add(inner);
  }

  // Cheeks — subtle pink-tinted spheres
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const cheekGeo = new SphereGeometry(0.05, 8, 8);
    const cheekMat = innerEarMat(`${name}_cheekMat_${suffix}`, new Color(1.0, 0.75, 0.8));
    cheekMat.transparent = true;
    cheekMat.opacity = 0.4;
    const cheek = new Mesh(cheekGeo, cheekMat);
    cheek.name = `${name}_cheek_${suffix}`;
    cheek.position.set(side * 0.17, 0.38, 0.3);
    root.add(cheek);
  }

  // Paws — 4 small flattened spheres at body base
  const pawPositions = [new Vector3(-0.2, -0.38, 0.15), new Vector3(0.2, -0.38, 0.15), new Vector3(-0.2, -0.38, -0.15), new Vector3(0.2, -0.38, -0.15)];
  for (let i = 0; i < pawPositions.length; i++) {
    const pawGeo = new SphereGeometry(0.06, 8, 8);
    const paw = new Mesh(pawGeo, fur);
    paw.name = `${name}_paw_${i}`;
    paw.scale.set(1, 0.5, 1.2);
    paw.position.copy(pawPositions[i]);
    root.add(paw);
  }

  // Tail — small fluffy puff at rear
  const tailGeo = new SphereGeometry(0.08, 10, 10);
  const tail = new Mesh(tailGeo, fur);
  tail.name = `${name}_tail`;
  tail.position.set(0, 0.0, -0.42);
  tail.scale.set(1.1, 1.1, 1.1);
  root.add(tail);

  return root;
}

/**
 * Builds a cute cartoon kitten with pointed ears, whiskers, expressive green eyes,
 * a pink triangle nose, four paws, and a curving tail.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the kitten.
 * @param bodyColor - Base fur color. Defaults to gray.
 * @returns A parent Group containing all kitten parts.
 */
export function buildKitten(name: string, position: Vector3, bodyColor: Color = new Color(0.6, 0.6, 0.65)): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  const fur = furMat(`${name}_furMat`, bodyColor);

  // Body — slightly elongated on Z
  const bodyGeo = new SphereGeometry(0.35, 14, 14);
  const body = new Mesh(bodyGeo, fur);
  body.name = `${name}_body`;
  body.scale.set(1, 0.95, 1.15);
  root.add(body);

  // Head — proportionally large for cuteness
  const headGeo = new SphereGeometry(0.28, 14, 14);
  const head = new Mesh(headGeo, fur);
  head.name = `${name}_head`;
  head.position.set(0, 0.4, 0.12);
  root.add(head);

  const headCenter = new Vector3(0, 0.4, 0.12);

  // Eyes — green irises
  for (const side of [-1, 1]) {
    const parts = buildEye(name, side, headCenter, new Color(0.3, 0.7, 0.3), 0.08, 0.045, 0.025, 0.1, 0.24);
    for (const p of parts) root.add(p);
  }

  // Nose — tiny pink triangle (3-tessellation cylinder)
  const noseGeo = new CylinderGeometry(0, 0.025, 0.03, 3);
  const nose = new Mesh(noseGeo, noseMat(`${name}_noseMat`, PINK));
  nose.name = `${name}_nose`;
  nose.position.set(0, 0.36, 0.4);
  nose.rotation.set(Math.PI / 2, 0, Math.PI);
  root.add(nose);

  // Mouth — small curved line below nose
  const mouthGeo = new TorusGeometry(0.025, 0.003, 16, 16);
  const mouth = new Mesh(mouthGeo, pupilMat(`${name}_mouthMat`));
  mouth.name = `${name}_mouth`;
  mouth.position.set(0, 0.32, 0.38);
  mouth.scale.set(1, 0.4, 1);
  root.add(mouth);

  // Ears — pointed cones with pink inner triangles
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const earGeo = new CylinderGeometry(0.005, 0.06, 0.18, 12);
    const ear = new Mesh(earGeo, fur);
    ear.name = `${name}_ear_${suffix}`;
    ear.position.set(side * 0.16, 0.72, 0.1);
    ear.rotation.set(0, 0, side * -0.25);
    root.add(ear);

    // Inner ear triangle
    const innerEarGeo = new CylinderGeometry(0.0025, 0.035, 0.12, 3);
    const innerEar = new Mesh(innerEarGeo, innerEarMat(`${name}_innerEarMat_${suffix}`, PINK));
    innerEar.name = `${name}_innerEar_${suffix}`;
    innerEar.position.set(side * 0.16, 0.71, 0.12);
    innerEar.rotation.set(0, 0, side * -0.25);
    root.add(innerEar);
  }

  // Whiskers — 6 very thin cylinders (3 per side)
  for (const side of [-1, 1]) {
    for (let w = 0; w < 3; w++) {
      const whiskerGeo = new CylinderGeometry(0.004, 0.004, 0.2, 4);
      const whisker = new Mesh(whiskerGeo, pupilMat(`${name}_whiskerMat_${side}_${w}`));
      whisker.name = `${name}_whisker_${side < 0 ? 'L' : 'R'}_${w}`;
      const yOffset = 0.34 + (w - 1) * 0.03;
      whisker.position.set(side * 0.22, yOffset, 0.32);
      whisker.rotation.set(0, 0, Math.PI / 2 + side * (0.15 + w * 0.12));
      root.add(whisker);
    }
  }

  // Paws — 4 round pads, front slightly larger
  const pawDefs = [
    { pos: new Vector3(-0.18, -0.32, 0.18), size: 0.13 },
    { pos: new Vector3(0.18, -0.32, 0.18), size: 0.13 },
    { pos: new Vector3(-0.16, -0.32, -0.15), size: 0.11 },
    { pos: new Vector3(0.16, -0.32, -0.15), size: 0.11 },
  ];
  for (let i = 0; i < pawDefs.length; i++) {
    const pawGeo = new SphereGeometry(pawDefs[i].size / 2, 8, 8);
    const paw = new Mesh(pawGeo, fur);
    paw.name = `${name}_paw_${i}`;
    paw.scale.set(1, 0.5, 1.1);
    paw.position.copy(pawDefs[i].pos);
    root.add(paw);
  }

  // Tail — long tapered cylinder curving upward
  const tailGeo = new CylinderGeometry(0.02, 0.035, 0.4, 8);
  const tail = new Mesh(tailGeo, fur);
  tail.name = `${name}_tail`;
  tail.position.set(0, 0.1, -0.4);
  tail.rotation.set(-0.8, 0, 0);
  root.add(tail);

  // Tail tip
  const tailTipGeo = new SphereGeometry(0.03, 8, 8);
  const tailTip = new Mesh(tailTipGeo, fur);
  tailTip.name = `${name}_tailTip`;
  tailTip.position.set(0, 0.35, -0.55);
  root.add(tailTip);

  return root;
}

/**
 * Builds a cute cartoon puppy with floppy ears, big puppy-dog eyes, a glossy nose,
 * a tongue peeking out, chunky paws, a wagging tail, and a red collar.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the puppy.
 * @param bodyColor - Base fur color. Defaults to golden-brown.
 * @returns A parent Group containing all puppy parts.
 */
export function buildPuppy(name: string, position: Vector3, bodyColor: Color = new Color(0.72, 0.52, 0.28)): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  const fur = furMat(`${name}_furMat`, bodyColor);

  // Body — slightly elongated
  const bodyGeo = new SphereGeometry(0.4, 14, 14);
  const body = new Mesh(bodyGeo, fur);
  body.name = `${name}_body`;
  body.scale.set(1, 0.95, 1.1);
  root.add(body);

  // Head
  const headGeo = new SphereGeometry(0.3, 14, 14);
  const head = new Mesh(headGeo, fur);
  head.name = `${name}_head`;
  head.position.set(0, 0.42, 0.12);
  root.add(head);

  const headCenter = new Vector3(0, 0.42, 0.12);

  // Eyes — warm brown irises, slightly larger for puppy-dog-eyes effect
  for (const side of [-1, 1]) {
    const parts = buildEye(name, side, headCenter, new Color(0.45, 0.28, 0.12), 0.09, 0.05, 0.028, 0.11, 0.26);
    for (const p of parts) root.add(p);
  }

  // Nose — larger black sphere, very glossy
  const noseGeo = new SphereGeometry(0.04, 10, 10);
  const nose = new Mesh(noseGeo, noseMat(`${name}_noseMat`, new Color(0.05, 0.05, 0.05)));
  nose.name = `${name}_nose`;
  nose.position.set(0, 0.4, 0.44);
  root.add(nose);

  // Mouth — curved shape, slightly open
  const mouthGeo = new TorusGeometry(0.035, 0.0035, 16, 16);
  const mouth = new Mesh(mouthGeo, pupilMat(`${name}_mouthMat`));
  mouth.name = `${name}_mouth`;
  mouth.position.set(0, 0.34, 0.4);
  mouth.scale.set(1, 0.4, 1);
  root.add(mouth);

  // Tongue — small pink ellipsoid peeking out
  const tongueGeo = new SphereGeometry(0.025, 8, 8);
  const tongue = new Mesh(tongueGeo, innerEarMat(`${name}_tongueMat`, new Color(1.0, 0.5, 0.55)));
  tongue.name = `${name}_tongue`;
  tongue.position.set(0, 0.32, 0.42);
  tongue.scale.set(0.8, 0.4, 1.2);
  root.add(tongue);

  // Ears — floppy, flattened ellipsoids that hang down
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const earGeo = new SphereGeometry(0.09, 10, 10);
    const earFur = furMat(`${name}_earFurMat_${suffix}`, bodyColor.clone().multiplyScalar(0.8));
    const ear = new Mesh(earGeo, earFur);
    ear.name = `${name}_ear_${suffix}`;
    ear.scale.set(0.6, 1.4, 0.4);
    ear.position.set(side * 0.22, 0.32, 0.05);
    ear.rotation.set(0, 0, side * 0.3);
    root.add(ear);

    // Inner ear
    const innerGeo = new SphereGeometry(0.06, 8, 8);
    const inner = new Mesh(innerGeo, innerEarMat(`${name}_innerEarMat_${suffix}`, PINK));
    inner.name = `${name}_innerEar_${suffix}`;
    inner.scale.set(0.5, 1.2, 0.3);
    inner.position.set(side * 0.22, 0.32, 0.07);
    inner.rotation.set(0, 0, side * 0.3);
    root.add(inner);
  }

  // Paws — 4 chunky spheres
  const pawPositions = [new Vector3(-0.2, -0.35, 0.18), new Vector3(0.2, -0.35, 0.18), new Vector3(-0.2, -0.35, -0.15), new Vector3(0.2, -0.35, -0.15)];
  for (let i = 0; i < pawPositions.length; i++) {
    const pawGeo = new SphereGeometry(0.07, 8, 8);
    const paw = new Mesh(pawGeo, fur);
    paw.name = `${name}_paw_${i}`;
    paw.scale.set(1.1, 0.5, 1.1);
    paw.position.copy(pawPositions[i]);
    root.add(paw);
  }

  // Tail — curved tapered cylinder, angled upward (happy wag position)
  const tailGeo = new CylinderGeometry(0.0175, 0.0325, 0.35, 8);
  const tail = new Mesh(tailGeo, fur);
  tail.name = `${name}_tail`;
  tail.position.set(0, 0.15, -0.4);
  tail.rotation.set(-1.0, 0, 0);
  root.add(tail);

  const tailTipGeo = new SphereGeometry(0.03, 8, 8);
  const tailTip = new Mesh(tailTipGeo, fur);
  tailTip.name = `${name}_tailTip`;
  tailTip.position.set(0, 0.42, -0.55);
  root.add(tailTip);

  // Collar — small torus around neck, bright red
  const collarGeo = new TorusGeometry(0.16, 0.0175, 16, 20);
  const collar = new Mesh(collarGeo, accessoryMat(`${name}_collarMat`, new Color(0.9, 0.15, 0.1)));
  collar.name = `${name}_collar`;
  collar.position.set(0, 0.22, 0.1);
  root.add(collar);

  return root;
}

/**
 * Builds a cute cartoon panda with the iconic black-and-white markings,
 * black eye patches, round black ears, black arms and legs, and a belly patch.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the panda.
 * @returns A parent Group containing all panda parts.
 */
export function buildPanda(name: string, position: Vector3): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  const white = new Color(0.96, 0.96, 0.96);
  const black = new Color(0.1, 0.1, 0.1);
  const whiteFur = furMat(`${name}_whiteFur`, white);
  const blackFur = furMat(`${name}_blackFur`, black);

  // Body — white, round and chubby
  const bodyGeo = new SphereGeometry(0.4, 14, 14);
  const body = new Mesh(bodyGeo, whiteFur);
  body.name = `${name}_body`;
  root.add(body);

  // Head — white
  const headGeo = new SphereGeometry(0.35, 14, 14);
  const head = new Mesh(headGeo, whiteFur);
  head.name = `${name}_head`;
  head.position.set(0, 0.45, 0.05);
  root.add(head);

  const headCenter = new Vector3(0, 0.45, 0.05);

  // Eye patches — flattened black spheres behind the eyes (panda mask)
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const patchGeo = new SphereGeometry(0.1, 10, 10);
    const patch = new Mesh(patchGeo, blackFur);
    patch.name = `${name}_eyePatch_${suffix}`;
    patch.scale.set(1, 1.2, 0.6);
    patch.position.set(headCenter.x + side * 0.11, headCenter.y + 0.02, headCenter.z + 0.2);
    root.add(patch);
  }

  // Eyes — inside the patches
  for (const side of [-1, 1]) {
    const parts = buildEye(name, side, headCenter, new Color(0.2, 0.15, 0.1), 0.07, 0.04, 0.022, 0.11, 0.3);
    for (const p of parts) root.add(p);
  }

  // Nose — small black sphere
  const noseGeo = new SphereGeometry(0.03, 8, 8);
  const nose = new Mesh(noseGeo, noseMat(`${name}_noseMat`, black));
  nose.name = `${name}_nose`;
  nose.position.set(0, 0.42, 0.4);
  root.add(nose);

  // Mouth
  const mouthGeo = new TorusGeometry(0.025, 0.003, 16, 16);
  const mouth = new Mesh(mouthGeo, pupilMat(`${name}_mouthMat`));
  mouth.name = `${name}_mouth`;
  mouth.position.set(0, 0.37, 0.38);
  mouth.scale.set(1, 0.4, 1);
  root.add(mouth);

  // Ears — round black spheres on top of head
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const earGeo = new SphereGeometry(0.09, 10, 10);
    const ear = new Mesh(earGeo, blackFur);
    ear.name = `${name}_ear_${suffix}`;
    ear.position.set(side * 0.22, 0.82, 0.0);
    root.add(ear);
  }

  // Arms — black elongated spheres on sides
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const armGeo = new SphereGeometry(0.09, 10, 10);
    const arm = new Mesh(armGeo, blackFur);
    arm.name = `${name}_arm_${suffix}`;
    arm.scale.set(0.7, 1.6, 0.7);
    arm.position.set(side * 0.35, -0.05, 0.05);
    arm.rotation.set(0, 0, side * 0.4);
    root.add(arm);
  }

  // Legs — black spheres at base
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const legGeo = new SphereGeometry(0.1, 10, 10);
    const leg = new Mesh(legGeo, blackFur);
    leg.name = `${name}_leg_${suffix}`;
    leg.scale.set(1, 0.7, 1.2);
    leg.position.set(side * 0.18, -0.38, 0.08);
    root.add(leg);
  }

  // Belly patch — slightly offset sphere at front, slightly different white tone
  const bellyGeo = new SphereGeometry(0.225, 10, 10);
  const bellyMat = furMat(`${name}_bellyMat`, new Color(0.92, 0.92, 0.9));
  const belly = new Mesh(bellyGeo, bellyMat);
  belly.name = `${name}_belly`;
  belly.position.set(0, -0.05, 0.2);
  belly.scale.set(1, 1, 0.5);
  root.add(belly);

  return root;
}

/**
 * Builds a cute cartoon hamster with an extremely round body, puffy cheeks,
 * tiny cute eyes, small round ears, tiny paws, and a nearly invisible tail.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the hamster.
 * @param bodyColor - Base fur color. Defaults to orange-tan.
 * @returns A parent Group containing all hamster parts.
 */
export function buildHamster(name: string, position: Vector3, bodyColor: Color = new Color(0.9, 0.65, 0.3)): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  const fur = furMat(`${name}_furMat`, bodyColor);

  // Body — very round, chubbiest animal
  const bodyGeo = new SphereGeometry(0.35, 14, 14);
  const body = new Mesh(bodyGeo, fur);
  body.name = `${name}_body`;
  root.add(body);

  // Head — almost as big as body
  const headGeo = new SphereGeometry(0.3, 14, 14);
  const head = new Mesh(headGeo, fur);
  head.name = `${name}_head`;
  head.position.set(0, 0.35, 0.1);
  root.add(head);

  const headCenter = new Vector3(0, 0.35, 0.1);

  // Cheeks — prominent puffy spheres on sides of face (lighter color)
  const lighterFur = furMat(`${name}_cheekFur`, bodyColor.clone().multiplyScalar(1.15));
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const cheekGeo = new SphereGeometry(0.11, 10, 10);
    const cheek = new Mesh(cheekGeo, lighterFur);
    cheek.name = `${name}_cheek_${suffix}`;
    cheek.position.set(side * 0.2, 0.3, 0.22);
    root.add(cheek);
  }

  // Eyes — tiny cute eyes, smaller than other animals, black irises
  for (const side of [-1, 1]) {
    const parts = buildEye(name, side, headCenter, new Color(0.05, 0.05, 0.05), 0.055, 0.035, 0.02, 0.09, 0.26);
    for (const p of parts) root.add(p);
  }

  // Nose — tiny pink dot
  const noseGeo = new SphereGeometry(0.02, 8, 8);
  const nose = new Mesh(noseGeo, noseMat(`${name}_noseMat`, PINK));
  nose.name = `${name}_nose`;
  nose.position.set(0, 0.33, 0.42);
  root.add(nose);

  // Mouth
  const mouthGeo = new TorusGeometry(0.02, 0.0025, 16, 16);
  const mouth = new Mesh(mouthGeo, pupilMat(`${name}_mouthMat`));
  mouth.name = `${name}_mouth`;
  mouth.position.set(0, 0.29, 0.4);
  mouth.scale.set(1, 0.4, 1);
  root.add(mouth);

  // Ears — small round ears, pink inner
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const earGeo = new SphereGeometry(0.05, 8, 8);
    const ear = new Mesh(earGeo, fur);
    ear.name = `${name}_ear_${suffix}`;
    ear.position.set(side * 0.2, 0.65, 0.02);
    root.add(ear);

    const innerGeo = new SphereGeometry(0.03, 8, 8);
    const inner = new Mesh(innerGeo, innerEarMat(`${name}_innerEarMat_${suffix}`, PINK));
    inner.name = `${name}_innerEar_${suffix}`;
    inner.position.set(side * 0.2, 0.65, 0.04);
    root.add(inner);
  }

  // Paws — very small, 4 tiny spheres
  const pawPositions = [new Vector3(-0.15, -0.32, 0.12), new Vector3(0.15, -0.32, 0.12), new Vector3(-0.13, -0.32, -0.1), new Vector3(0.13, -0.32, -0.1)];
  for (let i = 0; i < pawPositions.length; i++) {
    const pawGeo = new SphereGeometry(0.04, 8, 8);
    const paw = new Mesh(pawGeo, fur);
    paw.name = `${name}_paw_${i}`;
    paw.scale.set(1, 0.5, 1);
    paw.position.copy(pawPositions[i]);
    root.add(paw);
  }

  // Tail — nearly invisible tiny sphere
  const tailGeo = new SphereGeometry(0.025, 6, 6);
  const tail = new Mesh(tailGeo, fur);
  tail.name = `${name}_tail`;
  tail.position.set(0, -0.1, -0.35);
  root.add(tail);

  return root;
}

/**
 * Builds a cute cartoon frog with a flat body, large protruding eyes on stalks,
 * a wide frog smile, nostrils, webbed front and back legs, and glossy amphibian skin.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the frog.
 * @returns A parent Group containing all frog parts.
 */
export function buildFrog(name: string, position: Vector3): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  const green = new Color(0.25, 0.7, 0.2);
  const skin = skinMat(`${name}_skinMat`, green);
  const lightGreen = skinMat(`${name}_bellySkin`, new Color(0.55, 0.85, 0.4));

  // Body — green sphere, flat (scaleY=0.7)
  const bodyGeo = new SphereGeometry(0.3, 14, 14);
  const body = new Mesh(bodyGeo, skin);
  body.name = `${name}_body`;
  body.scale.set(1.2, 0.7, 1);
  root.add(body);

  // Head — merged with body (wider sphere)
  const headGeo = new SphereGeometry(0.275, 14, 14);
  const head = new Mesh(headGeo, skin);
  head.name = `${name}_head`;
  head.scale.set(1.3, 0.75, 1);
  head.position.set(0, 0.12, 0.15);
  root.add(head);

  // Belly
  const bellyGeo = new SphereGeometry(0.2, 10, 10);
  const belly = new Mesh(bellyGeo, lightGreen);
  belly.name = `${name}_belly`;
  belly.position.set(0, -0.08, 0.08);
  belly.scale.set(1, 0.6, 0.5);
  root.add(belly);

  // Eyes — LARGE protruding! Each on a small stalk
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';

    // Eye stalk
    const stalkGeo = new CylinderGeometry(0.04, 0.04, 0.1, 8);
    const stalk = new Mesh(stalkGeo, skin);
    stalk.name = `${name}_eyeStalk_${suffix}`;
    stalk.position.set(side * 0.18, 0.32, 0.2);
    root.add(stalk);

    // Large white eye sphere on stalk
    const parts = buildEye(name, side, new Vector3(side * 0.18, 0.33, 0.05), new Color(0.3, 0.65, 0.15), 0.1, 0.055, 0.03, 0, 0.18);
    for (const p of parts) root.add(p);
  }

  // Nostrils — 2 tiny dots on top of snout
  for (const side of [-1, 1]) {
    const nostrilGeo = new SphereGeometry(0.0125, 6, 6);
    const nostril = new Mesh(nostrilGeo, pupilMat(`${name}_nostrilMat_${side}`));
    nostril.name = `${name}_nostril_${side < 0 ? 'L' : 'R'}`;
    nostril.position.set(side * 0.05, 0.2, 0.42);
    root.add(nostril);
  }

  // Mouth — wide curved line (classic frog smile)
  const mouthGeo = new TorusGeometry(0.1, 0.004, 16, 20);
  const mouth = new Mesh(mouthGeo, pupilMat(`${name}_mouthMat`));
  mouth.name = `${name}_mouth`;
  mouth.position.set(0, 0.05, 0.35);
  mouth.scale.set(1, 0.3, 1);
  root.add(mouth);

  // Front legs — thin cylinders with webbed feet (flat discs)
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const frontLegGeo = new CylinderGeometry(0.03, 0.03, 0.25, 8);
    const frontLeg = new Mesh(frontLegGeo, skin);
    frontLeg.name = `${name}_frontLeg_${suffix}`;
    frontLeg.position.set(side * 0.3, -0.2, 0.2);
    frontLeg.rotation.set(0, 0, side * 0.6);
    root.add(frontLeg);

    const frontFootGeo = new CylinderGeometry(0.05, 0.05, 0.02, 8);
    const frontFoot = new Mesh(frontFootGeo, skin);
    frontFoot.name = `${name}_frontFoot_${suffix}`;
    frontFoot.position.set(side * 0.42, -0.32, 0.22);
    root.add(frontFoot);
  }

  // Back legs — thicker bent cylinders with larger webbed feet
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';

    // Upper leg (thigh)
    const thighGeo = new CylinderGeometry(0.045, 0.045, 0.2, 8);
    const thigh = new Mesh(thighGeo, skin);
    thigh.name = `${name}_thigh_${suffix}`;
    thigh.position.set(side * 0.25, -0.15, -0.2);
    thigh.rotation.set(0.5, 0, side * 0.8);
    root.add(thigh);

    // Lower leg (shin)
    const shinGeo = new CylinderGeometry(0.035, 0.035, 0.2, 8);
    const shin = new Mesh(shinGeo, skin);
    shin.name = `${name}_shin_${suffix}`;
    shin.position.set(side * 0.38, -0.28, -0.12);
    shin.rotation.set(-0.3, 0, side * 0.3);
    root.add(shin);

    // Back foot — larger webbed
    const backFootGeo = new CylinderGeometry(0.07, 0.07, 0.02, 8);
    const backFoot = new Mesh(backFootGeo, skin);
    backFoot.name = `${name}_backFoot_${suffix}`;
    backFoot.position.set(side * 0.42, -0.34, -0.08);
    root.add(backFoot);
  }

  return root;
}

/**
 * Builds a cute cartoon bear with a large round body, a lighter snout,
 * round ears with inner circles, thick arms and legs, a glossy nose, and a belly patch.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the bear.
 * @param bodyColor - Base fur color. Defaults to brown.
 * @returns A parent Group containing all bear parts.
 */
export function buildBear(name: string, position: Vector3, bodyColor: Color = new Color(0.5, 0.32, 0.18)): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  const fur = furMat(`${name}_furMat`, bodyColor);
  const lightFur = furMat(`${name}_lightFur`, bodyColor.clone().multiplyScalar(1.3));

  // Body — large sphere
  const bodyGeo = new SphereGeometry(0.45, 14, 14);
  const body = new Mesh(bodyGeo, fur);
  body.name = `${name}_body`;
  root.add(body);

  // Head
  const headGeo = new SphereGeometry(0.33, 14, 14);
  const head = new Mesh(headGeo, fur);
  head.name = `${name}_head`;
  head.position.set(0, 0.48, 0.08);
  root.add(head);

  const headCenter = new Vector3(0, 0.48, 0.08);

  // Snout — lighter-colored sphere protruding from face
  const snoutGeo = new SphereGeometry(0.11, 10, 10);
  const snout = new Mesh(snoutGeo, lightFur);
  snout.name = `${name}_snout`;
  snout.position.set(0, 0.42, 0.35);
  snout.scale.set(1.2, 0.8, 1);
  root.add(snout);

  // Eyes — dark brown irises
  for (const side of [-1, 1]) {
    const parts = buildEye(name, side, headCenter, new Color(0.3, 0.18, 0.08), 0.07, 0.04, 0.022, 0.12, 0.28);
    for (const p of parts) root.add(p);
  }

  // Nose — large oval dark brown sphere, very glossy
  const noseGeo = new SphereGeometry(0.04, 10, 10);
  const nose = new Mesh(noseGeo, noseMat(`${name}_noseMat`, new Color(0.15, 0.08, 0.05)));
  nose.name = `${name}_nose`;
  nose.position.set(0, 0.46, 0.45);
  nose.scale.set(1.3, 0.9, 1);
  root.add(nose);

  // Mouth
  const mouthGeo = new TorusGeometry(0.03, 0.003, 16, 16);
  const mouth = new Mesh(mouthGeo, pupilMat(`${name}_mouthMat`));
  mouth.name = `${name}_mouth`;
  mouth.position.set(0, 0.38, 0.42);
  mouth.scale.set(1, 0.4, 1);
  root.add(mouth);

  // Ears — round with lighter inner circles
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const earGeo = new SphereGeometry(0.08, 10, 10);
    const ear = new Mesh(earGeo, fur);
    ear.name = `${name}_ear_${suffix}`;
    ear.position.set(side * 0.24, 0.82, 0.02);
    root.add(ear);

    const innerGeo = new SphereGeometry(0.05, 8, 8);
    const inner = new Mesh(innerGeo, lightFur);
    inner.name = `${name}_innerEar_${suffix}`;
    inner.position.set(side * 0.24, 0.82, 0.05);
    root.add(inner);
  }

  // Arms — thick elongated spheres
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const armGeo = new SphereGeometry(0.1, 10, 10);
    const arm = new Mesh(armGeo, fur);
    arm.name = `${name}_arm_${suffix}`;
    arm.scale.set(0.7, 1.5, 0.7);
    arm.position.set(side * 0.38, -0.02, 0.05);
    arm.rotation.set(0, 0, side * 0.35);
    root.add(arm);
  }

  // Legs — chunky spheres
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const legGeo = new SphereGeometry(0.11, 10, 10);
    const leg = new Mesh(legGeo, fur);
    leg.name = `${name}_leg_${suffix}`;
    leg.scale.set(1.1, 0.7, 1.2);
    leg.position.set(side * 0.18, -0.42, 0.1);
    root.add(leg);
  }

  // Belly — slightly lighter oval at front
  const bellyGeo = new SphereGeometry(0.25, 10, 10);
  const belly = new Mesh(bellyGeo, lightFur);
  belly.name = `${name}_belly`;
  belly.position.set(0, -0.05, 0.22);
  belly.scale.set(1, 1, 0.5);
  root.add(belly);

  return root;
}

/**
 * Builds a cartoon cat — an alias for buildKitten with slightly different proportions.
 * The cat has a slightly larger body and longer tail than the kitten.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the cat.
 * @param bodyColor - Base fur color. Defaults to gray.
 * @returns A parent Group containing all cat parts.
 */
export function buildCat(name: string, position: Vector3, bodyColor: Color = new Color(0.55, 0.55, 0.6)): Group {
  const cat = buildKitten(name, position, bodyColor);
  // Slightly larger proportions than kitten
  cat.scale.set(1.1, 1.1, 1.15);
  return cat;
}

/**
 * Builds a cute cartoon shark with an elongated blue-gray body, white belly,
 * dorsal fin, pectoral fins, tail fin, friendly side-mounted eyes, a cartoon smile
 * with small friendly teeth, and gill slits.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the shark.
 * @returns A parent Group containing all shark parts.
 */
export function buildShark(name: string, position: Vector3): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  // -- Materials --
  const blueGray = new Color(0.42, 0.56, 0.72);
  const darkerBlue = new Color(0.3, 0.42, 0.58);
  const skin = skinMat(`${name}_skinMat`, blueGray);
  const darkSkin = skinMat(`${name}_darkSkinMat`, darkerBlue);
  const whiteSkin = skinMat(`${name}_whiteSkin`, new Color(0.96, 0.96, 0.97));

  // BODY — Teardrop built from overlapping spheres

  // 1. Front body — the big round "head" area
  const bodyGeo = new SphereGeometry(0.5, 20, 20);
  const body = new Mesh(bodyGeo, skin);
  body.name = `${name}_body`;
  body.scale.set(1.15, 0.88, 0.88);
  body.position.set(0.12, 0, 0);
  root.add(body);

  // 2. Mid body
  const midBodyGeo = new SphereGeometry(0.41, 16, 16);
  const midBody = new Mesh(midBodyGeo, skin);
  midBody.name = `${name}_midBody`;
  midBody.scale.set(1.4, 0.72, 0.68);
  midBody.position.set(-0.28, -0.01, 0);
  root.add(midBody);

  // 3. Peduncle — small narrow sphere forming the tail stem
  const peduncleGeo = new SphereGeometry(0.2, 12, 12);
  const peduncle = new Mesh(peduncleGeo, skin);
  peduncle.name = `${name}_peduncle`;
  peduncle.scale.set(1.8, 0.5, 0.45);
  peduncle.position.set(-0.82, 0, 0);
  root.add(peduncle);

  // White belly
  const bellyGeo = new SphereGeometry(0.45, 14, 14);
  const belly = new Mesh(bellyGeo, whiteSkin);
  belly.name = `${name}_belly`;
  belly.scale.set(1.45, 0.42, 0.72);
  belly.position.set(0.0, -0.2, 0);
  root.add(belly);

  // FINS

  // DORSAL FIN
  const dorsalFinGeo = new SphereGeometry(0.25, 12, 12);
  const dorsalFin = new Mesh(dorsalFinGeo, darkSkin);
  dorsalFin.name = `${name}_dorsalFin`;
  dorsalFin.scale.set(0.7, 1.5, 0.16);
  dorsalFin.position.set(-0.08, 0.55, 0);
  dorsalFin.rotation.set(0, 0, -0.25);
  root.add(dorsalFin);

  // Pectoral fins
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const finGeo = new SphereGeometry(0.14, 10, 10);
    const fin = new Mesh(finGeo, skin);
    fin.name = `${name}_pectoralFin_${suffix}`;
    fin.scale.set(0.65, 0.1, 0.45);
    fin.position.set(0.05, -0.28, side * 0.38);
    fin.rotation.set(side * -0.35, 0, 0.2);
    root.add(fin);
  }

  // TAIL FIN — crescent V-shape
  const tailUpperGeo = new SphereGeometry(0.21, 10, 10);
  const tailUpper = new Mesh(tailUpperGeo, darkSkin);
  tailUpper.name = `${name}_tailFin_upper`;
  tailUpper.scale.set(0.45, 0.95, 0.08);
  tailUpper.position.set(-1.12, 0.2, 0);
  tailUpper.rotation.set(0, 0, 0.45);
  root.add(tailUpper);

  const tailLowerGeo = new SphereGeometry(0.21, 10, 10);
  const tailLower = new Mesh(tailLowerGeo, darkSkin);
  tailLower.name = `${name}_tailFin_lower`;
  tailLower.scale.set(0.38, 0.65, 0.08);
  tailLower.position.set(-1.12, -0.12, 0);
  tailLower.rotation.set(0, 0, -0.5);
  root.add(tailLower);

  // Small ventral fin
  const ventralFinGeo = new SphereGeometry(0.07, 8, 8);
  const ventralFin = new Mesh(ventralFinGeo, skin);
  ventralFin.name = `${name}_ventralFin`;
  ventralFin.scale.set(0.5, 0.55, 0.1);
  ventralFin.position.set(-0.3, -0.32, 0);
  root.add(ventralFin);

  // EYES — Very large, expressive
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';

    // Sclera
    const scleraGeo = new SphereGeometry(0.14, 14, 14);
    const sclera = new Mesh(scleraGeo, eyeWhiteMat(`${name}_eyeWhiteMat_${suffix}`));
    sclera.name = `${name}_eyeWhite_${suffix}`;
    sclera.position.set(0.35, 0.16, side * 0.32);
    root.add(sclera);

    // Iris
    const irisGeo = new SphereGeometry(0.085, 10, 10);
    const iris = new Mesh(irisGeo, irisMat(`${name}_irisMat_${suffix}`, new Color(0.05, 0.15, 0.3)));
    iris.name = `${name}_iris_${suffix}`;
    iris.position.set(0.35, 0.16, side * 0.39);
    root.add(iris);

    // Pupil
    const pupilGeo = new SphereGeometry(0.045, 8, 8);
    const pupil = new Mesh(pupilGeo, pupilMat(`${name}_pupilMat_${suffix}`));
    pupil.name = `${name}_pupil_${suffix}`;
    pupil.position.set(0.35, 0.16, side * 0.43);
    root.add(pupil);

    // Highlight sparkle
    const highlightGeo = new SphereGeometry(0.025, 6, 6);
    const highlight = new Mesh(highlightGeo, eyeWhiteMat(`${name}_highlightMat_${suffix}`));
    highlight.name = `${name}_eyeHighlight_${suffix}`;
    highlight.position.set(0.35, 0.2, side * 0.44);
    root.add(highlight);
  }

  // MOUTH — Wide, friendly crescent smile
  const mouthGeo = new TorusGeometry(0.15, 0.008, 16, 28);
  const mouth = new Mesh(mouthGeo, pupilMat(`${name}_mouthMat`));
  mouth.name = `${name}_mouth`;
  mouth.position.set(0.55, -0.1, 0);
  mouth.rotation.set(Math.PI / 2, 0, 0);
  mouth.scale.set(1, 0.4, 1);
  root.add(mouth);

  // Teeth
  for (let t = 0; t < 5; t++) {
    const angle = ((t - 2) / 4) * 0.6;
    const toothGeo = new CylinderGeometry(0.003, 0.012, 0.038, 6);
    const tooth = new Mesh(toothGeo, eyeWhiteMat(`${name}_toothMat_${t}`));
    tooth.name = `${name}_tooth_${t}`;
    tooth.position.set(0.55 + Math.cos(angle) * 0.11, -0.14, Math.sin(angle) * 0.11);
    tooth.rotation.set(Math.PI, 0, 0);
    root.add(tooth);
  }

  // Cheek blush
  for (const side of [-1, 1]) {
    const cheekGeo = new SphereGeometry(0.06, 8, 8);
    const cheekMat = skinMat(`${name}_cheekMat_${side}`, new Color(0.95, 0.6, 0.65));
    cheekMat.transparent = true;
    cheekMat.opacity = 0.35;
    const cheek = new Mesh(cheekGeo, cheekMat);
    cheek.name = `${name}_cheek_${side < 0 ? 'L' : 'R'}`;
    cheek.position.set(0.28, -0.04, side * 0.4);
    cheek.scale.set(0.8, 0.5, 0.3);
    root.add(cheek);
  }

  // Gill slits
  for (const side of [-1, 1]) {
    for (let g = 0; g < 3; g++) {
      const gillGeo = new BoxGeometry(0.07, 0.003, 0.003);
      const gill = new Mesh(gillGeo, pupilMat(`${name}_gillMat_${side}_${g}`));
      gill.name = `${name}_gill_${side < 0 ? 'L' : 'R'}_${g}`;
      gill.position.set(0.12 + g * 0.06, -0.04, side * 0.4);
      gill.rotation.set(0, side * 0.15, 0);
      root.add(gill);
    }
  }

  return root;
}

/**
 * Builds a cute cartoon fish with an ellipsoid body, V-shaped tail fins,
 * a dorsal fin, side fins, expressive eyes, a small O-shaped mouth,
 * and scale-like disc accents along the body.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the fish.
 * @param bodyColor - Base skin color. Defaults to orange.
 * @returns A parent Group containing all fish parts.
 */
export function buildFish(name: string, position: Vector3, bodyColor: Color = new Color(1.0, 0.5, 0.15)): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  const skin = skinMat(`${name}_skinMat`, bodyColor);
  const darkerSkin = skinMat(`${name}_darkerSkin`, bodyColor.clone().multiplyScalar(0.7));
  const lighterSkin = skinMat(
    `${name}_lighterSkin`,
    bodyColor
      .clone()
      .multiplyScalar(1.15)
      .add(new Color(0.12, 0.12, 0.12)),
  );

  // BODY
  const bodyGeo = new SphereGeometry(0.35, 16, 16);
  const body = new Mesh(bodyGeo, skin);
  body.name = `${name}_body`;
  body.scale.set(1.2, 1.0, 0.55);
  root.add(body);

  // Light belly accent
  const bellyGeo = new SphereGeometry(0.275, 10, 10);
  const belly = new Mesh(bellyGeo, lighterSkin);
  belly.name = `${name}_belly`;
  belly.scale.set(1.1, 0.45, 0.48);
  belly.position.set(0, -0.1, 0);
  root.add(belly);

  // TAIL
  for (const vSide of [-1, 1]) {
    const tailFinGeo = new SphereGeometry(0.19, 10, 10);
    const tailFin = new Mesh(tailFinGeo, darkerSkin);
    tailFin.name = `${name}_tailFin_${vSide < 0 ? 'lower' : 'upper'}`;
    tailFin.scale.set(0.45, 0.9, 0.08);
    tailFin.position.set(-0.44, vSide * 0.1, 0);
    tailFin.rotation.set(0, 0, vSide * -0.55);
    root.add(tailFin);
  }

  // FINS

  // Dorsal fin
  const dorsalFinGeo = new SphereGeometry(0.1, 8, 8);
  const dorsalFin = new Mesh(dorsalFinGeo, darkerSkin);
  dorsalFin.name = `${name}_dorsalFin`;
  dorsalFin.scale.set(0.6, 1.0, 0.08);
  dorsalFin.position.set(-0.02, 0.34, 0);
  dorsalFin.rotation.set(0, 0, -0.15);
  root.add(dorsalFin);

  // Ventral fin
  const ventralFinGeo = new SphereGeometry(0.06, 8, 8);
  const ventralFin = new Mesh(ventralFinGeo, darkerSkin);
  ventralFin.name = `${name}_ventralFin`;
  ventralFin.scale.set(0.5, 0.7, 0.06);
  ventralFin.position.set(0.02, -0.28, 0);
  root.add(ventralFin);

  // Side fins
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const sideFinGeo = new SphereGeometry(0.06, 8, 8);
    const sideFin = new Mesh(sideFinGeo, darkerSkin);
    sideFin.name = `${name}_sideFin_${suffix}`;
    sideFin.scale.set(0.55, 0.08, 0.4);
    sideFin.position.set(0.1, -0.08, side * 0.18);
    sideFin.rotation.set(side * -0.5, 0, 0.25);
    root.add(sideFin);
  }

  // EYES
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';

    const scleraGeo = new SphereGeometry(0.08, 10, 10);
    const sclera = new Mesh(scleraGeo, eyeWhiteMat(`${name}_eyeWhiteMat_${suffix}`));
    sclera.name = `${name}_eyeWhite_${suffix}`;
    sclera.position.set(0.22, 0.1, side * 0.17);
    root.add(sclera);

    const irisGeo = new SphereGeometry(0.045, 8, 8);
    const iris = new Mesh(irisGeo, irisMat(`${name}_irisMat_${suffix}`, new Color(0.08, 0.08, 0.1)));
    iris.name = `${name}_iris_${suffix}`;
    iris.position.set(0.22, 0.1, side * 0.22);
    root.add(iris);

    const pupilGeo = new SphereGeometry(0.025, 8, 8);
    const pupil = new Mesh(pupilGeo, pupilMat(`${name}_pupilMat_${suffix}`));
    pupil.name = `${name}_pupil_${suffix}`;
    pupil.position.set(0.22, 0.1, side * 0.25);
    root.add(pupil);

    // Eye highlight sparkle
    const highlightGeo = new SphereGeometry(0.015, 6, 6);
    const highlight = new Mesh(highlightGeo, eyeWhiteMat(`${name}_highlightMat_${suffix}`));
    highlight.name = `${name}_eyeHighlight_${suffix}`;
    highlight.position.set(0.22, 0.13, side * 0.255);
    root.add(highlight);
  }

  // MOUTH — Cute puckered O-lips
  const mouthGeo = new TorusGeometry(0.035, 0.006, 16, 16);
  const mouth = new Mesh(mouthGeo, noseMat(`${name}_mouthMat`, new Color(0.9, 0.35, 0.3)));
  mouth.name = `${name}_mouth`;
  mouth.position.set(0.38, -0.01, 0);
  mouth.rotation.set(Math.PI / 2, 0, 0);
  root.add(mouth);

  // SPOTS
  const spot1Geo = new SphereGeometry(0.03, 6, 6);
  const spotMat1 = skinMat(`${name}_spotMat_1`, bodyColor.clone().multiplyScalar(1.35));
  spotMat1.transparent = true;
  spotMat1.opacity = 0.5;
  const spot1 = new Mesh(spot1Geo, spotMat1);
  spot1.name = `${name}_spot_1`;
  spot1.position.set(0.05, 0.08, 0.19);
  spot1.scale.set(0.8, 0.8, 0.2);
  root.add(spot1);

  const spot2Geo = new SphereGeometry(0.0225, 6, 6);
  const spotMat2 = skinMat(`${name}_spotMat_2`, bodyColor.clone().multiplyScalar(1.35));
  spotMat2.transparent = true;
  spotMat2.opacity = 0.5;
  const spot2 = new Mesh(spot2Geo, spotMat2);
  spot2.name = `${name}_spot_2`;
  spot2.position.set(-0.1, 0.12, 0.18);
  spot2.scale.set(0.8, 0.8, 0.2);
  root.add(spot2);

  return root;
}

/**
 * Builds a detailed cartoon elephant with a round body, large ears, a curved trunk,
 * four stumpy legs, expressive eyes, and a small tail. Uses PBR skin materials
 * for a soft, slightly glossy pachyderm look.
 *
 * @param name - Unique name prefix for all meshes.
 * @param position - World position to place the elephant.
 * @param bodyColor - Base skin color. Defaults to a warm gray.
 * @returns A parent Group containing all elephant parts.
 */
export function buildElephant(name: string, position: Vector3, bodyColor: Color = new Color(0.6, 0.6, 0.62)): Group {
  const root = new Group();
  root.name = `${name}_root`;
  root.position.copy(position);

  const skin = skinMat(`${name}_skinMat`, bodyColor);
  const darkSkin = skinMat(`${name}_darkSkinMat`, bodyColor.clone().multiplyScalar(0.7));

  // Body — large squashed sphere
  const bodyGeo = new SphereGeometry(1.0, 14, 14);
  const body = new Mesh(bodyGeo, skin);
  body.name = `${name}_body`;
  body.scale.set(1.0, 0.9, 1.1);
  root.add(body);

  // Head — slightly smaller sphere, forward and up
  const headGeo = new SphereGeometry(0.6, 12, 12);
  const head = new Mesh(headGeo, skin);
  head.name = `${name}_head`;
  head.position.set(0, 0.8, -0.8);
  root.add(head);

  const headCenter = new Vector3(0, 0.8, -0.8);

  // Trunk — series of 4 tapered cylinders for a curved trunk
  const trunkSegments = 4;
  const trunkParent = new Group();
  trunkParent.name = `${name}_trunkParent`;
  trunkParent.position.set(0, 0.4, -1.4);
  trunkParent.rotation.x = Math.PI / 4;
  root.add(trunkParent);

  for (let i = 0; i < trunkSegments; i++) {
    const t = i / trunkSegments;
    const diam = 0.3 - t * 0.12;
    const segHeight = 0.35;
    const segGeo = new CylinderGeometry((diam - 0.04) / 2, diam / 2, segHeight, 10);
    const seg = new Mesh(segGeo, skin);
    seg.name = `${name}_trunk_${i}`;
    seg.position.y = -i * segHeight * 0.85;
    seg.rotation.x = i * 0.12; // slight curve
    trunkParent.add(seg);
  }

  // Trunk tip — small torus ring
  const trunkTipGeo = new TorusGeometry(0.08, 0.02, 16, 12);
  const trunkTip = new Mesh(trunkTipGeo, darkSkin);
  trunkTip.name = `${name}_trunkTip`;
  trunkTip.position.y = -trunkSegments * 0.35 * 0.85 - 0.05;
  trunkParent.add(trunkTip);

  // Ears — large flat ellipsoid discs
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const earGeo = new SphereGeometry(0.4, 10, 10);
    const ear = new Mesh(earGeo, skin);
    ear.name = `${name}_ear_${suffix}`;
    ear.scale.set(0.2, 1.0, 1.2);
    ear.position.set(side * 0.65, 0.85, -0.75);
    ear.rotation.z = side * -0.15;
    root.add(ear);

    // Inner ear — pink-tinted
    const innerGeo = new SphereGeometry(0.275, 8, 8);
    const inner = new Mesh(innerGeo, innerEarMat(`${name}_innerEarMat_${suffix}`, new Color(0.85, 0.6, 0.65)));
    inner.name = `${name}_innerEar_${suffix}`;
    inner.scale.set(0.15, 0.85, 1.0);
    inner.position.set(side * 0.65, 0.85, -0.73);
    inner.rotation.z = side * -0.15;
    root.add(inner);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const parts = buildEye(name, side, headCenter, new Color(0.35, 0.25, 0.12), 0.09, 0.05, 0.028, 0.18, 0.35);
    for (const p of parts) root.add(p);
  }

  // Legs — 4 stumpy cylinders
  const legPositions = [new Vector3(-0.5, -0.7, 0.3), new Vector3(0.5, -0.7, 0.3), new Vector3(-0.5, -0.7, -0.3), new Vector3(0.5, -0.7, -0.3)];
  for (let i = 0; i < legPositions.length; i++) {
    const legGeo = new CylinderGeometry(0.15, 0.175, 0.6, 10);
    const leg = new Mesh(legGeo, skin);
    leg.name = `${name}_leg_${i}`;
    leg.position.copy(legPositions[i]);
    root.add(leg);

    // Toenails — 3 small spheres at foot base
    for (let t = 0; t < 3; t++) {
      const angle = ((t - 1) / 2) * 0.5 + (i < 2 ? 0 : Math.PI);
      const toenailGeo = new SphereGeometry(0.03, 6, 6);
      const toenail = new Mesh(toenailGeo, darkSkin);
      toenail.name = `${name}_toenail_${i}_${t}`;
      toenail.position.set(legPositions[i].x + Math.sin(angle) * 0.14, legPositions[i].y - 0.28, legPositions[i].z + Math.cos(angle) * 0.14);
      root.add(toenail);
    }
  }

  // Tail — thin tapered cylinder with a tuft
  const tailGeo = new CylinderGeometry(0.015, 0.03, 0.5, 6);
  const tail = new Mesh(tailGeo, skin);
  tail.name = `${name}_tail`;
  tail.position.set(0, 0.1, 0.9);
  tail.rotation.x = -0.4;
  root.add(tail);

  const tailTuftGeo = new SphereGeometry(0.04, 6, 6);
  const tailTuft = new Mesh(tailTuftGeo, darkSkin);
  tailTuft.name = `${name}_tailTuft`;
  tailTuft.position.set(0, 0.3, 1.15);
  root.add(tailTuft);

  return root;
}
