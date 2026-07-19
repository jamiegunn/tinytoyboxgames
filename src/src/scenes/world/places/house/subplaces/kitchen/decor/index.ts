import type { Mesh, Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createCabinetRun } from './cabinetRun';
import { createDiningTable } from './diningTable';
import { createFridge } from './fridge';
import { createKitchenWindow } from './kitchenWindow';
import { createOpenShelf } from './openShelf';
import { createPotRail } from './potRail';
import { createKitchenRug } from './rug';
import { createStove } from './stove';

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
 * table with chairs, and the oval rug. Interactive pieces (kettle, hanging
 * pots, fruit bowl) register through the shared tap dispatcher.
 *
 * @param scene - The Three.js scene that receives the decor.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns The rug floor-tap target and a combined cleanup function.
 */
export function createKitchenDecor(scene: Scene, dispatcher: WorldTapDispatcher): KitchenDecorResult {
  const rug = createKitchenRug(scene);
  createKitchenWindow(scene);
  createFridge(scene);
  createStove(scene);
  createOpenShelf(scene);

  const cleanups = [createCabinetRun(scene, dispatcher), createPotRail(scene, dispatcher), createDiningTable(scene, dispatcher)];

  return {
    rug,
    cleanup: () => {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}
