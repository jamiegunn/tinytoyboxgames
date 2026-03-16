import { createDustMotes } from '@app/utils/particles';
import { createDisposeCollector } from '@app/utils/sceneHelpers';
import { createInteractiveToybox } from '@app/toyboxes/framework';
import type { RoomBuildContext, RoomContentResult } from '@app/utils/roomSceneFactory';
import { PLAYROOM_TOYBOXES } from './toyboxes/manifest';
import { createWalls } from './room/walls';
import { createCeiling } from './room/ceiling';
import { createFloor } from './room/floor';
import { createDoor } from './room/door';
import { createWainscoting } from './room/wainscoting';
import { createCloudWallpaper } from './room/cloudWallpaper';
import { createWallArt } from './room/wallArt';
import { createBookshelf } from './bookshelf';
import { createFloorToys } from './floorToys';
import { createCritters } from './critters';
import { createDecor } from './decor';
import { spawnAnimalVisitors } from './critters/animalVisitors';

/**
 * Builds the Playroom-authored contents on top of the shared room runtime.
 *
 * @param context - Shared room runtime dependencies.
 * @returns The tappable floor targets and cleanup owned by Playroom content.
 */
export function buildPlayroomContents(context: RoomBuildContext): RoomContentResult {
  const { scene, canvas, camera, keyLight, dispatcher, nav, owl } = context;
  const disposer = createDisposeCollector();

  createWalls(scene);
  createCeiling(scene);
  const { floor, rug } = createFloor(scene);
  createWainscoting(scene);
  createCloudWallpaper(scene);
  createDoor(scene);
  createWallArt(scene);

  const dustMotes = createDustMotes(scene);
  disposer.add({ dispose: () => dustMotes.dispose() });

  createBookshelf(scene, keyLight);
  createFloorToys(scene, keyLight);
  createCritters(scene, keyLight);
  createDecor(scene, keyLight);

  PLAYROOM_TOYBOXES.forEach((spec) => {
    const handle = createInteractiveToybox({
      scene,
      canvas,
      camera,
      dispatcher,
      owl,
      nav,
      spec,
    });
    disposer.add(handle);
  });

  const visitorsCleanup = spawnAnimalVisitors(scene);
  disposer.add({ dispose: visitorsCleanup });

  return {
    floorTargets: [floor, rug],
    cleanup: () => {
      disposer.disposeAll();
    },
  };
}
