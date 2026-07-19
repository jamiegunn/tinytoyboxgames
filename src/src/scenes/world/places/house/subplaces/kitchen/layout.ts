/**
 * Layout constants for the generated room.
 *
 * The template keeps room scale and authored slot positions in one place so a
 * new room can be reshaped without hunting through wall, floor, decor, and
 * toybox files for magic numbers.
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

/** Sample decor placement near the back wall. */
export const COUNTER_X = -2.4;
export const COUNTER_Y = 0;
export const COUNTER_Z = 7.15;

// ── Back wall fixture slots ─────────────────────────────────────────────────

/** Lower cabinet run center X and span along the back wall. */
export const CABINET_RUN_X = 1.5;
export const CABINET_RUN_WIDTH = 4.1;

/** Countertop surface height shared by the cabinet run and stove. */
export const COUNTERTOP_Y = 1.16;

/** Window over the cabinet run (X center, sill height, opening size). */
export const KITCHEN_WINDOW_X = 1.5;
export const KITCHEN_WINDOW_BOTTOM_Y = 2.35;
export const KITCHEN_WINDOW_WIDTH = 1.9;
export const KITCHEN_WINDOW_HEIGHT = 1.7;

/** Fridge slot in the back-left corner. */
export const FRIDGE_X = 4.35;

/** Stove slot in the back-right corner. */
export const STOVE_X = -4.45;

/** Open crockery shelves above the sample counter. */
export const SHELF_X = -2.4;
export const SHELF_Y = 3.0;

/** Wall-mounted pot rail above the stove. */
export const POT_RAIL_X = -4.45;
export const POT_RAIL_Y = 3.0;

// ── Floor furniture slots ───────────────────────────────────────────────────

/** Small round breakfast table with two chairs. */
export const TABLE_X = -2.9;
export const TABLE_Z = 0.3;

/** Oval rug in front of the cabinet run. */
export const RUG_X = 0.6;
export const RUG_Z = 3.4;

/** Default toybox slot for the generated room. */
export const TOYBOX_X = 3.1;
export const TOYBOX_Y = 0.01;
export const TOYBOX_Z = -5.7;
export const TOYBOX_ROTATION_Y = Math.PI + Math.PI / 6;

/** Z position of the doorway back to the Living Room on the left wall. */
export const LIVING_ROOM_DOOR_Z = 2.4;
