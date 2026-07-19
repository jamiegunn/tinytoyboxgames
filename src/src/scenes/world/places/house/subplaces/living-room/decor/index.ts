import type { Mesh, Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createCatPlush } from './catPlush';
import { createCouch } from './couch';
import { createFireplace } from './fireplace';
import { createFloorLamp } from './floorLamp';
import { createRug } from './rug';
import { createSideTable } from './sideTable';
import { createWallArt } from './wallArt';
import { createWindowFrame } from './windowFrame';

/** Result of composing the Living Room's decor. */
export interface LivingRoomDecorResult {
  /** Rug mesh registered as an additional owl floor-tap target. */
  rug: Mesh;
  /** Unregisters all decor tap handlers and kills decor tweens. */
  cleanup: () => void;
}

/**
 * Composes all Living Room decor: rug, couch, fireplace, floor lamp, side
 * table, sleeping cat, window, and framed wall art. Interactive pieces (couch
 * cushions, fireplace, lamp, cat) register through the shared tap dispatcher.
 *
 * @param scene - The Three.js scene that receives the decor.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns The rug floor-tap target and a combined cleanup function.
 */
export function createLivingRoomDecor(scene: Scene, dispatcher: WorldTapDispatcher): LivingRoomDecorResult {
  const rug = createRug(scene);
  createSideTable(scene);
  createWindowFrame(scene);
  createWallArt(scene);

  const cleanups = [createCouch(scene, dispatcher), createFireplace(scene, dispatcher), createFloorLamp(scene, dispatcher), createCatPlush(scene, dispatcher)];

  return {
    rug,
    cleanup: () => {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}
