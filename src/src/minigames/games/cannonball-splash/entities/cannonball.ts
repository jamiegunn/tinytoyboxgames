/**
 * Cannonball projectile for Cannonball Splash.
 */

import { CircleGeometry, Color, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import type { Cannonball } from '../types';
import { ballisticPosition } from '../helpers';

const cannonballMat = new MeshStandardMaterial({
  color: new Color(0.1, 0.1, 0.12),
  metalness: 0.8,
  roughness: 0.3,
});
cannonballMat.name = 'cannonball_iron';

const shadowMat = new MeshStandardMaterial({
  color: new Color(0, 0, 0),
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
  roughness: 1,
});
shadowMat.name = 'cannonball_shadow';

/**
 * Creates a cannonball mesh (poolable).
 * @returns A hidden iron sphere mesh ready for pooling.
 */
export function createCannonballMesh(): Mesh {
  const mesh = new Mesh(new SphereGeometry(0.12, 8, 6), cannonballMat);
  mesh.name = 'cs_cannonball';
  mesh.castShadow = true;
  mesh.visible = false;
  return mesh;
}

/**
 * Creates a shadow disc projected on the water surface.
 * @returns A hidden horizontal circle mesh used as the ball's drop shadow.
 */
export function createCannonballShadow(): Mesh {
  const mesh = new Mesh(new CircleGeometry(0.15, 12), shadowMat);
  mesh.name = 'cs_cannonball_shadow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

const positionScratch = new Vector3();

/** Water level the ball splashes into. */
const WATER_Y = 0;

/**
 * Advances a cannonball along its ballistic trajectory.
 * @param ball - The in-flight cannonball to advance.
 * @param dt - Frame delta time in seconds.
 * @returns True once the ball has reached the water.
 */
export function updateCannonball(ball: Cannonball, dt: number): boolean {
  ball.elapsed += dt;

  const pos = ballisticPosition(ball.startPos, ball.velocity, ball.elapsed, positionScratch);
  ball.mesh.position.copy(pos);

  // Update shadow — project onto water surface, scale inversely with height
  if (ball.shadow) {
    ball.shadow.position.set(pos.x, 0.02, pos.z);
    const height = Math.max(0, pos.y);
    const shadowScale = Math.max(0.3, 1 - height * 0.15);
    ball.shadow.scale.setScalar(shadowScale);
    ball.shadow.visible = ball.mesh.visible;
  }

  // Spin
  ball.mesh.rotation.x += 6 * dt;
  ball.mesh.rotation.z += 3 * dt;

  // The velocity was solved so that y(flightDuration) = WATER_Y; either test
  // alone would do, and together they also cover a shot fired nearly straight up.
  return ball.elapsed >= ball.flightDuration || pos.y <= WATER_Y;
}

/**
 * Disposes the module-level cannonball materials. Call once, at teardown —
 * these are shared by every ball, so a per-instance dispose would leave later
 * balls rendering against freed GPU resources.
 */
export function disposeCannonballMaterials(): void {
  cannonballMat.dispose();
  shadowMat.dispose();
}
