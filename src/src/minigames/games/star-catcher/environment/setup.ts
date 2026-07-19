/**
 * Environment setup for the Star Catcher minigame.
 *
 * Builds the night: a graded sky, a glowing moon, a dense starfield, soft
 * moonlit cloud mounds for foreground depth, and a hilltop floor — the stage
 * for catching falling stars. Gameplay (spawning, scoring) lives elsewhere.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import { createGameLighting } from '@app/minigames/shared/sceneSetup';
import type { DisposalScope } from '@app/utils/disposal';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import type { TemplateEnvironmentRig } from '../types';

/** Deterministic pseudo-random so the starfield is stable across builds. */
let seed = 20260718;

/**
 * Returns the next deterministic pseudo-random float in [0, 1).
 *
 * @returns A pseudo-random value.
 */
function nextRandom(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

/**
 * Disables raycasting on a decorative object so it never intercepts taps meant
 * for the catchable stars.
 *
 * @param object - The decorative object to make tap-transparent.
 * @returns The same object, for chaining.
 */
function makeDecorative<T extends Object3D>(object: T): T {
  object.raycast = () => {};
  return object;
}

/**
 * Builds a vertical gradient sky plane from deep indigo at the top down to a
 * warm horizon glow, using vertex colours (no texture to leak).
 *
 * @returns The unlit gradient sky mesh.
 */
function buildSkyGradient(): Mesh {
  const geometry = new PlaneGeometry(36, 22, 1, 6);
  const top = new Color(0.03, 0.04, 0.12);
  const horizon = new Color(0.34, 0.22, 0.4);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < position.count; i += 1) {
    minY = Math.min(minY, position.getY(i));
    maxY = Math.max(maxY, position.getY(i));
  }
  const tmp = new Color();
  for (let i = 0; i < position.count; i += 1) {
    const t = (position.getY(i) - minY) / (maxY - minY);
    const glow = Math.max(0, 1 - t * 4);
    tmp.copy(top).lerp(horizon, glow);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  material.name = 'star-catcher_skyMat';
  const mesh = new Mesh(geometry, material);
  mesh.name = 'star-catcher_sky';
  // +Z is far from the camera (which sits at z ~= -6.8 looking toward +Z), so
  // the sky sits well behind the play area.
  mesh.position.set(0, 5, 11);
  return makeDecorative(mesh);
}

/**
 * Builds the glowing moon (emissive core plus an additive halo) and attaches
 * both parts to the scene.
 *
 * @param scene - The scene to add the moon parts to.
 * @returns The moon parts, for disposal tracking.
 */
function buildMoon(scene: Scene): Object3D[] {
  const coreMat = new MeshStandardMaterial({
    color: new Color(1, 0.97, 0.86),
    emissive: new Color(1, 0.95, 0.82),
    emissiveIntensity: 1.8,
    roughness: 0.9,
    metalness: 0,
  });
  coreMat.name = 'star-catcher_moonMat';
  const core = makeDecorative(new Mesh(new SphereGeometry(1.0, 28, 28), coreMat));
  core.name = 'star-catcher_moon';
  // Far background, upper-left of frame (screen-left is +X for this camera).
  core.position.set(2.9, 4.0, 10);

  const haloMat = new MeshBasicMaterial({
    color: new Color(1, 0.94, 0.78),
    transparent: true,
    opacity: 0.16,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  haloMat.name = 'star-catcher_moonHaloMat';
  const halo = makeDecorative(new Mesh(new SphereGeometry(1.7, 20, 20), haloMat));
  halo.name = 'star-catcher_moonHalo';
  halo.position.copy(core.position);

  scene.add(halo);
  scene.add(core);
  return [halo, core];
}

/**
 * Builds a dense starfield as a single instanced mesh of tiny glowing points.
 *
 * @returns The instanced starfield.
 */
function buildStarfield(): InstancedMesh {
  const count = 110;
  const geometry = new SphereGeometry(0.03, 6, 6);
  const material = new MeshBasicMaterial({ color: new Color(1, 0.98, 0.9) });
  material.name = 'star-catcher_starMat';
  const stars = new InstancedMesh(geometry, material, count);
  stars.name = 'star-catcher_stars';
  const matrix = new Matrix4();
  const scaleVec = new Vector3();
  const posVec = new Vector3();
  const quat = new Quaternion();
  for (let i = 0; i < count; i += 1) {
    posVec.set(nextRandom() * 32 - 16, 1.8 + nextRandom() * 8, 4 + nextRandom() * 6);
    const s = 0.6 + nextRandom() * 1.8;
    scaleVec.set(s, s, s);
    matrix.compose(posVec, quat, scaleVec);
    stars.setMatrixAt(i, matrix);
  }
  stars.instanceMatrix.needsUpdate = true;
  return makeDecorative(stars);
}

/**
 * Builds one soft moonlit cloud mound (a flattened, tinted sphere) for
 * foreground depth, tagged with a bob baseline in userData.
 *
 * @param x - World X position.
 * @param z - World Z position.
 * @param scale - Overall mound scale.
 * @param tint - Base colour of the mound.
 * @returns The mound mesh.
 */
function buildCloudMound(x: number, z: number, scale: number, tint: Color): Mesh {
  const material = new MeshStandardMaterial({
    color: tint,
    emissive: tint.clone().multiplyScalar(0.25),
    roughness: 1,
    metalness: 0,
  });
  material.name = 'star-catcher_moundMat';
  const mesh = makeDecorative(new Mesh(new SphereGeometry(1, 18, 14), material));
  mesh.name = 'star-catcher_mound';
  // Distant rolling hills: mostly sunk below the floor line so only rounded
  // tops poke up along the horizon.
  const baseY = -0.62 * scale;
  mesh.position.set(x, baseY, z);
  mesh.scale.set(scale, scale * 0.5, scale);
  mesh.userData.baseY = baseY;
  mesh.userData.phase = nextRandom() * Math.PI * 2;
  return mesh;
}

/**
 * Creates the Star Catcher night environment.
 *
 * @param scene - The shell-owned Three.js scene.
 * @param scope - Disposal scope that frees the lighting rig on teardown.
 * @returns The authored environment rig for later update and teardown.
 */
export function setupTemplateEnvironment(scene: Scene, scope: DisposalScope): TemplateEnvironmentRig {
  seed = 20260718;

  // Camera comes from the manifest (an orbit descriptor) applied to the shell
  // camera. See architecture-standards.md#cameradescriptor.

  // The rig adds the lights to the scene and scope-owns them.
  const lights = createGameLighting(
    scene,
    {
      name: 'star-catcher',
      direction: new Vector3(-0.6, -1, 0.5),
      directionalIntensity: 0.7,
      hemisphericIntensity: 0.42,
      pointPosition: new Vector3(-1.9, 3.2, 1.0),
      pointIntensity: 0.4,
    },
    scope,
  );

  // Hilltop floor — muted moonlit grass.
  const floorMaterial = new MeshStandardMaterial({
    color: new Color(0.12, 0.17, 0.2),
    emissive: new Color(0.02, 0.03, 0.05),
    roughness: 0.95,
    metalness: 0.02,
  });
  floorMaterial.name = 'star-catcher_floorMat';
  const floor = new Mesh(new PlaneGeometry(11, 9), floorMaterial);
  floor.name = 'star-catcher_floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  // Sky backdrop (kept in the rig's backdrop slot).
  const backdrop = buildSkyGradient();
  scene.add(backdrop);

  // Decorative accents: moon, halo, starfield, and foreground cloud mounds.
  const moonParts = buildMoon(scene);
  const stars = buildStarfield();
  scene.add(stars);
  const mounds = [
    buildCloudMound(-4.8, 4.2, 3.6, new Color(0.2, 0.24, 0.36)),
    buildCloudMound(4.6, 4.3, 3.9, new Color(0.17, 0.21, 0.33)),
    buildCloudMound(-0.6, 4.4, 3.0, new Color(0.24, 0.28, 0.4)),
    buildCloudMound(2.4, 4.1, 2.6, new Color(0.26, 0.3, 0.42)),
  ];
  for (const mound of mounds) {
    scene.add(mound);
  }

  const accents: Object3D[] = [...moonParts, stars, ...mounds];

  return {
    lights,
    floor,
    backdrop,
    accents,
  };
}

/**
 * Applies gentle authored-only motion: cloud mounds bob, the starfield drifts
 * almost imperceptibly. Nothing competes with gameplay readability.
 *
 * @param rig - The authored environment returned from setup.
 * @param elapsedTime - Seconds since the current run started.
 */
export function updateTemplateEnvironment(rig: TemplateEnvironmentRig, elapsedTime: number): void {
  for (const accent of rig.accents) {
    if (accent.name === 'star-catcher_stars') {
      accent.rotation.z = Math.sin(elapsedTime * 0.05) * 0.02;
    } else if (accent.name === 'star-catcher_mound') {
      const baseY = (accent.userData.baseY as number) ?? accent.position.y;
      const phase = (accent.userData.phase as number) ?? 0;
      accent.position.y = baseY + Math.sin(elapsedTime * 0.5 + phase) * 0.05;
    }
  }
}

/**
 * Tears down the authored environment and disposes all environment-owned
 * resources.
 *
 * @param rig - Environment created during setup.
 */
export function teardownTemplateEnvironment(rig: TemplateEnvironmentRig | null): void {
  if (!rig) return;

  for (const accent of rig.accents) {
    if (accent instanceof Mesh) {
      disposeMeshDeep(accent);
    } else {
      accent.removeFromParent();
    }
  }
  disposeMeshDeep(rig.floor);
  disposeMeshDeep(rig.backdrop);
  // Lights are freed by the shell's disposal scope; the camera is the shell's.
}
