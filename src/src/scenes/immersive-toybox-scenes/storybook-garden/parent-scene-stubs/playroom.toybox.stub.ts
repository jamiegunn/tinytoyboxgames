/**
 * Ready-to-copy Playroom toybox stub for Storybook Garden.
 *
 * This file exists because the immersive scene generator owns scene creation,
 * but it does not own spatial placement decisions in parent scenes. Instead of
 * forcing authors to reconstruct the toybox contract from documentation, the
 * template generates an exact `ToyboxSpec` example that can be copied into the
 * Playroom manifest and then tuned.
 *
 * Copy target:
 * `src/src/scenes/world/places/house/subplaces/playroom/toyboxes/manifest.ts`
 *
 * Normative references:
 * - ADR-0012: immersive scene ceremony must remain canonical
 * - ADR-0013: the template, generator, and tests must stay aligned
 */

import { Color } from 'three';
import type { ToyboxSpec } from '@app/toyboxes/framework';

/**
 * Starter Playroom toybox entry for Storybook Garden.
 *
 * The default values intentionally mirror a known-good Playroom chest entry so
 * the stub is copyable immediately. Treat the placement, palette, and emblem as
 * authored starting points rather than immutable generator truth.
 */
export const PLAYROOM_TOYBOX_STUB: ToyboxSpec = {
  id: 'storybook-garden',
  destination: 'storybook-garden',
  variant: 'classic',
  placement: {
    x: 3.67,
    y: 0.01,
    z: -6.88,
    rotationY: Math.PI + Math.PI / 4,
    scale: 0.75,
  },
  palette: {
    base: new Color(0.7, 0.55, 0.82),
    accent: new Color(0.65, 0.88, 0.72),
  },
  emblem: 'heart',
};
