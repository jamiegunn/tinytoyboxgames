import { Mesh, Group, Color, Vector3, SphereGeometry, CylinderGeometry } from 'three';
import { createFeltMaterial, createWoodMaterial, createPlasticMaterial } from '@app/utils/materialFactory';

// NOT HERE DELIBERATELY: buildDetailedFence, buildDetailedCloud,
// buildDetailedBush, buildWaterPlane, buildSkyGradient. About 200 lines.
//
// Every one of them has a live counterpart that the game actually uses and that
// knows things these did not. Clouds and sky come from utils/skyRig.ts, which
// the scenes drive; water is the pirate cove's sea scaffold, which ripples.
// buildSkyGradient in particular built a static two-colour dome, and a scene
// that adopted it would have lost the sky's response to its own fog settings.
//
// The four survivors above -- tree, rock, grass tuft, flower -- are here because
// something calls them. That is the only reason a builder belongs in this file.

/**
 * Builds a detailed storybook-style tree with a tapered trunk, branch stubs,
 * fluffy multi-sphere canopy, and optional small fruit spheres.
 *
 * @param position - World position for the tree's base.
 * @param height - Overall height of the tree. Defaults to 2.5.
 * @param canopyColor - Color for the canopy foliage. Defaults to a warm green.
 * @returns A parent Group containing all tree sub-meshes.
 */
export function buildDetailedTree(position: Vector3, height = 2.5, canopyColor?: Color): Group {
  const parent = new Group();
  parent.name = 'tree_parent';
  parent.position.copy(position);

  const leafColor = canopyColor ?? new Color(0.25, 0.6, 0.2);
  const trunkHeight = height * 0.45;
  const canopyBaseY = trunkHeight * 0.7;

  // --- Trunk: tapered cylinder, wider at base ---
  const trunkGeo = new CylinderGeometry(0.12 * height * 0.5, 0.22 * height * 0.5, trunkHeight, 12);
  const trunk = new Mesh(trunkGeo, createWoodMaterial('tree_trunk_mat', new Color(0.45, 0.28, 0.12)));
  trunk.name = 'tree_trunk';
  trunk.position.y = trunkHeight / 2;
  trunk.rotation.y = 0.15; // slight rotation for organic feel
  parent.add(trunk);

  // --- Branch stubs: 3 small tilted cylinders off the trunk ---
  const branchAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  branchAngles.forEach((angle, i) => {
    const branchLen = 0.18 * height;
    const branchGeo = new CylinderGeometry(0.02 * height * 0.5, 0.05 * height * 0.5, branchLen, 8);
    const branch = new Mesh(branchGeo, createWoodMaterial(`tree_branch_mat_${i}`, new Color(0.4, 0.25, 0.1)));
    branch.name = `tree_branch_${i}`;
    const branchY = trunkHeight * (0.5 + i * 0.12);
    branch.position.set(Math.cos(angle) * 0.1 * height, branchY, Math.sin(angle) * 0.1 * height);
    branch.rotation.z = Math.cos(angle) * 0.7;
    branch.rotation.x = Math.sin(angle) * 0.7;
    parent.add(branch);
  });

  // --- Canopy: 3-4 overlapping spheres for fluffy organic shape ---
  const canopySpheres = [
    { offset: new Vector3(0, 0, 0), diameter: 0.7 * height },
    { offset: new Vector3(0.2 * height, 0.1 * height, 0.1 * height), diameter: 0.55 * height },
    { offset: new Vector3(-0.15 * height, 0.15 * height, -0.1 * height), diameter: 0.5 * height },
    { offset: new Vector3(0.05 * height, -0.1 * height, 0.18 * height), diameter: 0.45 * height },
  ];

  canopySpheres.forEach((cfg, i) => {
    const radius = cfg.diameter / 2;
    const sphereGeo = new SphereGeometry(radius, 12, 12);
    const variation = 0.03 * i;
    const mat = createFeltMaterial(`tree_canopy_mat_${i}`, new Color(leafColor.r + variation, leafColor.g - variation * 0.5, leafColor.b + variation));
    mat.emissive = new Color(leafColor.r * 0.08, leafColor.g * 0.08, leafColor.b * 0.08);
    const sphere = new Mesh(sphereGeo, mat);
    sphere.name = `tree_canopy_${i}`;
    sphere.position.set(cfg.offset.x, canopyBaseY + radius + cfg.offset.y, cfg.offset.z);
    parent.add(sphere);
  });

  // --- Fruit: 2-3 tiny colored spheres nestled in the canopy ---
  const fruitColors = [new Color(0.85, 0.15, 0.1), new Color(0.9, 0.7, 0.05), new Color(0.85, 0.3, 0.1)];
  for (let i = 0; i < 3; i++) {
    const fruitRadius = 0.06 * height * 0.5;
    const fruitGeo = new SphereGeometry(fruitRadius, 8, 8);
    const fruit = new Mesh(fruitGeo, createPlasticMaterial(`tree_fruit_mat_${i}`, fruitColors[i]));
    fruit.name = `tree_fruit_${i}`;
    const fruitAngle = (i * Math.PI * 2) / 3 + 0.4;
    fruit.position.set(Math.cos(fruitAngle) * 0.22 * height, canopyBaseY + 0.15 * height + i * 0.05, Math.sin(fruitAngle) * 0.22 * height);
    parent.add(fruit);
  }

  return parent;
}

/**
 * Builds a detailed rocky cluster from several non-uniformly scaled spheres
 * with varied gray-brown PBR tones for a natural, organic appearance.
 *
 * @param position - World position for the rock cluster.
 * @param scale - Overall scale multiplier. Defaults to 1.0.
 * @param color - Base color for the rock. Defaults to a warm gray.
 * @returns A parent Group containing all rock sub-meshes.
 */
export function buildDetailedRock(position: Vector3, scale = 1.0, color?: Color): Group {
  const parent = new Group();
  parent.name = 'rock_parent';
  parent.position.copy(position);
  parent.rotation.y = Math.random() * Math.PI * 2; // random organic rotation

  const baseColor = color ?? new Color(0.5, 0.45, 0.4);

  // --- Main body: non-uniformly scaled sphere ---
  const mainGeo = new SphereGeometry(0.3 * scale, 10, 10);
  const mainMat = createPlasticMaterial('rock_main_mat', baseColor);
  mainMat.roughness = 0.75;
  const main = new Mesh(mainGeo, mainMat);
  main.name = 'rock_main';
  main.scale.set(1.0 * scale, 0.7 * scale, 0.9 * scale);
  parent.add(main);

  // --- Sub-rocks: 2-3 smaller overlapping spheres ---
  const subRocks = [
    { pos: new Vector3(0.2 * scale, -0.05 * scale, 0.15 * scale), diam: 0.35, scaleY: 0.65 },
    { pos: new Vector3(-0.18 * scale, -0.08 * scale, -0.1 * scale), diam: 0.28, scaleY: 0.6 },
    { pos: new Vector3(0.05 * scale, 0.1 * scale, -0.2 * scale), diam: 0.22, scaleY: 0.7 },
  ];

  subRocks.forEach((cfg, i) => {
    const subGeo = new SphereGeometry((cfg.diam * scale) / 2, 8, 8);
    const colorShift = (i - 1) * 0.04;
    const roughnessVariation = 0.7 + i * 0.05;
    const subMat = createPlasticMaterial(`rock_sub_mat_${i}`, new Color(baseColor.r + colorShift, baseColor.g + colorShift, baseColor.b + colorShift * 0.5));
    subMat.roughness = roughnessVariation;
    const sub = new Mesh(subGeo, subMat);
    sub.name = `rock_sub_${i}`;
    sub.position.copy(cfg.pos);
    sub.scale.y = cfg.scaleY;
    sub.rotation.x = Math.random() * 0.3;
    sub.rotation.z = Math.random() * 0.3;
    parent.add(sub);
  });

  return parent;
}

/**
 * Builds a tuft of grass from 5-7 thin tapered blades fanning outward,
 * each with slight random rotation and height variation for a natural look.
 *
 * @param position - World position for the grass tuft center.
 * @param color - Base green color. Defaults to a vibrant grass green.
 * @returns A parent Group containing all blade sub-meshes.
 */
export function buildGrassTuft(position: Vector3, color?: Color): Group {
  const parent = new Group();
  parent.name = 'grass_parent';
  parent.position.copy(position);

  const baseColor = color ?? new Color(0.2, 0.65, 0.15);
  const bladeCount = 5 + Math.floor(Math.random() * 3); // 5-7 blades

  for (let i = 0; i < bladeCount; i++) {
    const bladeHeight = 0.15 + Math.random() * 0.15; // 0.15-0.30 units
    const bladeGeo = new CylinderGeometry(0.003 / 2, 0.015 / 2, bladeHeight, 6);
    const variation = Math.random() * 0.06;
    const bladeMat = createFeltMaterial(`grass_blade_mat_${i}`, new Color(baseColor.r + variation, baseColor.g - variation, baseColor.b + variation * 0.5));
    bladeMat.emissive = new Color(baseColor.r * 0.1, baseColor.g * 0.12, baseColor.b * 0.05);
    const blade = new Mesh(bladeGeo, bladeMat);
    blade.name = `grass_blade_${i}`;

    const angle = (i / bladeCount) * Math.PI * 2 + Math.random() * 0.3;
    const fanTilt = 0.2 + Math.random() * 0.25;

    blade.position.set(Math.cos(angle) * 0.02, bladeHeight / 2, Math.sin(angle) * 0.02);
    blade.rotation.x = Math.sin(angle) * fanTilt;
    blade.rotation.z = -Math.cos(angle) * fanTilt;
    blade.rotation.y = Math.random() * 0.5;

    parent.add(blade);
  }

  return parent;
}

/**
 * Builds a detailed storybook flower with a tapered stem, radially arranged
 * flattened-sphere petals tilted outward, a pollen center, and stem leaves.
 *
 * @param position - World position for the flower base.
 * @param petalColor - Color for the flower petals.
 * @param stemHeight - Height of the stem. Defaults to 0.4.
 * @returns A parent Group containing all flower sub-meshes.
 */
export function buildDetailedFlower(position: Vector3, petalColor: Color, stemHeight = 0.4): Group {
  const parent = new Group();
  parent.name = 'flower_parent';
  parent.position.copy(position);

  const stemColor = new Color(0.18, 0.5, 0.12);

  // --- Stem: thin tapered cylinder ---
  const stemGeo = new CylinderGeometry(0.015 / 2, 0.025 / 2, stemHeight, 8);
  const stem = new Mesh(stemGeo, createFeltMaterial('flower_stem_mat', stemColor));
  stem.name = 'flower_stem';
  stem.position.y = stemHeight / 2;
  parent.add(stem);

  // --- Petals: 5-6 flattened spheres arranged radially, tilted outward 30° ---
  const petalCount = 6;
  const petalRadius = 0.06;
  const petalRingRadius = 0.045;

  for (let i = 0; i < petalCount; i++) {
    const petalGeo = new SphereGeometry(petalRadius, 8, 8);
    const mat = createPlasticMaterial(`flower_petal_mat_${i}`, petalColor);
    mat.roughness = 0.45;
    const petal = new Mesh(petalGeo, mat);
    petal.name = `flower_petal_${i}`;
    const angle = (i / petalCount) * Math.PI * 2;
    petal.position.set(Math.cos(angle) * petalRingRadius, stemHeight, Math.sin(angle) * petalRingRadius);
    petal.scale.set(1.0, 0.35, 1.3); // flattened ellipsoid
    // tilt outward ~30°
    petal.rotation.x = Math.sin(angle) * 0.52;
    petal.rotation.z = -Math.cos(angle) * 0.52;
    petal.rotation.y = angle;
    parent.add(petal);
  }

  // --- Center: small yellow pollen sphere ---
  const centerGeo = new SphereGeometry(0.02, 8, 8);
  const centerMat = createPlasticMaterial('flower_center_mat', new Color(0.95, 0.85, 0.15));
  centerMat.emissive = new Color(0.15, 0.12, 0.0);
  const center = new Mesh(centerGeo, centerMat);
  center.name = 'flower_center';
  center.position.y = stemHeight + 0.01;
  parent.add(center);

  // --- Leaves: 1-2 flattened ellipsoids on the stem ---
  for (let i = 0; i < 2; i++) {
    const leafGeo = new SphereGeometry(0.03, 8, 8);
    const leafMat = createFeltMaterial(`flower_leaf_mat_${i}`, new Color(0.2, 0.55, 0.15));
    const leaf = new Mesh(leafGeo, leafMat);
    leaf.name = `flower_leaf_${i}`;
    const leafAngle = i * Math.PI + 0.5;
    leaf.position.set(Math.cos(leafAngle) * 0.035, stemHeight * (0.3 + i * 0.2), Math.sin(leafAngle) * 0.035);
    leaf.scale.set(0.5, 0.25, 1.2); // flattened ellipsoid
    leaf.rotation.y = leafAngle;
    leaf.rotation.z = -Math.cos(leafAngle) * 0.4;
    parent.add(leaf);
  }

  return parent;
}
