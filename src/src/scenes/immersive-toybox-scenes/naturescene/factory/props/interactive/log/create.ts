/**
 * Creates a richly detailed fallen log with layered bark, longitudinal
 * ridges, circumferential rings, knots, a hollow opening with a dark
 * interior, moss and lichen growth, shelf fungi, visible end-grain,
 * and a raccoon peeking out of the hollow facing the stream.
 */
import { Scene, Group, type Mesh } from 'three';
import { createLogMaterials } from './materials';
import { createLogBody } from './body';
import { addHollow } from './hollow';
import { addEndGrain } from './endGrain';
import { addFoliage } from './foliage';
import { addRaccoon } from './raccoon';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { LOG_Y_OFFSET } from './constants';

export interface LogCreateResult {
  root: Group;
  tapTarget: Mesh;
  killAnimations: () => void;
}

/**
 * Creates a complete fallen log and adds it to the scene.
 *
 * Assembly is intentionally explicit instead of going through a generic
 * "log component" interface because the sub-modules do not share one role:
 * the body is the tap target and substrate, hollow/end-grain/foliage are
 * body decorators, and the raccoon attaches to the root and returns cleanup.
 *
 * @param scene - The Three.js scene.
 * @param placement - World-space placement for the log.
 * @returns Typed result with root and tap target for interaction wiring.
 */
export function createLog(scene: Scene, placement: EntityPlacement): LogCreateResult {
  const root = createEntityRoot('log_root', placement, scene);
  root.position.y += LOG_Y_OFFSET;

  const mats = createLogMaterials();
  const body = createLogBody(root, mats);

  // Body decorators layer onto the main cylinder mesh in a fixed order.
  addHollow(body, mats);
  addEndGrain(body, mats);
  addFoliage(body, mats);

  // The raccoon belongs to the wider prop root and owns its own animation cleanup.
  const killRaccoon = addRaccoon(root);

  return { root, tapTarget: body, killAnimations: killRaccoon };
}
