/**
 * Making the rig answer.
 *
 * THE CHARGE THIS CLOSES. `ship_mainsail`, `ship_sailBand` and `ship_mast` are
 * the tallest, largest, most obviously ship-shaped objects in Pirate Cove, and
 * a sampled map of tap outcomes (`.probe/render/r6-map.mjs`) returned NOTHING at
 * every sample standing on them. The scene's whole silhouette — the thing that
 * makes it read as a pirate ship rather than a jetty — was scenery.
 *
 * ONE TARGET, NOT THREE. soul.md §109 is explicit that coverage is not a
 * counting exercise: three registrations that each play the same shrug are worse
 * than one that does something. `pickRegistered` walks a hit's ancestry to the
 * registered owner, so registering the sail group alone catches the canvas and
 * the red band both, and they answer as one sail because they ARE one sail.
 *
 * WHY A FIXED-SIZE REACTION IS LEGITIMATE HERE AND WAS NOT FOR THE SEA. The
 * sail, band and mast sit at 14.5–15.6 units from the camera at every shipping
 * viewport — a 1.07x spread. One world unit subtends 52 px in landscape and
 * 62 px on a phone, and does not vary across the object. There is no depth to
 * compensate for, so the animation is authored in world units and left alone.
 * The sea, spanning 7.1x, could not be treated this way; see
 * `../sea/ripple.ts`.
 *
 * WHY IT ANIMATES `ship_sailSnap` AND NOT `ship_sailGroup`. See the comment at
 * the nesting site in `create.ts`: the ambient rig owns the outer group's
 * `scale.z` and `rotation.x`, and `playAnimations` would kill both on the first
 * tap.
 *
 * WHY `background: true` ON THE LARGEST OBJECT IN THE SCENE. `background` does
 * not mean "scenery" and it does not mean "no reaction". It means one thing:
 * this target does not enter the proximity contest. `pickByProximity` skips
 * background entries outright, so the flag buys a tap ON the sail and declines
 * a tap merely NEAR it.
 *
 * That is exactly the trade this object should take, and it was measured rather
 * than assumed. Registered as a plain prop the sail won 185 / 230 / 204 / 215
 * near-miss samples across the four shipping viewports (`.probe/render/
 * r6-steal.mjs` at `STEP=6`), and 36 / 0 / 16 / 8 of those came out of
 * `parrot_prop` — the smallest, highest thing on the rig, losing empty-sky
 * near-misses to a sail whose origin sits at the sail head under the crow's
 * nest. `interactionController.ts:70` documents where that road ends.
 *
 * The obvious fear about the flag is the mirror image: that a finger landing
 * literally on sail canvas, but within the 70px radius of the parrot's centre,
 * would now fire the bird — restoring the very behaviour this registration
 * exists to remove. That cost is ZERO, and zero is a claim worth doubting, so it
 * was measured at two grid pitches. The sail's ray-hit count with the flag is
 * identical to its ray-hit count without it — 718 / 1456 / 1010 / 1122 at 6px
 * over 25,560 / 21,760 / 9,230 / 9,000 samples per viewport, and 181 / 362 /
 * 251 / 284 at 12px — not one sample lost at either resolution. No prop centre
 * comes within 70px of the sail's silhouette at any shipping viewport.
 *
 * The flag also has to survive the ocean, which is registered background too
 * (`../sea/interaction.ts`). `pickRegistered` iterates hits in distance order
 * and `bg ??=` keeps the first, so the nearest background wins: sail at ~14.8
 * units beats sea at 29+. The identity above is the proof — if the sea had
 * outranked the sail those counts would have collapsed, not held.
 */

import type { Object3D } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { playAnimations } from '@app/utils/animationHelpers';

/** Frames per second for the sail snap. */
const FPS = 60;

/**
 * Registers a tap on the ship's sail: it bellies out, luffs back, and snaps.
 *
 * @param dispatcher - Shared world tap dispatcher.
 * @param shellRoot - The shell group returned by `createSceneShell`, searched by name.
 * @returns Cleanup that unregisters the handler, or `undefined` if the sail is absent.
 */
export function setupSailTap(dispatcher: WorldTapDispatcher, shellRoot: Object3D): (() => void) | undefined {
  const sailGroup = shellRoot.getObjectByName('ship_sailGroup');
  const sailSnap = shellRoot.getObjectByName('ship_sailSnap');
  if (!sailGroup || !sailSnap) return undefined;

  return dispatcher.register(
    sailGroup,
    () => {
      triggerSound('sfx_shared_whoosh');

      // Belly out hard, overshoot back past flat, settle. The depth channel is
      // what a gust actually does to a sail; the swing is a small amount of the
      // canvas being pushed away from the child, which sells the direction.
      playAnimations(
        sailSnap,
        [
          {
            property: 'scale.z',
            keys: [
              { frame: 0, value: 1 },
              { frame: 7, value: 1.38 },
              { frame: 19, value: 0.9 },
              { frame: 32, value: 1 },
            ],
          },
          {
            property: 'rotation.x',
            keys: [
              { frame: 0, value: 0 },
              { frame: 6, value: -0.1 },
              { frame: 18, value: 0.045 },
              { frame: 32, value: 0 },
            ],
          },
        ],
        { fps: FPS },
      );
    },
    { background: true },
  );
}
