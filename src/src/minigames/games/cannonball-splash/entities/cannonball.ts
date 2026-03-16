/**
 * Cannonball projectile for Cannonball Splash.
 */

import { CircleGeometry, Color, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { Cannonball } from '../types';
import { computeArcPosition } from '../helpers';

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

const trailMat = new MeshStandardMaterial({
  color: new Color(0.4, 0.4, 0.4),
  transparent: true,
  opacity: 0.3,
  roughness: 0.8,
});
trailMat.name = 'trail_smoke';

/** Creates a cannonball mesh (poolable). */
export function createCannonballMesh(): Mesh {
  const mesh = new Mesh(new SphereGeometry(0.12, 8, 6), cannonballMat);
  mesh.name = 'cs_cannonball';
  mesh.castShadow = true;
  mesh.visible = false;
  return mesh;
}

/** Creates a shadow disc projected on the water surface. */
export function createCannonballShadow(): Mesh {
  const mesh = new Mesh(new CircleGeometry(0.15, 12), shadowMat);
  mesh.name = 'cs_cannonball_shadow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

/**
 * Updates a cannonball's position along its arc.
 * Returns true when the flight is complete (t >= 1).
 */
export function updateCannonball(ball: Cannonball, dt: number): boolean {
  ball.elapsed += dt;
  const t = Math.min(ball.elapsed / ball.flightDuration, 1);

  const pos = computeArcPosition(ball.startPos, ball.endPos, ball.arcHeight, t);
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

  return t >= 1;
}

/** Creates a trail particle mesh (poolable). */
export function createTrailParticle(): Mesh {
  const mesh = new Mesh(new SphereGeometry(0.05, 4, 3), trailMat.clone());
  mesh.name = 'cs_trail';
  mesh.visible = false;
  return mesh;
}
