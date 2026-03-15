import { Group, type Mesh, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { createStreamContext } from './shared/context';
import { addStreamBanks } from './stream-bank';
import { createStreamBed } from './stream-bed';
import { addStreamRocks } from './stream-rocks';
import { createWaterSurface } from './water-surface';

export interface StreamCreateResult {
  root: Group;
  tapTarget: Mesh;
  killAnimations: () => void;
}

/**
 * Creates the complete stream feature including bed, water surface, banks, and rocks.
 * @param scene - The Three.js scene to add the stream to
 * @param placement - Position and rotation data for the stream
 * @returns Typed result with root and water surface tap target.
 */
export function createStream(scene: Scene, placement: EntityPlacement): StreamCreateResult {
  const root = createEntityRoot('streamRoot', placement, scene);

  const context = createStreamContext();

  createStreamBed(root, context);
  const { mesh: water, killAnimation } = createWaterSurface(root, context);
  addStreamBanks(root, context.getFrame);
  addStreamRocks(root, context);

  return { root, tapTarget: water, killAnimations: killAnimation };
}
