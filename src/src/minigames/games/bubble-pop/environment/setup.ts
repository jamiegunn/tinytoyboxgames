import { Color, type Scene, type Object3D, type PerspectiveCamera } from 'three';
import { createGradientSkydome, projectToView } from '@app/utils/skyRig';
import type { EnvironmentObjects, StarMesh } from '../types';
import { buildMoon, buildStar } from './scenery';

/**
 * Scene-level setup: night sky assembly. The camera is the default fixed shell
 * view (no manifest camera descriptor); the previous `createGameCamera` here
 * built a twilight camera that was never applied to the shell — dead code, now
 * removed. See architecture-standards.md#cameradescriptor.
 */

/**
 * Assembles the night sky dreamscape: a gradient skydome, a glowing moon, and
 * twinkling stars — all placed in screen space against the shell camera via
 * the shared sky rig (see `utils/skyRig`), so nothing depends on hand-guessed
 * world coordinates.
 *
 * @param scene - The Three.js scene.
 * @param camera - The active shell camera (used for screen-space placement).
 * @returns Environment objects for per-frame update and disposal.
 */
export function buildEnvironment(scene: Scene, camera: PerspectiveCamera): EnvironmentObjects {
  const meshes: Object3D[] = [];
  const stars: StarMesh[] = [];

  // Night skydome centred on the camera — always fills the background.
  const sky = createGradientSkydome({
    radius: 40,
    center: camera.position.clone(),
    topColor: new Color(0.015, 0.02, 0.07),
    horizonColor: new Color(0.06, 0.05, 0.15),
    bottomColor: new Color(0.02, 0.02, 0.06),
    horizonSharpness: 1.1,
  });
  scene.add(sky);
  meshes.push(sky);

  // Moon — upper-left of frame, clear of the HUD buttons, behind the bubbles.
  // Placement, sizing and appearance all live in buildMoon; the shared sky
  // rig's createCelestialBody could only make a flat disc inside a hard-edged
  // halo sphere.
  const moon = buildMoon(scene, camera);
  meshes.push(moon.root);

  // Stars — scattered across the upper sky in screen space, behind the bubbles.
  for (let i = 0; i < 48; i++) {
    const star = buildStar(scene, i);
    let sx = Math.random();
    const sy = Math.random() * 0.62;
    // Keep the moon's corner (~0.26, 0.28) clear of clutter.
    if (sx > 0.12 && sx < 0.4 && sy > 0.14 && sy < 0.42) {
      sx += 0.42;
    }
    star.mesh.position.copy(projectToView(camera, sx, sy, 14 + Math.random() * 6));
    star.mesh.raycast = () => {};
    meshes.push(star.mesh);
    stars.push(star);
  }

  return { meshes, stars, moon: moon.root, moonMat: moon.discMat, moonGlowMat: moon.glowMat };
}
