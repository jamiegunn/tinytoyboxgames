import { Color, Vector3 } from 'three';
import type { RoomEnvironmentConfig } from '@app/utils/roomSceneFactory';
import { BACK_WALL_FACE_Z, CEILING_Y, FIREPLACE_X, FLOOR_LAMP_X, FLOOR_LAMP_Z, LEFT_WALL_FACE_X, RIGHT_WALL_FACE_X } from './layout';

/**
 * Centralized environment config for the Living Room.
 *
 * The lighting leans warmer than the other rooms: the fireplace and floor lamp
 * each get an authored point light so the hearth reads as the room's glow
 * source. Decor never adds its own lights — glow placement lives here.
 *
 * That claim about the hearth was, until this change, not true of the rendered
 * image. With a flat white environment at 0.24 carrying most of the room, the
 * two point lights below moved mean luminance by well under a unit — the fire
 * was a bright object on a wall, not a light. Measured on the floor in front of
 * the hearth against floor at the same depth away from it, the near/far
 * luminance ratio was 1.196 and the red-minus-blue difference +28.3. After
 * cutting the environment those read 1.375 and +35.8, while a plain dimmer
 * control reached only 1.244 and +30.0. The hearth now lights the room it was
 * always documented as lighting.
 */
export const ROOM_ENVIRONMENT: RoomEnvironmentConfig = {
  clearColor: new Color(0.16, 0.12, 0.1),
  lighting: {
    keyDirection: new Vector3(-0.45, -0.82, 0.35),
    // Scaled with the kitchen (1.4 → 1.7, ×1.21) rather than tuned separately,
    // so the two rooms stay siblings and neither is fitted to its own render.
    keyIntensity: 1.65,
    keyColor: new Color(1.0, 0.88, 0.66),
    // Same 35%-of-key bounce as the kitchen, and scaled with it rather than
    // tuned separately for the same reason the key was: this room's left wall
    // has the identical defect — measured at 81.8% flat tiles against the right
    // wall's 78.4%, under a key travelling toward −X with LEFT_WALL_FACE_X
    // positive, so its Lambert term is zero here too.
    //
    // NOTE this room is NOT a clean measurement of the fix and must not be read
    // as one: its %grey disagrees between the two capture paths (33.7% theirs,
    // 10.1% mine) and every living-room colour claim in this audit is excluded
    // on those grounds. The change is made here because the ARITHMETIC is the
    // same dot product, not because a number came back green.
    // Same derivation as the kitchen's, run on THIS room's surfaces rather than
    // copied from it: wall (0.95, 0.84, 0.64) and floor (0.62, 0.44, 0.29) give
    // mean albedo (0.785, 0.640, 0.465); × keyColor (1.0, 0.88, 0.66) and
    // normalised gives (1.00, 0.72, 0.39); the intensity carries the luminance
    // compensation, 0.58 → 0.68. Warmer than the kitchen's because this room's
    // floor is darker and redder, which is the formula noticing something I
    // would not have.
    bounceIntensity: 0.68,
    bounceColor: new Color(1.0, 0.72, 0.39),
    // 0.28 → 0.19, the same ×0.67 the kitchen's fill took.
    fillIntensity: 0.19,
    fillColor: new Color(0.95, 0.9, 0.88),
    // Gives the hemisphere a distinct ground half; unset previously, which
    // collapsed it to a flat ambient (sky === ground) that could shade nothing.
    // Not "bounce off the floorboards" — see the kitchen's copy of this comment
    // for the measurement that retired that claim: this room's floor samples at
    // 0xcfbb9f, 8.4 degrees of hue from the value used here, and the hue was
    // shown to be close to inert. The split matters; the colour barely does.
    fillGroundColor: new Color(0x5c4530),
    // See LightingConfig.environmentIntensity and the kitchen's copy of this
    // comment. Verified on this room independently, with the variants carried
    // over unchanged rather than re-tuned: sd L 24.6 → 52.3 and flat-region
    // coverage 40.6% → 24.7%, against a dimmer control that reached 26.3 / 32.7%.
    environmentIntensity: 0.08,
    accentPosition: new Vector3(-2.5, 3.5, -4.5),
    accentIntensity: 0.22,
    accentColor: new Color(1.0, 0.86, 0.68),
    extraPointLights: [
      {
        // Fireplace glow, just in front of the hearth opening.
        position: new Vector3(FIREPLACE_X, 1.3, BACK_WALL_FACE_Z - 1.0),
        intensity: 0.55,
        color: new Color(1.0, 0.62, 0.3),
        distance: 8,
      },
      {
        // Floor-lamp pool of light beside the couch.
        position: new Vector3(FLOOR_LAMP_X, 2.4, FLOOR_LAMP_Z),
        intensity: 0.28,
        color: new Color(1.0, 0.88, 0.62),
        distance: 6,
      },
    ],
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
