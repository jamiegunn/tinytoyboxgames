/**
 * Scene construction for Cannonball Splash.
 *
 * Builds the ocean, sky, clouds, islands, deck, railing, cannon, and lighting.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import { C, type CannonRig, type EnvironmentRig } from '../types';

// ── Material factory ────────────────────────────────────────────────────────

function mat(
  name: string,
  color: [number, number, number],
  opts: { metalness?: number; roughness?: number; emissive?: [number, number, number]; transparent?: boolean; opacity?: number } = {},
): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color(...color),
    metalness: opts.metalness ?? 0,
    roughness: opts.roughness ?? 0.7,
  });
  if (opts.emissive) m.emissive = new Color(...opts.emissive);
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 1;
  }
  m.name = name;
  return m;
}

// ── Cannon builder ──────────────────────────────────────────────────────────

function createCannon(): CannonRig {
  const root = new Group();
  root.name = 'cannon_root';
  root.position.set(C.CANNON_X, C.CANNON_Y, C.CANNON_Z);

  const woodMat = mat('cannon_wood', [0.5, 0.35, 0.2], { roughness: 0.7 });
  const ironMat = mat('cannon_barrel', [0.2, 0.2, 0.22], { metalness: 0.7, roughness: 0.35 });
  const bandMat = mat('cannon_band', [0.15, 0.15, 0.17], { metalness: 0.8, roughness: 0.3 });
  const mouthMat = mat('cannon_mouth', [0.05, 0.05, 0.05], { roughness: 0.9 });

  // Base (wood carriage)
  const base = new Mesh(new BoxGeometry(1.2, 0.4, 1.0), woodMat);
  base.name = 'cannon_base';
  base.position.y = -0.2;
  base.castShadow = true;
  root.add(base);

  // Barrel group (rotates to aim)
  const barrelGroup = new Group();
  barrelGroup.name = 'cannon_barrel_group';
  barrelGroup.position.y = 0.1;

  const barrelBody = new Mesh(new CylinderGeometry(0.25, 0.25, 1.4, 12), ironMat);
  barrelBody.name = 'barrel_body';
  barrelBody.rotation.x = Math.PI / 2;
  barrelBody.position.z = -0.5;
  barrelBody.castShadow = true;
  barrelGroup.add(barrelBody);

  // Flared mouth
  const mouth = new Mesh(new CylinderGeometry(0.3, 0.25, 0.15, 12), mouthMat);
  mouth.name = 'barrel_mouth';
  mouth.rotation.x = Math.PI / 2;
  mouth.position.z = -1.2;
  barrelGroup.add(mouth);

  // Decorative bands
  for (let i = 0; i < 3; i++) {
    const band = new Mesh(new TorusGeometry(0.27, 0.025, 6, 16), bandMat);
    band.name = `barrel_band_${i}`;
    band.position.z = -0.3 - i * 0.35;
    band.rotation.x = Math.PI / 2;
    barrelGroup.add(band);
  }

  root.add(barrelGroup);

  // Wheels
  for (const side of [-1, 1]) {
    const wheel = new Mesh(new CylinderGeometry(0.3, 0.3, 0.1, 12), woodMat);
    wheel.name = `wheel_${side > 0 ? 'right' : 'left'}`;
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.65, -0.3, 0.1);
    wheel.castShadow = true;
    root.add(wheel);
  }

  // Nameplate
  const plate = new Mesh(new BoxGeometry(0.4, 0.15, 0.05), ironMat);
  plate.name = 'nameplate';
  plate.position.set(0, -0.05, 0.52);
  root.add(plate);

  return { root, barrelGroup, recoilTimer: 0, idlePhase: 0, aimYaw: 0, aimPitch: 0 };
}

// ── Main environment builder ────────────────────────────────────────────────

/**
 * Creates the full game environment and adds everything to the scene.
 * Configures the camera for the game's perspective.
 */
export function createGameEnvironment(scene: Scene, camera: PerspectiveCamera): EnvironmentRig {
  // ── Camera setup ──
  camera.fov = C.CAMERA_FOV;
  camera.near = C.CAMERA_NEAR;
  camera.far = C.CAMERA_FAR;
  camera.position.set(C.CAMERA_POS_X, C.CAMERA_POS_Y, C.CAMERA_POS_Z);
  camera.lookAt(new Vector3(C.CAMERA_LOOK_X, C.CAMERA_LOOK_Y, C.CAMERA_LOOK_Z));
  camera.updateProjectionMatrix();

  // ── Lighting ──
  const keyLight = new DirectionalLight(new Color(1.0, 0.88, 0.6), 0.9);
  keyLight.name = 'cs_keyLight';
  const keyDir = new Vector3(-0.3, -1, -0.5).normalize();
  keyLight.position.set(-keyDir.x * 15, -keyDir.y * 15, -keyDir.z * 15);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.002;
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 15;
  keyLight.shadow.camera.bottom = -15;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 30;
  scene.add(keyLight);

  const fillLight = new HemisphereLight(new Color(0.4, 0.55, 0.8), new Color(0.1, 0.08, 0.06), 0.45);
  fillLight.name = 'cs_fillLight';
  scene.add(fillLight);

  const accentLight = new PointLight(new Color(1.0, 0.65, 0.3), 0.3, 0);
  accentLight.name = 'cs_accentLight';
  accentLight.position.set(0, 2.5, 1.5);
  scene.add(accentLight);

  // ── Ocean ──
  const oceanMat = mat('ocean', [0.04, 0.18, 0.35], { metalness: 0.1, roughness: 0.3 });
  const ocean = new Mesh(new PlaneGeometry(40, 30), oceanMat);
  ocean.name = 'cs_ocean';
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0, -13);
  ocean.receiveShadow = true;
  scene.add(ocean);

  // Foam strips
  const foamMat = mat('foam_strip', [1, 1, 1], { transparent: true, opacity: 0.3, roughness: 0.5 });
  const foamStrips: Mesh[] = [];
  const foamZPositions = [-6, -10, -14, -18];
  for (let i = 0; i < foamZPositions.length; i++) {
    const foam = new Mesh(new BoxGeometry(20, 0.02, 0.15), foamMat);
    foam.name = `cs_foam_${i}`;
    foam.position.set(0, 0.01, foamZPositions[i]);
    scene.add(foam);
    foamStrips.push(foam);
  }

  // ── Sky ──
  const skyMat = mat('sky_base', [0.15, 0.25, 0.55], { emissive: [0.05, 0.08, 0.15], roughness: 1 });
  const skyBase = new Mesh(new PlaneGeometry(50, 20), skyMat);
  skyBase.name = 'cs_skyBase';
  skyBase.position.set(0, 8, -25);
  scene.add(skyBase);

  const horizonMat = mat('sky_horizon', [0.95, 0.5, 0.15], { transparent: true, opacity: 0.25, roughness: 1 });
  const skyHorizon = new Mesh(new PlaneGeometry(50, 10), horizonMat);
  skyHorizon.name = 'cs_skyHorizon';
  skyHorizon.position.set(0, 4, -24.5);
  scene.add(skyHorizon);

  // Clouds
  const cloudMat = mat('cloud', [1, 1, 1], { emissive: [0.15, 0.15, 0.15], roughness: 0.8 });
  const clouds: Mesh[] = [];
  const cloudData = [
    { x: -8, y: 10, z: -22, sx: 3, sy: 0.4, sz: 1 },
    { x: 3, y: 11, z: -23, sx: 4, sy: 0.35, sz: 1.2 },
    { x: 10, y: 9.5, z: -21, sx: 2.5, sy: 0.45, sz: 0.9 },
    { x: -3, y: 12, z: -24, sx: 3.5, sy: 0.3, sz: 1.1 },
  ];
  for (let i = 0; i < cloudData.length; i++) {
    const cd = cloudData[i];
    const cloud = new Mesh(new SphereGeometry(1, 8, 6), cloudMat);
    cloud.name = `cs_cloud_${i}`;
    cloud.scale.set(cd.sx, cd.sy, cd.sz);
    cloud.position.set(cd.x, cd.y, cd.z);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // ── Islands ──
  const islandMat = mat('island_green', [0.15, 0.3, 0.12], { roughness: 0.8 });
  const islands: Group[] = [];

  // Island 1
  const island1 = new Group();
  island1.name = 'cs_island_1';
  const islandBody1 = new Mesh(new SphereGeometry(1, 8, 6), islandMat);
  islandBody1.scale.set(2, 0.5, 1);
  islandBody1.position.set(-10, -0.1, -22);
  island1.add(islandBody1);
  scene.add(island1);
  islands.push(island1);

  // Island 2 (with palm tree)
  const island2 = new Group();
  island2.name = 'cs_island_2';
  const islandBody2 = new Mesh(new SphereGeometry(0.8, 8, 6), islandMat);
  islandBody2.scale.set(2, 0.5, 1);
  islandBody2.position.set(12, -0.1, -24);
  island2.add(islandBody2);
  // Palm trunk
  const trunkMat = mat('palm_trunk', [0.4, 0.28, 0.15], { roughness: 0.8 });
  const trunk = new Mesh(new CylinderGeometry(0.03, 0.04, 0.35, 6), trunkMat);
  trunk.position.set(12, 0.25, -24);
  island2.add(trunk);
  // Palm canopy
  const canopyMat = mat('palm_canopy', [0.2, 0.5, 0.15], { roughness: 0.7 });
  const canopy = new Mesh(new SphereGeometry(0.15, 6, 4), canopyMat);
  canopy.scale.set(1.5, 0.6, 1.5);
  canopy.position.set(12, 0.45, -24);
  island2.add(canopy);
  scene.add(island2);
  islands.push(island2);

  // ── Deck floor ──
  const deckMat = mat('deck_plank', [0.55, 0.38, 0.22], { roughness: 0.7 });
  const deckFloor = new Mesh(new PlaneGeometry(18, 5), deckMat);
  deckFloor.name = 'cs_deck';
  deckFloor.rotation.x = -Math.PI / 2;
  deckFloor.position.set(0, -0.01, 1.5);
  deckFloor.receiveShadow = true;
  scene.add(deckFloor);

  // Plank seams
  const seamMat = mat('plank_seam', [0.3, 0.2, 0.1], { roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const seam = new Mesh(new BoxGeometry(16, 0.005, 0.03), seamMat);
    seam.name = `cs_seam_${i}`;
    seam.position.set(0, 0.001, 0.5 + i * 1.2);
    scene.add(seam);
  }

  // ── Railing ──
  const railingGroup = new Group();
  railingGroup.name = 'cs_railing';
  const railMat = mat('railing_wood', [0.5, 0.35, 0.2], { roughness: 0.7 });
  const trimMat = mat('railing_trim', [0.4, 0.28, 0.15], { roughness: 0.6 });

  // Horizontal top rail
  const topRail = new Mesh(new CylinderGeometry(0.06, 0.06, 18, 8), trimMat);
  topRail.name = 'cs_topRail';
  topRail.rotation.z = Math.PI / 2;
  topRail.position.set(0, 0.8, -0.8);
  topRail.castShadow = true;
  railingGroup.add(topRail);

  // Horizontal lower rail
  const lowerRail = new Mesh(new BoxGeometry(18, 0.08, 0.06), railMat);
  lowerRail.name = 'cs_lowerRail';
  lowerRail.position.set(0, 0.35, -0.8);
  railingGroup.add(lowerRail);

  // Vertical posts
  for (let i = -4; i <= 4; i++) {
    const post = new Mesh(new CylinderGeometry(0.04, 0.04, 0.85, 6), railMat);
    post.name = `cs_post_${i}`;
    post.position.set(i * 2, 0.4, -0.8);
    post.castShadow = true;
    railingGroup.add(post);
  }
  scene.add(railingGroup);

  // ── Cannon ──
  const cannon = createCannon();
  scene.add(cannon.root);

  // ── Dispose function ──
  const allLights = [keyLight, fillLight, accentLight];

  function dispose(): void {
    for (const light of allLights) light.removeFromParent();
    disposeMeshDeep(ocean);
    for (const f of foamStrips) disposeMeshDeep(f);
    disposeMeshDeep(skyBase);
    disposeMeshDeep(skyHorizon);
    for (const c of clouds) disposeMeshDeep(c);
    for (const isl of islands) disposeMeshDeep(isl);
    disposeMeshDeep(deckFloor);
    disposeMeshDeep(railingGroup);
    disposeMeshDeep(cannon.root);

    // Dispose seams and any remaining children
    scene.traverse((child) => {
      if (child.name.startsWith('cs_seam') || child.name.startsWith('plank_seam')) {
        const m = child as Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as MeshStandardMaterial).dispose();
      }
    });
  }

  return {
    ocean,
    skyBase,
    skyHorizon,
    clouds,
    foamStrips,
    islands,
    deckFloor,
    railing: railingGroup,
    cannon,
    dispose,
  };
}

/**
 * Updates per-frame environment animations: ocean wave, cloud drift, foam drift.
 */
export function updateEnvironment(rig: EnvironmentRig, elapsedTime: number): void {
  // Ocean wave
  const primaryWave = 0.08 * Math.sin(elapsedTime * 0.8);
  const secondaryWave = 0.04 * Math.sin(elapsedTime * 1.3 + 2.0);
  rig.ocean.position.y = primaryWave + secondaryWave;

  // Cloud drift with wrapping
  for (let i = 0; i < rig.clouds.length; i++) {
    rig.clouds[i].position.x -= 0.05 * (1 / 60); // ~0.05 units/sec
    if (rig.clouds[i].position.x < -25) {
      rig.clouds[i].position.x = 25;
    }
  }

  // Foam drift
  for (let i = 0; i < rig.foamStrips.length; i++) {
    const offset = Math.sin(elapsedTime * 0.3 + i * 1.5) * 2;
    rig.foamStrips[i].position.x = offset;
  }
}
