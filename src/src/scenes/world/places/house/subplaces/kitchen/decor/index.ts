import type { Mesh, Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createCabinetRun } from './cabinetRun';
import { createDiningTable } from './diningTable';
import { createFridge } from './fridge';
import { createKitchenFrontFloor } from './frontFloor';
import { createKitchenWindow } from './kitchenWindow';
import { createLeftWallCabinets } from './leftWallCabinets';
import { createOpenShelf } from './openShelf';
import { createPlateRack } from './plateRack';
import { createPotRail } from './potRail';
import { createKitchenRug } from './rug';
import { createStove } from './stove';
import { createWallPegs } from './wallPegs';

/** Result of composing the Kitchen's decor. */
export interface KitchenDecorResult {
  /** Rug mesh registered as an additional owl floor-tap target. */
  rug: Mesh;
  /** Unregisters all decor tap handlers and kills decor tweens. */
  cleanup: () => void;
}

/**
 * Composes all Kitchen decor: cabinet run with countertop clutter, window
 * over the counter, fridge, stove, open crockery shelves, pot rail, breakfast
 * table with chairs, the oval rug, the front-floor dressing, the left-wall
 * dresser and base units, and the two side-wall pieces (plate rack with chalk
 * menu board on the right, peg rail with cloths and clock on the left).
 * Interactive pieces (kettle, hanging pots, fruit bowl, mugs, cloths) register
 * through the shared tap dispatcher.
 *
 * @param scene - The Three.js scene that receives the decor.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns The rug floor-tap target and a combined cleanup function.
 */
export function createKitchenDecor(scene: Scene, dispatcher: WorldTapDispatcher): KitchenDecorResult {
  const rug = createKitchenRug(scene);
  createKitchenFrontFloor(scene);
  createKitchenWindow(scene);
  createFridge(scene);
  createStove(scene);
  createOpenShelf(scene);
  createLeftWallCabinets(scene);

  const cleanups = [
    createCabinetRun(scene, dispatcher),
    createPotRail(scene, dispatcher),
    createDiningTable(scene, dispatcher),
    createPlateRack(scene, dispatcher),
    createWallPegs(scene, dispatcher),
  ];

  return {
    rug,
    cleanup: () => {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}
