/**
 * Shared sky rig — camera-agnostic backdrop placement.
 *
 * Every scene and minigame has its own camera convention (the minigame shell
 * looks toward -Z from a fixed pose; orbit scenes look toward +Z from
 * Babylon-derived spherical coords; some are mirrored). Hand-placing a moon or
 * sun in world coordinates therefore only ever works for one camera and breaks
 * on the next. This module removes the guesswork: backdrop elements are placed
 * in *screen space* against whatever camera is active, using the camera's own
 * unprojection. "Put the sun at 70% across, 18% down, 30 units out" resolves
 * correctly for any perspective camera.
 *
 * See docs/ai-guidance/scene-rendering-standards.md.
 */

import {
  BackSide,
  BufferAttribute,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  AdditiveBlending,
  PerspectiveCamera,
  SphereGeometry,
  Vector3,
} from 'three';

/**
 * Resolves a world position from a screen-space fraction and a distance from
 * the camera, using the camera's actual matrices (so it is correct for every
 * perspective camera regardless of its pose or look direction).
 *
 * @param camera - The active perspective camera.
 * @param screenX - Horizontal screen fraction: 0 = left edge, 1 = right edge.
 * @param screenY - Vertical screen fraction: 0 = top edge, 1 = bottom edge.
 * @param distance - Euclidean distance from the camera, in world units.
 * @returns A world-space position on the given screen ray at the given distance.
 */
export function projectToView(camera: PerspectiveCamera, screenX: number, screenY: number, distance: number): Vector3 {
  camera.updateMatrixWorld();
  // NDC: x in [-1,1] left→right, y in [-1,1] bottom→top (so flip screenY).
  const ndc = new Vector3(screenX * 2 - 1, -(screenY * 2 - 1), 0.5);
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  return camera.position.clone().add(dir.multiplyScalar(distance));
}

/** Options for {@link createGradientSkydome}. */
export interface SkydomeOptions {
  /** Sphere radius. Must comfortably exceed the camera's distance from `center`. */
  radius: number;
  /** Dome centre (camera position for fixed cameras; scene origin for orbit cameras). */
  center: Vector3;
  /** Colour at the zenith (straight up). */
  topColor: Color;
  /** Colour at the horizon (eye level). */
  horizonColor: Color;
  /** Colour at the nadir (straight down). */
  bottomColor: Color;
  /**
   * How tightly the horizon glow hugs the horizon. Higher = a thinner glow
   * band. @default 1
   */
  horizonSharpness?: number;
}

/**
 * Builds an inverted gradient skydome that always fills the background.
 *
 * The dome surrounds the camera, so it needs no per-scene coverage math: a
 * vertical vertex-colour gradient (zenith → horizon → nadir) reads as sky from
 * any view angle. Uses vertex colours (no texture to leak).
 *
 * @param options - Radius, centre, and the three gradient colours.
 * @returns The skydome mesh (raycasting disabled; add to the scene and dispose with the scene).
 */
export function createGradientSkydome(options: SkydomeOptions): Mesh {
  const geometry = new SphereGeometry(options.radius, 32, 24);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const sharpness = options.horizonSharpness ?? 1;
  const tmp = new Color();
  for (let i = 0; i < position.count; i += 1) {
    // Normalised altitude of this vertex: -1 (nadir) → 0 (horizon) → 1 (zenith).
    const ny = position.getY(i) / options.radius;
    if (ny >= 0) {
      const t = Math.pow(ny, 1 / sharpness);
      tmp.copy(options.horizonColor).lerp(options.topColor, t);
    } else {
      const t = Math.pow(-ny, 1 / sharpness);
      tmp.copy(options.horizonColor).lerp(options.bottomColor, t);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  const material = new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false, fog: false });
  material.name = 'skydome_mat';
  const mesh = new Mesh(geometry, material);
  mesh.name = 'skydome';
  mesh.position.copy(options.center);
  mesh.renderOrder = -1;
  mesh.raycast = () => {};
  return mesh;
}

/** Options for {@link createCelestialBody}. */
export interface CelestialBodyOptions {
  /** Core sphere radius in world units. */
  radius: number;
  /** Core surface colour. */
  color: Color;
  /** Emissive colour (the glow). */
  emissive: Color;
  /** Emissive intensity. @default 1.6 */
  emissiveIntensity?: number;
  /** Halo radius as a multiple of the core radius. @default 1.7 (0 disables the halo) */
  haloScale?: number;
  /** Halo colour. Defaults to the emissive colour. */
  haloColor?: Color;
  /** Halo opacity. @default 0.16 */
  haloOpacity?: number;
}

/** Result of {@link createCelestialBody}. */
export interface CelestialBody {
  /** Group holding the core (and halo). Position/scale this to place the body. */
  root: Group;
  /** The core mesh. */
  core: Mesh;
  /** The core material (e.g. to pulse the glow). */
  coreMaterial: MeshStandardMaterial;
}

/**
 * Builds a sun/moon: an emissive core sphere with an optional soft additive
 * halo. Raycasting is disabled so it never intercepts gameplay taps. No
 * textures (disposes cleanly with the scene).
 *
 * @param options - Radius, colours, and halo settings.
 * @returns The body group plus handles to the core mesh and material.
 */
export function createCelestialBody(options: CelestialBodyOptions): CelestialBody {
  const root = new Group();
  root.name = 'celestial_body';

  const coreMaterial = new MeshStandardMaterial({
    color: options.color,
    emissive: options.emissive,
    emissiveIntensity: options.emissiveIntensity ?? 1.6,
    roughness: 0.85,
    metalness: 0,
    fog: false,
  });
  coreMaterial.name = 'celestial_core_mat';
  const core = new Mesh(new SphereGeometry(options.radius, 28, 28), coreMaterial);
  core.name = 'celestial_core';
  core.raycast = () => {};
  root.add(core);

  const haloScale = options.haloScale ?? 1.7;
  if (haloScale > 0) {
    const haloMaterial = new MeshBasicMaterial({
      color: options.haloColor ?? options.emissive,
      transparent: true,
      opacity: options.haloOpacity ?? 0.16,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    haloMaterial.name = 'celestial_halo_mat';
    const halo = new Mesh(new SphereGeometry(options.radius * haloScale, 22, 22), haloMaterial);
    halo.name = 'celestial_halo';
    halo.raycast = () => {};
    root.add(halo);
  }

  return { root, core, coreMaterial };
}

/** Options for {@link createCloudPuff}. */
export interface CloudPuffOptions {
  /** Cloud colour. */
  color: Color;
  /** Cloud opacity. @default 0.85 */
  opacity?: number;
  /** Overall scale of the puff cluster. @default 1 */
  scale?: number;
}

/**
 * Builds a soft stylized cloud puff — a cluster of squashed, tinted spheres.
 * Unlit and fog-exempt so it reads clearly at sky distance, raycasting
 * disabled. No textures (disposes cleanly).
 *
 * @param options - Colour, opacity, and scale.
 * @returns The cloud group. Position/rotate it to place the cloud.
 */
export function createCloudPuff(options: CloudPuffOptions): Group {
  const group = new Group();
  group.name = 'cloud_puff';
  const material = new MeshBasicMaterial({
    color: options.color,
    transparent: true,
    opacity: options.opacity ?? 0.85,
    depthWrite: false,
    fog: false,
  });
  material.name = 'cloud_puff_mat';
  const scale = options.scale ?? 1;

  // A few overlapping lobes make a fluffy silhouette.
  const lobes: Array<[number, number, number]> = [
    [-1.5, -0.1, 0.9],
    [0, 0.25, 1.25],
    [1.4, -0.05, 1.0],
    [0.6, 0.15, 0.85],
    [-0.7, 0.1, 0.8],
  ];
  for (const [lx, ly, lr] of lobes) {
    const lobe = new Mesh(new SphereGeometry(lr * scale, 14, 12), material);
    lobe.position.set(lx * scale, ly * scale, 0);
    lobe.scale.set(1, 0.62, 0.7);
    lobe.raycast = () => {};
    group.add(lobe);
  }
  return group;
}
