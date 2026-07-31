import { Color, Vector3 } from 'three';
import type { RoomEnvironmentConfig } from '@app/utils/roomSceneFactory';
import { BACK_WALL_FACE_Z, CEILING_Y, LEFT_WALL_FACE_X, RIGHT_WALL_FACE_X } from './layout';

/**
 * Centralized environment config for the generated room.
 */
export const ROOM_ENVIRONMENT: RoomEnvironmentConfig = {
  clearColor: new Color(0.18, 0.16, 0.15),
  lighting: {
    keyDirection: new Vector3(-0.45, -0.82, 0.35),
    // Key raised 1.4 → 1.7 to hold the sunlit side roughly where it was while
    // the flat image-based fill below comes down. Without this the room is not
    // shaped, only dimmed — and a dimmed room was measured and rejected as a
    // negative control, so this is the difference between the fix and the thing
    // the fix has to beat.
    keyIntensity: 1.7,
    keyColor: new Color(1.0, 0.9, 0.72),
    // A bounce at 35% of the key, the ordinary bounce-card ratio, aimed by the
    // default construction — the key's X and Z negated, its Y kept. Reasoning
    // in docs/reviews/2026-07-31-fix-e-registration.md; mechanism in
    // LightingDescriptor.bounce.
    //
    // Without this the left wall of this room received ZERO key light. Not a
    // little — zero, by `max(0, dot((-1,0,0), (0.45, 0.82, -0.35)))`, because
    // LEFT_WALL_FACE_X is positive and the key travels toward −X. Measured in
    // the linear domain it sat at 23% of the right wall's luminance and 40% of
    // its colourfulness, which is why the plate rack on the right wall reads as
    // objects while the cloths and clock on the left read as a dark smear.
    //
    // DERIVED, not chosen — `keyColor × mean(albedo of the surfaces the key
    // lights)`, renormalised so the swap is purely chromatic:
    //
    //   wall (0.93, 0.86, 0.70) and floor (0.67, 0.50, 0.34)  ->  mean albedo
    //   (0.800, 0.680, 0.520);  × keyColor (1.0, 0.9, 0.72)  ->  normalised
    //   (1.00, 0.76, 0.47);  intensity × lum(old)/lum(new)  ->  0.60 → 0.67.
    //
    // This replaces (0.86, 0.88, 0.95), which shipped for one render under the
    // comment "cooler than the key on purpose … it should not arrive warmer
    // than the sun did". That sentence is shaped like physics and is the
    // reverse of it: bounced light takes the colour of what it bounced off, and
    // everything it bounces off in this room is warm. The cool version
    // DESATURATED the wall it was aimed at — HLS saturation 10.3 with no bounce
    // at all, 6.8 with it, against the right wall's 15.1 — while passing four
    // of its five gates. See docs/reviews/2026-07-31-fix-e2-registration.md.
    bounceIntensity: 0.67,
    bounceColor: new Color(1.0, 0.76, 0.47),
    // Fill trimmed 0.3 → 0.2. The hemisphere is the second flat term; with the
    // environment cut it no longer has to carry the room and can go back to
    // being fill.
    fillIntensity: 0.2,
    fillColor: new Color(0.95, 0.93, 0.9),
    // A dark warm ground half for the hemisphere, where previously there was
    // none — and an unset ground colour makes the hemisphere degenerate to
    // sky === ground, a flat ambient light identical from above and below, so
    // nothing in the room could be shaded by it at all. That split is what this
    // value buys.
    //
    // This comment used to call it "warm bounce off the floorboards", which was
    // a physical story invented to justify a number already chosen by eye. The
    // floors were then actually sampled: kitchen 0xd3c3ab, living room 0xcfbb9f,
    // playroom 0xd3c4aa — all within 1.3 degrees of hue of each other and all
    // 8–10 degrees away from this value, which is markedly more saturated than
    // any floor in the building. Swapping in the floor-derived colour moved
    // luminance spread by 0.04, below the same-build noise floor of 0.20. The
    // hue is close to inert; the DARKNESS is what shapes the room. 0x5c4530
    // stays because it cleared a pre-registered gate and was chosen by eye, and
    // the same constant is used in all three rooms — but it is a preference,
    // not a derivation, and it should not be documented as one.
    fillGroundColor: new Color(0x5c4530),
    // 0.24 → 0.08. See LightingConfig.environmentIntensity: at 0.24 this white
    // studio PMREM carried 73% of the room's luminance, flat in every channel,
    // which is what made the interior read as a photograph of beige rather than
    // a room with a window in it.
    environmentIntensity: 0.08,
    accentPosition: new Vector3(-2.5, 3.5, -4.5),
    accentIntensity: 0.22,
    accentColor: new Color(1.0, 0.88, 0.72),
  },
  floorTap: {
    owlPosition: new Vector3(0, 0.35, 1.2),
    flightBounds: {
      minX: RIGHT_WALL_FACE_X + 0.45,
      maxX: LEFT_WALL_FACE_X - 0.45,
      minZ: -8.5,
      maxZ: BACK_WALL_FACE_Z - 0.45,
      minY: 0.3,
      maxY: CEILING_Y - 1.0,
    },
    ceilingY: CEILING_Y,
    firstTapSoundId: 'sfx_shared_sparkle_burst',
  },
};
