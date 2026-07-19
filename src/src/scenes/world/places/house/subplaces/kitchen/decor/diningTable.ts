import gsap from 'gsap';
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { TABLE_X, TABLE_Z } from '../layout';

/** Table top height and radius. */
const TABLE_TOP_Y = 1.0;
const TABLE_RADIUS = 0.85;

/**
 * Creates one small painted chair facing the table center.
 *
 * @param parent - Group that receives the chair.
 * @param angle - Angle around the table where the chair sits.
 * @param color - Painted seat and back color.
 * @param index - Chair index used for naming and material keys.
 */
function createChair(parent: Group, angle: number, color: Color, index: number): void {
  const chair = new Group();
  chair.name = `kitchenChair${index}`;
  const distance = TABLE_RADIUS + 0.42;
  chair.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
  chair.rotation.y = -angle - Math.PI / 2;
  parent.add(chair);

  const paintMat = createGlossyPaintMaterial(`kitchen_chairMat${index}`, color);
  const legMat = createWoodMaterial(`kitchen_chairLegMat${index}`, new Color(0.62, 0.47, 0.3));

  const seat = new Mesh(new BoxGeometry(0.5, 0.06, 0.48), paintMat);
  seat.name = `chairSeat${index}`;
  seat.position.y = 0.52;
  seat.castShadow = true;
  chair.add(seat);

  const back = new Mesh(new BoxGeometry(0.5, 0.62, 0.06), paintMat);
  back.name = `chairBack${index}`;
  back.position.set(0, 0.85, 0.23);
  back.rotation.x = 0.08;
  back.castShadow = true;
  chair.add(back);

  [-1, 1].forEach((sideX) => {
    [-1, 1].forEach((sideZ) => {
      const leg = new Mesh(new CylinderGeometry(0.035, 0.028, 0.52, 8), legMat);
      leg.name = `chairLeg${index}_${sideX}_${sideZ}`;
      leg.position.set(sideX * 0.19, 0.26, sideZ * 0.18);
      chair.add(leg);
    });
  });
}

/**
 * Creates the small round breakfast table with two painted chairs and a fruit
 * bowl. Tapping a fruit makes it hop out of the bowl and plop back with a pop
 * and a sparkle — one of the room's tappable delights.
 *
 * @param scene - The Three.js scene that receives the table group.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns Cleanup function that unregisters fruit taps and kills hop tweens.
 */
export function createDiningTable(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const root = new Group();
  root.name = 'kitchen_diningTable';
  root.position.set(TABLE_X, 0, TABLE_Z);
  scene.add(root);

  const woodMat = createWoodMaterial('kitchen_tableWoodMat', new Color(0.68, 0.52, 0.34));

  const top = new Mesh(new CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.07, 24), woodMat);
  top.name = 'tableTop';
  top.position.y = TABLE_TOP_Y;
  top.castShadow = true;
  top.receiveShadow = true;
  root.add(top);

  const column = new Mesh(new CylinderGeometry(0.08, 0.08, TABLE_TOP_Y - 0.1, 10), woodMat);
  column.name = 'tableColumn';
  column.position.y = (TABLE_TOP_Y - 0.1) / 2 + 0.06;
  root.add(column);

  const foot = new Mesh(new CylinderGeometry(0.4, 0.46, 0.08, 18), woodMat);
  foot.name = 'tableFoot';
  foot.position.y = 0.04;
  root.add(foot);

  // Two chairs: one sage, one butter yellow, angled toward the camera.
  createChair(root, Math.PI * 0.15, new Color(0.66, 0.74, 0.58), 0);
  createChair(root, Math.PI * 0.85, new Color(0.95, 0.82, 0.5), 1);

  // Fruit bowl in the middle of the table.
  const bowl = new Mesh(new CylinderGeometry(0.3, 0.18, 0.16, 18), createPlasticMaterial('kitchen_fruitBowlMat', new Color(0.95, 0.92, 0.84)));
  bowl.name = 'fruitBowl';
  bowl.position.y = TABLE_TOP_Y + 0.12;
  bowl.castShadow = true;
  root.add(bowl);

  // Three tappable fruits: apple, orange, pear.
  const fruitSpecs = [
    { x: -0.1, z: 0.06, radius: 0.1, color: new Color(0.92, 0.28, 0.22) },
    { x: 0.12, z: -0.04, radius: 0.09, color: new Color(0.96, 0.62, 0.2) },
    { x: 0.0, z: -0.12, radius: 0.085, color: new Color(0.62, 0.78, 0.28) },
  ];

  const fruits: Mesh[] = [];
  const cleanups: Array<() => void> = [];

  fruitSpecs.forEach((spec, index) => {
    const fruit = new Mesh(new SphereGeometry(spec.radius, 14, 12), createGlossyPaintMaterial(`kitchen_tableFruitMat${index}`, spec.color));
    fruit.name = `tableFruit${index}`;
    const restY = TABLE_TOP_Y + 0.2 + spec.radius * 0.4;
    fruit.position.set(spec.x, restY, spec.z);
    fruit.castShadow = true;
    root.add(fruit);
    fruits.push(fruit);

    // Tap delight: the fruit hops out of the bowl and plops back down.
    const unregister = createTapInteraction(dispatcher, fruit, () => {
      triggerSound('sfx_shared_pop');
      getParticleEngine(scene).emit(PARTICLES.sceneSparkle, fruit.getWorldPosition(new Vector3()).add(new Vector3(0, 0.2, 0)));

      gsap.killTweensOf(fruit.position);
      gsap.killTweensOf(fruit.rotation);
      fruit.position.y = restY;
      gsap.to(fruit.position, {
        y: restY + 0.45,
        duration: 0.22,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          fruit.position.y = restY;
        },
      });
      gsap.to(fruit.rotation, {
        y: fruit.rotation.y + Math.PI * 2,
        duration: 0.44,
        ease: 'power1.inOut',
      });
    });
    cleanups.push(unregister);
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    fruits.forEach((fruit) => {
      gsap.killTweensOf(fruit.position);
      gsap.killTweensOf(fruit.rotation);
    });
  };
}
