import { buildToyboxVariant } from '@app/toyboxes/variants';
import { applyToyboxPlacement, resolveToyboxInteractionOptions } from './runtime';
import type { CreateInteractiveToyboxArgs, InteractiveToyboxHandle } from './types';
import { wireToyboxInteractions } from './wireToyboxInteractions';

/**
 * Builds a toybox variant, adds it to the scene, and wires the shared
 * interaction flow through the centralized room dispatcher.
 *
 * The room runtime now owns pointerdown dispatch, so the toybox framework only
 * keeps a local pointermove listener for hover feedback. This removes the old
 * per-toybox click listener pattern from Playroom without changing the authored
 * toybox specs or visuals.
 *
 * @param args - Scene, runtime, owl, dispatcher, navigation, and authored toybox spec dependencies.
 * @returns A handle containing the toybox root and a cleanup function.
 */
export function createInteractiveToybox({ scene, canvas, camera, dispatcher, owl, nav, spec }: CreateInteractiveToyboxArgs): InteractiveToyboxHandle {
  const runtime = buildToyboxVariant(spec);
  applyToyboxPlacement(runtime.root, spec.placement);
  scene.add(runtime.root);

  const interactionOptions = resolveToyboxInteractionOptions(spec);
  const dispose = wireToyboxInteractions({
    canvas,
    camera,
    dispatcher,
    runtime,
    destination: spec.destination,
    nav,
    owl,
    options: interactionOptions,
  });

  return {
    root: runtime.root,
    dispose,
  };
}
