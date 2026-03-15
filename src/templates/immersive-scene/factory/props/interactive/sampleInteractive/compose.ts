/**
 * Composes every staged instance of the interactive example prop.
 *
 * This file is the bridge between authored placement data, mesh creation, and
 * dispatcher-based interaction wiring. It exists so the scene root can stay
 * declarative even as interactive content grows.
 */

import type { ComposeContext } from '../../../../types';
import { SAMPLE_INTERACTIVE_STAGING } from '../../../../staging/sampleInteractive';
import { composeInteractiveCollection, type DisposeFn } from '../../../composeHelpers';
import { createSampleInteractive } from './create';
import { setupSampleInteractiveTap } from './interaction';

/**
 * Builds and wires every staged interactive example prop.
 *
 * @param ctx - Shared compose context for the immersive scene.
 * @returns Cleanup function that unregisters every created interaction.
 */
export function composeSampleInteractiveProps(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    SAMPLE_INTERACTIVE_STAGING,
    (scene, staging) =>
      createSampleInteractive(scene, staging, {
        materials: {
          sampleInteractiveStem: ctx.materials.sampleInteractiveStem,
          sampleInteractiveBloom: ctx.materials.sampleInteractiveBloom,
        },
      }),
    (scene, dispatcher, result) => setupSampleInteractiveTap(scene, dispatcher, result),
  );
}
