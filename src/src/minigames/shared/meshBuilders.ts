import { Mesh, Group, Color, Vector3, SphereGeometry, CylinderGeometry, BoxGeometry, PlaneGeometry, MeshBasicMaterial, DoubleSide } from 'three';
import { createFeltMaterial, createWoodMaterial, createPlasticMaterial } from '@app/utils/materialFactory';

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

/**
 * Builds a detailed toy-world fence section with tapered vertical posts
 * and horizontal rails, using wood PBR materials with slight imperfections.
 *
 * @param position - World position for the fence.
 * @param width - Total width of the fence section. Defaults to 3.0.
 * @returns A parent Group containing all fence sub-meshes.
 */
export function buildDetailedFence(position: Vector3, width = 3.0): Group {
  const parent = new Group();
  parent.name = 'fence_parent';
  parent.position.copy(position);

  const postCount = 4;
  const postHeight = 0.6;
  const spacing = width / (postCount - 1);
  const woodColor = new Color(0.55, 0.35, 0.15);

  // --- Vertical posts: tapered cylinders ---
  for (let i = 0; i < postCount; i++) {
    const postGeo = new CylinderGeometry(0.04 / 2, 0.06 / 2, postHeight, 8);
    const post = new Mesh(postGeo, createWoodMaterial(`fence_post_mat_${i}`, new Color(woodColor.r + (Math.random() - 0.5) * 0.05, woodColor.g, woodColor.b)));
    post.name = `fence_post_${i}`;
    post.position.set(i * spacing - width / 2, postHeight / 2, 0);
    post.rotation.y = (Math.random() - 0.5) * 0.08; // slight imperfection
    parent.add(post);
  }

  // --- Horizontal rails: 2 thin boxes between posts ---
  const railHeights = [postHeight * 0.35, postHeight * 0.7];
  railHeights.forEach((ry, i) => {
    const railGeo = new BoxGeometry(width, 0.03, 0.03);
    const rail = new Mesh(railGeo, createWoodMaterial(`fence_rail_mat_${i}`, new Color(woodColor.r - 0.03, woodColor.g - 0.02, woodColor.b)));
    rail.name = `fence_rail_${i}`;
    rail.position.set(0, ry, 0);
    parent.add(rail);
  });

  return parent;
}

/**
 * Builds a fluffy cumulus-style cloud from 4-5 overlapping white spheres
 * with soft transparency and slight emissive luminosity.
 *
 * @param position - World position for the cloud center.
 * @param scale - Overall scale multiplier. Defaults to 1.0.
 * @returns A parent Group containing all cloud sub-meshes.
 */
export function buildDetailedCloud(position: Vector3, scale = 1.0): Group {
  const parent = new Group();
  parent.name = 'cloud_parent';
  parent.position.copy(position);

  const cloudParts = [
    { offset: new Vector3(0, 0, 0), diameter: 0.8 },
    { offset: new Vector3(0.35, 0.1, 0.05), diameter: 0.65 },
    { offset: new Vector3(-0.3, 0.05, -0.08), diameter: 0.6 },
    { offset: new Vector3(0.1, 0.18, 0.12), diameter: 0.5 },
    { offset: new Vector3(-0.12, -0.05, 0.15), diameter: 0.55 },
  ];

  cloudParts.forEach((cfg, i) => {
    const sphereGeo = new SphereGeometry((cfg.diameter * scale) / 2, 10, 10);
    const mat = createPlasticMaterial(`cloud_mat_${i}`, new Color(0.97, 0.97, 0.99));
    mat.roughness = 0.9;
    mat.emissive = new Color(0.15, 0.15, 0.18);
    mat.transparent = true;
    mat.opacity = 0.85;
    const sphere = new Mesh(sphereGeo, mat);
    sphere.name = `cloud_part_${i}`;
    sphere.position.set(cfg.offset.x * scale, cfg.offset.y * scale, cfg.offset.z * scale);
    parent.add(sphere);
  });

  return parent;
}

/**
 * Builds a dense storybook bush from 4-6 overlapping spheres in two
 * slightly different greens, flattened vertically for a rounded shrub shape.
 *
 * @param position - World position for the bush.
 * @param scale - Overall scale multiplier. Defaults to 1.0.
 * @param color - Base foliage color. Defaults to a medium green.
 * @returns A parent Group containing all bush sub-meshes.
 */
export function buildDetailedBush(position: Vector3, scale = 1.0, color?: Color): Group {
  const parent = new Group();
  parent.name = 'bush_parent';
  parent.position.copy(position);

  const baseColor = color ?? new Color(0.2, 0.55, 0.15);
  const altColor = new Color(baseColor.r + 0.05, baseColor.g + 0.08, baseColor.b - 0.02);

  const foliageParts = [
    { offset: new Vector3(0, 0, 0), diameter: 0.6 },
    { offset: new Vector3(0.2, 0.05, 0.12), diameter: 0.5 },
    { offset: new Vector3(-0.18, 0.08, -0.1), diameter: 0.48 },
    { offset: new Vector3(0.08, -0.05, -0.2), diameter: 0.42 },
    { offset: new Vector3(-0.1, 0.12, 0.18), diameter: 0.38 },
    { offset: new Vector3(0.15, -0.02, 0.05), diameter: 0.35 },
  ];

  foliageParts.forEach((cfg, i) => {
    const sphereGeo = new SphereGeometry((cfg.diameter * scale) / 2, 10, 10);
    const useAlt = i % 2 === 1;
    const partColor = useAlt ? altColor : baseColor;
    const mat = createFeltMaterial(`bush_mat_${i}`, partColor);
    mat.emissive = new Color(partColor.r * 0.06, partColor.g * 0.08, partColor.b * 0.04);
    const sphere = new Mesh(sphereGeo, mat);
    sphere.name = `bush_part_${i}`;
    sphere.position.set(cfg.offset.x * scale, cfg.offset.y * scale, cfg.offset.z * scale);
    sphere.scale.y = 0.7; // flatten vertically
    parent.add(sphere);
  });

  return parent;
}

/**
 * Builds a stylized water surface with a semi-transparent PBR plane
 * and a second offset plane underneath for depth illusion, complete
 * with emissive blue tint for underwater glow.
 *
 * @param position - World position for the water plane center.
 * @param width - Width of the water surface. Defaults to 10.
 * @param depth - Depth (Z extent) of the water surface. Defaults to 8.
 * @returns A parent Group containing the water planes.
 */
export function buildWaterPlane(position: Vector3, width = 10, depth = 8): Group {
  const parent = new Group();
  parent.name = 'water_parent';
  parent.position.copy(position);

  // --- Surface plane (ground = horizontal plane) ---
  const surfaceGeo = new PlaneGeometry(width, depth);
  surfaceGeo.rotateX(-Math.PI / 2);
  const surfaceMat = createPlasticMaterial('water_surface_mat', new Color(0.15, 0.45, 0.7));
  surfaceMat.metalness = 0.2;
  surfaceMat.roughness = 0.1;
  surfaceMat.transparent = true;
  surfaceMat.opacity = 0.75;
  surfaceMat.emissive = new Color(0.03, 0.08, 0.15);
  const surface = new Mesh(surfaceGeo, surfaceMat);
  surface.name = 'water_surface';
  surface.position.y = 0;
  parent.add(surface);

  // --- Depth plane: slightly below, darker, more transparent ---
  const depthGeo = new PlaneGeometry(width * 0.95, depth * 0.95);
  depthGeo.rotateX(-Math.PI / 2);
  const depthMat = createPlasticMaterial('water_depth_mat', new Color(0.08, 0.25, 0.5));
  depthMat.metalness = 0.15;
  depthMat.roughness = 0.2;
  depthMat.transparent = true;
  depthMat.opacity = 0.5;
  depthMat.emissive = new Color(0.02, 0.04, 0.1);
  const depthPlane = new Mesh(depthGeo, depthMat);
  depthPlane.name = 'water_depth';
  depthPlane.position.y = -0.08;
  parent.add(depthPlane);

  return parent;
}

/**
 * Builds a banded sky gradient background from 3-4 stacked horizontal strips,
 * blending from a top color to a bottom color with emissive lighting for
 * a soft storybook sky effect.
 *
 * @param topColor - Color at the top of the sky.
 * @param bottomColor - Color at the bottom of the sky.
 * @param size - Width and height of the sky backdrop. Defaults to 20.
 * @returns A parent Group containing the sky strip planes.
 */
export function buildSkyGradient(topColor: Color, bottomColor: Color, size = 20): Group {
  const parent = new Group();
  parent.name = 'sky_parent';

  const stripCount = 4;
  const stripHeight = size / stripCount;

  for (let i = 0; i < stripCount; i++) {
    const t = i / (stripCount - 1); // 0 = top, 1 = bottom
    const stripColor = topColor.clone().lerp(bottomColor, t);

    const stripGeo = new PlaneGeometry(size, stripHeight);
    const mat = new MeshBasicMaterial({
      name: `sky_strip_mat_${i}`,
      color: stripColor.clone(),
      side: DoubleSide,
    });
    // Emissive approximation via MeshBasicMaterial (unlit, so color IS the emission)
    // Blend emissive tint into the base color for the same visual effect
    const emissiveFactor = 0.7 - t * 0.3;
    mat.color.setRGB(stripColor.r * (1 + emissiveFactor), stripColor.g * (1 + emissiveFactor), stripColor.b * (1 + emissiveFactor));

    const strip = new Mesh(stripGeo, mat);
    strip.name = `sky_strip_${i}`;

    // Position strips from top to bottom
    const yPos = size / 2 - stripHeight / 2 - i * stripHeight;
    strip.position.set(0, yPos, size / 2);

    parent.add(strip);
  }

  return parent;
}
