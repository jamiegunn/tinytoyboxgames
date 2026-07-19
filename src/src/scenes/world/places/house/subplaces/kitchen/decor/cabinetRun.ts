import gsap from 'gsap';
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import {
  createGlossyPaintMaterial,
  createPlasticMaterial,
  createToyMetalMaterial,
  createTranslucentMaterial,
  createWoodMaterial,
} from '@app/utils/materialFactory';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { BACK_WALL_FACE_Z, CABINET_RUN_WIDTH, CABINET_RUN_X, COUNTERTOP_Y } from '../layout';

/** Cabinet body depth (front face sits proud of the back wall). */
const CABINET_DEPTH = 0.85;

/** Cabinet carcass height under the countertop slab. */
const CABINET_HEIGHT = 1.12;

/**
 * Creates the run of lower cabinets with a wooden countertop along the back
 * wall: three sage door fronts with little knobs, a tiled backsplash strip,
 * and homey items on top — a butter-yellow kettle, a mixing bowl with a
 * spoon, and two pantry jars. Tapping the kettle makes it wobble on its base,
 * chime, and sparkle — one of the room's tappable delights.
 *
 * @param scene - The Three.js scene that receives the cabinet group.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns Cleanup function that unregisters the kettle tap and kills tweens.
 */
export function createCabinetRun(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const root = new Group();
  root.name = 'kitchen_cabinetRun';
  root.position.set(CABINET_RUN_X, 0, BACK_WALL_FACE_Z - CABINET_DEPTH / 2);
  scene.add(root);

  const carcassMat = createGlossyPaintMaterial('kitchen_cabinetMat', new Color(0.82, 0.86, 0.78));
  const doorMat = createGlossyPaintMaterial('kitchen_cabinetDoorMat', new Color(0.74, 0.8, 0.68));
  const counterMat = createWoodMaterial('kitchen_countertopMat', new Color(0.56, 0.42, 0.28));
  const knobMat = createToyMetalMaterial('kitchen_cabinetKnobMat', new Color(0.78, 0.68, 0.44));
  const splashMat = createGlossyPaintMaterial('kitchen_backsplashMat', new Color(0.93, 0.9, 0.82));

  // Carcass and kick base.
  const carcass = new Mesh(new BoxGeometry(CABINET_RUN_WIDTH, CABINET_HEIGHT, CABINET_DEPTH), carcassMat);
  carcass.name = 'cabinetCarcass';
  carcass.position.y = CABINET_HEIGHT / 2;
  carcass.castShadow = true;
  carcass.receiveShadow = true;
  root.add(carcass);

  // Countertop slab, slightly proud of the doors.
  const counter = new Mesh(new BoxGeometry(CABINET_RUN_WIDTH + 0.12, 0.08, CABINET_DEPTH + 0.12), counterMat);
  counter.name = 'cabinetCountertop';
  counter.position.y = COUNTERTOP_Y;
  counter.castShadow = true;
  root.add(counter);

  // Backsplash strip against the wall.
  const splash = new Mesh(new BoxGeometry(CABINET_RUN_WIDTH + 0.12, 0.28, 0.05), splashMat);
  splash.name = 'cabinetBacksplash';
  splash.position.set(0, COUNTERTOP_Y + 0.18, CABINET_DEPTH / 2 - 0.03);
  root.add(splash);

  // Three door fronts with knobs.
  const doorWidth = (CABINET_RUN_WIDTH - 0.5) / 3;
  for (let i = 0; i < 3; i++) {
    const doorX = (i - 1) * (doorWidth + 0.14);
    const door = new Mesh(new BoxGeometry(doorWidth, CABINET_HEIGHT - 0.32, 0.05), doorMat);
    door.name = `cabinetDoor${i}`;
    door.position.set(doorX, CABINET_HEIGHT / 2 - 0.04, -CABINET_DEPTH / 2 - 0.025);
    root.add(door);

    const knob = new Mesh(new SphereGeometry(0.045, 10, 8), knobMat);
    knob.name = `cabinetKnob${i}`;
    knob.position.set(doorX + doorWidth / 2 - 0.14, CABINET_HEIGHT / 2 + 0.22, -CABINET_DEPTH / 2 - 0.07);
    root.add(knob);
  }

  // ── Kettle (tappable) ──
  const kettle = new Group();
  kettle.name = 'kitchen_kettle';
  kettle.position.set(-1.35, COUNTERTOP_Y + 0.04, -0.05);
  root.add(kettle);

  const kettleMat = createGlossyPaintMaterial('kitchen_kettleMat', new Color(0.96, 0.8, 0.34));
  const kettleLidMat = createGlossyPaintMaterial('kitchen_kettleLidMat', new Color(0.88, 0.68, 0.26));

  const kettleBody = new Mesh(new SphereGeometry(0.24, 18, 14), kettleMat);
  kettleBody.name = 'kettleBody';
  kettleBody.scale.set(1, 0.85, 1);
  kettleBody.position.y = 0.2;
  kettleBody.castShadow = true;
  kettle.add(kettleBody);

  const kettleLid = new Mesh(new CylinderGeometry(0.1, 0.13, 0.07, 12), kettleLidMat);
  kettleLid.name = 'kettleLid';
  kettleLid.position.y = 0.4;
  kettle.add(kettleLid);

  const kettleKnob = new Mesh(new SphereGeometry(0.04, 10, 8), kettleLidMat);
  kettleKnob.name = 'kettleKnob';
  kettleKnob.position.y = 0.46;
  kettle.add(kettleKnob);

  const spout = new Mesh(new CylinderGeometry(0.035, 0.055, 0.26, 10), kettleMat);
  spout.name = 'kettleSpout';
  spout.position.set(-0.26, 0.28, 0);
  spout.rotation.z = 0.8;
  kettle.add(spout);

  const handle = new Mesh(new TorusGeometry(0.13, 0.025, 8, 18, Math.PI), kettleLidMat);
  handle.name = 'kettleHandle';
  handle.position.set(0.16, 0.34, 0);
  handle.rotation.z = -0.5;
  kettle.add(handle);

  // ── Mixing bowl with spoon ──
  const bowlMat = createPlasticMaterial('kitchen_mixingBowlMat', new Color(0.62, 0.74, 0.78));
  const bowl = new Mesh(new CylinderGeometry(0.26, 0.16, 0.22, 18), bowlMat);
  bowl.name = 'mixingBowl';
  bowl.position.set(0.15, COUNTERTOP_Y + 0.15, -0.08);
  bowl.castShadow = true;
  root.add(bowl);

  const spoonMat = createWoodMaterial('kitchen_spoonMat', new Color(0.72, 0.55, 0.36));
  const spoon = new Mesh(new CylinderGeometry(0.018, 0.03, 0.42, 8), spoonMat);
  spoon.name = 'mixingSpoon';
  spoon.position.set(0.24, COUNTERTOP_Y + 0.32, -0.08);
  spoon.rotation.z = -0.5;
  root.add(spoon);

  // ── Pantry jars ──
  const jarGlassMat = createTranslucentMaterial('kitchen_jarGlassMat', new Color(0.85, 0.9, 0.88), 0.55);
  const jarLidMat = createWoodMaterial('kitchen_jarLidMat', new Color(0.66, 0.5, 0.32));
  [
    { x: 1.35, radius: 0.11, height: 0.34 },
    { x: 1.62, radius: 0.09, height: 0.26 },
  ].forEach((spec, index) => {
    const jar = new Mesh(new CylinderGeometry(spec.radius, spec.radius, spec.height, 12), jarGlassMat);
    jar.name = `pantryJar${index}`;
    jar.position.set(spec.x, COUNTERTOP_Y + 0.04 + spec.height / 2, -0.02);
    root.add(jar);

    const lid = new Mesh(new CylinderGeometry(spec.radius + 0.015, spec.radius + 0.015, 0.045, 12), jarLidMat);
    lid.name = `pantryJarLid${index}`;
    lid.position.set(spec.x, COUNTERTOP_Y + 0.04 + spec.height + 0.02, -0.02);
    root.add(lid);
  });

  // Tap delight: the kettle rocks on its base, chimes, and sparkles.
  const unregister = createTapInteraction(dispatcher, kettleBody, () => {
    triggerSound('sfx_shared_chime');
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, kettle.getWorldPosition(new Vector3()).add(new Vector3(0, 0.45, -0.15)));

    gsap.killTweensOf(kettle.rotation);
    gsap.killTweensOf(kettle.scale);
    gsap.to(kettle.rotation, {
      z: 0.22,
      duration: 0.09,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        kettle.rotation.z = 0;
      },
    });
    gsap.to(kettle.scale, {
      x: 1.12,
      y: 0.92,
      duration: 0.12,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        kettle.scale.set(1, 1, 1);
      },
    });
  });

  return () => {
    unregister();
    gsap.killTweensOf(kettle.rotation);
    gsap.killTweensOf(kettle.scale);
  };
}
