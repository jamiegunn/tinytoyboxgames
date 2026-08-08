/**
 * Builds one bleacher bank: three stepped wooden rows with alternating red and
 * blue seat boards, and a pennant pole flying a yellow flag at one end.
 *
 * The bank faces local -Z; staging turns each bank toward the field.
 */

import { BoxGeometry, CylinderGeometry, Group, Mesh, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { ImmersiveSceneMaterials } from '../../../../materials';
import { FLAG_HEIGHT, FLAG_THICKNESS, FLAG_WIDTH, POLE_HEIGHT, POLE_RADIUS, ROW_COUNT, ROW_WIDTH, SEAT_THICKNESS, STEP_DEPTH, STEP_RISE } from './constants';

/** Shared dependencies required to build one bleacher bank. */
export interface BleachersBuildOptions {
  materials: Pick<ImmersiveSceneMaterials, 'bleacherWood' | 'seatRed' | 'seatBlue' | 'pennantYellow' | 'shellTrim'>;
}

/**
 * Creates one staged bleacher bank.
 *
 * @param scene - Scene that should receive the created prop.
 * @param placement - World placement authored in `staging/bleachers.ts`.
 * @param options - Shared materials used by the prop.
 * @returns The root group for the created bank.
 */
export function createBleachers(scene: Scene, placement: EntityPlacement, options: BleachersBuildOptions): Group {
  const root = createEntityRoot('baseball_bleachers', placement, scene);

  for (let row = 0; row < ROW_COUNT; row += 1) {
    const height = (row + 1) * STEP_RISE;
    const step = new Mesh(new BoxGeometry(ROW_WIDTH, height, STEP_DEPTH), options.materials.bleacherWood);
    step.name = `baseball_bleacher_step_${row}`;
    step.position.set(0, height / 2, row * STEP_DEPTH);
    step.castShadow = true;
    step.receiveShadow = true;
    root.add(step);

    const seat = new Mesh(new BoxGeometry(ROW_WIDTH, SEAT_THICKNESS, STEP_DEPTH * 0.9), row % 2 === 0 ? options.materials.seatRed : options.materials.seatBlue);
    seat.name = `baseball_bleacher_seat_${row}`;
    seat.position.set(0, height + SEAT_THICKNESS / 2, row * STEP_DEPTH);
    seat.castShadow = true;
    seat.receiveShadow = true;
    root.add(seat);
  }

  const pole = new Mesh(new CylinderGeometry(POLE_RADIUS, POLE_RADIUS, POLE_HEIGHT, 10), options.materials.shellTrim);
  pole.name = 'baseball_bleacher_pole';
  pole.position.set(ROW_WIDTH / 2 - 0.12, POLE_HEIGHT / 2, (ROW_COUNT - 1) * STEP_DEPTH);
  pole.castShadow = true;
  root.add(pole);

  const flag = new Mesh(new BoxGeometry(FLAG_WIDTH, FLAG_HEIGHT, FLAG_THICKNESS), options.materials.pennantYellow);
  flag.name = 'baseball_bleacher_flag';
  flag.position.set(ROW_WIDTH / 2 - 0.12 - FLAG_WIDTH / 2 - POLE_RADIUS, POLE_HEIGHT - FLAG_HEIGHT / 2 - 0.05, (ROW_COUNT - 1) * STEP_DEPTH);
  flag.rotation.z = 0.08;
  flag.castShadow = true;
  root.add(flag);

  return root;
}
