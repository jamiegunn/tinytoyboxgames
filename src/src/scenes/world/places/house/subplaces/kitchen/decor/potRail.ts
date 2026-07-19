import gsap from 'gsap';
import { Color, CylinderGeometry, Group, Mesh, TorusGeometry, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createGlossyPaintMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { BACK_WALL_FACE_Z, POT_RAIL_X, POT_RAIL_Y } from '../layout';

/** Rail bar length along the back wall. */
const RAIL_LENGTH = 1.5;

/** One hanging pot spec: offset along the rail, size, and enamel color. */
interface PotSpec {
  /** X offset from the rail center. */
  x: number;
  /** Pot body radius. */
  radius: number;
  /** Pot body height. */
  height: number;
  /** Enamel color. */
  color: Color;
}

/**
 * Creates the wall-mounted pot rail above the stove: a metal bar on two
 * brackets with three enamel pots hanging from hooks. Tapping a pot makes it
 * swing on its hook with a cheerful clank and a sparkle — one of the room's
 * tappable delights.
 *
 * @param scene - The Three.js scene that receives the rail group.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns Cleanup function that unregisters pot taps and kills swing tweens.
 */
export function createPotRail(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const root = new Group();
  root.name = 'kitchen_potRail';
  root.position.set(POT_RAIL_X, POT_RAIL_Y, BACK_WALL_FACE_Z - 0.12);
  scene.add(root);

  const railMat = createToyMetalMaterial('kitchen_potRailMat', new Color(0.55, 0.5, 0.44));

  const rail = new Mesh(new CylinderGeometry(0.03, 0.03, RAIL_LENGTH, 8), railMat);
  rail.name = 'potRailBar';
  rail.rotation.z = Math.PI / 2;
  root.add(rail);

  [-1, 1].forEach((side, index) => {
    const bracket = new Mesh(new CylinderGeometry(0.025, 0.025, 0.14, 8), railMat);
    bracket.name = `potRailBracket${index}`;
    bracket.position.set(side * (RAIL_LENGTH / 2 - 0.08), 0, 0.07);
    bracket.rotation.x = Math.PI / 2;
    root.add(bracket);
  });

  const potSpecs: PotSpec[] = [
    { x: -0.48, radius: 0.15, height: 0.24, color: new Color(0.85, 0.45, 0.38) },
    { x: 0.02, radius: 0.12, height: 0.3, color: new Color(0.55, 0.66, 0.58) },
    { x: 0.5, radius: 0.13, height: 0.2, color: new Color(0.95, 0.82, 0.5) },
  ];

  const pivots: Group[] = [];
  const cleanups: Array<() => void> = [];

  potSpecs.forEach((spec, index) => {
    // Pivot at the rail so the pot swings from its hook.
    const pivot = new Group();
    pivot.name = `potPivot${index}`;
    pivot.position.set(spec.x, 0, 0);
    root.add(pivot);
    pivots.push(pivot);

    const hook = new Mesh(new TorusGeometry(0.045, 0.012, 6, 12), railMat);
    hook.name = `potHook${index}`;
    hook.position.y = -0.045;
    pivot.add(hook);

    const potMat = createGlossyPaintMaterial(`kitchen_potMat${index}`, spec.color);
    const pot = new Mesh(new CylinderGeometry(spec.radius, spec.radius * 0.82, spec.height, 14), potMat);
    pot.name = `potBody${index}`;
    pot.position.y = -0.09 - spec.height / 2;
    pot.castShadow = true;
    pivot.add(pot);

    const handleRing = new Mesh(new TorusGeometry(spec.radius * 0.5, 0.014, 6, 12), railMat);
    handleRing.name = `potHandle${index}`;
    handleRing.position.y = -0.09 + 0.01;
    handleRing.rotation.x = Math.PI / 2;
    pivot.add(handleRing);

    // Tap delight: the pot swings on its hook with a clank and a sparkle.
    const unregister = createTapInteraction(dispatcher, pot, () => {
      triggerSound('sfx_hub_toybox_tap');
      getParticleEngine(scene).emit(PARTICLES.sceneSparkle, pot.getWorldPosition(new Vector3()).add(new Vector3(0, 0.15, -0.2)));

      gsap.killTweensOf(pivot.rotation);
      pivot.rotation.x = 0;
      gsap.to(pivot.rotation, {
        x: 0.45,
        duration: 0.16,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          pivot.rotation.x = 0;
        },
      });
    });
    cleanups.push(unregister);
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    pivots.forEach((pivot) => gsap.killTweensOf(pivot.rotation));
  };
}
