import { Box3, Vector3 } from 'three';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES, DUST_MOTES_RATE } from '@app/utils/particles/presets';
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
import { spawnAnimalVisitors, type VisitorPerch } from './critters/animalVisitors';

/** Fixed room-centre emit point for ambient dust motes (matches the legacy origin emitter). */
const MOTE_ORIGIN = new Vector3(0, 0, 0);

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
  disposer.add(createDoor(scene, dispatcher, nav));
  createWallArt(scene);

  // Ambient warm dust motes drifting from the room-centre origin. The shared
  // batch is freed by SceneFrame's disposal scope; we only stop the stream.
  // See architecture-standards.md#particleengine.
  const dustMotes = getParticleEngine(scene).stream(PARTICLES.dustMotes, () => MOTE_ORIGIN, DUST_MOTES_RATE);
  disposer.add({ dispose: () => dustMotes.stop() });

  createBookshelf(scene, keyLight);
  createFloorToys(scene, keyLight);
  createCritters(scene, keyLight);
  createDecor(scene, keyLight);

  // Perches are measured from the toyboxes that are actually created, never
  // written down separately: a hand-kept copy of these coordinates once
  // outlived the toybox it described and left the kitty sitting in mid-air.
  const perches: VisitorPerch[] = [];
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

    const bounds = new Box3().setFromObject(handle.root);
    if (!bounds.isEmpty()) {
      const size = bounds.getSize(new Vector3());
      perches.push({
        x: spec.placement.x,
        z: spec.placement.z,
        topY: bounds.max.y,
        radius: Math.max(size.x, size.z) / 2,
      });
    }
  });

  const visitorsCleanup = spawnAnimalVisitors(scene, perches);
  disposer.add({ dispose: visitorsCleanup });

  return {
    floorTargets: [floor, rug],
    cleanup: () => {
      disposer.disposeAll();
    },
  };
}
