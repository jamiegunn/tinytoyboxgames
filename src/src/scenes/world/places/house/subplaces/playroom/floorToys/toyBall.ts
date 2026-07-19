import { CircleGeometry, Color, Mesh, SphereGeometry, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import { getIdleAnimator } from '@app/utils/idle/registry';

/**
 * Creates a red glossy toy ball with a white star and a gentle rolling animation.
 * @param scene - The Three.js scene to add the toy ball to
 * @param _keyLight - The directional light (unused)
 */
export function createToyBall(scene: Scene, _keyLight: DirectionalLight): void {
  const ball = new Mesh(new SphereGeometry(0.11, 14, 14), createGlossyPaintMaterial('hub_ballMat', new Color(0.92, 0.12, 0.12)));
  ball.name = 'toyBall';
  ball.position.set(0.8, 0.11, -4.5);
  ball.castShadow = true;
  scene.add(ball);

  const star = new Mesh(new CircleGeometry(0.04, 5), createPlasticMaterial('hub_ballStarMat', new Color(0.98, 0.98, 0.98)));
  star.name = 'ballStar';
  star.position.z = 0.11;
  ball.add(star);

  // Rolling animation
  // Slow roll back and forth along x to x=0.9. See architecture-standards.md#idleanimator.
  getIdleAnimator(scene).bob(ball, { axis: 'x', amplitude: 0.9 - ball.position.x, period: 800 / 60 });
}
