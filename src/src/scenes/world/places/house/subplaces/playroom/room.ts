import { Mesh, Raycaster, Vector2, Vector3, type Camera, type DirectionalLight, type Scene } from 'three';
import type { NavigationActions } from '@app/types/scenes';
import { createSparkleBurst, createDustMotes } from '@app/utils/particles';
import { createOwlCompanion } from '@app/entities/owl';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createInteractiveToybox } from '@app/toyboxes/framework';
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
import { BACK_WALL_FACE_Z, CEILING_Y, LEFT_WALL_FACE_X, RIGHT_WALL_FACE_X } from './layout';

/**
 * Builds the playroom landing scene and wires its shared toybox interactions.
 *
 * @param scene - The Three.js scene that receives the playroom contents.
 * @param canvas - The canvas element used for floor taps and toybox raycasts.
 * @param camera - The active scene camera used for raycasting.
 * @param keyLight - The playroom key light forwarded into lit child builders.
 * @param nav - Navigation actions used when toyboxes transition into scenes.
 * @returns A cleanup function that tears down every playroom-side listener and disposable.
 */
export function createRoom(scene: Scene, canvas: HTMLCanvasElement, camera: Camera, keyLight: DirectionalLight, nav: NavigationActions): () => void {
  const cleanups: Array<() => void> = [];

  createWalls(scene);
  createCeiling(scene);
  const { floor, rug } = createFloor(scene);
  createWainscoting(scene);
  createCloudWallpaper(scene);
  createDoor(scene);
  createWallArt(scene);

  const dustMotes = createDustMotes(scene);
  cleanups.push(() => dustMotes.dispose());

  createBookshelf(scene, keyLight);
  createFloorToys(scene, keyLight);
  createCritters(scene, keyLight);
  createDecor(scene, keyLight);

  const owl = createOwlCompanion(scene, new Vector3(0, 0.35, 1.5), {
    flightBounds: {
      minX: RIGHT_WALL_FACE_X + 0.5,
      maxX: LEFT_WALL_FACE_X - 0.5,
      minZ: -10,
      maxZ: BACK_WALL_FACE_Z - 0.5,
      minY: 0.3,
      maxY: CEILING_Y - 1.0,
    },
  });
  cleanups.push(() => owl.dispose());

  PLAYROOM_TOYBOXES.forEach((spec) => {
    const handle = createInteractiveToybox({
      scene,
      canvas,
      camera,
      owl,
      nav,
      spec,
    });
    cleanups.push(handle.dispose);
  });

  let firstTap = false;
  const floorRaycaster = new Raycaster();
  const floorPointer = new Vector2();

  const onFloorClick = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    floorPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    floorPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    floorRaycaster.setFromCamera(floorPointer, camera);

    const allHits = floorRaycaster.intersectObjects(scene.children, true);
    for (const hit of allHits) {
      const obj = hit.object;
      if (obj.userData.onClick) {
        obj.userData.onClick();
        return;
      }
      if (obj.userData.blocksFloorTap) {
        return;
      }
    }

    if (event.button === 0 && event.shiftKey) {
      return;
    }

    const intersects = floorRaycaster.intersectObjects([floor, rug].filter(Boolean) as Mesh[]);
    if (intersects.length === 0) {
      return;
    }

    const point = intersects[0].point;
    if (!firstTap) {
      firstTap = true;
      triggerSound('sfx_shared_sparkle_burst');
      createSparkleBurst(scene, point);
    } else {
      triggerSound('sfx_shared_tap_fallback');
    }

    owl.flyTo(point);
  };

  canvas.addEventListener('pointerdown', onFloorClick);
  cleanups.push(() => canvas.removeEventListener('pointerdown', onFloorClick));

  const visitorsCleanup = spawnAnimalVisitors(scene);
  cleanups.push(visitorsCleanup);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
