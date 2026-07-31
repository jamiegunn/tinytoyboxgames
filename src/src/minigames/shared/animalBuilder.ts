import { Mesh, Group, Color, Vector3, SphereGeometry, CylinderGeometry, BoxGeometry, TorusGeometry } from 'three';
import { createSkinMaterial, createCartoonEyeWhiteMaterial, createCartoonPupilMaterial, createCartoonNoseMaterial, createIrisMaterial } from './materials';

// ---------------------------------------------------------------------------
// Short aliases for material factories (keeps call sites concise)
// ---------------------------------------------------------------------------

const eyeWhiteMat = createCartoonEyeWhiteMaterial;
const pupilMat = createCartoonPupilMaterial;
const noseMat = createCartoonNoseMaterial;
const irisMat = createIrisMaterial;
const skinMat = createSkinMaterial;

// NOT HERE DELIBERATELY: buildBunny, buildKitten, buildPuppy, buildPanda,
// buildHamster, buildFrog, buildBear, buildCat, buildElephant -- and the shared
// buildEye helper, PINK, and the fur/innerEar/accessory material aliases that
// only they used. About 970 lines.
//
// Nine complete, documented, internally consistent cartoon animals. Nothing in
// the app ever called one of them. They survived because this file is LIVE:
// buildShark and buildFish below are real, so the module-reachability guard
// answered "yes, the app loads this" and stopped, which is exactly the blind
// spot tests/framework/noUnusedExports.test.mjs was written to close.
//
// The resemblance to this repo's other famous corpse is not a coincidence. The
// deleted little-shark species roster was 963 lines of finished, plausible,
// uncalled content; this was ~920. Both read as shipped. The difference is only
// that the roster sat in files nothing imported, and these sat next to a
// function that ships.
//
// Do not restore one because a game "needs an animal". Building the animal is
// the cheap part -- the reason the playroom's critters are built elsewhere,
// independently, is that they answer to scene lighting and idle animation
// conventions these builders never knew about. Wiring one of these in would
// give you a panda that ignores every one of them.

// ---------------------------------------------------------------------------
// Animal builder functions
// ---------------------------------------------------------------------------

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
