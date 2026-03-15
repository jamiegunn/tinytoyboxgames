import { CircleGeometry, Color, Mesh, type DirectionalLight, type Scene } from 'three';
import { createPaperMaterial } from '@app/utils/materialFactory';

/**
 * Creates a white paper airplane lying on the floor with folded wings.
 * @param scene - The Three.js scene to add the paper airplane to
 * @param _keyLight - The directional light (unused)
 */
export function createPaperAirplane(scene: Scene, _keyLight: DirectionalLight): void {
  const paperMat = createPaperMaterial('hub_paperPlaneMat', new Color(0.95, 0.95, 0.97));

  const fuselage = new Mesh(new CircleGeometry(0.15, 3), paperMat);
  fuselage.name = 'planeFuselage';
  fuselage.position.set(1.5, 0.06, -4.8);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.rotation.y = 0.8;
  fuselage.scale.set(1.8, 1, 0.4);
  fuselage.castShadow = true;
  scene.add(fuselage);

  const wingL = new Mesh(new CircleGeometry(0.12, 3), paperMat);
  wingL.name = 'planeWingL';
  wingL.position.set(-0.02, 0.04, 0);
  wingL.rotation.x = -0.3;
  wingL.scale.set(0.8, 0.6, 1);
  fuselage.add(wingL);

  const wingR = new Mesh(new CircleGeometry(0.12, 3), paperMat);
  wingR.name = 'planeWingR';
  wingR.position.set(0.02, 0.04, 0);
  wingR.rotation.x = 0.3;
  wingR.scale.set(0.8, 0.6, 1);
  fuselage.add(wingR);
}
