import { Scene, Mesh, Group, SphereGeometry, CylinderGeometry, BoxGeometry, ConeGeometry, Color, MeshStandardMaterial } from 'three';
import { createSkinMaterial, createCoralMaterial } from '@app/minigames/shared/materials';
import { BOUNDS } from '../types';

/** State for an actively transiting submarine. */
export interface SubmarineTransit {
  group: Group;
  /** Start position. */
  startX: number;
  startZ: number;
  /** End position. */
  endX: number;
  endZ: number;
  /** Progress 0→1. */
  t: number;
  /** Transit speed (units of t per second). */
  speed: number;
  /** Whether this sub is currently visible and moving. */
  active: boolean;
}

/** Decorative background creatures that add life to the reef. */
export interface AmbientCreatures {
  /** Small fish moving as a group. */
  fishSchool: Group[];
  /** Ambient rising bubbles. */
  bubbles: Mesh[];
  /** Translucent jellyfish. */
  jellyfish: Group[];
  /** Decorative octopuses on the seafloor. */
  octopuses: Group[];
  /** Floating squids. */
  squids: Group[];
  /** Scuttling crabs on the seafloor. */
  crabs: { group: Group; baseX: number; baseZ: number }[];
  /** SpongeBob-style pineapples on the seafloor. */
  pineapples: Group[];
  /** Submarines that transit through the scene. */
  submarines: SubmarineTransit[];
  /** Pool of small bubbles for submarine propeller wash. */
  propWash: { mesh: Mesh; life: number; velY: number; velX: number; velZ: number }[];
  /** Shared material for propeller wash bubbles. */
  propWashMat: MeshStandardMaterial;
  /** School movement state. */
  schoolPhase: number;
  /** Timer for octopus proximity check (fires every 5s). */
  octoProximityTimer: number;
  /** Timer for submarine dispatch (fires every 10s). */
  subTimer: number;
}

/** Camera view radius for proximity checks (matches waves.ts). */
const CAMERA_VIEW_RADIUS = 15;

// ── Tiny fish (school) ──────────────────────────────────────────────

/**
 * Builds a tiny fish shape (body + tail) for the ambient school.
 * @param mat - Material for the fish.
 * @param name - Mesh name prefix.
 * @returns A Group containing the fish parts.
 */
function buildTinyFish(mat: MeshStandardMaterial, name: string): Group {
  const g = new Group();
  g.name = name;

  const bodyGeo = new SphereGeometry(0.06, 8, 6);
  const body = new Mesh(bodyGeo, mat);
  body.scale.set(1.5, 0.7, 0.5);
  g.add(body);

  const tailGeo = new SphereGeometry(0.035, 6, 4);
  const tail = new Mesh(tailGeo, mat);
  tail.scale.set(0.4, 0.8, 0.08);
  tail.position.x = -0.08;
  g.add(tail);

  return g;
}

// ── Jellyfish ───────────────────────────────────────────────────────

/**
 * Builds a decorative jellyfish with a translucent dome and dangling tentacles.
 * @param idx - Index for naming.
 * @param color - Jellyfish tint color.
 * @returns A Group containing all jellyfish parts.
 */
function buildJellyfish(idx: number, color: Color): Group {
  const g = new Group();
  g.name = `jellyfish_${idx}`;

  const bellGeo = new SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const bellMat = new MeshStandardMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.3),
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.5,
    roughness: 0.2,
  });
  bellMat.name = `jellyMat_${idx}`;
  const bell = new Mesh(bellGeo, bellMat);
  bell.rotation.x = Math.PI;
  g.add(bell);

  const tentMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.8),
    transparent: true,
    opacity: 0.35,
    roughness: 0.4,
  });
  tentMat.name = `jellyTentMat_${idx}`;
  for (let t = 0; t < 6; t++) {
    const angle = (t / 6) * Math.PI * 2;
    const tentGeo = new CylinderGeometry(0.004, 0.008, 0.25 + Math.random() * 0.15, 4);
    const tent = new Mesh(tentGeo, tentMat);
    tent.position.set(Math.cos(angle) * 0.1, -0.15, Math.sin(angle) * 0.1);
    g.add(tent);
  }

  return g;
}

// ── Octopus ─────────────────────────────────────────────────────────

/**
 * Builds a decorative octopus sitting on the seafloor.
 * @param idx - Index for naming.
 * @param color - Body tint color.
 * @returns A Group containing all octopus parts.
 */
function buildOctopus(idx: number, color: Color): Group {
  const g = new Group();
  g.name = `octopus_${idx}`;

  // Head/body — flattened dome
  const bodyMat = createCoralMaterial(`octopusMat_${idx}`, color);
  const bodyGeo = new SphereGeometry(0.25, 12, 10);
  const body = new Mesh(bodyGeo, bodyMat);
  body.scale.set(1, 0.75, 1);
  body.position.y = 0.15;
  g.add(body);

  // Eyes
  const eyeWhiteMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  eyeWhiteMat.name = `octopusEye_${idx}`;
  const pupilMat = new MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  pupilMat.name = `octopusPupil_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const eyeGeo = new SphereGeometry(0.05, 8, 6);
    const eye = new Mesh(eyeGeo, eyeWhiteMat);
    eye.position.set(side * 0.1, 0.22, 0.2);
    g.add(eye);
    const pupilGeo = new SphereGeometry(0.025, 6, 6);
    const pupil = new Mesh(pupilGeo, pupilMat);
    pupil.position.set(side * 0.1, 0.22, 0.24);
    g.add(pupil);
  }

  // 8 tentacles radiating outward
  const tentMat = createCoralMaterial(`octopusTent_${idx}`, color.clone().multiplyScalar(0.85));
  for (let t = 0; t < 8; t++) {
    const angle = (t / 8) * Math.PI * 2;
    const tentGeo = new CylinderGeometry(0.015, 0.035, 0.35, 6);
    const tent = new Mesh(tentGeo, tentMat);
    tent.position.set(Math.cos(angle) * 0.18, 0.02, Math.sin(angle) * 0.18);
    tent.rotation.z = (Math.PI / 2) * 0.6 * (angle > Math.PI ? 1 : -1);
    tent.rotation.y = -angle;
    g.add(tent);
  }

  return g;
}

// ── Squid ───────────────────────────────────────────────────────────

/**
 * Builds a decorative squid floating in mid-water.
 * @param idx - Index for naming.
 * @param color - Body tint color.
 * @returns A Group containing all squid parts.
 */
function buildSquid(idx: number, color: Color): Group {
  const g = new Group();
  g.name = `squid_${idx}`;

  const bodyMat = new MeshStandardMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.15),
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.75,
    roughness: 0.3,
  });
  bodyMat.name = `squidMat_${idx}`;

  // Elongated mantle (torpedo shape)
  const mantleGeo = new CylinderGeometry(0.08, 0.14, 0.5, 10);
  const mantle = new Mesh(mantleGeo, bodyMat);
  mantle.position.y = 0.15;
  g.add(mantle);

  // Pointed tip on top
  const tipGeo = new ConeGeometry(0.08, 0.15, 8);
  const tip = new Mesh(tipGeo, bodyMat);
  tip.position.y = 0.45;
  g.add(tip);

  // 2 fins
  const finMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.9),
    transparent: true,
    opacity: 0.6,
    roughness: 0.4,
  });
  finMat.name = `squidFin_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const finGeo = new SphereGeometry(0.06, 8, 6);
    const fin = new Mesh(finGeo, finMat);
    fin.scale.set(0.3, 1, 1.5);
    fin.position.set(side * 0.12, 0.3, 0);
    g.add(fin);
  }

  // Eyes
  const eyeMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  eyeMat.name = `squidEye_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const eyeGeo = new SphereGeometry(0.03, 6, 6);
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.08, 0.05, 0.1);
    g.add(eye);
  }

  // 8 tentacles hanging down
  const tentMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.8),
    transparent: true,
    opacity: 0.6,
    roughness: 0.5,
  });
  tentMat.name = `squidTent_${idx}`;
  for (let t = 0; t < 8; t++) {
    const angle = (t / 8) * Math.PI * 2;
    const tentGeo = new CylinderGeometry(0.006, 0.012, 0.2 + Math.random() * 0.1, 4);
    const tent = new Mesh(tentGeo, tentMat);
    tent.position.set(Math.cos(angle) * 0.08, -0.1, Math.sin(angle) * 0.08);
    g.add(tent);
  }

  return g;
}

// ── Crab ────────────────────────────────────────────────────────────

/**
 * Builds a decorative crab on the seafloor.
 * @param idx - Index for naming.
 * @param color - Shell color.
 * @returns A Group containing all crab parts.
 */
function buildCrab(idx: number, color: Color): Group {
  const g = new Group();
  g.name = `crab_${idx}`;

  const shellMat = createCoralMaterial(`crabMat_${idx}`, color);

  // Body — flattened sphere
  const bodyGeo = new SphereGeometry(0.1, 10, 8);
  const body = new Mesh(bodyGeo, shellMat);
  body.scale.set(1.3, 0.5, 1.0);
  body.position.y = 0.04;
  g.add(body);

  // Eyes on stalks
  const eyeMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  eyeMat.name = `crabEye_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const stalkGeo = new CylinderGeometry(0.008, 0.008, 0.06, 4);
    const stalk = new Mesh(stalkGeo, shellMat);
    stalk.position.set(side * 0.05, 0.08, 0.06);
    g.add(stalk);
    const eyeGeo = new SphereGeometry(0.015, 6, 6);
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.05, 0.11, 0.06);
    g.add(eye);
  }

  // 2 claws
  const clawMat = createCoralMaterial(`crabClaw_${idx}`, color.clone().multiplyScalar(0.9));
  for (let side = -1; side <= 1; side += 2) {
    const armGeo = new CylinderGeometry(0.012, 0.015, 0.1, 6);
    const arm = new Mesh(armGeo, clawMat);
    arm.position.set(side * 0.15, 0.03, 0.04);
    arm.rotation.z = side * 0.5;
    g.add(arm);
    // Pincer — two small wedges
    const pincerGeo = new BoxGeometry(0.03, 0.015, 0.04);
    const pincer = new Mesh(pincerGeo, clawMat);
    pincer.position.set(side * 0.2, 0.05, 0.04);
    g.add(pincer);
  }

  // 6 legs (3 per side)
  const legMat = createCoralMaterial(`crabLeg_${idx}`, color.clone().multiplyScalar(0.8));
  for (let side = -1; side <= 1; side += 2) {
    for (let l = 0; l < 3; l++) {
      const legGeo = new CylinderGeometry(0.005, 0.008, 0.08, 4);
      const leg = new Mesh(legGeo, legMat);
      const zOff = -0.02 + l * 0.04;
      leg.position.set(side * 0.12, 0.01, zOff);
      leg.rotation.z = side * 0.8;
      g.add(leg);
    }
  }

  return g;
}

// ── Pineapple ───────────────────────────────────────────────────────

/**
 * Builds a decorative pineapple on the seafloor.
 * @param idx - Index for naming.
 * @returns A Group containing all pineapple parts.
 */
function buildPineapple(idx: number): Group {
  const g = new Group();
  g.name = `pineapple_${idx}`;

  // Body — slightly tapered cylinder
  const bodyMat = new MeshStandardMaterial({
    color: new Color(0.95, 0.7, 0.1),
    roughness: 0.8,
    metalness: 0.05,
  });
  bodyMat.name = `pineappleMat_${idx}`;
  const bodyGeo = new CylinderGeometry(0.12, 0.15, 0.4, 10);
  const body = new Mesh(bodyGeo, bodyMat);
  body.position.y = 0.2;
  g.add(body);

  // Bumpy texture — small spheres on the surface
  const bumpMat = new MeshStandardMaterial({
    color: new Color(0.85, 0.6, 0.05),
    roughness: 0.9,
  });
  bumpMat.name = `pineappleBump_${idx}`;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const angle = (col / 6) * Math.PI * 2 + row * 0.5;
      const y = 0.1 + row * 0.1;
      const r = 0.13;
      const bumpGeo = new SphereGeometry(0.015, 4, 4);
      const bump = new Mesh(bumpGeo, bumpMat);
      bump.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      g.add(bump);
    }
  }

  // Green leaf crown
  const leafMat = new MeshStandardMaterial({
    color: new Color(0.2, 0.65, 0.15),
    roughness: 0.6,
  });
  leafMat.name = `pineappleLeaf_${idx}`;
  for (let l = 0; l < 5; l++) {
    const angle = (l / 5) * Math.PI * 2;
    const leafGeo = new ConeGeometry(0.03, 0.15, 4);
    const leaf = new Mesh(leafGeo, leafMat);
    leaf.position.set(Math.cos(angle) * 0.04, 0.45, Math.sin(angle) * 0.04);
    leaf.rotation.z = (Math.cos(angle) > 0 ? -1 : 1) * 0.3;
    leaf.rotation.x = (Math.sin(angle) > 0 ? -1 : 1) * 0.3;
    g.add(leaf);
  }
  // Center leaf
  const centerLeafGeo = new ConeGeometry(0.025, 0.12, 4);
  const centerLeaf = new Mesh(centerLeafGeo, leafMat);
  centerLeaf.position.y = 0.48;
  g.add(centerLeaf);

  // Door (small dark rectangle)
  const doorMat = new MeshStandardMaterial({ color: new Color(0.15, 0.08, 0.02), roughness: 0.9 });
  doorMat.name = `pineappleDoor_${idx}`;
  const doorGeo = new BoxGeometry(0.05, 0.08, 0.01);
  const door = new Mesh(doorGeo, doorMat);
  door.position.set(0, 0.1, 0.15);
  g.add(door);

  // Windows (two small circles)
  const windowMat = new MeshStandardMaterial({
    color: new Color(0.3, 0.6, 0.9),
    emissive: new Color(0.15, 0.3, 0.5),
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });
  windowMat.name = `pineappleWin_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const winGeo = new SphereGeometry(0.02, 6, 6);
    const win = new Mesh(winGeo, windowMat);
    win.position.set(side * 0.06, 0.25, 0.13);
    g.add(win);
  }

  return g;
}

// ── Submarine ───────────────────────────────────────────────────────

/**
 * Builds a toy submarine.
 * @param idx - Index for naming.
 * @returns A Group containing all submarine parts.
 */
function buildSubmarine(idx: number): Group {
  const g = new Group();
  g.name = `submarine_${idx}`;

  const hullColor = new Color(0.3, 0.35, 0.42);
  const accentColor = new Color(0.9, 0.7, 0.15);

  // Hull — elongated capsule (cylinder + sphere caps)
  const hullMat = new MeshStandardMaterial({ color: hullColor, roughness: 0.4, metalness: 0.6 });
  hullMat.name = `subHull_${idx}`;
  const hullGeo = new CylinderGeometry(0.2, 0.2, 1.0, 12);
  const hull = new Mesh(hullGeo, hullMat);
  hull.rotation.z = Math.PI / 2;
  g.add(hull);

  // Nose cap
  const noseMat = new MeshStandardMaterial({ color: accentColor, roughness: 0.3, metalness: 0.5 });
  noseMat.name = `subNose_${idx}`;
  const noseGeo = new SphereGeometry(0.2, 10, 8);
  const nose = new Mesh(noseGeo, noseMat);
  nose.position.x = 0.5;
  nose.scale.set(0.6, 1, 1);
  g.add(nose);

  // Tail cap
  const tailGeo = new SphereGeometry(0.2, 10, 8);
  const tail = new Mesh(tailGeo, hullMat);
  tail.position.x = -0.5;
  tail.scale.set(0.5, 0.9, 0.9);
  g.add(tail);

  // Conning tower
  const towerGeo = new CylinderGeometry(0.08, 0.1, 0.2, 8);
  const tower = new Mesh(towerGeo, hullMat);
  tower.position.set(0.05, 0.25, 0);
  g.add(tower);

  // Periscope
  const periGeo = new CylinderGeometry(0.015, 0.015, 0.15, 6);
  const peri = new Mesh(periGeo, hullMat);
  peri.position.set(0.05, 0.42, 0);
  g.add(peri);

  // Periscope lens
  const lensGeo = new SphereGeometry(0.02, 6, 6);
  const lensMat = new MeshStandardMaterial({
    color: new Color(0.2, 0.5, 0.8),
    emissive: new Color(0.1, 0.3, 0.5),
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });
  lensMat.name = `subLens_${idx}`;
  const lens = new Mesh(lensGeo, lensMat);
  lens.position.set(0.05, 0.5, 0.02);
  g.add(lens);

  // Propeller — small disc at the back
  const propMat = new MeshStandardMaterial({ color: new Color(0.5, 0.5, 0.55), metalness: 0.8, roughness: 0.3 });
  propMat.name = `subProp_${idx}`;
  for (let b = 0; b < 4; b++) {
    const bladeGeo = new BoxGeometry(0.005, 0.1, 0.03);
    const blade = new Mesh(bladeGeo, propMat);
    const angle = (b / 4) * Math.PI * 2;
    blade.position.set(-0.62, Math.sin(angle) * 0.04, Math.cos(angle) * 0.04);
    blade.rotation.x = angle;
    g.add(blade);
  }

  // Port windows along the hull
  const winMat = new MeshStandardMaterial({
    color: new Color(0.4, 0.75, 1.0),
    emissive: new Color(0.3, 0.6, 0.9),
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.8,
    roughness: 0.1,
  });
  winMat.name = `subWin_${idx}`;
  for (let w = 0; w < 3; w++) {
    const winGeo = new SphereGeometry(0.03, 6, 6);
    const win = new Mesh(winGeo, winMat);
    win.position.set(0.2 - w * 0.2, 0, 0.2);
    g.add(win);
  }

  // Scale up so it reads as a proper vehicle
  g.scale.setScalar(1.5);

  return g;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates ambient decorative creatures for the reef.
 * @param scene - The Three.js scene.
 * @returns Ambient creature handles for update/dispose.
 */
export function createAmbientCreatures(scene: Scene): AmbientCreatures {
  // School of tiny fish (10)
  const fishSchool: Group[] = [];
  const schoolColors = [new Color(0.5, 0.55, 0.85), new Color(0.6, 0.8, 0.55), new Color(0.85, 0.65, 0.4)];
  for (let i = 0; i < 10; i++) {
    const color = schoolColors[i % schoolColors.length];
    const mat = createSkinMaterial(`ambientFishMat_${i}`, color);
    const fish = buildTinyFish(mat, `ambient_fish_${i}`);
    fish.position.set((Math.random() - 0.5) * 3, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 3);
    scene.add(fish);
    fishSchool.push(fish);
  }

  // Bubbles
  const bubbles: Mesh[] = [];
  const bubbleMat = new MeshStandardMaterial({
    color: new Color(0.7, 0.85, 1.0),
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    metalness: 0.3,
  });
  bubbleMat.name = 'ambientBubbleMat';
  for (let i = 0; i < 12; i++) {
    const geo = new SphereGeometry(0.03 + Math.random() * 0.04);
    const bubble = new Mesh(geo, bubbleMat);
    bubble.name = `ambient_bubble_${i}`;
    bubble.position.set((Math.random() - 0.5) * BOUNDS * 2, -0.3 + Math.random() * 2.5, (Math.random() - 0.5) * BOUNDS * 2);
    scene.add(bubble);
    bubbles.push(bubble);
  }

  // Jellyfish (8 spread across the world)
  const jellyfish: Group[] = [];
  const jellyColors = [
    new Color(0.7, 0.4, 0.9),
    new Color(0.3, 0.8, 0.9),
    new Color(0.9, 0.5, 0.7),
    new Color(0.5, 0.9, 0.6),
    new Color(0.9, 0.7, 0.4),
    new Color(0.4, 0.6, 0.95),
    new Color(0.8, 0.3, 0.6),
    new Color(0.6, 0.9, 0.8),
  ];
  const jellyPositions: [number, number, number][] = [
    [-12, 1.2, -10],
    [15, 1.5, 12],
    [-8, 1.8, 18],
    [25, 1.3, -15],
    [-20, 1.6, 5],
    [10, 1.4, -25],
    [-30, 1.7, -20],
    [35, 1.5, 8],
  ];
  for (let j = 0; j < jellyPositions.length; j++) {
    const jelly = buildJellyfish(j, jellyColors[j]);
    jelly.position.set(jellyPositions[j][0], jellyPositions[j][1], jellyPositions[j][2]);
    scene.add(jelly);
    jellyfish.push(jelly);
  }

  // Octopuses (4 on the seafloor)
  const octopuses: Group[] = [];
  const octoColors = [new Color(0.6, 0.2, 0.7), new Color(0.9, 0.4, 0.2), new Color(0.2, 0.65, 0.6), new Color(0.85, 0.3, 0.55)];
  const octoPositions: [number, number][] = [
    [-10, -8],
    [18, 15],
    [-22, 12],
    [8, -20],
  ];
  for (let o = 0; o < octoPositions.length; o++) {
    const octo = buildOctopus(o, octoColors[o]);
    octo.position.set(octoPositions[o][0], -0.45, octoPositions[o][1]);
    octo.rotation.y = Math.random() * Math.PI * 2;
    scene.add(octo);
    octopuses.push(octo);
  }

  // Squids (3 floating mid-water)
  const squids: Group[] = [];
  const squidColors = [new Color(0.85, 0.6, 0.7), new Color(0.6, 0.75, 0.9), new Color(0.9, 0.8, 0.65)];
  const squidPositions: [number, number, number][] = [
    [-15, 1.0, 10],
    [20, 1.3, -12],
    [-5, 0.8, -18],
  ];
  for (let s = 0; s < squidPositions.length; s++) {
    const squid = buildSquid(s, squidColors[s]);
    squid.position.set(squidPositions[s][0], squidPositions[s][1], squidPositions[s][2]);
    scene.add(squid);
    squids.push(squid);
  }

  // Crabs (6 on the seafloor)
  const crabs: AmbientCreatures['crabs'] = [];
  const crabColors = [
    new Color(0.9, 0.3, 0.15),
    new Color(0.85, 0.4, 0.1),
    new Color(0.95, 0.25, 0.2),
    new Color(0.8, 0.35, 0.12),
    new Color(0.9, 0.45, 0.15),
    new Color(0.75, 0.3, 0.18),
  ];
  const crabPositions: [number, number][] = [
    [-6, -5],
    [12, 8],
    [-18, 3],
    [5, -15],
    [-25, -12],
    [30, 20],
  ];
  for (let c = 0; c < crabPositions.length; c++) {
    const crab = buildCrab(c, crabColors[c]);
    const bx = crabPositions[c][0];
    const bz = crabPositions[c][1];
    crab.position.set(bx, -0.47, bz);
    crab.rotation.y = Math.random() * Math.PI * 2;
    scene.add(crab);
    crabs.push({ group: crab, baseX: bx, baseZ: bz });
  }

  // Pineapples (3 on the seafloor)
  const pineapples: Group[] = [];
  const pinePositions: [number, number][] = [
    [14, -6],
    [-16, 20],
    [28, -22],
  ];
  for (let p = 0; p < pinePositions.length; p++) {
    const pineapple = buildPineapple(p);
    pineapple.position.set(pinePositions[p][0], -0.5, pinePositions[p][1]);
    pineapple.rotation.y = Math.random() * Math.PI * 2;
    scene.add(pineapple);
    pineapples.push(pineapple);
  }

  // Submarines (2 pre-built, initially hidden)
  const submarines: SubmarineTransit[] = [];
  for (let s = 0; s < 2; s++) {
    const sub = buildSubmarine(s);
    sub.visible = false;
    scene.add(sub);
    submarines.push({
      group: sub,
      startX: 0,
      startZ: 0,
      endX: 0,
      endZ: 0,
      t: 0,
      speed: 0,
      active: false,
    });
  }

  // Propeller wash bubble pool (pre-allocated, reused)
  const propWashMat = new MeshStandardMaterial({
    color: new Color(0.8, 0.9, 1.0),
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    metalness: 0.2,
  });
  propWashMat.name = 'propWashMat';
  const propWash: AmbientCreatures['propWash'] = [];
  const propWashGeo = new SphereGeometry(0.04, 6, 6);
  for (let i = 0; i < 40; i++) {
    const mesh = new Mesh(propWashGeo, propWashMat);
    mesh.name = `propWash_${i}`;
    mesh.visible = false;
    scene.add(mesh);
    propWash.push({ mesh, life: 0, velY: 0, velX: 0, velZ: 0 });
  }

  return {
    fishSchool,
    bubbles,
    jellyfish,
    octopuses,
    squids,
    crabs,
    pineapples,
    submarines,
    propWash,
    propWashMat,
    schoolPhase: Math.random() * Math.PI * 2,
    octoProximityTimer: 5.0,
    subTimer: 15.0,
  };
}

// ── Update ──────────────────────────────────────────────────────────

/**
 * Updates ambient creature animations.
 * @param creatures - Ambient creatures to update.
 * @param dt - Frame delta time.
 * @param elapsedTime - Total elapsed game time.
 * @param sharkX - Shark world X position (school orbits near shark).
 * @param sharkZ - Shark world Z position.
 */
export function updateAmbientCreatures(creatures: AmbientCreatures, dt: number, elapsedTime: number, sharkX: number, sharkZ: number): void {
  creatures.schoolPhase += dt * 0.3;

  // School moves in a lazy arc centered around the shark
  const centerX = sharkX + Math.sin(creatures.schoolPhase) * 5;
  const centerZ = sharkZ + Math.cos(creatures.schoolPhase * 0.7) * 5;

  for (let i = 0; i < creatures.fishSchool.length; i++) {
    const fish = creatures.fishSchool[i];
    const offset = i * 0.4;
    fish.position.x = centerX + Math.sin(elapsedTime * 0.8 + offset) * 0.6;
    fish.position.z = centerZ + Math.cos(elapsedTime * 0.6 + offset) * 0.6;
    fish.position.y = 0.4 + Math.sin(elapsedTime * 1.2 + offset) * 0.2;
    fish.rotation.y = -creatures.schoolPhase + Math.PI / 2;
    fish.rotation.z = Math.sin(elapsedTime * 4 + i) * 0.08;
  }

  // Bubbles rise slowly, respawn near the shark
  for (const bubble of creatures.bubbles) {
    bubble.position.y += dt * (0.2 + Math.sin(elapsedTime + bubble.position.x) * 0.1);
    bubble.position.x += Math.sin(elapsedTime * 2 + bubble.position.y * 3) * dt * 0.08;
    const pulse = 1 + Math.sin(elapsedTime * 3 + bubble.position.y * 2) * 0.1;
    bubble.scale.setScalar(pulse);
    if (bubble.position.y > 2.6) {
      bubble.position.y = -0.3;
      bubble.position.x = sharkX + (Math.random() - 0.5) * 30;
      bubble.position.z = sharkZ + (Math.random() - 0.5) * 30;
    }
  }

  // Jellyfish: gentle floating and pulsing
  for (let j = 0; j < creatures.jellyfish.length; j++) {
    const jelly = creatures.jellyfish[j];
    const baseY = 1.2 + (j % 3) * 0.3;
    jelly.position.y = baseY + Math.sin(elapsedTime * 0.5 + j * 2) * 0.3;
    jelly.position.x += Math.sin(elapsedTime * 0.2 + j * 1.5) * dt * 0.15;
    jelly.position.z += Math.cos(elapsedTime * 0.15 + j * 2.5) * dt * 0.1;
    const jellyPulse = 1 + Math.sin(elapsedTime * 2 + j * 1.3) * 0.08;
    jelly.scale.set(jellyPulse, 1 / jellyPulse, jellyPulse);
    jelly.children.forEach((child, ci) => {
      if (ci > 0) {
        child.rotation.z = Math.sin(elapsedTime * 1.5 + ci * 0.8 + j) * 0.15;
        child.rotation.x = Math.cos(elapsedTime * 1.2 + ci * 0.6 + j) * 0.1;
      }
    });
  }

  // Octopuses: tentacle sway + gentle body bob
  for (let o = 0; o < creatures.octopuses.length; o++) {
    const octo = creatures.octopuses[o];
    // Gentle body bob
    octo.position.y = -0.45 + Math.sin(elapsedTime * 0.4 + o * 1.7) * 0.02;
    // Tentacle sway (children index 3+ are tentacles: 0=body, 1-4=eyes, 5-12=tentacles)
    octo.children.forEach((child, ci) => {
      if (ci >= 5) {
        child.rotation.x = Math.sin(elapsedTime * 1.0 + ci * 0.5 + o) * 0.2;
        child.rotation.z += Math.sin(elapsedTime * 0.8 + ci * 0.7 + o) * dt * 0.3;
      }
    });
  }

  // Squids: vertical bob + gentle drift + tentacle sway
  for (let s = 0; s < creatures.squids.length; s++) {
    const squid = creatures.squids[s];
    const baseY = 0.8 + s * 0.25;
    squid.position.y = baseY + Math.sin(elapsedTime * 0.6 + s * 2.1) * 0.25;
    squid.position.x += Math.sin(elapsedTime * 0.15 + s * 1.8) * dt * 0.12;
    squid.position.z += Math.cos(elapsedTime * 0.12 + s * 2.3) * dt * 0.08;
    // Mantle breathing
    const squidPulse = 1 + Math.sin(elapsedTime * 2.5 + s) * 0.06;
    squid.scale.set(squidPulse, 1, squidPulse);
    // Tentacle sway (last 8 children)
    const tentStart = squid.children.length - 8;
    for (let t = tentStart; t < squid.children.length; t++) {
      squid.children[t].rotation.z = Math.sin(elapsedTime * 1.3 + t * 0.6 + s) * 0.12;
      squid.children[t].rotation.x = Math.cos(elapsedTime * 1.1 + t * 0.5 + s) * 0.08;
    }
  }

  // Crabs: sideways scuttle oscillation
  for (let c = 0; c < creatures.crabs.length; c++) {
    const { group, baseX, baseZ } = creatures.crabs[c];
    const scuttlePhase = elapsedTime * 0.5 + c * 1.4;
    // Sideways oscillation ~0.5 units
    group.position.x = baseX + Math.sin(scuttlePhase) * 0.5;
    group.position.z = baseZ + Math.cos(scuttlePhase * 0.7) * 0.3;
    // Face sideways to direction of movement
    group.rotation.y = Math.sin(scuttlePhase) > 0 ? Math.PI / 2 : -Math.PI / 2;
    // Claw clacking — rotate claws (children at specific indices)
    group.children.forEach((child, ci) => {
      // Leg wiggle for legs (index >= 12 for the leg meshes)
      if (ci >= 12) {
        child.rotation.x = Math.sin(elapsedTime * 3 + ci + c) * 0.15;
      }
    });
  }

  // Pineapples: static (they just sit there — it's a pineapple)

  // ── Octopus proximity (every 5s, ensure 1-2 in camera) ───────────
  creatures.octoProximityTimer -= dt;
  if (creatures.octoProximityTimer <= 0) {
    creatures.octoProximityTimer = 5.0;

    // Count octopuses within camera view
    let nearCount = 0;
    let farthestIdx = 0;
    let farthestDist = 0;
    for (let o = 0; o < creatures.octopuses.length; o++) {
      const octo = creatures.octopuses[o];
      const dx = octo.position.x - sharkX;
      const dz = octo.position.z - sharkZ;
      const dist = dx * dx + dz * dz;
      if (dist < CAMERA_VIEW_RADIUS * CAMERA_VIEW_RADIUS) {
        nearCount++;
      }
      if (dist > farthestDist) {
        farthestDist = dist;
        farthestIdx = o;
      }
    }

    // Need at least 1; teleport a far octopus near the shark
    if (nearCount < 1 && creatures.octopuses.length > 0) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 5; // 6-11 units from shark
      const octo = creatures.octopuses[farthestIdx];
      octo.position.x = sharkX + Math.cos(angle) * dist;
      octo.position.z = sharkZ + Math.sin(angle) * dist;
      octo.position.y = -0.45;
      octo.rotation.y = Math.random() * Math.PI * 2;
      nearCount++;
    }

    // Ensure at most 2 — if more, move the farthest "near" one away
    if (nearCount > 2) {
      let closestNearIdx = 0;
      let closestNearDist = Infinity;
      for (let o = 0; o < creatures.octopuses.length; o++) {
        const octo = creatures.octopuses[o];
        const dx = octo.position.x - sharkX;
        const dz = octo.position.z - sharkZ;
        const dist = dx * dx + dz * dz;
        if (dist < CAMERA_VIEW_RADIUS * CAMERA_VIEW_RADIUS && dist < closestNearDist) {
          // Find the one closest to camera edge (largest dist within view)
          // Actually we want the 3rd+ one — find the third nearest
        }
        // Simpler: just move one that's near to far away
        if (dist < CAMERA_VIEW_RADIUS * CAMERA_VIEW_RADIUS) {
          if (dist > closestNearDist || closestNearDist === Infinity) {
            closestNearDist = dist;
            closestNearIdx = o;
          }
        }
      }
      const octo = creatures.octopuses[closestNearIdx];
      const awayAngle = Math.random() * Math.PI * 2;
      octo.position.x = sharkX + Math.cos(awayAngle) * 30;
      octo.position.z = sharkZ + Math.sin(awayAngle) * 30;
    }
  }

  // ── Submarine transit (every 10s, send one through) ───────────────
  creatures.subTimer -= dt;
  if (creatures.subTimer <= 0) {
    creatures.subTimer = 15.0;

    // Find an inactive submarine
    const sub = creatures.submarines.find((s) => !s.active);
    if (sub) {
      // Pick a random crossing direction through the shark's area
      const angle = Math.random() * Math.PI * 2;
      const crossDist = 25;
      sub.startX = sharkX - Math.cos(angle) * crossDist;
      sub.startZ = sharkZ - Math.sin(angle) * crossDist;
      sub.endX = sharkX + Math.cos(angle) * crossDist;
      sub.endZ = sharkZ + Math.sin(angle) * crossDist;
      sub.t = 0;
      sub.speed = 1.0 / 8.0; // cross in ~8 seconds
      sub.active = true;
      sub.group.visible = true;
      // Face direction of travel
      sub.group.rotation.y = Math.atan2(-(sub.endZ - sub.startZ), sub.endX - sub.startX);
      // Random height: mid-water to near-surface
      sub.group.position.y = 2.2 + Math.random() * 0.2;
    }
  }

  // Animate active submarines + spawn propeller wash
  for (const sub of creatures.submarines) {
    if (!sub.active) continue;
    sub.t += sub.speed * dt;

    if (sub.t >= 1.0) {
      sub.active = false;
      sub.group.visible = false;
      continue;
    }

    // Lerp position
    sub.group.position.x = sub.startX + (sub.endX - sub.startX) * sub.t;
    sub.group.position.z = sub.startZ + (sub.endZ - sub.startZ) * sub.t;
    // Gentle bob
    sub.group.position.y += Math.sin(elapsedTime * 1.5) * dt * 0.02;

    // Propeller spin (blades at indices 7-10)
    const children = sub.group.children;
    for (let b = 7; b <= 10 && b < children.length; b++) {
      children[b].rotation.x += dt * 15;
    }

    // Spawn propeller wash bubbles behind the sub (~5 per frame at 60fps)
    const spawnCount = Math.ceil(dt * 300);
    // Direction from start→end (sub faces this way)
    const dirX = sub.endX - sub.startX;
    const dirZ = sub.endZ - sub.startZ;
    const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const nxDir = dirX / dirLen;
    const nzDir = dirZ / dirLen;

    for (let i = 0; i < spawnCount; i++) {
      // Find a dead bubble in the pool
      const bubble = creatures.propWash.find((b) => b.life <= 0);
      if (!bubble) break;

      // Position at the sub's rear (opposite of travel direction), with spread
      const subScale = 1.5; // sub group scale
      const rearOffset = 0.65 * subScale;
      bubble.mesh.position.set(
        sub.group.position.x - nxDir * rearOffset + (Math.random() - 0.5) * 0.3,
        sub.group.position.y + (Math.random() - 0.5) * 0.2,
        sub.group.position.z - nzDir * rearOffset + (Math.random() - 0.5) * 0.3,
      );
      // Velocity: mostly backward + upward + random spread
      bubble.velX = -nxDir * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.4;
      bubble.velZ = -nzDir * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.4;
      bubble.velY = 0.3 + Math.random() * 0.4;
      bubble.life = 1.0 + Math.random() * 0.8; // 1-1.8s lifetime
      bubble.mesh.visible = true;
      bubble.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
    }
  }

  // Update propeller wash bubbles
  for (const bubble of creatures.propWash) {
    if (bubble.life <= 0) continue;
    bubble.life -= dt;

    // Move: drift backward/upward with deceleration
    bubble.mesh.position.x += bubble.velX * dt;
    bubble.mesh.position.y += bubble.velY * dt;
    bubble.mesh.position.z += bubble.velZ * dt;

    // Decelerate
    bubble.velX *= Math.max(0, 1 - 1.5 * dt);
    bubble.velZ *= Math.max(0, 1 - 1.5 * dt);
    // Buoyancy keeps velY positive
    bubble.velY += dt * 0.1;

    // Shrink to simulate fade-out (shared material, can't change opacity per bubble)
    bubble.mesh.scale.multiplyScalar(1 - dt * 0.5);

    if (bubble.life <= 0) {
      bubble.mesh.visible = false;
    }
  }
}

// ── Disposal ────────────────────────────────────────────────────────

/**
 * Disposes all ambient creature meshes and materials.
 * @param creatures - Ambient creatures to dispose.
 */
export function disposeAmbientCreatures(creatures: AmbientCreatures): void {
  const disposeGroup = (g: Group): void => {
    g.traverse((child) => {
      if ((child as Mesh).geometry) (child as Mesh).geometry.dispose();
      if ((child as Mesh).material) ((child as Mesh).material as MeshStandardMaterial)?.dispose();
    });
    g.removeFromParent();
  };

  for (const fish of creatures.fishSchool) disposeGroup(fish);
  for (const bubble of creatures.bubbles) {
    bubble.geometry?.dispose();
    (bubble.material as MeshStandardMaterial)?.dispose();
    bubble.removeFromParent();
  }
  for (const jelly of creatures.jellyfish) disposeGroup(jelly);
  for (const octo of creatures.octopuses) disposeGroup(octo);
  for (const squid of creatures.squids) disposeGroup(squid);
  for (const { group } of creatures.crabs) disposeGroup(group);
  for (const pine of creatures.pineapples) disposeGroup(pine);
  for (const sub of creatures.submarines) disposeGroup(sub.group);
  for (const bubble of creatures.propWash) {
    bubble.mesh.geometry?.dispose();
    bubble.mesh.removeFromParent();
  }
  creatures.propWashMat.dispose();
}
