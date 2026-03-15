import { Group, Color, Mesh, SphereGeometry, CylinderGeometry, BoxGeometry, MeshStandardMaterial } from 'three';
import { randomRange } from '@app/minigames/shared/mathUtils';

// ── Type definitions ────────────────────────────────────────────────

/** Available coral morphology types. */
export type CoralType = 'brain' | 'staghorn' | 'fan' | 'tube' | 'mushroom';

/** Available underwater plant morphology types. */
export type PlantType = 'kelp' | 'seaGrass' | 'fern' | 'moss';

// ── Color palettes ──────────────────────────────────────────────────

/** Default color palette for coral varieties. */
const CORAL_COLORS: Color[] = [
  new Color(1.0, 0.45, 0.55), // pink
  new Color(1.0, 0.55, 0.15), // orange
  new Color(0.7, 0.3, 0.85), // purple
  new Color(1.0, 0.82, 0.25), // yellow
  new Color(0.2, 0.75, 0.7), // teal
];

/** Default color palette for plant varieties. */
const PLANT_COLORS: Color[] = [
  new Color(0.1, 0.35, 0.1), // dark green
  new Color(0.4, 0.42, 0.15), // olive
  new Color(0.18, 0.55, 0.34), // sea green
  new Color(0.15, 0.65, 0.3), // emerald
];

// ── Internal helpers ────────────────────────────────────────────────

let coralUid = 0;
let plantUid = 0;

// Picks a random element from an array.
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Creates a coral-style MeshStandardMaterial.
function coralMat(name: string, color: Color, roughness: number, emissiveFactor = 0.1): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness,
    emissive: color.clone().multiplyScalar(emissiveFactor),
  });
}

// Creates a translucent coral-style MeshStandardMaterial.
function coralMatTranslucent(name: string, color: Color, roughness: number, opacity: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness,
    emissive: color.clone().multiplyScalar(0.08),
    transparent: true,
    opacity,
  });
}

// Creates a plant-style MeshStandardMaterial.
function plantMat(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.6,
    emissive: color.clone().multiplyScalar(0.06),
  });
}

// ── Coral builders ──────────────────────────────────────────────────

/**
 * Builds a brain coral — a large bumpy sphere with small sphere protuberances on the upper half.
 *
 * @param color - Base color for the coral.
 * @param scale - Uniform scale multiplier.
 * @returns A Group containing the brain coral meshes.
 */
export function buildBrainCoral(color: Color, scale: number): Group {
  const id = coralUid++;
  const group = new Group();
  group.name = `coral_brain_${id}`;

  const mat = coralMat(`coral_brain_mat_${id}`, color, 0.7);

  // Main body sphere
  const bodyGeo = new SphereGeometry(0.45, 14, 14);
  const body = new Mesh(bodyGeo, mat);
  body.name = `coral_brain_body_${id}`;
  body.scale.set(1, 0.75, 1);
  group.add(body);

  // Bumps on the top half (4-6)
  const bumpCount = 4 + Math.floor(Math.random() * 3);
  const bumpMat = coralMat(`coral_brain_bump_mat_${id}`, color.clone().add(new Color(0.1, 0.1, 0.1)), 0.7);
  for (let b = 0; b < bumpCount; b++) {
    const angle = (b / bumpCount) * Math.PI * 2 + randomRange(-0.3, 0.3);
    const radius = 0.3 + randomRange(-0.05, 0.05);
    const bumpGeo = new SphereGeometry(0.08 + Math.random() * 0.06, 6, 6);
    const bump = new Mesh(bumpGeo, bumpMat);
    bump.name = `coral_brain_bump_${id}_${b}`;
    bump.position.set(Math.cos(angle) * radius, 0.15 + Math.random() * 0.12, Math.sin(angle) * radius);
    group.add(bump);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a staghorn coral — a short cylindrical base with 3-5 branching arms tipped with small spheres.
 *
 * @param color - Base color for the coral.
 * @param scale - Uniform scale multiplier.
 * @returns A Group containing the staghorn coral meshes.
 */
export function buildStaghornCoral(color: Color, scale: number): Group {
  const id = coralUid++;
  const group = new Group();
  group.name = `coral_staghorn_${id}`;

  const mat = coralMat(`coral_staghorn_mat_${id}`, color, 0.6);
  const tipMat = coralMat(`coral_staghorn_tip_mat_${id}`, color.clone().add(new Color(0.15, 0.15, 0.15)), 0.6);

  // Central base
  const baseGeo = new CylinderGeometry(0.1, 0.14, 0.2, 8);
  const base = new Mesh(baseGeo, mat);
  base.name = `coral_staghorn_base_${id}`;
  base.position.y = 0.1;
  group.add(base);

  // Branching arms (3-5)
  const armCount = 3 + Math.floor(Math.random() * 3);
  for (let a = 0; a < armCount; a++) {
    const armHeight = 0.4 + Math.random() * 0.4;
    const armGeo = new CylinderGeometry(0.02, 0.05, armHeight, 6);
    const arm = new Mesh(armGeo, mat);
    arm.name = `coral_staghorn_arm_${id}_${a}`;

    const angle = (a / armCount) * Math.PI * 2 + randomRange(-0.3, 0.3);
    arm.position.set(Math.cos(angle) * 0.06, 0.2 + armHeight / 2, Math.sin(angle) * 0.06);
    arm.rotation.z = randomRange(-0.4, 0.4);
    arm.rotation.x = randomRange(-0.3, 0.3);
    group.add(arm);

    // Sphere tip
    const tipGeo = new SphereGeometry(0.04, 6, 6);
    const tip = new Mesh(tipGeo, tipMat);
    tip.name = `coral_staghorn_tip_${id}_${a}`;
    tip.position.set(
      arm.position.x + Math.sin(arm.rotation.z) * armHeight * 0.5,
      arm.position.y + Math.cos(arm.rotation.z) * armHeight * 0.5,
      arm.position.z + Math.sin(arm.rotation.x) * armHeight * 0.5,
    );
    group.add(tip);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a fan coral — a thin stem topped with a flattened translucent fan shape.
 *
 * @param color - Base color for the coral.
 * @param scale - Uniform scale multiplier.
 * @returns A Group containing the fan coral meshes.
 */
export function buildFanCoral(color: Color, scale: number): Group {
  const id = coralUid++;
  const group = new Group();
  group.name = `coral_fan_${id}`;

  const stemMat = coralMat(`coral_fan_stem_mat_${id}`, color.clone().multiplyScalar(0.7), 0.5);
  const fanMaterial = coralMatTranslucent(`coral_fan_disc_mat_${id}`, color, 0.5, 0.9);

  // Stem
  const stemH = 0.35 + Math.random() * 0.2;
  const stemGeo = new CylinderGeometry(0.03, 0.05, stemH, 6);
  const stem = new Mesh(stemGeo, stemMat);
  stem.name = `coral_fan_stem_${id}`;
  stem.position.y = stemH / 2;
  group.add(stem);

  // Fan — flattened sphere
  const fanGeo = new SphereGeometry(0.35, 12, 10);
  const fan = new Mesh(fanGeo, fanMaterial);
  fan.name = `coral_fan_disc_${id}`;
  fan.position.y = stemH + 0.2;
  fan.scale.set(0.1, 1.0, 1.2);
  group.add(fan);

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a tube coral cluster — 3-5 upright tubes of varying heights, each capped with a small sphere.
 *
 * @param color - Base color for the coral.
 * @param scale - Uniform scale multiplier.
 * @returns A Group containing the tube coral meshes.
 */
export function buildTubeCoral(color: Color, scale: number): Group {
  const id = coralUid++;
  const group = new Group();
  group.name = `coral_tube_${id}`;

  const mat = coralMat(`coral_tube_mat_${id}`, color, 0.65);
  const capMat = coralMat(`coral_tube_cap_mat_${id}`, color.clone().add(new Color(0.12, 0.12, 0.12)), 0.65);

  const tubeCount = 3 + Math.floor(Math.random() * 3);
  for (let t = 0; t < tubeCount; t++) {
    const tubeH = 0.3 + Math.random() * 0.5;
    const tubeR = 0.04 + Math.random() * 0.025;
    const tubeGeo = new CylinderGeometry(tubeR, tubeR * 1.2, tubeH, 8);
    const tube = new Mesh(tubeGeo, mat);
    tube.name = `coral_tube_shaft_${id}_${t}`;
    tube.position.set(randomRange(-0.12, 0.12), tubeH / 2, randomRange(-0.12, 0.12));
    tube.rotation.z = randomRange(-0.15, 0.15);
    tube.rotation.x = randomRange(-0.15, 0.15);
    group.add(tube);

    // Sphere cap
    const capGeo = new SphereGeometry(tubeR * 1.2, 6, 6);
    const cap = new Mesh(capGeo, capMat);
    cap.name = `coral_tube_cap_${id}_${t}`;
    cap.position.set(tube.position.x, tube.position.y + tubeH / 2, tube.position.z);
    group.add(cap);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a mushroom coral — a thin stem topped with a wide flattened cap, with subtle emissive glow.
 *
 * @param color - Base color for the coral.
 * @param scale - Uniform scale multiplier.
 * @returns A Group containing the mushroom coral meshes.
 */
export function buildMushroomCoral(color: Color, scale: number): Group {
  const id = coralUid++;
  const group = new Group();
  group.name = `coral_mushroom_${id}`;

  const stemMat = coralMat(`coral_mushroom_stem_mat_${id}`, color.clone().multiplyScalar(0.7), 0.6);
  const capMaterial = coralMat(`coral_mushroom_cap_mat_${id}`, color, 0.6, 0.15);

  // Stem
  const stemH = 0.25 + Math.random() * 0.15;
  const stemGeo = new CylinderGeometry(0.04, 0.06, stemH, 6);
  const stem = new Mesh(stemGeo, stemMat);
  stem.name = `coral_mushroom_stem_${id}`;
  stem.position.y = stemH / 2;
  group.add(stem);

  // Cap — flattened sphere, wider than stem
  const capGeo = new SphereGeometry(0.22 + Math.random() * 0.1, 10, 8);
  const cap = new Mesh(capGeo, capMaterial);
  cap.name = `coral_mushroom_cap_${id}`;
  cap.position.y = stemH + 0.06;
  cap.scale.set(1, 0.4, 1);
  group.add(cap);

  group.scale.setScalar(scale);
  return group;
}

// ── Plant builders ──────────────────────────────────────────────────

/**
 * Builds a kelp plant — a small holdfast base with 3-5 tall, slightly curved fronds.
 *
 * @param color - Base color for the plant.
 * @param scale - Uniform scale multiplier.
 * @returns A Group containing the kelp meshes.
 */
export function buildKelp(color: Color, scale: number): Group {
  const id = plantUid++;
  const group = new Group();
  group.name = `seaweed_kelp_${id}`;

  const mat = plantMat(`seaweed_kelp_mat_${id}`, color);

  // Holdfast base
  const baseGeo = new SphereGeometry(0.08, 8, 6);
  const base = new Mesh(baseGeo, plantMat(`seaweed_kelp_base_mat_${id}`, color.clone().multiplyScalar(0.6)));
  base.name = `seaweed_kelp_base_${id}`;
  base.position.y = 0.02;
  base.scale.set(1.2, 0.6, 1.2);
  group.add(base);

  // Fronds (3-5)
  const frondCount = 3 + Math.floor(Math.random() * 3);
  for (let f = 0; f < frondCount; f++) {
    const frondH = 0.8 + Math.random() * 0.6;
    const frondGeo = new CylinderGeometry(0.015, 0.035, frondH, 6);
    const frond = new Mesh(frondGeo, mat);
    frond.name = `seaweed_kelp_frond_${id}_${f}`;
    const spread = randomRange(-0.06, 0.06);
    frond.position.set(spread, frondH / 2 + 0.04, randomRange(-0.04, 0.04));
    // Slight curve at the tip
    frond.rotation.z = randomRange(-0.2, 0.2);
    frond.rotation.x = randomRange(-0.15, 0.15);
    group.add(frond);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a sea grass patch — 5-8 thin blade-like shapes with slight random rotation.
 *
 * @param color - Base color for the plant.
 * @param scale - Uniform scale multiplier.
 * @returns A Group containing the sea grass meshes.
 */
export function buildSeaGrass(color: Color, scale: number): Group {
  const id = plantUid++;
  const group = new Group();
  group.name = `seaweed_grass_${id}`;

  const mat = plantMat(`seaweed_grass_mat_${id}`, color);

  const bladeCount = 5 + Math.floor(Math.random() * 4);
  for (let b = 0; b < bladeCount; b++) {
    const bladeH = 0.3 + Math.random() * 0.5;
    // Very thin box as a blade
    const bladeGeo = new BoxGeometry(0.01, bladeH, 0.04);
    const blade = new Mesh(bladeGeo, mat);
    blade.name = `seaweed_grass_blade_${id}_${b}`;
    blade.position.set(randomRange(-0.1, 0.1), bladeH / 2, randomRange(-0.08, 0.08));
    blade.rotation.z = randomRange(-0.25, 0.25);
    blade.rotation.y = randomRange(-0.4, 0.4);
    group.add(blade);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds an underwater fern — a central stem with 4-6 pairs of small flat leaves angled off each side.
 *
 * @param color - Base color for the plant.
 * @param scale - Uniform scale multiplier.
 * @returns A Group containing the fern meshes.
 */
export function buildFern(color: Color, scale: number): Group {
  const id = plantUid++;
  const group = new Group();
  group.name = `seaweed_fern_${id}`;

  const mat = plantMat(`seaweed_fern_mat_${id}`, color);

  // Central stem
  const stemH = 0.5 + Math.random() * 0.3;
  const stemGeo = new CylinderGeometry(0.015, 0.025, stemH, 6);
  const stem = new Mesh(stemGeo, mat);
  stem.name = `seaweed_fern_stem_${id}`;
  stem.position.y = stemH / 2;
  group.add(stem);

  // Leaf pairs (4-6)
  const leafPairs = 4 + Math.floor(Math.random() * 3);
  const leafMat = plantMat(`seaweed_fern_leaf_mat_${id}`, color.clone().multiplyScalar(0.85 + Math.random() * 0.3));
  for (let lp = 0; lp < leafPairs; lp++) {
    const leafY = 0.1 + (lp / leafPairs) * (stemH * 0.8);
    for (const side of [-1, 1]) {
      const leafW = 0.06 + Math.random() * 0.04;
      const leafH = 0.04 + Math.random() * 0.03;
      const leafGeo = new BoxGeometry(leafW, leafH, 0.005);
      const leaf = new Mesh(leafGeo, leafMat);
      leaf.name = `seaweed_fern_leaf_${id}_${lp}_${side > 0 ? 'r' : 'l'}`;
      leaf.position.set(side * (leafW / 2 + 0.015), leafY, 0);
      leaf.rotation.z = side * (0.3 + Math.random() * 0.3);
      group.add(leaf);
    }
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a moss patch — a low cluster of 6-10 tiny spheres hugging the ground.
 *
 * @param color - Base color for the moss.
 * @param scale - Uniform scale multiplier.
 * @returns A Group containing the moss meshes.
 */
export function buildMoss(color: Color, scale: number): Group {
  const id = plantUid++;
  const group = new Group();
  group.name = `seaweed_moss_${id}`;

  const mat = plantMat(`seaweed_moss_mat_${id}`, color);

  const blobCount = 6 + Math.floor(Math.random() * 5);
  for (let b = 0; b < blobCount; b++) {
    const r = 0.1 + Math.random() * 0.1;
    const blobGeo = new SphereGeometry(r, 6, 5);
    const blob = new Mesh(blobGeo, mat);
    blob.name = `seaweed_moss_blob_${id}_${b}`;
    blob.position.set(randomRange(-0.15, 0.15), r * 0.4, randomRange(-0.15, 0.15));
    blob.scale.set(1, 0.5 + Math.random() * 0.3, 1);
    group.add(blob);
  }

  group.scale.setScalar(scale);
  return group;
}

// ── Dispatcher functions ────────────────────────────────────────────

/**
 * Builds a coral of the specified type with optional color and scale overrides.
 * Uses a random color from the coral palette when no color is provided.
 *
 * @param type - The coral morphology to build.
 * @param color - Optional base color; defaults to a random coral palette color.
 * @param scale - Optional uniform scale; defaults to 1.0.
 * @returns A Group containing the assembled coral meshes.
 */
export function buildCoral(type: CoralType, color?: Color, scale?: number): Group {
  const c = color ?? pick(CORAL_COLORS).clone();
  const s = scale ?? 1.0;

  switch (type) {
    case 'brain':
      return buildBrainCoral(c, s);
    case 'staghorn':
      return buildStaghornCoral(c, s);
    case 'fan':
      return buildFanCoral(c, s);
    case 'tube':
      return buildTubeCoral(c, s);
    case 'mushroom':
      return buildMushroomCoral(c, s);
  }
}

/**
 * Builds a plant of the specified type with optional color and scale overrides.
 * Uses a random color from the plant palette when no color is provided.
 *
 * @param type - The plant morphology to build.
 * @param color - Optional base color; defaults to a random plant palette color.
 * @param scale - Optional uniform scale; defaults to 1.0.
 * @returns A Group containing the assembled plant meshes.
 */
export function buildPlant(type: PlantType, color?: Color, scale?: number): Group {
  const c = color ?? pick(PLANT_COLORS).clone();
  const s = scale ?? 1.0;

  switch (type) {
    case 'kelp':
      return buildKelp(c, s);
    case 'seaGrass':
      return buildSeaGrass(c, s);
    case 'fern':
      return buildFern(c, s);
    case 'moss':
      return buildMoss(c, s);
  }
}
