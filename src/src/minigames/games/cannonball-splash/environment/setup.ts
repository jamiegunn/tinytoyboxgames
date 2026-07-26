/**
 * Scene construction for Cannonball Splash.
 *
 * Builds the ocean, sky, clouds, sun, islands, ship, cannon, and lighting. The
 * sky is an unlit vertex-colored gradient plane and the ocean is a lit gradient
 * plane whose vertices actually move, so the scene reads as a sunny toy seaside
 * diorama under ACES tone mapping.
 */

import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
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

// ── Ocean surface ───────────────────────────────────────────────────────────

/** World z the ocean plane is centred on (its local +y runs toward -z). */
const OCEAN_CENTER_Z = -21;

/**
 * Height of the water surface at a world point.
 *
 * The "waves" used to be the whole rigid plane sliding up and down in y, which
 * moves every drop of water in lockstep and reads as a lift, not a sea. Three
 * summed swells rolling toward the camera give the surface real shape. The
 * z-terms carry most of the amplitude and the x-term is deliberately small, so
 * the long foam and wave-band strips can ride the surface without clipping
 * through it along their width.
 * @param x - World x coordinate.
 * @param z - World z coordinate.
 * @param t - Elapsed time in seconds.
 * @returns Water height in world units.
 */
export function sampleOceanHeight(x: number, z: number, t: number): number {
  return 0.09 * Math.sin(0.55 * z + 1.1 * t) + 0.05 * Math.sin(0.31 * z - 0.7 * t + 1.3) + 0.03 * Math.sin(0.23 * x + 0.8 * t);
}

// Pushes the wave heights into the ocean plane's vertices. The plane is rotated
// -90° about x, so its local +z displaces world +y and its local +y runs toward
// world -z.
function updateOceanSurface(ocean: Mesh, t: number): void {
  const pos = ocean.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, sampleOceanHeight(pos.getX(i), OCEAN_CENTER_Z - pos.getY(i), t));
  }
  pos.needsUpdate = true;
  ocean.geometry.computeVertexNormals();
}

// ── Gradient helpers ────────────────────────────────────────────────────────

/**
 * Writes a vertical color gradient into a plane geometry's vertex colors.
 * The gradient is sampled along the plane's local +y axis through the given
 * color stops (each stop is [t, color] with t in [0, 1], sorted ascending).
 * @param geometry - The PlaneGeometry to write colors into.
 * @param stops - Gradient stops from bottom (t = 0) to top (t = 1).
 */
function applyVerticalGradient(geometry: PlaneGeometry, stops: Array<[number, Color]>): void {
  const pos = geometry.attributes.position;
  const params = geometry.parameters;
  const halfH = params.height / 2;
  const colors: number[] = [];
  const out = new Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) + halfH) / params.height));
    // Find surrounding stops
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        lo = stops[s];
        hi = stops[s + 1];
        break;
      }
    }
    const span = Math.max(1e-6, hi[0] - lo[0]);
    out.copy(lo[1]).lerp(hi[1], (t - lo[0]) / span);
    colors.push(out.r, out.g, out.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
}

/**
 * Creates a soft radial glow texture on an offscreen canvas for the sun sprite.
 * @returns A CanvasTexture with a warm white-to-transparent radial gradient.
 */
function createSunGlowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255, 246, 210, 0.9)');
    grad.addColorStop(0.35, 'rgba(255, 232, 170, 0.45)');
    grad.addColorStop(1, 'rgba(255, 226, 150, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/**
 * Builds a puffy toy cloud as a cluster of overlapping soft-shaded spheres.
 * @param name - Name assigned to the cloud group.
 * @param material - Shared cloud material.
 * @param blobScale - Overall size multiplier for the cluster.
 * @returns The cloud group ready for placement.
 */
function createPuffyCloud(name: string, material: MeshStandardMaterial, blobScale: number): Group {
  const cloud = new Group();
  cloud.name = name;
  const blobs = [
    { x: 0, y: 0.15, s: 1.0 },
    { x: -0.95, y: -0.1, s: 0.72 },
    { x: 0.95, y: -0.08, s: 0.78 },
    { x: -0.45, y: 0.32, s: 0.6 },
    { x: 0.5, y: 0.3, s: 0.55 },
  ];
  blobs.forEach((b, i) => {
    const blob = new Mesh(new SphereGeometry(1.4 * b.s * blobScale, 10, 8), material);
    blob.name = `${name}_blob_${i}`;
    blob.position.set(b.x * 1.6 * blobScale, b.y * 1.4 * blobScale, 0);
    blob.scale.set(1.15, 0.68, 0.9);
    cloud.add(blob);
  });
  return cloud;
}

/**
 * Builds a small stylized palm tree (trunk + leafy canopy) for horizon islands.
 * @param trunkMat - Shared trunk material.
 * @param canopyMat - Shared canopy material.
 * @param height - Trunk height in world units.
 * @param lean - Sideways lean in radians.
 * @returns The palm tree group with its base at local origin.
 */
function createPalmTree(trunkMat: MeshStandardMaterial, canopyMat: MeshStandardMaterial, height: number, lean: number): Group {
  const palm = new Group();
  palm.name = 'cs_palm';

  const trunk = new Mesh(new CylinderGeometry(0.08, 0.14, height, 6), trunkMat);
  trunk.name = 'palm_trunk';
  trunk.position.y = height / 2;
  palm.add(trunk);

  // Canopy: a ring of flattened fronds around a center puff
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const frond = new Mesh(new SphereGeometry(0.45, 6, 4), canopyMat);
    frond.name = `palm_frond_${i}`;
    frond.scale.set(1.4, 0.28, 0.55);
    frond.position.set(Math.cos(angle) * 0.5, height + 0.05, Math.sin(angle) * 0.5);
    frond.rotation.y = -angle;
    frond.rotation.z = 0.35;
    palm.add(frond);
  }
  const centerPuff = new Mesh(new SphereGeometry(0.3, 6, 4), canopyMat);
  centerPuff.name = 'palm_center';
  centerPuff.scale.set(1, 0.6, 1);
  centerPuff.position.y = height + 0.15;
  palm.add(centerPuff);

  palm.rotation.z = lean;
  return palm;
}

// ── Ship builder ────────────────────────────────────────────────────────────

// Deck outline, in the extrusion shape's local frame: sx is world x and sy is
// world -z, so the bow tip at sy = 3 sits at z = -3, out in front of the child,
// and the stern is behind the camera.
const SHIP_OUTLINE: Array<[number, number]> = [
  [0, 3.0],
  [1.1, 2.2],
  [1.9, 1.0],
  [2.3, -0.6],
  [2.2, -2.4],
  [-2.2, -2.4],
  [-2.3, -0.6],
  [-1.9, 1.0],
  [-1.1, 2.2],
];

// Builds the deck outline as a Shape, optionally shrunk toward the centreline
// to give the bulwark its inner edge.
function shipOutlineShape(scale: number): Shape {
  const shape = new Shape();
  for (let i = 0; i < SHIP_OUTLINE.length; i++) {
    const [sx, sy] = SHIP_OUTLINE[i];
    if (i === 0) shape.moveTo(sx * scale, sy * scale);
    else shape.lineTo(sx * scale, sy * scale);
  }
  shape.closePath();
  return shape;
}

// Makes an object and all its descendants invisible to the raycaster.
//
// The framework picks with intersectObjects(scene.children, true), so any mesh
// between the camera and the water can swallow a tap. The old railing's nine
// posts sat right across the child's view and did exactly that: taps that
// landed on a post produced no shot at all. Scenery must never eat a tap.
function makeNonPickable(object: Object3D): void {
  object.traverse((child) => {
    child.raycast = () => {};
  });
}

/**
 * Builds the ship the child is standing on: a pointed hull, a planked deck and
 * a bulwark to lean over.
 *
 * The "ship" was previously a flat 18x5 rectangle at z = 1.5 — behind the
 * camera's near framing and with no silhouette at all, so nothing on screen
 * said where the cannon was firing from. An extruded hull with a bow gives the
 * lower third of the frame a boat.
 * @param materials - Deck, hull and rail materials (shared, disposed with the rig).
 * @param materials.deck - Planking on the deck's top face.
 * @param materials.hull - Painted hull sides.
 * @param materials.rail - Cap along the top of the bulwark.
 * @param materials.seam - Darker plank seams.
 * @returns The ship group, already excluded from raycasts.
 */
function createShip(materials: { deck: MeshStandardMaterial; hull: MeshStandardMaterial; rail: MeshStandardMaterial; seam: MeshStandardMaterial }): Group {
  const ship = new Group();
  ship.name = 'cs_ship';

  // Hull: extruded straight up, so ExtrudeGeometry's cap group (0) is the deck
  // and its side group (1) is the painted hull.
  const hullGeo = new ExtrudeGeometry(shipOutlineShape(1), { depth: 0.68, bevelEnabled: false, curveSegments: 2 });
  const hull = new Mesh(hullGeo, [materials.deck, materials.hull]);
  hull.name = 'cs_hull';
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.38; // deck top lands at y = 0.30, hull bottom at -0.38
  hull.receiveShadow = true;
  hull.castShadow = true;
  ship.add(hull);

  // Bulwark: the same outline with a shrunken copy punched out of it.
  const bulwarkShape = shipOutlineShape(1);
  bulwarkShape.holes.push(shipOutlineShape(0.87));
  const bulwarkGeo = new ExtrudeGeometry(bulwarkShape, { depth: 0.36, bevelEnabled: false, curveSegments: 2 });
  const bulwark = new Mesh(bulwarkGeo, [materials.rail, materials.hull]);
  bulwark.name = 'cs_bulwark';
  bulwark.rotation.x = -Math.PI / 2;
  bulwark.position.y = 0.3;
  bulwark.castShadow = true;
  ship.add(bulwark);

  // Plank seams, fore-and-aft, kept short enough to stay inside the bow taper.
  const seams = [
    { x: 0, length: 3.6, z: -0.4 },
    { x: -0.55, length: 3.4, z: -0.5 },
    { x: 0.55, length: 3.4, z: -0.5 },
    { x: -1.5, length: 2.2, z: 0 },
    { x: 1.5, length: 2.2, z: 0 },
  ];
  for (let i = 0; i < seams.length; i++) {
    const s = seams[i];
    const seam = new Mesh(new BoxGeometry(0.05, 0.012, s.length), materials.seam);
    seam.name = `cs_seam_${i}`;
    seam.position.set(s.x, 0.303, s.z);
    ship.add(seam);
  }

  makeNonPickable(ship);
  return ship;
}

// ── Cannon builder ──────────────────────────────────────────────────────────

function createCannon(): CannonRig {
  const root = new Group();
  root.name = 'cannon_root';
  root.position.set(C.CANNON_X, C.CANNON_Y, C.CANNON_Z);

  const woodMat = mat('cannon_wood', [0.58, 0.38, 0.2], { roughness: 0.65 });
  const bronzeMat = mat('cannon_barrel', [0.78, 0.5, 0.23], { metalness: 0.55, roughness: 0.32, emissive: [0.06, 0.03, 0.01] });
  const brassMat = mat('cannon_band', [0.95, 0.74, 0.32], { metalness: 0.65, roughness: 0.25, emissive: [0.08, 0.05, 0.01] });
  const mouthMat = mat('cannon_mouth', [0.28, 0.16, 0.07], { roughness: 0.8 });

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
  // Turret order: swing left/right first, then tip up. With the default XYZ the
  // pitch tilts the yaw axis and the barrel rolls as it traverses, which is why
  // computeCannonAim solves yaw/pitch in this frame.
  barrelGroup.rotation.order = 'YXZ';

  const barrelBody = new Mesh(new CylinderGeometry(0.25, 0.28, 1.4, 14), bronzeMat);
  barrelBody.name = 'barrel_body';
  barrelBody.rotation.x = Math.PI / 2;
  barrelBody.position.z = -0.5;
  barrelBody.castShadow = true;
  barrelGroup.add(barrelBody);

  // Flared mouth
  const mouth = new Mesh(new CylinderGeometry(0.31, 0.25, 0.16, 14), brassMat);
  mouth.name = 'barrel_mouth';
  mouth.rotation.x = Math.PI / 2;
  mouth.position.z = -1.2;
  barrelGroup.add(mouth);

  // Dark bore so the muzzle reads as an opening
  const bore = new Mesh(new CircleGeometry(0.2, 12), mouthMat);
  bore.name = 'barrel_bore';
  bore.position.z = -1.285;
  bore.rotation.y = Math.PI;
  barrelGroup.add(bore);

  // Decorative brass bands
  for (let i = 0; i < 3; i++) {
    const band = new Mesh(new TorusGeometry(0.27, 0.03, 6, 16), brassMat);
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

    const hub = new Mesh(new CylinderGeometry(0.09, 0.09, 0.12, 8), brassMat);
    hub.name = `wheel_hub_${side > 0 ? 'right' : 'left'}`;
    hub.rotation.z = Math.PI / 2;
    hub.position.set(side * 0.66, -0.3, 0.1);
    root.add(hub);
  }

  // Nameplate
  const plate = new Mesh(new BoxGeometry(0.4, 0.15, 0.05), brassMat);
  plate.name = 'nameplate';
  plate.position.set(0, -0.05, 0.52);
  root.add(plate);

  return { root, barrelGroup, recoilTimer: 0, idlePhase: 0, aimYaw: 0, aimPitch: 0 };
}

// ── Main environment builder ────────────────────────────────────────────────

/**
 * Creates the full game environment and adds everything to the scene.
 * Configures the camera for the game's perspective.
 * @param scene - Scene to add environment objects to.
 * @param camera - Camera to configure for the game view.
 * @returns The environment rig for per-frame update and disposal.
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
  const keyLight = new DirectionalLight(new Color(1.0, 0.9, 0.68), 1.0);
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

  const fillLight = new HemisphereLight(new Color(0.6, 0.72, 0.9), new Color(0.42, 0.32, 0.22), 0.6);
  fillLight.name = 'cs_fillLight';
  scene.add(fillLight);

  const accentLight = new PointLight(new Color(1.0, 0.65, 0.3), 0.3, 0);
  accentLight.name = 'cs_accentLight';
  accentLight.position.set(0, 2.5, 1.5);
  scene.add(accentLight);

  // ── Sky: unlit vertical gradient plane ──
  const skyGeo = new PlaneGeometry(150, 46, 1, 8);
  applyVerticalGradient(skyGeo, [
    [0, new Color(1.0, 0.9, 0.72)],
    [0.3, new Color(0.72, 0.84, 0.96)],
    [1, new Color(0.32, 0.58, 0.93)],
  ]);
  const skyMat = new MeshBasicMaterial({ vertexColors: true });
  skyMat.name = 'sky_gradient';
  const skyBase = new Mesh(skyGeo, skyMat);
  skyBase.name = 'cs_skyBase';
  skyBase.position.set(0, 15, -46);
  scene.add(skyBase);

  // ── Sun: warm disc + soft glow sprite ──
  const sun = new Group();
  sun.name = 'cs_sun';
  const sunDiscMat = new MeshBasicMaterial({ color: new Color(1.0, 0.9, 0.55) });
  sunDiscMat.name = 'sun_disc';
  const sunDisc = new Mesh(new CircleGeometry(2.6, 24), sunDiscMat);
  sunDisc.name = 'sun_disc_mesh';
  sun.add(sunDisc);

  const sunGlowTexture = createSunGlowTexture();
  const sunGlowMat = new SpriteMaterial({ map: sunGlowTexture, transparent: true, depthWrite: false });
  sunGlowMat.name = 'sun_glow';
  const sunGlow = new Sprite(sunGlowMat);
  sunGlow.name = 'cs_sun_glow';
  sunGlow.scale.set(14, 14, 1);
  sunGlow.position.z = 0.3;
  sun.add(sunGlow);
  sun.position.set(-11, 13.5, -45.5);
  scene.add(sun);

  // ── Clouds: puffy toy clusters drifting slowly ──
  const cloudMat = mat('cloud', [1, 1, 1], { emissive: [0.42, 0.42, 0.46], roughness: 1 });
  const clouds: Group[] = [];
  const cloudData = [
    { x: -18, y: 10.5, z: -42, s: 1.3 },
    { x: -3, y: 13, z: -43, s: 1.6 },
    { x: 9, y: 9.8, z: -41, s: 1.1 },
    { x: 20, y: 12, z: -42.5, s: 1.4 },
    { x: 3, y: 8.6, z: -40, s: 0.85 },
  ];
  for (let i = 0; i < cloudData.length; i++) {
    const cd = cloudData[i];
    const cloud = createPuffyCloud(`cs_cloud_${i}`, cloudMat, cd.s);
    cloud.position.set(cd.x, cd.y, cd.z);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // ── Ocean: vertex-gradient plane, deep near → bright aqua at horizon ──
  // Segmented enough (about nine vertices per swell) that the wave displacement
  // in updateOceanSurface reads as rolling water rather than folded paper.
  const oceanGeo = new PlaneGeometry(130, 50, 26, 40);
  applyVerticalGradient(oceanGeo, [
    [0, new Color(0.1, 0.36, 0.58)],
    [0.55, new Color(0.2, 0.55, 0.72)],
    [1, new Color(0.52, 0.8, 0.87)],
  ]);
  const oceanMat = new MeshStandardMaterial({ vertexColors: true, color: new Color(1, 1, 1), metalness: 0.05, roughness: 0.5 });
  oceanMat.name = 'ocean';
  const ocean = new Mesh(oceanGeo, oceanMat);
  ocean.name = 'cs_ocean';
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0, OCEAN_CENTER_Z);
  ocean.receiveShadow = true;
  scene.add(ocean);

  // ── Wave bands: alternating light/deep stripes for readable water ──
  const waveLightMat = mat('wave_light', [1, 1, 1], { transparent: true, opacity: 0.16, roughness: 0.6 });
  const waveDeepMat = mat('wave_deep', [0.05, 0.28, 0.48], { transparent: true, opacity: 0.3, roughness: 0.6 });
  const waveBands: Mesh[] = [];
  const waveData = [
    { z: -3.5, w: 22, light: true },
    { z: -5.5, w: 26, light: false },
    { z: -8, w: 30, light: true },
    { z: -11, w: 36, light: false },
    { z: -14, w: 42, light: true },
    { z: -17.5, w: 48, light: false },
    { z: -22, w: 56, light: true },
    { z: -28, w: 68, light: false },
  ];
  for (let i = 0; i < waveData.length; i++) {
    const wd = waveData[i];
    const band = new Mesh(new BoxGeometry(wd.w, 0.015, 0.22 + i * 0.05), wd.light ? waveLightMat : waveDeepMat);
    band.name = `cs_wave_${i}`;
    band.position.set(0, 0.015, wd.z);
    scene.add(band);
    waveBands.push(band);
  }

  // Foam strips (bright accents that sway across the water)
  const foamMat = mat('foam_strip', [1, 1, 1], { transparent: true, opacity: 0.45, roughness: 0.5 });
  const foamStrips: Mesh[] = [];
  const foamZPositions = [-6, -10, -14, -18];
  for (let i = 0; i < foamZPositions.length; i++) {
    const foam = new Mesh(new BoxGeometry(3.5 + i, 0.02, 0.16), foamMat);
    foam.name = `cs_foam_${i}`;
    foam.position.set(0, 0.03, foamZPositions[i]);
    scene.add(foam);
    foamStrips.push(foam);
  }

  // ── Islands: sandy mounds with palm trees on the horizon ──
  const sandMat = mat('island_sand', [0.93, 0.82, 0.58], { roughness: 0.85 });
  const grassMat = mat('island_grass', [0.35, 0.66, 0.3], { roughness: 0.8 });
  const trunkMat = mat('palm_trunk', [0.5, 0.34, 0.18], { roughness: 0.8 });
  const canopyMat = mat('palm_canopy', [0.22, 0.58, 0.24], { roughness: 0.7 });
  const islands: Group[] = [];

  // Island 1 — left, larger, two palms
  const island1 = new Group();
  island1.name = 'cs_island_1';
  const islandBody1 = new Mesh(new SphereGeometry(1, 12, 8), sandMat);
  islandBody1.name = 'island1_sand';
  islandBody1.scale.set(5.2, 1.5, 2.4);
  island1.add(islandBody1);
  const grassCap1 = new Mesh(new SphereGeometry(1, 10, 6), grassMat);
  grassCap1.name = 'island1_grass';
  grassCap1.scale.set(3.0, 0.9, 1.5);
  grassCap1.position.set(-0.6, 0.55, 0);
  island1.add(grassCap1);
  const palm1 = createPalmTree(trunkMat, canopyMat, 2.4, 0.12);
  palm1.position.set(-1.2, 1.0, 0);
  island1.add(palm1);
  const palm2 = createPalmTree(trunkMat, canopyMat, 1.9, -0.18);
  palm2.position.set(0.8, 1.1, 0.2);
  island1.add(palm2);
  island1.position.set(-15, -0.4, -37);
  scene.add(island1);
  islands.push(island1);

  // Island 2 — right, smaller, single palm
  const island2 = new Group();
  island2.name = 'cs_island_2';
  const islandBody2 = new Mesh(new SphereGeometry(1, 12, 8), sandMat);
  islandBody2.name = 'island2_sand';
  islandBody2.scale.set(3.4, 1.1, 1.8);
  island2.add(islandBody2);
  const palm3 = createPalmTree(trunkMat, canopyMat, 2.0, 0.15);
  palm3.position.set(0.2, 0.7, 0);
  island2.add(palm3);
  island2.position.set(14, -0.35, -39);
  scene.add(island2);
  islands.push(island2);

  // ── Ship ──
  const ship = createShip({
    deck: mat('deck_plank', [0.66, 0.45, 0.26], { roughness: 0.7 }),
    hull: mat('hull_paint', [0.55, 0.22, 0.18], { roughness: 0.55 }),
    rail: mat('rail_cap', [0.5, 0.33, 0.17], { roughness: 0.6 }),
    seam: mat('plank_seam', [0.38, 0.25, 0.13], { roughness: 0.8 }),
  });
  scene.add(ship);

  // ── Cannon ──
  const cannon = createCannon();
  // Scenery must never swallow a tap (see makeNonPickable): the cannon sits at
  // the bottom of the frame, right where small fingers land.
  makeNonPickable(cannon.root);
  scene.add(cannon.root);

  // ── Dispose function ──
  const allLights = [keyLight, fillLight, accentLight];

  function dispose(): void {
    for (const light of allLights) light.removeFromParent();
    disposeMeshDeep(ocean);
    for (const w of waveBands) disposeMeshDeep(w);
    for (const f of foamStrips) disposeMeshDeep(f);
    disposeMeshDeep(skyBase);
    disposeMeshDeep(sunDisc);
    sunGlowMat.dispose();
    sunGlowTexture.dispose();
    sunGlow.removeFromParent();
    sun.removeFromParent();
    for (const c of clouds) disposeMeshDeep(c);
    for (const isl of islands) disposeMeshDeep(isl);
    // The seams live under the ship group now, so a deep dispose reaches them;
    // this used to need a scene-wide traverse looking for stray meshes by name.
    disposeMeshDeep(ship);
    disposeMeshDeep(cannon.root);
  }

  return {
    ocean,
    skyBase,
    sun,
    clouds,
    foamStrips,
    waveBands,
    islands,
    ship,
    cannon,
    dispose,
  };
}

/**
 * Updates per-frame environment animations: ocean waves, cloud drift, foam
 * drift, and wave-band shimmer.
 * @param rig - The environment rig to animate.
 * @param elapsedTime - Total elapsed game time in seconds.
 * @param dt - Frame delta time in seconds.
 */
export function updateEnvironment(rig: EnvironmentRig, elapsedTime: number, dt: number): void {
  updateOceanSurface(rig.ocean, elapsedTime);

  // Cloud drift, in units per *second*. This was multiplied by a hardcoded 1/60
  // regardless of the real frame time, so the sky crawled on a 30Hz phone and
  // raced on a 120Hz one.
  for (let i = 0; i < rig.clouds.length; i++) {
    rig.clouds[i].position.x -= 0.05 * dt;
    if (rig.clouds[i].position.x < -30) {
      rig.clouds[i].position.x = 30;
    }
  }

  // Foam drift — sways sideways and rides the swell it is painted on.
  for (let i = 0; i < rig.foamStrips.length; i++) {
    const strip = rig.foamStrips[i];
    strip.position.x = Math.sin(elapsedTime * 0.3 + i * 1.5) * 2;
    strip.position.y = sampleOceanHeight(strip.position.x, strip.position.z, elapsedTime) + 0.05;
  }

  // Wave-band shimmer: gentle sideways sway, phase-offset per band.
  for (let i = 0; i < rig.waveBands.length; i++) {
    const band = rig.waveBands[i];
    band.position.x = Math.sin(elapsedTime * 0.45 + i * 1.3) * (0.8 + i * 0.15);
    band.position.y = sampleOceanHeight(band.position.x, band.position.z, elapsedTime) + 0.035;
  }
}
