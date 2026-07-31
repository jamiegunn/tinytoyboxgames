import { Color, Vector3 } from 'three';
import type { RoomEnvironmentConfig } from '@app/utils/roomSceneFactory';
import { BACK_WALL_FACE_Z, CEILING_Y, LEFT_WALL_FACE_X, RIGHT_WALL_FACE_X } from './layout';

/**
 * Centralized Playroom environment configuration.
 *
 * This room gets a DELIBERATELY WEAKER version of the change made to the kitchen
 * and living room, and the reason is worth keeping, because the obvious move was
 * wrong. All three rooms shipped with an identical lighting config — key 1.4,
 * fill 0.3, no ground colour, no environment override — so the first conclusion
 * was that all three had the same defect. Rendered, they did not:
 *
 *                     sd L   %flat   <L120  colour  wall texture
 *   kitchen  (before) 23.0   51.7%    1.2%    17.5      0.46
 *   playroom(before)  32.6   27.3%    8.2%    33.3      2.15
 *
 * The playroom already beat the FIXED kitchen on flat-region coverage, with
 * nearly double the colourfulness and more than four times the wall texture,
 * before anything was done to it. Identical configuration, different room. What
 * differs is on the walls: this room's SIDE walls carry windows, a pinboard, a
 * chalkboard, a door and wainscoting, where the kitchen's side walls carry
 * nothing at all and the side walls are ~48% of the frame.
 *
 * So the environment cut here is 0.24 → 0.16, not the kitchen's 0.08. Pushed to
 * 0.08 this room's shadow wall fell to 69.6, below the pre-registered floor of
 * 70 that keeps a wall reading as a wall in shade rather than as an absence —
 * a room that was already working does not get the strong medicine. At 0.16 the
 * flat-region coverage falls 27.3% → 21.9% and luminance spread rises 32.6 →
 * 41.3, against a dim-only control that reached 22.2% / 33.0 with mid-tone
 * saturation going the WRONG way (0.217 → 0.195). That control is the reason
 * both gates are here: it passes a naive "is the room less flat" test and fails
 * the one that asks whether the room is shaped or merely darker.
 */
export const PLAYROOM_ENVIRONMENT: RoomEnvironmentConfig = {
  clearColor: new Color(0.12, 0.15, 0.22),
  lighting: {
    keyDirection: new Vector3(-0.5, -0.8, 0.3),
    // 1.4 → 1.5, a smaller lift than the kitchen's 1.4 → 1.7, because less
    // environment is being taken away here.
    keyIntensity: 1.5,
    keyColor: new Color(1.0, 0.9, 0.72),
    // 35% of this room's key, same construction as the kitchen's. The defect is
    // shared: this key also travels toward −X, so the left wall's Lambert term
    // is zero here too.
    //
    // This room's left wall is the one that measures 32.3% flat tiles, the best
    // wall in the house and the reference the whole side-wall dose curve is
    // aimed at — and it turns out it was scoring that while receiving NO key
    // light. The corkboard of pinned art on it was carrying the wall against a
    // contrast handicap worth about 9 points. That makes the content argument
    // stronger than it was written up as, not weaker.
    //
    // The same derivation as the other two rooms, and this room is the reason
    // to trust it over an eye. Its walls are a COOL blue (0.60, 0.82, 0.88);
    // with the floor (0.72, 0.55, 0.35) the mean albedo is (0.660, 0.685,
    // 0.615), which × keyColor and normalised gives (1.00, 0.93, 0.67) —
    // markedly less saturated than the amber the kitchen and living room get,
    // and only a little off the key itself. Intensity 0.53 → 0.50 carries the
    // luminance compensation, and moves the other way from theirs for the same
    // reason.
    //
    // A near-neutral bounce is exactly what I applied to all three rooms by
    // taste one commit ago. It is right in this one and wrong in the other two,
    // and I had no way of knowing which from the outside.
    bounceIntensity: 0.5,
    bounceColor: new Color(1.0, 0.93, 0.67),
    // 0.3 → 0.26. The sky half of the hemisphere stays cool (below), which is
    // this room's own character and is not being normalised away.
    fillIntensity: 0.26,
    fillColor: new Color(0.9, 0.92, 1.0),
    // A dark warm ground half for the hemisphere, where previously there was
    // none — and an unset ground colour makes the hemisphere degenerate to
    // sky === ground, a flat ambient identical from above and below, which can
    // shade nothing. What this value BUYS is the split between up and down; its
    // particular hue is close to inert, measured directly (see the kitchen's
    // copy of this comment), so the same constant is used in all three rooms
    // rather than three slightly different ones implying a precision that is
    // not there.
    fillGroundColor: new Color(0x5c4530),
    // 0.24 → 0.16. See LightingConfig.environmentIntensity. Two thirds of the
    // way rather than the kitchen's one third, per the docblock above.
    environmentIntensity: 0.16,
    accentPosition: new Vector3(0, 4, -5),
    accentIntensity: 0.3,
    accentColor: new Color(1.0, 0.95, 0.85),
    extraPointLights: [
      {
        position: new Vector3(-4, 2, 7),
        intensity: 0.2,
        color: new Color(1.0, 0.95, 0.8),
        distance: 8,
      },
    ],
  },
  floorTap: {
    owlPosition: new Vector3(0, 0.35, 1.5),
    flightBounds: {
      minX: RIGHT_WALL_FACE_X + 0.5,
      maxX: LEFT_WALL_FACE_X - 0.5,
      minZ: -10,
      maxZ: BACK_WALL_FACE_Z - 0.5,
      minY: 0.3,
      maxY: CEILING_Y - 1.0,
    },
    ceilingY: CEILING_Y,
    firstTapSoundId: 'sfx_shared_sparkle_burst',
  },
};
