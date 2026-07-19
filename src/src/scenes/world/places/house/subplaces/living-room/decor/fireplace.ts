import gsap from 'gsap';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createPlasticMaterial, createToyMetalMaterial, createWoodMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { BACK_WALL_FACE_Z, FIREPLACE_X } from '../layout';

/** Fireplace body dimensions. */
const BODY_WIDTH = 2.0;
const BODY_HEIGHT = 2.2;
const BODY_DEPTH = 0.7;

/** Firebox opening dimensions. */
const OPENING_WIDTH = 1.3;
const OPENING_HEIGHT = 1.1;

/**
 * Creates the warm-material for the fire glow: an emissive standard material
 * so the flames read as the room's light source even before the authored
 * point light in `environment.ts` catches nearby furniture.
 *
 * @param name - Cache key for the material factory.
 * @param color - Diffuse and emissive tint.
 * @param intensity - Emissive intensity.
 * @returns A cached emissive MeshStandardMaterial.
 */
function createGlowMaterial(name: string, color: Color, intensity: number): MeshStandardMaterial {
  return getOrCreateMaterial(name, () => {
    const material = new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 });
    material.emissive = color.clone();
    material.emissiveIntensity = intensity;
    return material;
  });
}

/**
 * Creates the brick fireplace on the back wall: rounded toy-brick body, a
 * wooden mantel shelf, a dark firebox with logs, and softly flickering
 * emissive flames. Tapping the fire makes it flare, crackle-chime, and throw
 * sparkles — one of the room's tappable delights.
 *
 * @param scene - The Three.js scene that receives the fireplace group.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns Cleanup function that unregisters the tap and kills flame tweens.
 */
export function createFireplace(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const root = new Group();
  root.name = 'livingRoom_fireplace';
  root.position.set(FIREPLACE_X, 0, BACK_WALL_FACE_Z - BODY_DEPTH / 2);
  scene.add(root);

  const brickMat = createPlasticMaterial('livingRoom_fireplaceBrickMat', new Color(0.78, 0.45, 0.36));
  const brickDarkMat = createPlasticMaterial('livingRoom_fireplaceBrickDarkMat', new Color(0.68, 0.38, 0.3));
  const mantelMat = createWoodMaterial('livingRoom_fireplaceMantelMat', new Color(0.52, 0.37, 0.24));
  const fireboxMat = createPlasticMaterial('livingRoom_fireboxMat', new Color(0.1, 0.07, 0.06));
  const logMat = createWoodMaterial('livingRoom_fireLogMat', new Color(0.42, 0.28, 0.17));
  const grateMat = createToyMetalMaterial('livingRoom_fireGrateMat', new Color(0.25, 0.24, 0.26));

  // Chimney breast body.
  const body = new Mesh(new BoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH), brickMat);
  body.name = 'fireplaceBody';
  body.position.y = BODY_HEIGHT / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // A few offset brick accents for a toy-brick feel.
  const brickPositions: Array<[number, number]> = [
    [-0.7, 0.5],
    [0.65, 0.85],
    [-0.55, 1.5],
    [0.75, 1.8],
  ];
  brickPositions.forEach(([x, y], index) => {
    const brick = new Mesh(new BoxGeometry(0.4, 0.18, 0.04), brickDarkMat);
    brick.name = `fireplaceBrick${index}`;
    brick.position.set(x, y, -BODY_DEPTH / 2 - 0.02);
    root.add(brick);
  });

  // Mantel shelf.
  const mantel = new Mesh(new BoxGeometry(BODY_WIDTH + 0.4, 0.14, BODY_DEPTH + 0.3), mantelMat);
  mantel.name = 'fireplaceMantel';
  mantel.position.y = BODY_HEIGHT + 0.07;
  mantel.castShadow = true;
  root.add(mantel);

  // Dark firebox recess (proud of the body's front face).
  const firebox = new Mesh(new BoxGeometry(OPENING_WIDTH, OPENING_HEIGHT, 0.1), fireboxMat);
  firebox.name = 'firebox';
  firebox.position.set(0, 0.12 + OPENING_HEIGHT / 2, -BODY_DEPTH / 2 - 0.03);
  root.add(firebox);

  // Grate bar and two stacked logs.
  const grate = new Mesh(new BoxGeometry(OPENING_WIDTH - 0.2, 0.05, 0.08), grateMat);
  grate.name = 'fireGrate';
  grate.position.set(0, 0.2, -BODY_DEPTH / 2 - 0.12);
  root.add(grate);

  [-0.18, 0.18].forEach((x, index) => {
    const log = new Mesh(new CylinderGeometry(0.09, 0.09, 0.7, 10), logMat);
    log.name = `fireLog${index}`;
    log.position.set(x, 0.3, -BODY_DEPTH / 2 - 0.12);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = index === 0 ? 0.25 : -0.2;
    root.add(log);
  });

  // Flames: three emissive cones that flicker gently forever.
  const flameGroup = new Group();
  flameGroup.name = 'fireFlames';
  flameGroup.position.set(0, 0.36, -BODY_DEPTH / 2 - 0.12);
  root.add(flameGroup);

  const flameSpecs: Array<{ x: number; height: number; color: Color; intensity: number }> = [
    { x: 0, height: 0.55, color: new Color(1.0, 0.55, 0.15), intensity: 1.4 },
    { x: -0.16, height: 0.38, color: new Color(1.0, 0.72, 0.25), intensity: 1.2 },
    { x: 0.15, height: 0.34, color: new Color(1.0, 0.42, 0.12), intensity: 1.2 },
  ];
  flameSpecs.forEach((spec, index) => {
    const flame = new Mesh(new ConeGeometry(0.12, spec.height, 8), createGlowMaterial(`livingRoom_flameMat${index}`, spec.color, spec.intensity));
    flame.name = `fireFlame${index}`;
    flame.position.set(spec.x, spec.height / 2, 0);
    flameGroup.add(flame);
  });

  // Idle flicker: a slow breathing scale loop on the whole flame cluster.
  gsap.to(flameGroup.scale, {
    x: 1.08,
    y: 0.88,
    duration: 0.35,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });

  // Tap delight: flare up, chime like crackling embers, and sparkle.
  const unregister = createTapInteraction(dispatcher, firebox, () => {
    triggerSound('sfx_shared_chime');
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, flameGroup.getWorldPosition(new Vector3()).add(new Vector3(0, 0.3, 0.2)));

    gsap.killTweensOf(flameGroup.scale);
    gsap.to(flameGroup.scale, {
      x: 1.35,
      y: 1.45,
      z: 1.25,
      duration: 0.14,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        flameGroup.scale.set(1, 1, 1);
        gsap.to(flameGroup.scale, {
          x: 1.08,
          y: 0.88,
          duration: 0.35,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      },
    });
  });

  return () => {
    unregister();
    gsap.killTweensOf(flameGroup.scale);
  };
}
