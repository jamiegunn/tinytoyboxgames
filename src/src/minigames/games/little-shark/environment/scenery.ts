import { Scene, Mesh, Group, Color, Vector3, SphereGeometry, CylinderGeometry, BoxGeometry, CircleGeometry, PlaneGeometry, MeshStandardMaterial } from 'three';
import { createCoralMaterial, createSandMaterial, createLeafMaterial, createMetalMaterial } from '@app/minigames/shared/materials';
import { buildDetailedRock } from '@app/minigames/shared/meshBuilders';
import { randomRange } from '../helpers';
import { CAUSTIC_LIGHT_COUNT } from '../types';

/**
 * Low-level mesh and light constructors for the underwater environment.
 * Pure constructors — take a Scene and return positioned meshes.
 */

/** A caustic light represented as a small emissive sphere. */
export interface CausticLight {
  mesh: Mesh;
  intensity: number;
}

/**
 * Builds the ocean floor with sand dunes, ripples, and terrain variation.
 * @param scene - The Three.js scene.
 * @returns The reef floor mesh.
 */
export function buildReefFloor(scene: Scene): Mesh {
  // Main sandy floor
  const geo = new CircleGeometry(10, 64);
  geo.rotateX(-Math.PI / 2);
  const mat = createSandMaterial('reefFloorMat', new Color(0.92, 0.85, 0.65));
  const reefFloor = new Mesh(geo, mat);
  reefFloor.name = 'reef_floor';
  reefFloor.position.y = -0.5;
  scene.add(reefFloor);

  // Sand dunes — overlapping humps for terrain variation
  const dunePositions: [number, number, number, number][] = [
    [-4, -0.35, -3, 1.8],
    [3, -0.3, 4, 2.2],
    [-6, -0.4, 2, 1.5],
    [5, -0.38, -4, 1.6],
    [0, -0.32, -5, 2.0],
    [-2, -0.36, 5, 1.4],
  ];
  for (let i = 0; i < dunePositions.length; i++) {
    const [dx, dy, dz, size] = dunePositions[i];
    const duneGeo = new SphereGeometry(size, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const duneMat = createSandMaterial(`duneMat_${i}`, new Color(0.72 + Math.random() * 0.06, 0.66 + Math.random() * 0.06, 0.46 + Math.random() * 0.06));
    const dune = new Mesh(duneGeo, duneMat);
    dune.name = `reef_dune_${i}`;
    dune.position.set(dx, dy, dz);
    dune.scale.set(1, 0.15, 1);
    scene.add(dune);
  }

  // Sand ripple lines — thin stretched cylinders on the floor
  for (let r = 0; r < 8; r++) {
    const rippleGeo = new CylinderGeometry(0.02, 0.02, 2 + Math.random() * 3, 4);
    const rippleMat = createSandMaterial(`rippleMat_${r}`, new Color(0.68, 0.62, 0.44));
    const ripple = new Mesh(rippleGeo, rippleMat);
    ripple.name = `reef_ripple_${r}`;
    ripple.rotation.x = Math.PI / 2;
    ripple.rotation.z = randomRange(-0.2, 0.2);
    ripple.position.set(randomRange(-7, 7), -0.48, randomRange(-7, 7));
    ripple.scale.set(1, 1, 0.3);
    scene.add(ripple);
  }

  // Scattered shells on the floor
  const shellColors = [new Color(0.95, 0.88, 0.75), new Color(0.9, 0.75, 0.6), new Color(0.85, 0.82, 0.9), new Color(1.0, 0.85, 0.7)];
  for (let s = 0; s < 8; s++) {
    const shellGeo = new SphereGeometry(0.08 + Math.random() * 0.06, 8, 6, 0, Math.PI);
    const shellMat = createSandMaterial(`shellMat_${s}`, shellColors[s % shellColors.length]);
    const shell = new Mesh(shellGeo, shellMat);
    shell.name = `reef_shell_${s}`;
    shell.position.set(randomRange(-7, 7), -0.47, randomRange(-7, 7));
    shell.rotation.y = Math.random() * Math.PI * 2;
    shell.rotation.z = randomRange(-0.3, 0.3);
    shell.scale.set(1.2, 0.4, 1);
    scene.add(shell);
  }

  // Starfish on the floor
  const starfishColors = [new Color(1.0, 0.35, 0.2), new Color(0.95, 0.6, 0.15), new Color(0.85, 0.25, 0.4)];
  const starfishPositions: [number, number][] = [
    [-3.5, 2.5],
    [4, -3],
    [-5.5, -1],
  ];
  for (let sf = 0; sf < starfishPositions.length; sf++) {
    const [sfx, sfz] = starfishPositions[sf];
    const sfGroup = new Group();
    sfGroup.name = `reef_starfish_${sf}`;
    sfGroup.position.set(sfx, -0.45, sfz);
    sfGroup.rotation.y = Math.random() * Math.PI * 2;

    const sfMat = createCoralMaterial(`starfishMat_${sf}`, starfishColors[sf]);
    // 5 arms
    for (let arm = 0; arm < 5; arm++) {
      const angle = (arm / 5) * Math.PI * 2;
      const armGeo = new CylinderGeometry(0.02, 0.06, 0.25, 6);
      const armMesh = new Mesh(armGeo, sfMat);
      armMesh.position.set(Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12);
      armMesh.rotation.z = Math.PI / 2;
      armMesh.rotation.y = -angle;
      armMesh.scale.set(0.5, 1, 1);
      sfGroup.add(armMesh);
    }
    // Center body
    const centerGeo = new SphereGeometry(0.06, 8, 6);
    const center = new Mesh(centerGeo, sfMat);
    center.scale.set(1, 0.3, 1);
    sfGroup.add(center);

    scene.add(sfGroup);
  }

  return reefFloor;
}

/**
 * Builds the ocean surface with gentle shimmer.
 * @param scene - The Three.js scene.
 * @returns The water surface group.
 */
export function buildOceanSurface(scene: Scene): Group {
  const parent = new Group();
  parent.name = 'water_parent';
  parent.position.set(0, 2.5, 0);

  // Surface plane — covers the full infinite reef
  const surfaceGeo = new PlaneGeometry(140, 140);
  surfaceGeo.rotateX(-Math.PI / 2);
  const surfaceMat = new MeshStandardMaterial({
    color: new Color(0.25, 0.55, 0.8),
    metalness: 0.15,
    roughness: 0.1,
    transparent: true,
    opacity: 0.12,
    emissive: new Color(0.06, 0.15, 0.3),
  });
  surfaceMat.name = 'water_surface_mat';
  const surface = new Mesh(surfaceGeo, surfaceMat);
  surface.name = 'water_surface';
  surface.raycast = () => {}; // Let taps pass through to the reef floor below
  parent.add(surface);

  // Light rays from surface — translucent vertical planes
  for (let ray = 0; ray < 6; ray++) {
    const rayGeo = new PlaneGeometry(0.3, 3);
    const rayMat = new MeshStandardMaterial({
      color: new Color(0.4, 0.7, 1.0),
      emissive: new Color(0.2, 0.4, 0.6),
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.06,
      side: 2, // DoubleSide
    });
    rayMat.name = `lightRayMat_${ray}`;
    const rayMesh = new Mesh(rayGeo, rayMat);
    rayMesh.name = `lightRay_${ray}`;
    rayMesh.position.set(randomRange(-30, 30), -1.5, randomRange(-30, 30));
    rayMesh.rotation.y = randomRange(0, Math.PI);
    rayMesh.scale.set(1 + Math.random(), 1, 1);
    rayMesh.raycast = () => {}; // Don't intercept taps
    parent.add(rayMesh);
  }

  scene.add(parent);
  return parent;
}

/**
 * Builds lush coral reef clusters with varied types.
 * @param scene - The Three.js scene.
 * @returns Array of coral meshes.
 */
export function buildCorals(scene: Scene): Mesh[] {
  const corals: Mesh[] = [];
  const coralColors = [
    new Color(1.0, 0.35, 0.45),
    new Color(1.0, 0.55, 0.15),
    new Color(0.85, 0.25, 0.75),
    new Color(0.2, 0.85, 0.55),
    new Color(1.0, 0.75, 0.25),
    new Color(0.4, 0.6, 1.0),
    new Color(0.95, 0.4, 0.7),
    new Color(0.3, 0.8, 0.9),
  ];
  const positions: [number, number][] = [
    [-5, -5],
    [5.5, -4.5],
    [-5.5, 5],
    [5, 5],
    [-6.5, 0],
    [6.5, 0],
    [0, -6.5],
    [0, 6.5],
    [-3.5, -6],
    [3.5, 6],
  ];

  for (let i = 0; i < positions.length; i++) {
    const [px, pz] = positions[i];
    const color = coralColors[i % coralColors.length];
    const coralMat = createCoralMaterial(`coralMat_main_${i}`, color);
    const coralBranchMat = createCoralMaterial(`coralMat_branch_${i}`, color.clone().multiplyScalar(0.75));
    const coralLightMat = createCoralMaterial(`coralMat_light_${i}`, color.clone().add(new Color(0.15, 0.15, 0.15)));

    const type = i % 4;

    if (type === 0) {
      // Brain coral — large bumpy sphere
      const sphereGeo = new SphereGeometry(0.5 + Math.random() * 0.3, 16, 16);
      const sphere = new Mesh(sphereGeo, coralMat);
      sphere.name = `coral_s_${i}`;
      sphere.position.set(px + randomRange(-0.3, 0.3), -0.25, pz + randomRange(-0.3, 0.3));
      sphere.scale.set(1, 0.7, 1);
      scene.add(sphere);
      corals.push(sphere);

      // Bump texture spheres on the brain coral
      for (let b = 0; b < 5; b++) {
        const bumpGeo = new SphereGeometry(0.08 + Math.random() * 0.06, 6, 6);
        const bump = new Mesh(bumpGeo, coralLightMat);
        bump.name = `coral_bump_${i}_${b}`;
        const angle = (b / 5) * Math.PI * 2;
        const r = 0.3 + Math.random() * 0.1;
        bump.position.set(sphere.position.x + Math.cos(angle) * r, sphere.position.y + 0.2 + Math.random() * 0.1, sphere.position.z + Math.sin(angle) * r);
        scene.add(bump);
        corals.push(bump);
      }
    } else if (type === 1) {
      // Branching staghorn coral — multiple branching cylinders
      for (let b = 0; b < 4; b++) {
        const branchHeight = 0.6 + Math.random() * 0.5;
        const branchGeo = new CylinderGeometry(0.03, 0.08, branchHeight, 8);
        const branch = new Mesh(branchGeo, coralMat);
        branch.name = `coral_stag_${i}_${b}`;
        branch.position.set(px + randomRange(-0.3, 0.3), branchHeight / 2 - 0.4, pz + randomRange(-0.3, 0.3));
        branch.rotation.z = randomRange(-0.4, 0.4);
        branch.rotation.x = randomRange(-0.2, 0.2);
        scene.add(branch);
        corals.push(branch);

        // Forked tips
        for (let t = 0; t < 2; t++) {
          const tipHeight = 0.2 + Math.random() * 0.15;
          const tipGeo = new CylinderGeometry(0.015, 0.03, tipHeight, 6);
          const tip = new Mesh(tipGeo, coralBranchMat);
          tip.name = `coral_stagtip_${i}_${b}_${t}`;
          tip.position.set(
            branch.position.x + randomRange(-0.1, 0.1),
            branch.position.y + branchHeight / 2 + tipHeight / 2 - 0.05,
            branch.position.z + randomRange(-0.1, 0.1),
          );
          tip.rotation.z = (t === 0 ? -1 : 1) * (0.3 + Math.random() * 0.3);
          scene.add(tip);
          corals.push(tip);
        }
      }
    } else if (type === 2) {
      // Fan coral — flat disc on a stalk
      const stalkH = 0.4 + Math.random() * 0.3;
      const stalkGeo = new CylinderGeometry(0.04, 0.07, stalkH, 8);
      const stalk = new Mesh(stalkGeo, coralBranchMat);
      stalk.name = `coral_fanstalk_${i}`;
      stalk.position.set(px, stalkH / 2 - 0.4, pz);
      scene.add(stalk);
      corals.push(stalk);

      const fanGeo = new CircleGeometry(0.4 + Math.random() * 0.2, 16);
      const fan = new Mesh(fanGeo, coralMat);
      fan.name = `coral_fan_${i}`;
      fan.position.set(px, stalkH - 0.1, pz);
      fan.rotation.x = -0.3;
      fan.rotation.y = randomRange(0, Math.PI * 2);
      scene.add(fan);
      corals.push(fan);

      // Vein lines on the fan
      for (let v = 0; v < 3; v++) {
        const veinGeo = new CylinderGeometry(0.005, 0.005, 0.3, 4);
        const vein = new Mesh(veinGeo, coralLightMat);
        vein.name = `coral_vein_${i}_${v}`;
        vein.position.copy(fan.position);
        vein.position.y += 0.01;
        vein.rotation.set(fan.rotation.x, randomRange(0, Math.PI), 0);
        scene.add(vein);
        corals.push(vein);
      }
    } else {
      // Tube coral cluster — grouped cylinders with rounded tops
      for (let t = 0; t < 5; t++) {
        const tubeH = 0.3 + Math.random() * 0.4;
        const tubeR = 0.04 + Math.random() * 0.03;
        const tubeGeo = new CylinderGeometry(tubeR, tubeR * 1.2, tubeH, 8);
        const tube = new Mesh(tubeGeo, coralMat);
        tube.name = `coral_tube_${i}_${t}`;
        tube.position.set(px + randomRange(-0.2, 0.2), tubeH / 2 - 0.4, pz + randomRange(-0.2, 0.2));
        scene.add(tube);
        corals.push(tube);

        // Rounded top
        const topGeo = new SphereGeometry(tubeR * 1.1, 6, 6);
        const top = new Mesh(topGeo, coralLightMat);
        top.name = `coral_tubetop_${i}_${t}`;
        top.position.set(tube.position.x, tube.position.y + tubeH / 2, tube.position.z);
        scene.add(top);
        corals.push(top);
      }
    }
  }

  return corals;
}

/**
 * Builds tall kelp-like seaweed with broad fronds and holdfast bases.
 * @param scene - The Three.js scene.
 * @returns Array of seaweed meshes.
 */
export function buildSeaweed(scene: Scene): Mesh[] {
  const seaweeds: Mesh[] = [];
  const seaweedPositions: [number, number][] = [
    [-4, -3],
    [3, -4],
    [-3, 4],
    [4, 3],
    [-1, -5.5],
    [2, 5.5],
    [-5.5, 1],
    [5.5, -1],
  ];

  for (let i = 0; i < seaweedPositions.length; i++) {
    const [sx, sz] = seaweedPositions[i];
    const height = 1.2 + Math.random() * 0.8;
    const seaweedColor = new Color(0.08 + Math.random() * 0.1, 0.45 + Math.random() * 0.2, 0.12 + Math.random() * 0.1);

    // Holdfast base — wider cylinder at bottom
    const holdfastGeo = new CylinderGeometry(0.06, 0.15, 0.15, 8);
    const holdfastMat = createLeafMaterial(`seaweedBase_${i}`, seaweedColor.clone().multiplyScalar(0.6));
    const holdfast = new Mesh(holdfastGeo, holdfastMat);
    holdfast.name = `seaweed_base_${i}`;
    holdfast.position.set(sx, -0.42, sz);
    scene.add(holdfast);
    seaweeds.push(holdfast);

    // Main stalk — tapered
    const weedGeo = new CylinderGeometry(0.03, 0.07, height, 8);
    const weed = new Mesh(weedGeo, createLeafMaterial(`seaweedMat_${i}`, seaweedColor));
    weed.name = `seaweed_${i}`;
    weed.position.set(sx, height / 2 - 0.35, sz);
    scene.add(weed);
    seaweeds.push(weed);

    // Broad leaf fronds
    const frondCount = 3 + Math.floor(Math.random() * 3);
    for (let f = 0; f < frondCount; f++) {
      const frondHeight = 0.35 + Math.random() * 0.25;
      const frondY = -0.2 + (f / frondCount) * (height * 0.75);
      const side = f % 2 === 0 ? 1 : -1;

      // Broader leaf shape (flattened box)
      const frondGeo = new BoxGeometry(0.15 + Math.random() * 0.1, frondHeight, 0.02);
      const frondColor = seaweedColor.clone().multiplyScalar(0.8 + Math.random() * 0.4);
      const frond = new Mesh(frondGeo, createLeafMaterial(`seaweedFrondMat_${i}_${f}`, frondColor));
      frond.name = `seaweed_frond_${i}_${f}`;
      frond.position.set(sx + side * (0.08 + Math.random() * 0.04), frondY + height / 2 - 0.35, sz + (Math.random() - 0.5) * 0.08);
      frond.rotation.z = side * (0.4 + Math.random() * 0.5);
      frond.rotation.y = randomRange(-0.3, 0.3);
      scene.add(frond);
      seaweeds.push(frond);
    }
  }

  return seaweeds;
}

/**
 * Builds sea anemones with waving tentacles.
 * @param scene - The Three.js scene.
 * @returns Array of anemone meshes.
 */
export function buildAnemones(scene: Scene): Mesh[] {
  const anemones: Mesh[] = [];
  const anemonePositions: [number, number][] = [
    [-8, -15],
    [12, 8],
    [-20, 10],
    [5, -22],
    [-15, 25],
    [25, -10],
    [0, 30],
    [-30, -5],
  ];
  const anemoneColors = [
    new Color(0.9, 0.3, 0.5),
    new Color(0.4, 0.9, 0.7),
    new Color(1.0, 0.6, 0.2),
    new Color(0.6, 0.3, 0.9),
    new Color(0.9, 0.3, 0.5),
    new Color(0.4, 0.9, 0.7),
    new Color(1.0, 0.6, 0.2),
    new Color(0.6, 0.3, 0.9),
  ];

  for (let a = 0; a < anemonePositions.length; a++) {
    const [ax, az] = anemonePositions[a];
    const color = anemoneColors[a];
    const aMat = createCoralMaterial(`anemoneMat_${a}`, color);
    const aTipMat = createCoralMaterial(`anemoneTipMat_${a}`, color.clone().add(new Color(0.2, 0.2, 0.2)));

    // Base disc
    const baseGeo = new CylinderGeometry(0.2, 0.25, 0.12, 12);
    const base = new Mesh(baseGeo, aMat);
    base.name = `anemone_base_${a}`;
    base.position.set(ax, -0.38, az);
    scene.add(base);
    anemones.push(base);

    // Tentacles
    const tentacleCount = 8 + Math.floor(Math.random() * 4);
    for (let t = 0; t < tentacleCount; t++) {
      const angle = (t / tentacleCount) * Math.PI * 2;
      const tentacleH = 0.25 + Math.random() * 0.2;
      const tentGeo = new CylinderGeometry(0.008, 0.018, tentacleH, 6);
      const tent = new Mesh(tentGeo, aMat);
      tent.name = `anemone_tent_${a}_${t}`;
      const radius = 0.1 + Math.random() * 0.08;
      tent.position.set(ax + Math.cos(angle) * radius, tentacleH / 2 - 0.3, az + Math.sin(angle) * radius);
      tent.rotation.z = (Math.random() - 0.5) * 0.3;
      scene.add(tent);
      anemones.push(tent);

      // Glowing tip
      const tipGeo = new SphereGeometry(0.015, 6, 6);
      const tip = new Mesh(tipGeo, aTipMat);
      tip.name = `anemone_tip_${a}_${t}`;
      tip.position.set(tent.position.x, tent.position.y + tentacleH / 2, tent.position.z);
      scene.add(tip);
      anemones.push(tip);
    }
  }

  return anemones;
}

/**
 * Builds underwater rock formations.
 * @param scene - The Three.js scene.
 * @returns Array of rock groups.
 */
export function buildRocks(scene: Scene): Group[] {
  const rocks: Group[] = [];
  const rockPositions: [number, number, number][] = [
    [-18, -0.4, -12],
    [20, -0.4, 8],
    [-10, -0.4, -25],
    [15, -0.4, 22],
    [-25, -0.4, 15],
    [28, -0.4, -5],
    [-30, -0.4, -20],
    [8, -0.4, 35],
    [-35, -0.4, 5],
    [22, -0.4, -28],
    [-5, -0.4, -38],
    [38, -0.4, 12],
  ];

  for (const [rx, ry, rz] of rockPositions) {
    const rock = buildDetailedRock(
      new Vector3(rx, ry, rz),
      0.6 + Math.random() * 0.5,
      new Color(0.3 + Math.random() * 0.1, 0.33 + Math.random() * 0.08, 0.35 + Math.random() * 0.1),
    );
    scene.add(rock);
    rocks.push(rock);
  }

  return rocks;
}

/**
 * Builds a detailed treasure chest with lid, bands, keyhole, and spilling coins.
 * @param scene - The Three.js scene.
 * @returns The treasure chest root mesh (the body box).
 */
export function buildTreasureChest(scene: Scene): Mesh {
  const chestX = 4.5;
  const chestZ = -4.5;

  // Body
  const bodyGeo = new BoxGeometry(0.7, 0.4, 0.45);
  const woodMat = createMetalMaterial('treasureWoodMat', new Color(0.5, 0.3, 0.08));
  const body = new Mesh(bodyGeo, woodMat);
  body.name = 'treasure_chest';
  body.position.set(chestX, -0.28, chestZ);
  scene.add(body);

  // Rounded lid (half cylinder)
  const lidGeo = new CylinderGeometry(0.225, 0.225, 0.7, 12, 1, false, 0, Math.PI);
  const lid = new Mesh(lidGeo, woodMat);
  lid.name = 'treasure_lid';
  lid.position.set(chestX, -0.08, chestZ);
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  scene.add(lid);

  // Metal bands
  const bandMat = createMetalMaterial('treasureBandMat', new Color(0.3, 0.28, 0.25));
  for (let b = 0; b < 3; b++) {
    const bandGeo = new BoxGeometry(0.05, 0.42, 0.48);
    const band = new Mesh(bandGeo, bandMat);
    band.name = `treasure_band_${b}`;
    band.position.set(chestX + (b - 1) * 0.25, -0.27, chestZ);
    scene.add(band);
  }

  // Keyhole
  const keyGeo = new CylinderGeometry(0.025, 0.025, 0.02, 8);
  const keyMat = createMetalMaterial('treasureKeyMat', new Color(0.7, 0.6, 0.1));
  const keyhole = new Mesh(keyGeo, keyMat);
  keyhole.name = 'treasure_keyhole';
  keyhole.position.set(chestX, -0.15, chestZ + 0.23);
  keyhole.rotation.x = Math.PI / 2;
  scene.add(keyhole);

  // Gold coins spilling out
  const coinMat = createMetalMaterial('treasureCoinMat', new Color(0.95, 0.8, 0.15));
  for (let c = 0; c < 6; c++) {
    const coinGeo = new CylinderGeometry(0.05, 0.05, 0.015, 10);
    const coin = new Mesh(coinGeo, coinMat);
    coin.name = `treasure_coin_${c}`;
    coin.position.set(chestX + randomRange(-0.4, 0.4), -0.47 + Math.random() * 0.02, chestZ + randomRange(-0.3, 0.3));
    coin.rotation.x = Math.PI / 2 + randomRange(-0.3, 0.3);
    coin.rotation.z = Math.random() * Math.PI;
    scene.add(coin);
  }

  return body;
}

/**
 * Creates caustic-simulating emissive spheres for underwater light patterns.
 * @param scene - The Three.js scene.
 * @returns Array of caustic light objects.
 */
export function buildCausticLights(scene: Scene): CausticLight[] {
  const causticLights: CausticLight[] = [];
  for (let i = 0; i < CAUSTIC_LIGHT_COUNT; i++) {
    const angle = (i / CAUSTIC_LIGHT_COUNT) * Math.PI * 2;
    const cx = Math.cos(angle) * 15;
    const cz = Math.sin(angle) * 15;
    const geo = new SphereGeometry(0.25, 10, 10);
    const mat = new MeshStandardMaterial({
      color: new Color(0.35, 0.65, 1.0),
      emissive: new Color(0.3, 0.6, 1.0),
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.35,
    });
    mat.name = `caustic_mat_${i}`;
    const mesh = new Mesh(geo, mat);
    mesh.name = `caustic_${i}`;
    mesh.position.set(cx, 1.5, cz);
    scene.add(mesh);
    causticLights.push({ mesh, intensity: 0.2 });
  }

  // Extra floor caustic patches — flat bright spots on the sand
  for (let i = 0; i < 6; i++) {
    const patchGeo = new CircleGeometry(0.3 + Math.random() * 0.4, 12);
    patchGeo.rotateX(-Math.PI / 2);
    const patchMat = new MeshStandardMaterial({
      color: new Color(0.4, 0.65, 0.85),
      emissive: new Color(0.3, 0.5, 0.7),
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0.12,
    });
    patchMat.name = `caustic_patch_mat_${i}`;
    const patch = new Mesh(patchGeo, patchMat);
    patch.name = `caustic_patch_${i}`;
    patch.position.set(randomRange(-25, 25), -0.48, randomRange(-25, 25));
    scene.add(patch);
  }

  return causticLights;
}

/**
 * Builds underwater background walls to create enclosed ocean feel.
 * @param scene - The Three.js scene.
 */
export function buildOceanWalls(scene: Scene): void {
  const wallDist = 10;
  const wallH = 6;
  const wallW = 22;
  const wallMat = new MeshStandardMaterial({
    color: new Color(0.12, 0.32, 0.55),
    emissive: new Color(0.08, 0.2, 0.4),
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.7,
  });
  wallMat.name = 'oceanWallMat';

  // 4 walls forming a box
  const wallGeo = new PlaneGeometry(wallW, wallH);
  const wallPositions: [Vector3, number][] = [
    [new Vector3(0, wallH / 2 - 1, -wallDist), 0],
    [new Vector3(0, wallH / 2 - 1, wallDist), Math.PI],
    [new Vector3(-wallDist, wallH / 2 - 1, 0), Math.PI / 2],
    [new Vector3(wallDist, wallH / 2 - 1, 0), -Math.PI / 2],
  ];

  for (let w = 0; w < wallPositions.length; w++) {
    const [pos, rotY] = wallPositions[w];
    const wall = new Mesh(wallGeo, wallMat);
    wall.name = `ocean_wall_${w}`;
    wall.position.copy(pos);
    wall.rotation.y = rotY;
    wall.raycast = () => {}; // Don't intercept taps
    scene.add(wall);
  }
}
