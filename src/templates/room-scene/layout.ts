/**
 * Layout constants for this room.
 *
 * Room scale and authored slot positions live here so the room can be reshaped
 * without hunting through wall, floor, decor, and toybox files for magic numbers.
 */

/** Ceiling height used by the shell and owl flight bounds. */
export const CEILING_Y = 6.2;

/** Wall thickness for the three-wall shell. */
export const WALL_THICKNESS = 0.25;

/** Side wall center positions. */
export const LEFT_WALL_X = 5.4;
export const RIGHT_WALL_X = -5.4;

/** Back wall center and interior face positions. */
export const BACK_WALL_CENTER_Z = 8.4;
export const BACK_WALL_FACE_Z = BACK_WALL_CENTER_Z - WALL_THICKNESS / 2;

/** Interior faces used by authored placement. */
export const LEFT_WALL_FACE_X = LEFT_WALL_X - WALL_THICKNESS / 2;
export const RIGHT_WALL_FACE_X = RIGHT_WALL_X + WALL_THICKNESS / 2;

/** Shell spans. */
export const WALL_HEIGHT = CEILING_Y;
export const ROOM_SPAN_X = LEFT_WALL_X - RIGHT_WALL_X + WALL_THICKNESS;
export const ROOM_DEPTH = 20;

/** Ceiling slab thickness. */
export const CEILING_THICKNESS = 0.16;

/** Floor dimensions are intentionally larger than the visible shell to hide seams. */
export const FLOOR_WIDTH = 18;
export const FLOOR_DEPTH = 24;

/** Placeholder decor placement near the back wall. */
export const PLACEHOLDER_X = -2.4;
export const PLACEHOLDER_Y = 0;
export const PLACEHOLDER_Z = 7.15;

/** Default toybox slot for the generated room. */
export const TOYBOX_X = 3.1;
export const TOYBOX_Y = 0.01;
export const TOYBOX_Z = -5.7;
export const TOYBOX_ROTATION_Y = Math.PI + Math.PI / 6;
