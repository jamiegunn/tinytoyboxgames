import gsap from 'gsap';
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createFeltMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { COUCH_X, COUCH_Z } from '../layout';

/** Couch body dimensions. */
const SEAT_WIDTH = 3.2;
const SEAT_DEPTH = 1.3;
const SEAT_HEIGHT = 0.55;
const BACK_HEIGHT = 0.9;
const ARM_RADIUS = 0.28;

/**
 * Creates the rounded teal couch facing the camera, with three plump throw
 * cushions. Tapping a cushion makes it wiggle, sparkle, and pop — one of the
 * room's tappable delights, wired through the shared tap dispatcher.
 *
 * @param scene - The Three.js scene that receives the couch group.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns Cleanup function that unregisters cushion taps and kills tweens.
 */
export function createCouch(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const root = new Group();
  root.name = 'livingRoom_couch';
  root.position.set(COUCH_X, 0, COUCH_Z);
  root.rotation.y = Math.PI; // Face the camera (toward -Z).
  scene.add(root);

  const bodyMat = createFeltMaterial('livingRoom_couchBodyMat', new Color(0.32, 0.55, 0.55));
  const cushionMat = createFeltMaterial('livingRoom_couchCushionMat', new Color(0.4, 0.63, 0.62));
  const legMat = createWoodMaterial('livingRoom_couchLegMat', new Color(0.5, 0.36, 0.24));

  // Seat base.
  const seat = new Mesh(new BoxGeometry(SEAT_WIDTH, SEAT_HEIGHT, SEAT_DEPTH), bodyMat);
  seat.name = 'couchSeat';
  seat.position.y = 0.18 + SEAT_HEIGHT / 2;
  seat.castShadow = true;
  seat.receiveShadow = true;
  root.add(seat);

  // Backrest, slightly tilted for coziness.
  const back = new Mesh(new BoxGeometry(SEAT_WIDTH, BACK_HEIGHT, 0.35), bodyMat);
  back.name = 'couchBack';
  back.position.set(0, 0.18 + SEAT_HEIGHT + BACK_HEIGHT / 2 - 0.12, SEAT_DEPTH / 2 - 0.12);
  back.rotation.x = 0.1;
  back.castShadow = true;
  root.add(back);

  // Rounded arms: horizontal cylinders capping each end.
  [-1, 1].forEach((side) => {
    const arm = new Mesh(new CylinderGeometry(ARM_RADIUS, ARM_RADIUS, SEAT_DEPTH, 14), bodyMat);
    arm.name = `couchArm${side > 0 ? 'Right' : 'Left'}`;
    arm.position.set(side * (SEAT_WIDTH / 2 - 0.06), 0.18 + SEAT_HEIGHT + ARM_RADIUS * 0.5, 0);
    arm.rotation.x = Math.PI / 2;
    arm.castShadow = true;
    root.add(arm);
  });

  // Little wooden feet.
  [-1, 1].forEach((sideX) => {
    [-1, 1].forEach((sideZ) => {
      const leg = new Mesh(new CylinderGeometry(0.06, 0.05, 0.18, 10), legMat);
      leg.name = `couchLeg${sideX}${sideZ}`;
      leg.position.set(sideX * (SEAT_WIDTH / 2 - 0.25), 0.09, sideZ * (SEAT_DEPTH / 2 - 0.2));
      root.add(leg);
    });
  });

  // Three plump seat cushions, each a tappable delight.
  const cushionColors = [new Color(0.92, 0.72, 0.4), new Color(0.4, 0.63, 0.62), new Color(0.82, 0.55, 0.5)];
  const cleanups: Array<() => void> = [];
  const cushions: Mesh[] = [];

  cushionColors.forEach((color, index) => {
    const material = index === 1 ? cushionMat : createFeltMaterial(`livingRoom_couchPillowMat${index}`, color);
    const cushion = new Mesh(new SphereGeometry(0.34, 16, 12), material);
    cushion.name = `couchCushion${index}`;
    cushion.scale.set(1.15, 0.7, 1);
    cushion.position.set((index - 1) * 0.95, 0.18 + SEAT_HEIGHT + 0.16, -0.08);
    cushion.castShadow = true;
    root.add(cushion);
    cushions.push(cushion);

    const baseScale = cushion.scale.clone();
    const unregister = createTapInteraction(dispatcher, cushion, () => {
      triggerSound('sfx_shared_pop');
      const worldPosition = cushion.getWorldPosition(new Vector3());
      getParticleEngine(scene).emit(PARTICLES.sceneSparkle, worldPosition);

      gsap.killTweensOf(cushion.scale);
      gsap.killTweensOf(cushion.rotation);
      gsap.to(cushion.scale, {
        x: baseScale.x * 1.2,
        y: baseScale.y * 0.75,
        z: baseScale.z * 1.2,
        duration: 0.1,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          cushion.scale.copy(baseScale);
        },
      });
      gsap.to(cushion.rotation, {
        z: 0.16,
        duration: 0.08,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          cushion.rotation.z = 0;
        },
      });
    });
    cleanups.push(unregister);
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    cushions.forEach((cushion) => {
      gsap.killTweensOf(cushion.scale);
      gsap.killTweensOf(cushion.rotation);
    });
  };
}
