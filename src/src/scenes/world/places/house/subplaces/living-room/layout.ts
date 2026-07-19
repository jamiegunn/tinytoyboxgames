/**
 * Layout constants for the Living Room.
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

// ── Hearth wall (back wall) slots ───────────────────────────────────────────

/** Fireplace center X on the back wall. */
export const FIREPLACE_X = 2.6;

/** Window center X on the back wall. */
export const WINDOW_X = -3.2;

/** Window sill height and opening size. */
export const WINDOW_BOTTOM_Y = 2.6;
export const WINDOW_WIDTH = 2.0;
export const WINDOW_HEIGHT = 1.9;

/** "Outside" doorway center X on the back wall (centered between window and fireplace). */
export const OUTSIDE_DOOR_X = 0;

/** Framed wall art slots (X, Y on the back wall). */
export const WALL_ART_ABOVE_MANTEL = { x: FIREPLACE_X, y: 4.35 } as const;
export const WALL_ART_RIGHT = { x: 4.5, y: 3.5 } as const;

// ── Side-wall doorway slots ─────────────────────────────────────────────────

/** Z position of the doorway back to the Playroom on the left wall. */
export const PLAYROOM_DOOR_Z = 2.4;

/** Z position of the doorway into the Kitchen on the right wall. */
export const KITCHEN_DOOR_Z = 2.4;

// ── Furniture slots ─────────────────────────────────────────────────────────

/** Rug center and radius (large enough to anchor the whole seating area). */
export const RUG_X = 0;
export const RUG_Z = 1.2;
export const RUG_RADIUS = 3.6;

/** Couch slot under the window, facing the camera, clear of the outside door. */
export const COUCH_X = -2.6;
export const COUCH_Z = 5.6;

/** Side table in the corner nook beyond the fireplace, under the moon print. */
export const SIDE_TABLE_X = 4.4;
export const SIDE_TABLE_Z = 6.6;

/** Floor lamp tucked into the back corner beside the couch. */
export const FLOOR_LAMP_X = -4.7;
export const FLOOR_LAMP_Z = 7.4;

/** Sleeping cat plush curled up on the rug. */
export const CAT_X = 1.1;
export const CAT_Z = 2.7;

/** Stack of picture books on the front floor, between the toyboxes. */
export const BOOK_STACK_X = -1.7;
export const BOOK_STACK_Z = -3.8;

// ── Toybox slots ────────────────────────────────────────────────────────────

/** Nature toybox slot (foreground right). */
export const NATURE_TOYBOX_X = 3.6;
export const NATURE_TOYBOX_Z = -5.2;
export const NATURE_TOYBOX_ROTATION_Y = Math.PI + 0.5;

/** Pirate Cove toybox slot (foreground left). */
export const PIRATE_TOYBOX_X = -3.6;
export const PIRATE_TOYBOX_Z = -5.5;
export const PIRATE_TOYBOX_ROTATION_Y = Math.PI - 0.5;

/** Shared toybox floor offset. */
export const TOYBOX_Y = 0.01;
