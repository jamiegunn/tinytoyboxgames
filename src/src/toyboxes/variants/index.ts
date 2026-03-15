import type { ToyboxRuntime, ToyboxSpec } from '@app/toyboxes/framework';
import { buildAnimalsOpenBoxToybox } from './animalsOpenBox';
import { buildClassicToybox } from './classic';
import { buildDresserToybox } from './dresser';

export { buildAnimalsOpenBoxToybox, buildClassicToybox, buildDresserToybox };

/**
 * Resolves a scene-authored toybox spec into a concrete shared variant builder.
 *
 * @param spec - Authored toybox specification from the parent scene manifest.
 * @returns The built toybox runtime for the chosen variant.
 */
export function buildToyboxVariant(spec: ToyboxSpec): ToyboxRuntime {
  switch (spec.variant) {
    case 'animals-open-box':
      return buildAnimalsOpenBoxToybox(spec);
    case 'dresser':
      return buildDresserToybox(spec);
    case 'classic':
    default:
      return buildClassicToybox(spec);
  }
}
