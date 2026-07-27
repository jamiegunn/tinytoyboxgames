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
