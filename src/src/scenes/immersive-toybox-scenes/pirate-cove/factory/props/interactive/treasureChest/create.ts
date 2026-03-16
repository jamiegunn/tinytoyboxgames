/**
 * Builds the tappable treasure chest prop.
 *
 * A wooden chest with gold trim. The lid is a separate group so it can be
 * animated to open and close on tap.
 */

import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { PirateCoveMaterials } from '../../../../materials';
import {
  BAND_HEIGHT,
  BAND_INSET,
  CHEST_DEPTH,
  CHEST_HEIGHT,
  CHEST_WIDTH,
  COIN_HEIGHT,
  COIN_RADIUS,
  GEM_RADIUS,
  GOBLET_HEIGHT,
  GOBLET_RADIUS,
  LATCH_HEIGHT,
  LATCH_WIDTH,
  LID_HEIGHT,
  NECKLACE_RADIUS,
  NECKLACE_TUBE_RADIUS,
} from './constants';

/** Per-instance gem material — each gem has a unique color so no sharing. */
function gemMat(color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.2 });
}

/** Shared dependencies required to build one treasure chest. */
export interface TreasureChestBuildOptions {
  materials: Pick<PirateCoveMaterials, 'chestWood' | 'gold' | 'metal'>;
}

/** Typed handles returned to the interaction layer after mesh creation. */
export interface TreasureChestCreateResult {
  root: Group;
  lid: Group;
  tapTarget: Mesh;
}

/**
 * Creates one staged treasure chest instance.
 *
 * @param scene - Scene that should receive the chest.
 * @param placement - World placement from staging.
 * @param options - Shared materials.
 * @returns Typed handles needed by the interaction layer.
 */
export function createTreasureChest(scene: Scene, placement: EntityPlacement, options: TreasureChestBuildOptions): TreasureChestCreateResult {
  const root = createEntityRoot('treasure_chest_prop', placement, scene);

  // Chest body (box)
  const body = new Mesh(new BoxGeometry(CHEST_WIDTH, CHEST_HEIGHT, CHEST_DEPTH), options.materials.chestWood);
  body.name = 'chest_body';
  body.position.y = CHEST_HEIGHT / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // Gold bands on the body
  const bandPositions = [CHEST_HEIGHT * 0.2, CHEST_HEIGHT * 0.8];
  bandPositions.forEach((y, i) => {
    const band = new Mesh(new BoxGeometry(CHEST_WIDTH + BAND_INSET, BAND_HEIGHT, CHEST_DEPTH + BAND_INSET), options.materials.gold);
    band.name = `chest_body_band_${i}`;
    band.position.y = y;
    band.castShadow = true;
    root.add(band);
  });

  // Lid group — pivot point is at the back edge of the chest body top
  const lid = new Group();
  lid.name = 'chest_lid_pivot';
  lid.position.set(0, CHEST_HEIGHT, -CHEST_DEPTH / 2);
  root.add(lid);

  // Lid box (offset so it rotates from the back edge)
  const lidBox = new Mesh(new BoxGeometry(CHEST_WIDTH, LID_HEIGHT, CHEST_DEPTH), options.materials.chestWood);
  lidBox.name = 'chest_lid';
  lidBox.position.set(0, LID_HEIGHT / 2, CHEST_DEPTH / 2);
  lidBox.castShadow = true;
  lid.add(lidBox);

  // Gold band on the lid
  const lidBand = new Mesh(new BoxGeometry(CHEST_WIDTH + BAND_INSET, BAND_HEIGHT, CHEST_DEPTH + BAND_INSET), options.materials.gold);
  lidBand.name = 'chest_lid_band';
  lidBand.position.set(0, LID_HEIGHT * 0.5, CHEST_DEPTH / 2);
  lid.add(lidBand);

  // Front latch
  const latch = new Mesh(new BoxGeometry(LATCH_WIDTH, LATCH_HEIGHT, 0.04), options.materials.gold);
  latch.name = 'chest_latch';
  latch.position.set(0, CHEST_HEIGHT * 0.85, CHEST_DEPTH / 2 + 0.02);
  root.add(latch);

  // Corner studs (gold cylinders)
  const corners = [
    { x: -CHEST_WIDTH / 2, z: -CHEST_DEPTH / 2 },
    { x: CHEST_WIDTH / 2, z: -CHEST_DEPTH / 2 },
    { x: -CHEST_WIDTH / 2, z: CHEST_DEPTH / 2 },
    { x: CHEST_WIDTH / 2, z: CHEST_DEPTH / 2 },
  ];
  corners.forEach((pos, i) => {
    const stud = new Mesh(new CylinderGeometry(0.03, 0.03, CHEST_HEIGHT, 8), options.materials.gold);
    stud.name = `chest_corner_stud_${i}`;
    stud.position.set(pos.x, CHEST_HEIGHT / 2, pos.z);
    root.add(stud);
  });

  // ── Overflowing treasure ──────────────────────────────────────────────────

  const hd = CHEST_DEPTH / 2; // shorthand for half-depth

  // Gold coins — heaped inside, spilling over every edge, scattered on deck
  const coinPlacements = [
    // Heaped inside the chest
    { x: 0.1, y: CHEST_HEIGHT * 0.85, z: 0, rotX: 0.1, rotZ: 0 },
    { x: -0.15, y: CHEST_HEIGHT * 0.82, z: 0.05, rotX: -0.05, rotZ: 0.2 },
    { x: 0.2, y: CHEST_HEIGHT * 0.78, z: -0.08, rotX: 0, rotZ: -0.15 },
    { x: -0.22, y: CHEST_HEIGHT * 0.88, z: -0.1, rotX: 0.08, rotZ: 0.1 },
    { x: 0.05, y: CHEST_HEIGHT * 0.92, z: 0.12, rotX: -0.1, rotZ: -0.05 },
    { x: -0.08, y: CHEST_HEIGHT * 0.86, z: 0.15, rotX: 0.12, rotZ: 0.3 },
    { x: 0.25, y: CHEST_HEIGHT * 0.83, z: 0.08, rotX: 0.05, rotZ: -0.2 },
    // Spilling over the front edge
    { x: 0.08, y: CHEST_HEIGHT * 0.6, z: hd + 0.05, rotX: 0.4, rotZ: 0.1 },
    { x: -0.12, y: CHEST_HEIGHT * 0.5, z: hd + 0.1, rotX: 0.6, rotZ: -0.2 },
    { x: 0.2, y: CHEST_HEIGHT * 0.45, z: hd + 0.12, rotX: 0.5, rotZ: 0.3 },
    // Spilling over the sides
    { x: CHEST_WIDTH / 2 + 0.04, y: CHEST_HEIGHT * 0.55, z: 0.05, rotX: 0.3, rotZ: 0.7 },
    { x: -CHEST_WIDTH / 2 - 0.03, y: CHEST_HEIGHT * 0.5, z: -0.1, rotX: 0.4, rotZ: -0.5 },
    // Trail on the ground — front
    { x: 0.25, y: 0.01, z: hd + 0.25, rotX: Math.PI / 2, rotZ: 0.3 },
    { x: -0.3, y: 0.01, z: hd + 0.35, rotX: Math.PI / 2, rotZ: -0.5 },
    { x: 0.15, y: 0.01, z: hd + 0.5, rotX: Math.PI / 2, rotZ: 1.2 },
    { x: -0.05, y: 0.01, z: hd + 0.6, rotX: Math.PI / 2, rotZ: 0.7 },
    { x: 0.35, y: 0.01, z: hd + 0.4, rotX: Math.PI / 2, rotZ: -0.3 },
    // Trail on the ground — sides
    { x: 0.55, y: 0.01, z: 0.15, rotX: Math.PI / 2, rotZ: 0.8 },
    { x: -0.58, y: 0.01, z: 0.05, rotX: Math.PI / 2, rotZ: -0.1 },
    { x: 0.62, y: 0.01, z: -0.1, rotX: Math.PI / 2, rotZ: 0.4 },
    { x: -0.52, y: 0.01, z: -0.2, rotX: Math.PI / 2, rotZ: 1.0 },
    // Behind the chest
    { x: 0.1, y: 0.01, z: -hd - 0.2, rotX: Math.PI / 2, rotZ: -0.6 },
    { x: -0.18, y: 0.01, z: -hd - 0.15, rotX: Math.PI / 2, rotZ: 0.9 },
  ];
  coinPlacements.forEach((pos, i) => {
    const coin = new Mesh(new CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_HEIGHT, 10), options.materials.gold);
    coin.name = `chest_coin_${i}`;
    coin.position.set(pos.x, pos.y, pos.z);
    coin.rotation.set(pos.rotX, 0, pos.rotZ);
    coin.castShadow = true;
    root.add(coin);
  });

  // Silver coins (a second metal tone mixed into the piles)
  const silverMat = new MeshStandardMaterial({ color: new Color(0.82, 0.82, 0.85), metalness: 0.3, roughness: 0.3 });
  const silverCoinPlacements = [
    { x: 0.0, y: CHEST_HEIGHT * 0.87, z: -0.02, rotX: 0.15, rotZ: 0.1 },
    { x: -0.18, y: CHEST_HEIGHT * 0.84, z: 0.12, rotX: 0.05, rotZ: -0.25 },
    { x: 0.12, y: CHEST_HEIGHT * 0.48, z: hd + 0.08, rotX: 0.55, rotZ: 0.15 },
    { x: -0.4, y: 0.01, z: hd + 0.45, rotX: Math.PI / 2, rotZ: 0.6 },
    { x: 0.48, y: 0.01, z: hd + 0.3, rotX: Math.PI / 2, rotZ: -0.4 },
    { x: 0.5, y: 0.01, z: -0.25, rotX: Math.PI / 2, rotZ: 0.2 },
  ];
  silverCoinPlacements.forEach((pos, i) => {
    const coin = new Mesh(new CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_HEIGHT, 10), silverMat);
    coin.name = `chest_silver_coin_${i}`;
    coin.position.set(pos.x, pos.y, pos.z);
    coin.rotation.set(pos.rotX, 0, pos.rotZ);
    coin.castShadow = true;
    root.add(coin);
  });

  // Colourful gems (octahedrons for a faceted jewel look)
  const GEM_COLORS = [
    new Color(0.85, 0.1, 0.15), // ruby red
    new Color(0.1, 0.4, 0.9), // sapphire blue
    new Color(0.15, 0.8, 0.3), // emerald green
    new Color(0.7, 0.15, 0.85), // amethyst purple
    new Color(0.95, 0.75, 0.1), // amber / topaz
    new Color(0.1, 0.85, 0.85), // aquamarine
    new Color(0.95, 0.45, 0.6), // pink tourmaline
    new Color(0.95, 0.55, 0.1), // orange citrine
  ];
  const gemPlacements = [
    // Inside the chest
    { x: -0.05, y: CHEST_HEIGHT * 0.92, z: -0.05, s: 1 },
    { x: 0.18, y: CHEST_HEIGHT * 0.9, z: 0.1, s: 0.8 },
    { x: -0.2, y: CHEST_HEIGHT * 0.88, z: 0.08, s: 1.1 },
    { x: 0.08, y: CHEST_HEIGHT * 0.95, z: -0.12, s: 0.7 },
    { x: 0.22, y: CHEST_HEIGHT * 0.86, z: -0.04, s: 0.9 },
    // Spilling out
    { x: -0.1, y: CHEST_HEIGHT * 0.55, z: hd + 0.08, s: 1 },
    { x: 0.15, y: CHEST_HEIGHT * 0.4, z: hd + 0.14, s: 0.85 },
    // On the ground
    { x: 0.38, y: GEM_RADIUS, z: hd + 0.32, s: 1 },
    { x: -0.45, y: GEM_RADIUS, z: hd + 0.2, s: 0.9 },
    { x: -0.55, y: GEM_RADIUS, z: 0.15, s: 0.75 },
    { x: 0.6, y: GEM_RADIUS, z: 0.0, s: 1.1 },
    { x: 0.2, y: GEM_RADIUS, z: hd + 0.55, s: 0.8 },
  ];
  gemPlacements.forEach((pos, i) => {
    const gem = new Mesh(new OctahedronGeometry(GEM_RADIUS * pos.s), gemMat(GEM_COLORS[i % GEM_COLORS.length]));
    gem.name = `chest_gem_${i}`;
    gem.position.set(pos.x, pos.y, pos.z);
    gem.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    gem.castShadow = true;
    root.add(gem);
  });

  // Pearl strand (small white spheres in a loose arc on the ground)
  const pearlMat = new MeshStandardMaterial({ color: new Color(0.95, 0.93, 0.88), metalness: 0.05, roughness: 0.2 });
  for (let i = 0; i < 7; i++) {
    const angle = (i / 6) * Math.PI * 0.6 - Math.PI * 0.3;
    const pearl = new Mesh(new SphereGeometry(0.02, 8, 8), pearlMat);
    pearl.name = `chest_pearl_${i}`;
    pearl.position.set(Math.cos(angle) * 0.55 + 0.1, 0.02, hd + 0.25 + Math.sin(angle) * 0.2);
    pearl.castShadow = true;
    root.add(pearl);
  }

  // Two goblets — one upright inside, one tipped over on the ground
  const gobletUpright = new Mesh(new CylinderGeometry(GOBLET_RADIUS * 0.6, GOBLET_RADIUS, GOBLET_HEIGHT, 8), options.materials.gold);
  gobletUpright.name = 'chest_goblet_upright';
  gobletUpright.position.set(-0.12, CHEST_HEIGHT * 0.85 + GOBLET_HEIGHT / 2, 0.05);
  gobletUpright.castShadow = true;
  root.add(gobletUpright);

  const gobletTipped = new Mesh(new CylinderGeometry(GOBLET_RADIUS * 0.6, GOBLET_RADIUS, GOBLET_HEIGHT, 8), options.materials.gold);
  gobletTipped.name = 'chest_goblet_tipped';
  gobletTipped.position.set(-0.52, GOBLET_RADIUS, hd + 0.15);
  gobletTipped.rotation.z = Math.PI * 0.4;
  gobletTipped.castShadow = true;
  root.add(gobletTipped);

  // Second goblet on the other side, upside-down
  const gobletFlipped = new Mesh(new CylinderGeometry(GOBLET_RADIUS, GOBLET_RADIUS * 0.6, GOBLET_HEIGHT, 8), options.materials.gold);
  gobletFlipped.name = 'chest_goblet_flipped';
  gobletFlipped.position.set(0.55, GOBLET_HEIGHT / 2, -0.15);
  gobletFlipped.castShadow = true;
  root.add(gobletFlipped);

  // Gold necklace draped over the front chest edge
  const necklace = new Mesh(new TorusGeometry(NECKLACE_RADIUS, NECKLACE_TUBE_RADIUS, 6, 16), options.materials.gold);
  necklace.name = 'chest_necklace_front';
  necklace.position.set(0.2, CHEST_HEIGHT * 0.7, hd + 0.02);
  necklace.rotation.x = Math.PI * 0.3;
  necklace.rotation.z = Math.PI * 0.15;
  necklace.castShadow = true;
  root.add(necklace);

  // Second necklace on the ground with a coloured gem pendant
  const necklace2 = new Mesh(new TorusGeometry(NECKLACE_RADIUS * 1.1, NECKLACE_TUBE_RADIUS, 6, 16), silverMat);
  necklace2.name = 'chest_necklace_ground';
  necklace2.position.set(-0.35, 0.015, hd + 0.4);
  necklace2.rotation.x = Math.PI / 2;
  necklace2.castShadow = true;
  root.add(necklace2);

  // Crown sitting on top of the coin heap inside
  const crownBand = new Mesh(new CylinderGeometry(0.08, 0.08, 0.05, 12, 1, true), options.materials.gold);
  crownBand.name = 'chest_crown_band';
  crownBand.position.set(0.0, CHEST_HEIGHT * 0.95, 0.0);
  crownBand.castShadow = true;
  root.add(crownBand);

  // Crown points (small pyramidal shapes around the band)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const point = new Mesh(new CylinderGeometry(0, 0.025, 0.05, 4), options.materials.gold);
    point.name = `chest_crown_point_${i}`;
    point.position.set(Math.cos(angle) * 0.08, CHEST_HEIGHT * 0.95 + 0.045, Math.sin(angle) * 0.08);
    point.castShadow = true;
    root.add(point);
  }

  // Small gold bars / ingots on the ground
  const ingotPlacements = [
    { x: 0.4, y: 0.025, z: hd + 0.18, rotY: 0.4 },
    { x: -0.48, y: 0.025, z: -0.05, rotY: -0.6 },
    { x: 0.15, y: 0.025, z: -hd - 0.12, rotY: 0.2 },
  ];
  ingotPlacements.forEach((pos, i) => {
    const ingot = new Mesh(new BoxGeometry(0.1, 0.05, 0.06), options.materials.gold);
    ingot.name = `chest_ingot_${i}`;
    ingot.position.set(pos.x, pos.y, pos.z);
    ingot.rotation.y = pos.rotY;
    ingot.castShadow = true;
    root.add(ingot);
  });

  return { root, lid, tapTarget: body };
}
