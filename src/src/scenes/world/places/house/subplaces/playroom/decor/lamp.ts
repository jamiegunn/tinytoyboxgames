import { CircleGeometry, Color, CylinderGeometry, Mesh, PointLight, SphereGeometry, Vector3, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';

/**
 * Creates a mushroom-shaped night-light lamp with spots and a warm point-light glow.
 * @param scene - The Three.js scene to add the lamp to
 * @param _keyLight - The directional light (unused)
 */
export function createLamp(scene: Scene, _keyLight: DirectionalLight): void {
  const stem = new Mesh(new CylinderGeometry(0.04, 0.06, 0.2, 10), createPlasticMaterial('hub_mushroomStemMat', new Color(0.95, 0.92, 0.85)));
  stem.name = 'mushroomStem';
  stem.position.set(-4.2, 0.1, 0.5);
  stem.castShadow = true;
  scene.add(stem);

  const capMat = createGlossyPaintMaterial('hub_mushroomCapMat', new Color(0.9, 0.35, 0.35));
  capMat.emissive = new Color(0.2, 0.05, 0.05);
  const cap = new Mesh(new SphereGeometry(0.5, 12, 12), capMat);
  cap.name = 'mushroomCap';
  cap.scale.set(0.35, 0.2, 0.35);
  cap.position.y = 0.14;
  stem.add(cap);

  // Spots
  const spotMat = createPlasticMaterial('hub_mushroomSpotMat', new Color(0.98, 0.97, 0.95));
  const spotPositions = [new Vector3(0.05, 0.08, 0.12), new Vector3(-0.08, 0.06, 0.1), new Vector3(0.1, 0.04, -0.05), new Vector3(-0.04, 0.09, -0.08)];
  for (let si = 0; si < spotPositions.length; si++) {
    const spot = new Mesh(new CircleGeometry(0.03, 8), spotMat);
    spot.name = `mushroomSpot${si}`;
    spot.position.copy(spotPositions[si]);
    cap.add(spot);
  }

  // Warm glow
  const glow = new PointLight(new Color(1.0, 0.85, 0.65), 0.3, 3.5);
  glow.name = 'mushroomGlow';
  glow.position.set(-4.2, 0.35, 0.5);
  scene.add(glow);
}
