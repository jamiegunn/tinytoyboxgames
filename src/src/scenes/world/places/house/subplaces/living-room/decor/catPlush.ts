import gsap from 'gsap';
import { Color, ConeGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createFeltMaterial } from '@app/utils/materialFactory';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { getIdleAnimator } from '@app/utils/idle/registry';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { CAT_X, CAT_Z } from '../layout';

/**
 * Creates a sleeping cat plush curled up on the rug: a round felt body,
 * tucked head with triangle ears, and a tail wrapped around like a crescent.
 * Tapping the cat makes it stretch, wiggle its ears, chime softly, and
 * sparkle — one of the room's tappable delights.
 *
 * @param scene - The Three.js scene that receives the cat group.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns Cleanup function that unregisters the tap and kills tweens.
 */
export function createCatPlush(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const root = new Group();
  root.name = 'livingRoom_catPlush';
  root.position.set(CAT_X, 0.06, CAT_Z);
  root.rotation.y = -0.6;
  scene.add(root);

  const furMat = createFeltMaterial('livingRoom_catFurMat', new Color(0.88, 0.64, 0.4));
  const furDarkMat = createFeltMaterial('livingRoom_catFurDarkMat', new Color(0.76, 0.52, 0.3));
  const noseMat = createFeltMaterial('livingRoom_catNoseMat', new Color(0.9, 0.55, 0.55));

  // Curled body: a squashed sphere.
  const body = new Mesh(new SphereGeometry(0.32, 16, 12), furMat);
  body.name = 'catBody';
  body.scale.set(1.2, 0.62, 1);
  body.position.y = 0.18;
  body.castShadow = true;
  root.add(body);

  // Head tucked against the body.
  const head = new Mesh(new SphereGeometry(0.17, 14, 12), furMat);
  head.name = 'catHead';
  head.position.set(0.3, 0.2, 0.1);
  head.castShadow = true;
  root.add(head);

  // Triangle ears.
  const ears: Mesh[] = [];
  [-1, 1].forEach((side) => {
    const ear = new Mesh(new ConeGeometry(0.055, 0.1, 6), furDarkMat);
    ear.name = `catEar${side > 0 ? 'Right' : 'Left'}`;
    ear.position.set(0.3 + side * 0.08, 0.34, 0.1 + side * 0.04);
    ear.rotation.z = side * -0.25;
    root.add(ear);
    ears.push(ear);
  });

  // Tiny nose.
  const nose = new Mesh(new SphereGeometry(0.025, 8, 6), noseMat);
  nose.name = 'catNose';
  nose.position.set(0.44, 0.18, 0.14);
  root.add(nose);

  // Tail curled around the body like a crescent.
  const tail = new Mesh(new TorusGeometry(0.3, 0.05, 8, 20, Math.PI * 1.2), furDarkMat);
  tail.name = 'catTail';
  tail.position.set(-0.05, 0.08, -0.02);
  tail.rotation.x = -Math.PI / 2;
  tail.rotation.z = 0.6;
  root.add(tail);

  // Gentle sleeping breath.
  // Gentle vertical breathing (0.62 ↔ 0.68). See architecture-standards.md#idleanimator.
  getIdleAnimator(scene).breathe(body, { amplitude: 0.68 / body.scale.y - 1, period: 3.2, axes: ['y'] });

  const unregister = createTapInteraction(dispatcher, body, () => {
    triggerSound('sfx_shared_chime');
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, root.getWorldPosition(new Vector3()).add(new Vector3(0, 0.4, 0)));

    // A sleepy stretch: the whole cat lifts and wiggles, ears flick.
    gsap.killTweensOf(root.rotation);
    gsap.to(root.rotation, {
      y: root.rotation.y + 0.14,
      duration: 0.1,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 3,
    });
    ears.forEach((ear, index) => {
      gsap.killTweensOf(ear.rotation);
      gsap.to(ear.rotation, {
        z: ear.rotation.z + (index === 0 ? -0.3 : 0.3),
        duration: 0.08,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 3,
      });
    });
  });

  return () => {
    unregister();
    gsap.killTweensOf(body.scale);
    gsap.killTweensOf(root.rotation);
    ears.forEach((ear) => gsap.killTweensOf(ear.rotation));
  };
}
