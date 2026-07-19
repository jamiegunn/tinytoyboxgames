import gsap from 'gsap';
import { Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createToyMetalMaterial, createWoodMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { FLOOR_LAMP_X, FLOOR_LAMP_Z } from '../layout';

/** Lamp pole height. */
const POLE_HEIGHT = 2.1;

/**
 * Creates the cozy floor lamp beside the couch: wooden base, slim brass pole,
 * and a warm glowing shade. Tapping the shade makes it wobble, chime, and
 * sparkle — one of the room's tappable delights.
 *
 * @param scene - The Three.js scene that receives the lamp group.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns Cleanup function that unregisters the tap and kills tweens.
 */
export function createFloorLamp(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const root = new Group();
  root.name = 'livingRoom_floorLamp';
  root.position.set(FLOOR_LAMP_X, 0, FLOOR_LAMP_Z);
  scene.add(root);

  const baseMat = createWoodMaterial('livingRoom_lampBaseMat', new Color(0.48, 0.34, 0.22));
  const poleMat = createToyMetalMaterial('livingRoom_lampPoleMat', new Color(0.72, 0.6, 0.38));
  const shadeMat = getOrCreateMaterial('livingRoom_lampShadeMat', () => {
    const material = new MeshStandardMaterial({ color: new Color(1.0, 0.85, 0.58), roughness: 0.7, metalness: 0 });
    material.emissive = new Color(1.0, 0.78, 0.45);
    material.emissiveIntensity = 0.65;
    return material;
  });

  const base = new Mesh(new CylinderGeometry(0.32, 0.36, 0.1, 18), baseMat);
  base.name = 'lampBase';
  base.position.y = 0.05;
  base.castShadow = true;
  root.add(base);

  const pole = new Mesh(new CylinderGeometry(0.035, 0.035, POLE_HEIGHT, 10), poleMat);
  pole.name = 'lampPole';
  pole.position.y = 0.1 + POLE_HEIGHT / 2;
  root.add(pole);

  const shade = new Mesh(new ConeGeometry(0.42, 0.55, 18, 1, true), shadeMat);
  shade.name = 'lampShade';
  shade.position.y = 0.1 + POLE_HEIGHT + 0.18;
  shade.castShadow = true;
  root.add(shade);

  const bulb = new Mesh(new SphereGeometry(0.1, 12, 10), shadeMat);
  bulb.name = 'lampBulb';
  bulb.position.y = 0.1 + POLE_HEIGHT + 0.05;
  root.add(bulb);

  const unregister = createTapInteraction(dispatcher, shade, () => {
    triggerSound('sfx_shared_star_chime');
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, shade.getWorldPosition(new Vector3()));

    gsap.killTweensOf(shade.rotation);
    gsap.killTweensOf(shade.scale);
    gsap.to(shade.rotation, {
      z: 0.18,
      duration: 0.09,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        shade.rotation.z = 0;
      },
    });
    gsap.to(shade.scale, {
      x: 1.12,
      y: 1.12,
      z: 1.12,
      duration: 0.12,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        shade.scale.set(1, 1, 1);
      },
    });
  });

  return () => {
    unregister();
    gsap.killTweensOf(shade.rotation);
    gsap.killTweensOf(shade.scale);
  };
}
