import gsap from 'gsap';
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import { getIdleAnimator } from '@app/utils/idle/registry';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { triggerSound } from '@app/assets/audio/sceneBridge';

/**
 * Creates "Web-Slinger" — an ORIGINAL blocky brick-figure superhero toy in the
 * red/blue web-slinger *spirit* but with its own design: a chunky stud-topped
 * build, a plain masked face with round white goggle-eyes (not the pointed
 * comic eyes), and an original white diamond chest emblem (no spider/web
 * markings). It is deliberately not a copy of any trademarked character or the
 * LEGO minifigure proportions.
 *
 * Tapping it makes the hero do a little victory hop with a chime and a sparkle.
 *
 * @param scene - The Three.js scene to add the hero to.
 * @param _keyLight - The directional light (unused).
 */
export function createWebSlinger(scene: Scene, _keyLight: DirectionalLight): void {
  const red = createGlossyPaintMaterial('hub_heroRed', new Color(0.86, 0.13, 0.15));
  const blue = createGlossyPaintMaterial('hub_heroBlue', new Color(0.13, 0.28, 0.78));
  const white = createGlossyPaintMaterial('hub_heroWhite', new Color(0.97, 0.97, 0.98));
  const dark = createPlasticMaterial('hub_heroDark', new Color(0.08, 0.09, 0.12));

  const root = new Group();
  root.name = 'webSlinger';
  root.position.set(2.7, 0, -2.7);
  // Face the camera (which looks from -Z), turned slightly for a dynamic pose so
  // the mask, emblem, and raised arm all read.
  root.rotation.y = Math.PI - 0.35;
  root.scale.setScalar(1.4);
  scene.add(root);

  // ── Legs — blue blocks ───────────────────────────────────────────────────
  [-1, 1].forEach((side, i) => {
    const leg = new Mesh(new BoxGeometry(0.07, 0.16, 0.08), blue);
    leg.name = `hero_leg_${i}`;
    leg.position.set(side * 0.045, 0.08, 0);
    leg.castShadow = true;
    root.add(leg);
    const boot = new Mesh(new BoxGeometry(0.075, 0.05, 0.1), red);
    boot.name = `hero_boot_${i}`;
    boot.position.set(0, -0.06, 0.01);
    leg.add(boot);
  });

  // ── Torso — red block with a white diamond emblem ────────────────────────
  const torso = new Mesh(new BoxGeometry(0.17, 0.17, 0.1), red);
  torso.name = 'hero_torso';
  torso.position.y = 0.245;
  torso.castShadow = true;
  root.add(torso);

  const belt = new Mesh(new BoxGeometry(0.175, 0.03, 0.105), blue);
  belt.name = 'hero_belt';
  belt.position.y = -0.08;
  torso.add(belt);

  // Original chest emblem: a white diamond (rotated flat box), NOT a spider.
  const emblem = new Mesh(new BoxGeometry(0.05, 0.05, 0.012), white);
  emblem.name = 'hero_emblem';
  emblem.position.set(0, 0.01, 0.052);
  emblem.rotation.z = Math.PI / 4;
  torso.add(emblem);

  // ── Arms — red with blue gloves, one raised in a hero pose ───────────────
  const armData = [
    { side: -1, raised: true },
    { side: 1, raised: false },
  ];
  armData.forEach(({ side, raised }, i) => {
    const shoulder = new Group();
    shoulder.name = `hero_shoulder_${i}`;
    shoulder.position.set(side * 0.11, 0.3, 0);
    shoulder.rotation.z = raised ? side * 1.9 : side * 0.35;
    root.add(shoulder);

    const arm = new Mesh(new BoxGeometry(0.06, 0.15, 0.06), red);
    arm.name = `hero_arm_${i}`;
    arm.position.y = -0.07;
    arm.castShadow = true;
    shoulder.add(arm);

    const glove = new Mesh(new CylinderGeometry(0.035, 0.035, 0.05, 10), blue);
    glove.name = `hero_glove_${i}`;
    glove.position.y = -0.09;
    arm.add(glove);
  });

  // ── Head — red mask, brick stud on top, round white goggle-eyes ──────────
  const head = new Mesh(new BoxGeometry(0.12, 0.12, 0.12), red);
  head.name = 'hero_head';
  head.position.y = 0.4;
  head.castShadow = true;
  root.add(head);

  const stud = new Mesh(new CylinderGeometry(0.03, 0.03, 0.025, 12), red);
  stud.name = 'hero_stud';
  stud.position.y = 0.072;
  head.add(stud);

  [-1, 1].forEach((side, i) => {
    const eye = new Mesh(new SphereGeometry(0.026, 12, 10), white);
    eye.name = `hero_eye_${i}`;
    eye.scale.set(1, 1.15, 0.5);
    eye.position.set(side * 0.032, 0.008, 0.06);
    head.add(eye);
    const rim = new Mesh(new SphereGeometry(0.03, 12, 10), dark);
    rim.name = `hero_eyerim_${i}`;
    rim.scale.set(1, 1.15, 0.4);
    rim.position.set(side * 0.032, 0.008, 0.056);
    head.add(rim);
    eye.renderOrder = 1;
  });

  // Gentle idle sway so the hero feels alive. See architecture-standards.md#idleanimator.
  getIdleAnimator(scene).sway(root, { axis: 'z', amplitude: 0.04, period: 150 / 60 });

  // Tap → victory hop (picked up by the playroom's legacy click scan).
  let hopping = false;
  root.userData.onClick = () => {
    if (hopping) return;
    hopping = true;
    triggerSound('sfx_shared_chime');
    const baseY = root.position.y;
    gsap
      .timeline({
        onComplete: () => {
          hopping = false;
        },
      })
      .to(root.position, { y: baseY + 0.28, duration: 0.22, ease: 'power2.out' })
      .to(root.rotation, { y: root.rotation.y + Math.PI * 2, duration: 0.44, ease: 'power1.inOut' }, 0)
      .to(root.position, { y: baseY, duration: 0.22, ease: 'bounce.out' }, 0.22);
    const burst = root.localToWorld(new Vector3(0, 0.5, 0));
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, burst);
  };
}
