import { Color, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { CEILING_Y } from '../layout';
import gsap from 'gsap';

/**
 * Creates a hanging mobile attached to the ceiling by a string.
 * Features a wooden cross-bar with a crescent moon, stars, a cloud,
 * and a heart dangling on strings. The entire assembly rotates slowly.
 * @param scene - The Three.js scene to add the mobile to
 */
export function createHangingMobile(scene: Scene): void {
  // ── Root pivot — rotates the entire mobile ──
  const pivot = new Group();
  pivot.name = 'mobilePivot';
  pivot.position.set(3.0, CEILING_Y, 3.5);
  scene.add(pivot);

  const stringMat = createFeltMaterial('hub_mobileStringMat', new Color(0.7, 0.6, 0.5));
  const barMat = createWoodMaterial('hub_mobileBarMat', new Color(0.65, 0.5, 0.35));

  // ── Ceiling attachment string ──
  const attachLen = 0.6;
  const attachString = new Mesh(new CylinderGeometry(0.006, 0.006, attachLen, 4), stringMat);
  attachString.name = 'mobileAttachString';
  attachString.position.y = -attachLen / 2;
  pivot.add(attachString);

  // ── Cross-bar assembly ──
  const crossGroup = new Group();
  crossGroup.name = 'mobileCrossGroup';
  crossGroup.position.y = -attachLen;
  pivot.add(crossGroup);

  // Main bar
  const mainBar = new Mesh(new CylinderGeometry(0.02, 0.02, 1.4, 6), barMat);
  mainBar.name = 'mobileMainBar';
  mainBar.rotation.z = Math.PI / 2;
  crossGroup.add(mainBar);

  // Perpendicular bar
  const crossBar = new Mesh(new CylinderGeometry(0.02, 0.02, 1.0, 6), barMat);
  crossBar.name = 'mobileCrossBar';
  crossBar.rotation.x = Math.PI / 2;
  crossGroup.add(crossBar);

  // Centre knot
  const knot = new Mesh(new SphereGeometry(0.035, 8, 8), barMat);
  knot.name = 'mobileKnot';
  crossGroup.add(knot);

  // ── Hanging ornaments ──
  const hangPoints = [
    { x: -0.65, z: 0, len: 0.7 }, // left end of main bar
    { x: 0.65, z: 0, len: 0.55 }, // right end of main bar
    { x: 0, z: -0.45, len: 0.85 }, // front of cross bar
    { x: 0, z: 0.45, len: 0.6 }, // back of cross bar
    { x: -0.3, z: -0.2, len: 0.95 }, // diagonal
  ];

  // Moon — crescent shape
  const moonMat = createPlasticMaterial('hub_mobileMoonMat', new Color(1.0, 0.95, 0.7));
  moonMat.emissive = new Color(0.1, 0.09, 0.05);
  addHangingString(crossGroup, hangPoints[0], stringMat);
  const moonGroup = new Group();
  moonGroup.name = 'mobileMoonGroup';
  moonGroup.position.set(hangPoints[0].x, -hangPoints[0].len, hangPoints[0].z);
  crossGroup.add(moonGroup);

  const moonOuter = new Mesh(new TorusGeometry(0.1, 0.04, 8, 16, Math.PI * 1.3), moonMat);
  moonOuter.name = 'mobileMoon';
  moonOuter.rotation.z = -0.3;
  moonGroup.add(moonOuter);

  // Stars — 3D star shapes (cones facing each other)
  const starColors = [new Color(1.0, 0.9, 0.3), new Color(1.0, 0.6, 0.75), new Color(0.5, 0.8, 1.0)];

  for (let si = 0; si < 3; si++) {
    const hp = hangPoints[si + 1];
    addHangingString(crossGroup, hp, stringMat);

    const starMat = createGlossyPaintMaterial(`hub_mobileStarMat${si}`, starColors[si]);
    starMat.emissive = starColors[si].clone().multiplyScalar(0.08);
    const starGroup = new Group();
    starGroup.name = `mobileStar${si}`;
    starGroup.position.set(hp.x, -hp.len, hp.z);
    starGroup.rotation.z = si * 0.7 + 0.2;
    crossGroup.add(starGroup);

    // Star body — two cones tip-to-tip
    const coneH = 0.06;
    const coneR = 0.05;
    const topCone = new Mesh(new ConeGeometry(coneR, coneH, 5), starMat);
    topCone.name = `mobileStarTop${si}`;
    topCone.position.y = coneH * 0.15;
    starGroup.add(topCone);

    const botCone = new Mesh(new ConeGeometry(coneR, coneH, 5), starMat);
    botCone.name = `mobileStarBot${si}`;
    botCone.position.y = -coneH * 0.15;
    botCone.rotation.z = Math.PI;
    botCone.rotation.y = Math.PI / 5; // offset points
    starGroup.add(botCone);
  }

  // Cloud — cluster of spheres
  const cloudMat = createPlasticMaterial('hub_mobileCloudMat', new Color(0.95, 0.95, 0.98));
  cloudMat.emissive = new Color(0.05, 0.05, 0.06);
  const hp4 = hangPoints[4];
  addHangingString(crossGroup, hp4, stringMat);

  const cloudGroup = new Group();
  cloudGroup.name = 'mobileCloud';
  cloudGroup.position.set(hp4.x, -hp4.len, hp4.z);
  crossGroup.add(cloudGroup);

  const cloudPuffs = [
    { x: 0, y: 0, z: 0, r: 0.05 },
    { x: -0.04, y: -0.01, z: 0, r: 0.04 },
    { x: 0.04, y: -0.01, z: 0, r: 0.04 },
    { x: -0.02, y: 0.03, z: 0, r: 0.035 },
    { x: 0.02, y: 0.03, z: 0, r: 0.035 },
  ];
  cloudPuffs.forEach((cp, ci) => {
    const puff = new Mesh(new SphereGeometry(cp.r, 8, 8), cloudMat);
    puff.name = `mobileCloudPuff${ci}`;
    puff.position.set(cp.x, cp.y, cp.z);
    cloudGroup.add(puff);
  });

  // ── Slow rotation ──
  gsap.to(pivot.rotation, {
    y: Math.PI * 2,
    duration: 25,
    repeat: -1,
    ease: 'none',
  });

  // ── Gentle sway ──
  gsap.to(crossGroup.rotation, {
    x: 0.04,
    duration: 4,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
  gsap.to(crossGroup.rotation, {
    z: 0.03,
    duration: 5.5,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
}

/**
 * Adds a thin string from the cross-bar to a hang point.
 * @param parent - The cross-bar group to attach the string to
 * @param hp - Hang point with x, z offsets and string length
 * @param mat - The felt material for the string
 */
function addHangingString(parent: Group, hp: { x: number; z: number; len: number }, mat: ReturnType<typeof createFeltMaterial>): void {
  const str = new Mesh(new CylinderGeometry(0.005, 0.005, hp.len, 4), mat);
  str.name = 'mobileHangString';
  str.position.set(hp.x, -hp.len / 2, hp.z);
  parent.add(str);
}
