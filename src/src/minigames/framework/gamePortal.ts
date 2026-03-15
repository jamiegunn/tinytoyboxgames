import {
  Mesh,
  Group,
  Color,
  MeshStandardMaterial,
  CylinderGeometry,
  SphereGeometry,
  BoxGeometry,
  TorusGeometry,
  CircleGeometry,
  Vector3,
  type Scene,
  type Object3D,
} from 'three';
import gsap from 'gsap';
import type { MiniGameId, NavigationActions } from '@app/types/scenes';
import { triggerSound } from '@app/assets/audio/sceneBridge';

/** Configuration for a single game portal placement. */
export interface GamePortalConfig {
  gameId: MiniGameId;
  position: Vector3;
  color: Color;
}

/** Result of building game portals, including tappable meshes for raycasting. */
export interface GamePortalResult {
  root: Group;
  tappableMeshes: Object3D[];
}

// ── Helper: create a colored MeshStandardMaterial ──

function mat(name: string, diffuse: Color, emissive?: Color): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: diffuse,
    emissive: emissive ?? new Color(0, 0, 0),
    roughness: 0.7,
    metalness: 0.05,
  });
  m.name = name;
  return m;
}

// ── Geometry helpers ──

function createSphere(name: string, diameter: number, segments = 16): Mesh {
  const m = new Mesh(new SphereGeometry(diameter / 2, segments, segments));
  m.name = name;
  return m;
}

function createCylinder(name: string, diameterTop: number, diameterBottom: number, height: number, tessellation = 16): Mesh {
  const m = new Mesh(new CylinderGeometry(diameterTop / 2, diameterBottom / 2, height, tessellation));
  m.name = name;
  return m;
}

function createBox(name: string, width: number, height: number, depth: number): Mesh {
  const m = new Mesh(new BoxGeometry(width, height, depth));
  m.name = name;
  return m;
}

function createTorus(name: string, diameter: number, thickness: number, tessellation = 32): Mesh {
  const m = new Mesh(new TorusGeometry(diameter / 2, thickness / 2, 16, tessellation));
  m.name = name;
  return m;
}

function createDisc(name: string, radius: number, tessellation = 16): Mesh {
  const m = new Mesh(new CircleGeometry(radius, tessellation));
  m.name = name;
  return m;
}

// ════════════════════════════════════════════════════════════════════
// Per-game icon builders — each returns a parent Group with children
// ════════════════════════════════════════════════════════════════════

function buildBalloonIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_balloon`;
  // Balloon body — teardrop (sphere squished taller)
  const body = createSphere(`${id}_body`, 0.65, 10);
  body.scale.set(0.8, 1.1, 0.8);
  body.position.y = 0.2;
  body.material = mat(`${id}_bodyMat`, new Color(0.95, 0.2, 0.2), new Color(0.3, 0.05, 0.05));
  root.add(body);
  // Knot
  const knot = createSphere(`${id}_knot`, 0.12, 6);
  knot.position.y = -0.18;
  knot.material = mat(`${id}_knotMat`, new Color(0.7, 0.15, 0.15));
  root.add(knot);
  // String
  const str = createCylinder(`${id}_str`, 0.025, 0.025, 0.35, 6);
  str.position.y = -0.38;
  str.material = mat(`${id}_strMat`, new Color(0.9, 0.9, 0.85));
  root.add(str);
  return root;
}

function buildTruckIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_truck`;
  // Body
  const body = createBox(`${id}_body`, 0.7, 0.3, 0.4);
  body.position.y = 0.15;
  body.material = mat(`${id}_bodyMat`, new Color(1, 0.25, 0.1), new Color(0.25, 0.05, 0.02));
  root.add(body);
  // Cab (raised front)
  const cab = createBox(`${id}_cab`, 0.3, 0.2, 0.38);
  cab.position.set(0.2, 0.35, 0);
  cab.material = mat(`${id}_cabMat`, new Color(1, 0.35, 0.15), new Color(0.2, 0.06, 0.02));
  root.add(cab);
  // Wheels (4 chunky cylinders)
  const wheelMat = mat(`${id}_wheelMat`, new Color(0.15, 0.15, 0.15));
  const wheelPositions = [new Vector3(-0.22, -0.02, 0.22), new Vector3(-0.22, -0.02, -0.22), new Vector3(0.22, -0.02, 0.22), new Vector3(0.22, -0.02, -0.22)];
  for (let i = 0; i < 4; i++) {
    const w = createCylinder(`${id}_w${i}`, 0.2, 0.2, 0.08, 12);
    w.rotation.x = Math.PI / 2;
    w.position.copy(wheelPositions[i]);
    w.material = wheelMat;
    root.add(w);
  }
  // Eyes on front (friendly face)
  const eyeMat = mat(`${id}_eyeMat`, new Color(1, 1, 1), new Color(0.3, 0.3, 0.3));
  const eyeL = createSphere(`${id}_eyeL`, 0.08);
  eyeL.position.set(0.36, 0.34, 0.1);
  eyeL.material = eyeMat;
  root.add(eyeL);
  const eyeR = createSphere(`${id}_eyeR`, 0.08);
  eyeR.position.set(0.36, 0.34, -0.1);
  eyeR.material = eyeMat;
  root.add(eyeR);
  return root;
}

function buildCarrotIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_carrot`;
  // Carrot body (cone)
  const body = createCylinder(`${id}_body`, 0.2, 0, 0.6, 10);
  body.position.y = 0;
  body.rotation.z = 0.15; // slight tilt
  body.material = mat(`${id}_bodyMat`, new Color(1, 0.5, 0.1), new Color(0.2, 0.08, 0.01));
  root.add(body);
  // Green leafy top (3 small elongated cones)
  const leafMat = mat(`${id}_leafMat`, new Color(0.2, 0.7, 0.15), new Color(0.04, 0.15, 0.02));
  for (let i = 0; i < 3; i++) {
    const leaf = createCylinder(`${id}_leaf${i}`, 0, 0.08, 0.25, 6);
    leaf.position.set((i - 1) * 0.06, 0.4, 0);
    leaf.rotation.z = (i - 1) * 0.25;
    leaf.material = leafMat;
    root.add(leaf);
  }
  return root;
}

function buildBallIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_ball`;
  const ball = createSphere(`${id}_sphere`, 0.55, 12);
  ball.material = mat(`${id}_ballMat`, new Color(1, 0.7, 0.15), new Color(0.3, 0.18, 0.03));
  root.add(ball);
  // Stripe across the ball
  const stripe = createTorus(`${id}_stripe`, 0.56, 0.04, 24);
  stripe.material = mat(`${id}_stripeMat`, new Color(0.95, 0.35, 0.1), new Color(0.2, 0.06, 0.01));
  root.add(stripe);
  return root;
}

function buildElephantIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_elephant`;
  const gray = new Color(0.6, 0.6, 0.65);
  const grayEm = new Color(0.1, 0.1, 0.12);
  // Head
  const head = createSphere(`${id}_head`, 0.55, 10);
  head.material = mat(`${id}_headMat`, gray, grayEm);
  root.add(head);
  // Trunk (curved cylinder)
  const trunk = createCylinder(`${id}_trunk`, 0.1, 0.06, 0.4, 8);
  trunk.position.set(0, -0.2, 0.2);
  trunk.rotation.x = -0.6;
  trunk.material = mat(`${id}_trunkMat`, gray.clone().multiplyScalar(0.9), grayEm);
  root.add(trunk);
  // Ears (large flat discs)
  for (let side = -1; side <= 1; side += 2) {
    const ear = createDisc(`${id}_ear${side}`, 0.22, 10);
    ear.position.set(side * 0.32, 0.05, 0);
    ear.rotation.y = side * 0.3;
    ear.material = mat(`${id}_earMat${side}`, new Color(0.65, 0.55, 0.6), new Color(0.1, 0.06, 0.08));
    root.add(ear);
  }
  // Eyes
  const eyeMat = mat(`${id}_eyeMat`, new Color(0.1, 0.1, 0.1), new Color(0.05, 0.05, 0.05));
  for (let side = -1; side <= 1; side += 2) {
    const eye = createSphere(`${id}_eye${side}`, 0.08);
    eye.position.set(side * 0.14, 0.1, 0.24);
    eye.material = eyeMat;
    root.add(eye);
  }
  // Water droplets (3 small blue spheres spraying from trunk)
  const dropMat = mat(`${id}_dropMat`, new Color(0.3, 0.7, 1), new Color(0.1, 0.25, 0.4));
  for (let i = 0; i < 3; i++) {
    const drop = createSphere(`${id}_drop${i}`, 0.07, 6);
    drop.position.set((i - 1) * 0.1, -0.3 - i * 0.06, 0.35 + i * 0.05);
    drop.material = dropMat;
    root.add(drop);
  }
  return root;
}

function buildBubblesIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_bubbles`;
  const bubbleMat = mat(`${id}_bubMat`, new Color(0.7, 0.9, 1), new Color(0.15, 0.25, 0.35));
  bubbleMat.opacity = 0.7;
  bubbleMat.transparent = true;
  // Cluster of 5 bubbles at varied sizes and positions
  const bubbles = [
    { pos: new Vector3(0, 0.05, 0), size: 0.4 },
    { pos: new Vector3(0.22, 0.25, 0.1), size: 0.28 },
    { pos: new Vector3(-0.2, 0.2, -0.05), size: 0.32 },
    { pos: new Vector3(0.1, -0.15, 0.15), size: 0.22 },
    { pos: new Vector3(-0.1, 0.4, 0.08), size: 0.18 },
  ];
  for (let i = 0; i < bubbles.length; i++) {
    const b = createSphere(`${id}_b${i}`, bubbles[i].size, 10);
    b.position.copy(bubbles[i].pos);
    b.material = bubbleMat;
    root.add(b);
  }
  return root;
}

function buildPaletteIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_palette`;
  // Palette base (flattened sphere — paint palette shape)
  const base = createSphere(`${id}_base`, 0.7, 10);
  base.scale.set(1.2, 0.2, 1);
  base.material = mat(`${id}_baseMat`, new Color(0.85, 0.75, 0.6), new Color(0.12, 0.1, 0.07));
  root.add(base);
  // Paint dabs (small colored spheres on the palette)
  const dabColors = [new Color(1, 0.2, 0.2), new Color(0.2, 0.5, 1), new Color(1, 0.85, 0), new Color(0.2, 0.8, 0.3), new Color(1, 0.4, 0.7)];
  const dabPositions = [
    new Vector3(-0.18, 0.1, 0.15),
    new Vector3(0.15, 0.1, 0.18),
    new Vector3(0.22, 0.1, -0.08),
    new Vector3(-0.1, 0.1, -0.15),
    new Vector3(0.0, 0.1, 0.02),
  ];
  for (let i = 0; i < dabColors.length; i++) {
    const dab = createSphere(`${id}_dab${i}`, 0.12, 6);
    dab.position.copy(dabPositions[i]);
    dab.scale.y = 0.5;
    dab.material = mat(`${id}_dabMat${i}`, dabColors[i], dabColors[i].clone().multiplyScalar(0.3));
    root.add(dab);
  }
  // Brush handle
  const brush = createCylinder(`${id}_brush`, 0.04, 0.04, 0.4, 6);
  brush.position.set(0.35, 0.12, -0.1);
  brush.rotation.z = -0.5;
  brush.material = mat(`${id}_brushMat`, new Color(0.6, 0.4, 0.2));
  root.add(brush);
  // Brush tip
  const tip = createCylinder(`${id}_tip`, 0.06, 0.03, 0.1, 6);
  tip.position.set(0.45, 0.04, -0.14);
  tip.rotation.z = -0.5;
  tip.material = mat(`${id}_tipMat`, new Color(0.9, 0.3, 0.3), new Color(0.2, 0.05, 0.05));
  root.add(tip);
  return root;
}

function buildBlocksIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_blocks`;
  // Triangle on top of a square — classic shape-builder icon
  const square = createBox(`${id}_sq`, 0.4, 0.4, 0.4);
  square.position.y = -0.1;
  square.material = mat(`${id}_sqMat`, new Color(0.3, 0.5, 1), new Color(0.06, 0.1, 0.25));
  root.add(square);
  // Triangle (3-sided cylinder) on top
  const tri = createCylinder(`${id}_tri`, 0.45, 0.45, 0.35, 3);
  tri.position.y = 0.28;
  tri.material = mat(`${id}_triMat`, new Color(1, 0.8, 0.1), new Color(0.25, 0.18, 0.02));
  root.add(tri);
  // Small circle on the side
  const circ = createSphere(`${id}_circ`, 0.22, 8);
  circ.position.set(0.3, -0.1, 0);
  circ.material = mat(`${id}_circMat`, new Color(0.9, 0.25, 0.25), new Color(0.2, 0.04, 0.04));
  root.add(circ);
  return root;
}

function buildTeddyIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_teddy`;
  const brown = new Color(0.65, 0.4, 0.2);
  const brownEm = new Color(0.12, 0.07, 0.03);
  // Body
  const body = createSphere(`${id}_body`, 0.45, 8);
  body.position.y = -0.12;
  body.material = mat(`${id}_bodyMat`, brown, brownEm);
  root.add(body);
  // Head
  const head = createSphere(`${id}_head`, 0.38, 8);
  head.position.y = 0.2;
  head.material = mat(`${id}_headMat`, brown, brownEm);
  root.add(head);
  // Ears
  for (let side = -1; side <= 1; side += 2) {
    const ear = createSphere(`${id}_ear${side}`, 0.14, 6);
    ear.position.set(side * 0.17, 0.38, 0);
    ear.material = mat(`${id}_earMat${side}`, brown.clone().multiplyScalar(0.8), brownEm);
    root.add(ear);
  }
  // Snout
  const snout = createSphere(`${id}_snout`, 0.15, 6);
  snout.position.set(0, 0.15, 0.16);
  snout.material = mat(`${id}_snoutMat`, new Color(0.8, 0.65, 0.45), new Color(0.12, 0.1, 0.06));
  root.add(snout);
  // Nose
  const nose = createSphere(`${id}_nose`, 0.06, 6);
  nose.position.set(0, 0.17, 0.23);
  nose.material = mat(`${id}_noseMat`, new Color(0.1, 0.08, 0.06));
  root.add(nose);
  // Eyes
  const eyeMat = mat(`${id}_eyeMat`, new Color(0.08, 0.06, 0.05));
  for (let side = -1; side <= 1; side += 2) {
    const eye = createSphere(`${id}_eye${side}`, 0.06, 6);
    eye.position.set(side * 0.1, 0.25, 0.16);
    eye.material = eyeMat;
    root.add(eye);
  }
  return root;
}

function buildJarIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_jar`;
  // Glass jar body
  const jarMat = mat(`${id}_jarMat`, new Color(0.7, 0.85, 0.9), new Color(0.1, 0.15, 0.2));
  jarMat.opacity = 0.5;
  jarMat.transparent = true;
  const jar = createCylinder(`${id}_jar`, 0.4, 0.4, 0.5, 16);
  jar.position.y = -0.05;
  jar.material = jarMat;
  root.add(jar);
  // Lid
  const lid = createCylinder(`${id}_lid`, 0.42, 0.42, 0.08, 16);
  lid.position.y = 0.24;
  lid.material = mat(`${id}_lidMat`, new Color(0.5, 0.35, 0.2), new Color(0.08, 0.05, 0.02));
  root.add(lid);
  // Glowing firefly dots inside (3-4 small emissive spheres)
  const glowMat = mat(`${id}_glowMat`, new Color(0.8, 1, 0.3), new Color(0.6, 0.9, 0.2));
  const glowPositions = [new Vector3(0.05, 0.05, 0.05), new Vector3(-0.08, -0.08, -0.03), new Vector3(0.06, 0.12, -0.06), new Vector3(-0.04, -0.02, 0.08)];
  for (let i = 0; i < glowPositions.length; i++) {
    const dot = createSphere(`${id}_glow${i}`, 0.06, 6);
    dot.position.copy(glowPositions[i]);
    dot.material = glowMat;
    root.add(dot);
  }
  return root;
}

function buildSharkFinIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_shark`;
  // Water surface (flat blue disc)
  const water = createDisc(`${id}_water`, 0.35, 16);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.15;
  water.material = mat(`${id}_waterMat`, new Color(0.15, 0.4, 0.7), new Color(0.05, 0.12, 0.25));
  root.add(water);
  // Dorsal fin poking above water
  const fin = createCylinder(`${id}_fin`, 0, 0.25, 0.4, 3);
  fin.position.y = 0.08;
  fin.rotation.z = 0.15; // slight lean
  fin.material = mat(`${id}_finMat`, new Color(0.4, 0.5, 0.6), new Color(0.08, 0.1, 0.14));
  root.add(fin);
  // Small wave ripples (thin toruses)
  const rippleMat = mat(`${id}_ripMat`, new Color(0.5, 0.7, 1), new Color(0.1, 0.15, 0.25));
  rippleMat.opacity = 0.5;
  rippleMat.transparent = true;
  for (let i = 0; i < 2; i++) {
    const ripple = createTorus(`${id}_rip${i}`, 0.3 + i * 0.2, 0.02, 16);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = -0.14;
    ripple.material = rippleMat;
    root.add(ripple);
  }
  // Friendly eye on the fin base
  const eye = createSphere(`${id}_eye`, 0.06, 6);
  eye.position.set(0.06, -0.02, 0.1);
  eye.material = mat(`${id}_eyeMat`, new Color(0.1, 0.1, 0.1));
  root.add(eye);
  // Fish friend (tiny orange fish nearby)
  const fish = createSphere(`${id}_fish`, 0.1, 6);
  fish.scale.set(1.4, 0.8, 0.8);
  fish.position.set(-0.25, -0.1, 0.1);
  const fishMat = mat(`${id}_fishMat`, new Color(1, 0.5, 0.1), new Color(0.25, 0.1, 0.02));
  fish.material = fishMat;
  root.add(fish);
  // Fish tail
  const tail = createCylinder(`${id}_ftail`, 0.08, 0, 0.08, 3);
  tail.position.set(-0.33, -0.1, 0.1);
  tail.rotation.z = Math.PI / 2;
  tail.material = fishMat;
  root.add(tail);
  return root;
}

// ── Icon builder dispatch ──

const ICON_BUILDERS: Record<MiniGameId, (id: string) => Group> = {
  'bubble-pop': buildBubblesIcon,
  fireflies: buildJarIcon,
  'little-shark': buildSharkFinIcon,
};

/**
 * Icon builders retained for future minigames that are not currently registered.
 *
 * Keeping these builders in one exported map avoids losing authored assets when
 * a game is temporarily out of rotation, while still satisfying the repo's
 * unused-symbol checks.
 */
export const INACTIVE_ICON_BUILDERS = {
  balloon: buildBalloonIcon,
  truck: buildTruckIcon,
  carrot: buildCarrotIcon,
  ball: buildBallIcon,
  elephant: buildElephantIcon,
  palette: buildPaletteIcon,
  blocks: buildBlocksIcon,
  teddy: buildTeddyIcon,
} as const;

// ════════════════════════════════════════════════════════════════════
// Portal assembly — pedestal + glow ring + game-specific icon
// ════════════════════════════════════════════════════════════════════

/**
 * Builds a glowing, floating game-launch portal and adds it to the scene.
 * Each portal features a game-specific 3D icon (balloon, truck, shark fin, etc.)
 * on a lit pedestal with a pulsing glow ring and gentle float/rotation animations.
 * Returns the root group and an array of tappable meshes for raycaster-based interaction.
 *
 * @param scene - The Three.js scene to add the portal to.
 * @param config - Portal configuration with game ID, position, and theme color.
 * @param nav - Navigation actions providing launchMiniGame.
 * @returns The portal result containing root group and tappable meshes.
 */
export function buildGamePortal(scene: Scene, config: GamePortalConfig, nav: NavigationActions): GamePortalResult {
  const { gameId, position, color } = config;
  const root = new Group();
  root.name = `portal_${gameId}_root`;
  root.position.copy(position);

  const tappableMeshes: Object3D[] = [];

  // ── Pedestal ──
  const pedestal = createCylinder(`portal_${gameId}_pedestal`, 1.4, 1.4, 0.12, 24);
  pedestal.position.y = 0.06;
  const pedestalMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.4),
    emissive: color.clone().multiplyScalar(0.15),
    roughness: 0.7,
    metalness: 0.05,
  });
  pedestalMat.name = `portal_${gameId}_pedestalMat`;
  pedestal.material = pedestalMat;
  pedestal.receiveShadow = true;
  pedestal.castShadow = true;
  root.add(pedestal);
  tappableMeshes.push(pedestal);

  // ── Game-specific icon ──
  const builder = ICON_BUILDERS[gameId];
  const icon = builder(`portal_${gameId}`);
  icon.position.y = 0.75;
  root.add(icon);

  // Collect all mesh children of the icon for tapping and shadows
  icon.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      tappableMeshes.push(child);
    }
  });
  pedestal.castShadow = true;

  // ── Float animation (gentle bob) via GSAP ──
  gsap.to(icon.position, {
    y: 0.95,
    duration: 3, // 90 frames at 30fps = 3s
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });

  // ── Slow rotation on icon via GSAP ──
  gsap.to(icon.rotation, {
    y: '+=6.283185307',
    duration: 8, // 240 frames at 30fps = 8s
    repeat: -1,
    ease: 'none',
  });

  // ── Pick trigger callback (caller wires via raycaster) ──
  const launchGame = () => {
    triggerSound('sfx_shared_tap_fallback');
    triggerSound('sfx_hub_toybox_open');
    nav.launchMiniGame(gameId);
  };

  // Store the launch handler on each tappable mesh via userData
  for (const mesh of tappableMeshes) {
    mesh.userData.onTap = launchGame;
  }

  scene.add(root);

  return { root, tappableMeshes };
}

/**
 * Builds multiple game portals for a world scene.
 *
 * @param scene - The Three.js scene.
 * @param configs - Array of portal configurations.
 * @param nav - Navigation actions.
 * @returns Array of portal results for disposal and interaction tracking.
 */
export function buildGamePortals(scene: Scene, configs: GamePortalConfig[], nav: NavigationActions): GamePortalResult[] {
  return configs.map((config) => buildGamePortal(scene, config, nav));
}
