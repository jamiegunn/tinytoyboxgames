import { Color } from 'three';
import type { ToyboxSpec } from '@app/toyboxes/framework';

/**
 * The toyboxes the Playroom builds, and the only place their coordinates live.
 *
 * Every placement here must keep the toybox's whole rendered extent on screen
 * at both portrait 9:16 and landscape 16:9. `playroom-toybox-framing.test.mjs`
 * builds these specs for real and projects them through the real camera, so a
 * placement that drifts off the frame fails the build. One already had:
 * `adventure` sat at x 5.25, which put its outer edge at 5.86 and hung it 20%
 * off the right of a portrait phone. A three-year-old holding a phone upright
 * could see a sliver of the pirate-cove box and nothing more.
 *
 * Do not eyeball a new position against the wall coordinates. The frame is a
 * frustum, so the room is much narrower on screen near the camera (-z) than at
 * the back wall (+z): a toybox may reach x 3.52 at z -4 but x 6.52 at z +8.
 * `.probe/ndcunder.mjs` prints the margin for a candidate placement.
 *
 * NOT HERE DELIBERATELY: pirate-cove/parent-scene-stubs/playroom.toybox.stub.ts.
 *
 * A generator-emitted `PLAYROOM_TOYBOX_STUB`, 44 lines, described in its own
 * docblock as "ready-to-copy" and "copyable immediately", naming THIS FILE as
 * its copy target by path. Nothing imported it. It was on the reachability
 * allowlist under six words -- "Generator-emitted parent-scene stub." -- which
 * read as harmless, and it was not harmless.
 *
 * Its copy had already been made and then tuned, and every field had since
 * moved: placement (3.67, 0.01, -6.88) against the live (4.05, 0.01, 2.7),
 * rotationY PI+PI/4 against -PI/2, a purple/green palette against red/yellow,
 * emblem 'heart' against 'stars'. Pasting it in as instructed would have
 * reverted the portrait-clipping fix recorded above, put the box back where it
 * sinks a corner into the rug, and changed the art. Its z of -6.88 is the exact
 * mistake the paragraph above warns about: deep in -z, where the frustum is
 * narrowest, with no evidence anyone ran ndcunder.mjs on it.
 *
 * So it was not inert dead code. It was a live instruction to undo tuned work,
 * and it had been sitting one obedient copy-paste away from doing it.
 *
 * If the generator emits another, delete it once its values are here and tuned.
 * A spent copy-source outranks its copy in exactly one respect -- it looks
 * official -- and that is the whole of the danger.
 */
export const PLAYROOM_TOYBOXES: ToyboxSpec[] = [
  {
    id: 'adventure',
    destination: 'pirate-cove',
    variant: 'classic',
    placement: {
      // Pulled in from (5.25, 1.5), which was clipped in portrait. Both numbers
      // come from the projection: at z 2.7 the outer edge may reach 5.19, and
      // this box's rendered extent runs 0.61 past its anchor, so x 4.05 lands
      // at 4.66 with room to spare. z 2.7 is also just far enough back to clear
      // the rug rather than sinking a corner of the box into it.
      x: 4.05,
      y: 0.01,
      z: 2.7,
      rotationY: -Math.PI / 2,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.9, 0.35, 0.3),
      accent: new Color(1.0, 0.9, 0.55),
    },
    emblem: 'stars',
  },
  {
    id: 'animals',
    destination: 'nature',
    variant: 'animals-open-box',
    placement: {
      x: -1.6,
      y: 0.01,
      z: -6.5,
      rotationY: -0.15,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.45, 0.7, 0.92),
      accent: new Color(0.85, 0.85, 0.88),
    },
  },
  {
    id: 'creative',
    destination: null,
    variant: 'dresser',
    placement: {
      x: -2.8,
      y: 0.01,
      z: 8.25,
      rotationY: Math.PI,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.5, 0.82, 0.55),
      accent: new Color(0.95, 0.92, 0.82),
    },
    emblem: 'clover',
  },
];
