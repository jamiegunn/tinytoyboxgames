import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';

/**
 * Creates a wooden pull-along dog toy on wheels with a pull string.
 * @param scene - The Three.js scene to add the pull toy to
 * @param _keyLight - The directional light (unused)
 */
export function createPullToy(scene: Scene, _keyLight: DirectionalLight): void {
  const root = new Group();
  root.name = 'pullToy_root';
  root.position.set(-1.2, 0.06, -0.5); // to the left of the stacking rings
  root.rotation.y = 0.5;
  scene.add(root);

  const bodyMat = createGlossyPaintMaterial('hub_pullToyMat', new Color(0.9, 0.55, 0.2));

  // Wooden platform base
  const platform = new Mesh(new BoxGeometry(0.5, 0.04, 0.22), createWoodMaterial('hub_pullPlatformMat', new Color(0.55, 0.4, 0.25)));
  platform.name = 'pullPlatform';
  platform.position.y = 0.08;
  platform.castShadow = true;
  root.add(platform);

  // Wheels — red, on axles
  const wheelMat = createGlossyPaintMaterial('hub_pullWheelMat', new Color(0.85, 0.2, 0.2));
  const wPos = [new Vector3(-0.18, -0.03, 0.13), new Vector3(0.18, -0.03, 0.13), new Vector3(-0.18, -0.03, -0.13), new Vector3(0.18, -0.03, -0.13)];
  for (let wi = 0; wi < wPos.length; wi++) {
    const wheel = new Mesh(new CylinderGeometry(0.04, 0.04, 0.03, 10), wheelMat);
    wheel.name = `pullWheel${wi}`;
    wheel.position.copy(wPos[wi]);
    wheel.rotation.x = Math.PI / 2;
    platform.add(wheel);
  }

  // Dog body — use geometry scaling so children aren't compressed
  const dogBodyGeo = new SphereGeometry(1, 10, 8);
  dogBodyGeo.scale(0.13, 0.1, 0.08);
  const dogBody = new Mesh(dogBodyGeo, bodyMat);
  dogBody.name = 'pullDogBody';
  dogBody.position.set(0, 0.14, 0);
  dogBody.castShadow = true;
  platform.add(dogBody);

  // Dog head — round, sits in front of the body
  const dogHead = new Mesh(new SphereGeometry(0.065, 10, 10), bodyMat);
  dogHead.name = 'pullDogHead';
  dogHead.position.set(0.14, 0.04, 0);
  dogHead.castShadow = true;
  dogBody.add(dogHead);

  // Snout — lighter coloured bump
  const snoutGeo = new SphereGeometry(1, 8, 8);
  snoutGeo.scale(0.035, 0.025, 0.03);
  const snout = new Mesh(snoutGeo, createPlasticMaterial('hub_pullSnoutMat', new Color(0.95, 0.8, 0.6)));
  snout.name = 'pullDogSnout';
  snout.position.set(0.055, -0.01, 0);
  dogHead.add(snout);

  // Nose — black dot at tip of snout
  const nose = new Mesh(new SphereGeometry(0.012, 6, 6), createGlossyPaintMaterial('hub_pullNoseMat', new Color(0.1, 0.1, 0.1)));
  nose.name = 'pullDogNose';
  nose.position.set(0.03, 0.008, 0);
  snout.add(nose);

  // Eyes — small black beads
  const eyeMat = createGlossyPaintMaterial('hub_pullEyeMat', new Color(0.08, 0.08, 0.08));
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new SphereGeometry(0.012, 6, 6), eyeMat);
    eye.name = `pullDogEye${side}`;
    eye.position.set(0.04, 0.025, side * 0.035);
    dogHead.add(eye);
  });

  // Blush spots
  const blushMat = createPlasticMaterial('hub_pullBlushMat', new Color(1.0, 0.6, 0.55));
  [-1, 1].forEach((side) => {
    const blush = new Mesh(new CircleGeometry(0.012, 8), blushMat);
    blush.name = `pullDogBlush${side}`;
    blush.position.set(0.02, -0.01, side * 0.05);
    blush.rotation.y = side * 0.4;
    dogHead.add(blush);
  });

  // Floppy ears
  [-1, 1].forEach((side) => {
    const earGeo = new SphereGeometry(1, 8, 6);
    earGeo.scale(0.02, 0.04, 0.035);
    const ear = new Mesh(earGeo, createFeltMaterial(`hub_pullEarMat${side}`, new Color(0.75, 0.45, 0.15)));
    ear.name = `pullDogEar${side}`;
    ear.position.set(-0.01, 0.02, side * 0.055);
    ear.rotation.x = side * 0.4;
    dogHead.add(ear);
  });

  // Legs — four short cylinders
  const legMat = createGlossyPaintMaterial('hub_pullLegMat', new Color(0.85, 0.5, 0.18));
  const legPositions = [new Vector3(0.06, -0.08, 0.05), new Vector3(0.06, -0.08, -0.05), new Vector3(-0.06, -0.08, 0.05), new Vector3(-0.06, -0.08, -0.05)];
  legPositions.forEach((lp, li) => {
    const leg = new Mesh(new CylinderGeometry(0.015, 0.015, 0.06, 6), legMat);
    leg.name = `pullDogLeg${li}`;
    leg.position.copy(lp);
    dogBody.add(leg);
  });

  // Tail — short, upright, wagging
  const tail = new Mesh(new CylinderGeometry(0.01, 0.01, 0.06, 4), bodyMat);
  tail.name = 'pullDogTail';
  tail.position.set(-0.12, 0.06, 0);
  tail.rotation.z = 0.5;
  dogBody.add(tail);

  // Pull string — brown felt cord with a bead at the end
  const string = new Mesh(new CylinderGeometry(0.004, 0.004, 0.35, 4), createFeltMaterial('hub_pullStringMat', new Color(0.5, 0.35, 0.2)));
  string.name = 'pullString';
  string.position.set(0.42, 0.02, 0);
  string.rotation.z = Math.PI / 2;
  platform.add(string);

  // String bead
  const bead = new Mesh(new SphereGeometry(0.018, 6, 6), createGlossyPaintMaterial('hub_pullBeadMat', new Color(0.85, 0.2, 0.2)));
  bead.name = 'pullStringBead';
  bead.position.set(0.6, 0.02, 0);
  platform.add(bead);
}
