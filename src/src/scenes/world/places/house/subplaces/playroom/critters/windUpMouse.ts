import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Group, Mesh, PlaneGeometry, SphereGeometry, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import gsap from 'gsap';

/**
 * Creates an animated wind-up mouse that scurries around the floor.
 * @param scene - The Three.js scene to add the mouse to
 * @param _keyLight - The directional light (unused)
 */
export function createWindUpMouse(scene: Scene, _keyLight: DirectionalLight): void {
  const bodyMat = createFeltMaterial('mouseMat', new Color(0.75, 0.72, 0.68));

  const root = new Group();
  root.name = 'mouse_root';
  root.position.set(-3.0, 0.06, -1.0);
  scene.add(root);

  // Body — teardrop shape using geometry scaling (no mesh.scale distortion)
  const bodyGeo = new SphereGeometry(1, 12, 12);
  bodyGeo.scale(0.15, 0.1, 0.2);
  const body = new Mesh(bodyGeo, bodyMat);
  body.name = 'mouse';
  body.position.y = 0.1;
  body.castShadow = true;
  root.add(body);

  // Rump — slightly wider back end
  const rumpGeo = new SphereGeometry(1, 10, 8);
  rumpGeo.scale(0.12, 0.09, 0.1);
  const rump = new Mesh(rumpGeo, bodyMat);
  rump.name = 'mouseRump';
  rump.position.set(0, 0, -0.12);
  body.add(rump);

  // Snout — pointed front
  const snoutGeo = new SphereGeometry(1, 8, 8);
  snoutGeo.scale(0.06, 0.05, 0.08);
  const snout = new Mesh(snoutGeo, bodyMat);
  snout.name = 'mouseSnout';
  snout.position.set(0, 0.01, 0.18);
  body.add(snout);

  // Round pink felt ears
  const earMat = createFeltMaterial('mouseEarMat', new Color(0.92, 0.65, 0.68));
  [-1, 1].forEach((side) => {
    const ear = new Mesh(new CircleGeometry(0.06, 12), earMat);
    ear.name = `mouseEar${side}`;
    ear.position.set(side * 0.08, 0.08, 0.1);
    ear.rotation.x = -0.4;
    ear.rotation.y = side * 0.5;
    body.add(ear);

    const inner = new Mesh(new CircleGeometry(0.038, 10), createFeltMaterial(`hub_mouseEarInnerMat${side}`, new Color(0.95, 0.78, 0.8)));
    inner.name = `mouseEarInner${side}`;
    inner.position.z = 0.002;
    ear.add(inner);
  });

  // Button eyes — sitting on the surface
  const mouseEyeMat = createGlossyPaintMaterial('hub_mouseEyeMat', new Color(0.08, 0.06, 0.06));
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new CylinderGeometry(0.018, 0.018, 0.01, 12), mouseEyeMat);
    eye.name = `mouseEye${side}`;
    eye.position.set(side * 0.06, 0.06, 0.14);
    eye.rotation.x = Math.PI / 2;
    body.add(eye);

    const glint = new Mesh(new SphereGeometry(0.005, 4, 4), createGlossyPaintMaterial(`hub_mouseGlintMat${side}`, new Color(1, 1, 1)));
    glint.name = `mouseGlint${side}`;
    glint.position.set(0.006, 0.006, 0.004);
    eye.add(glint);
  });

  // Tiny pink nose at the tip of the snout
  const nose = new Mesh(new SphereGeometry(0.015, 6, 6), createGlossyPaintMaterial('hub_mouseNoseMat', new Color(0.95, 0.5, 0.55)));
  nose.name = 'mouseNose';
  nose.position.set(0, 0.01, 0.06);
  snout.add(nose);

  // Whiskers — thin lines from each side of the snout
  const whiskerMat = createFeltMaterial('hub_whiskerMat', new Color(0.6, 0.58, 0.55));
  [-1, 1].forEach((side) => {
    for (let w = -1; w <= 1; w++) {
      const whisker = new Mesh(new PlaneGeometry(0.1, 0.003), whiskerMat);
      whisker.name = `mouseWhisker${side}_${w}`;
      whisker.position.set(side * 0.05, 0.005 + w * 0.015, 0.04);
      whisker.rotation.y = side * 0.35;
      whisker.rotation.z = w * 0.18;
      snout.add(whisker);
    }
  });

  // Felt tail — thin, curving cylinder
  const tail = new Mesh(new CylinderGeometry(0.005, 0.005, 0.25, 4), earMat);
  tail.name = 'mouseTail';
  tail.position.set(0, 0.02, -0.18);
  tail.rotation.x = -0.5;
  body.add(tail);

  // Tail curl
  const tailTip = new Mesh(new CylinderGeometry(0.004, 0.004, 0.08, 4), earMat);
  tailTip.name = 'mouseTailTip';
  tailTip.position.set(0, -0.12, -0.02);
  tailTip.rotation.x = -0.8;
  tail.add(tailTip);

  // Wind-up key on the back
  const keyMat = createToyMetalMaterial('mouseKeyMat', new Color(0.85, 0.72, 0.3));
  const keyBase = new Mesh(new CylinderGeometry(0.015, 0.015, 0.04, 6), keyMat);
  keyBase.name = 'mouseKeyBase';
  keyBase.position.set(0, 0.1, -0.06);
  body.add(keyBase);

  const keyHandle = new Mesh(new BoxGeometry(0.05, 0.03, 0.008), keyMat);
  keyHandle.name = 'mouseKeyHandle';
  keyHandle.position.y = 0.03;
  keyBase.add(keyHandle);

  // Tiny feet
  const footMat = createFeltMaterial('hub_mouseFootMat', new Color(0.92, 0.65, 0.68));
  [-1, 1].forEach((side) => {
    const foot = new Mesh(new SphereGeometry(0.018, 6, 6), footMat);
    foot.name = `mouseFoot${side}`;
    foot.position.set(side * 0.08, -0.08, 0.04);
    body.add(foot);

    const backFoot = new Mesh(new SphereGeometry(0.016, 6, 6), footMat);
    backFoot.name = `mouseBackFoot${side}`;
    backFoot.position.set(side * 0.07, -0.08, -0.08);
    body.add(backFoot);
  });

  // Scurry animation — position (animate the root group, keep Y=0.06 above rug)
  const scurryTimeline = gsap.timeline({ repeat: -1 });
  scurryTimeline.to(root.position, {
    x: -1.5,
    y: 0.06,
    z: -1.8,
    duration: 90 / 60,
    ease: 'power1.inOut',
  });
  scurryTimeline.to(root.position, {
    x: -2.8,
    y: 0.06,
    z: -2.0,
    duration: 90 / 60,
    ease: 'power1.inOut',
  });
  scurryTimeline.to(root.position, {
    x: -2.8,
    y: 0.06,
    z: -2.0,
    duration: 60 / 60,
    ease: 'none',
  });
  scurryTimeline.to(root.position, {
    x: -3.0,
    y: 0.06,
    z: -1.0,
    duration: 60 / 60,
    ease: 'power1.inOut',
  });

  // Scurry animation — rotation
  const rotTimeline = gsap.timeline({ repeat: -1 });
  rotTimeline.to(root.rotation, { y: -0.3, duration: 90 / 60, ease: 'power1.inOut' });
  rotTimeline.to(root.rotation, { y: -0.8, duration: 90 / 60, ease: 'power1.inOut' });
  rotTimeline.to(root.rotation, { y: -0.8, duration: 60 / 60, ease: 'none' });
  rotTimeline.to(root.rotation, { y: 0.5, duration: 60 / 60, ease: 'power1.inOut' });
}
