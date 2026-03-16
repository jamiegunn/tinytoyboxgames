/**
 * Composes every staged instance of the simple example prop.
 *
 * This file exists so the scene root never needs to know how the prop iterates
 * over staging or which materials it consumes. That separation keeps the root
 * orchestration file readable as the scene grows.
 */

import type { ComposeContext } from '../../../../types';
import { SAMPLE_SIMPLE_STAGING } from '../../../../staging/sampleSimple';
import { composeCollection, type DisposeFn } from '../../../composeHelpers';
import { createSampleSimple } from './create';

/**
 * Builds every staged simple prop entry in the scene.
 *
 * @param ctx - Shared compose context for the immersive scene.
 * @returns A no-op cleanup, matching the shared composer contract.
 */
export function composeSampleSimpleProps(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, SAMPLE_SIMPLE_STAGING, (scene, staging) =>
    createSampleSimple(scene, staging, {
      materials: {
        sampleSimpleBase: ctx.materials.sampleSimpleBase,
        sampleSimpleAccent: ctx.materials.sampleSimpleAccent,
      },
    }),
  );
}
