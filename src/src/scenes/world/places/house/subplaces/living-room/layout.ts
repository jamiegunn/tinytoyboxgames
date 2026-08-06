// ── HOW TO NAVIGATE THIS ROOM ───────────────────────────────────────────────
//
// Read this before changing any coordinate below. One of the three axes does
// not do what its name suggests, and getting it backwards mirrors the room:
//
//     +X  ->  screen LEFT      (NOT right)
//     -X  ->  screen RIGHT
//     +Y  ->  screen UP        (floor is y = 0, ceiling is CEILING_Y)
//     +Z  ->  AWAY from the camera, deeper into the room (toward the back wall)
//     -Z  ->  TOWARD the camera, nearer the child
//
// +X reads LEFT because the room camera looks ALONG +Z with +Y up, which makes
// the screen-right vector -X. Anyone who assumes the usual "x increases
// rightward" places props on the wrong side of the room, and the mistake is
// invisible until it renders.
//
// The constants below are the proof, not just an example: LEFT_WALL_X = 5.4
// and RIGHT_WALL_X = -5.4. The wall the child sees on the LEFT is the
// POSITIVE one.
//
// This is measured, not asserted. `tests/framework/sceneAxes.test.mjs` projects
// the three unit axes at this scene's own opening pose and fails if any of them
// flips, so if a camera preset is ever re-posed these lines cannot quietly
// become lies.
//
// THE CAMERA IS ON x = 0, WHICH IS A TRAP
// ----------------------------------------
// The eye sits on the room's centreline. Two props both placed near x = 0 at
// different depths are therefore stacked along the same view ray, and the
// nearer one hides the further one no matter how far apart they are in Z.
// Pirate Cove shipped exactly that — a ship wheel at x = 0 covering 72% of the
// portal at x = 0 four units behind it — and the stage solver that placed the
// wheel passed, because it checked FOOTPRINT overlap on the floor plane and
// footprint clearance is not line-of-sight clearance. Offset one of them
// sideways rather than trusting depth to separate them.
//
// For placement by intent rather than by raw literals, `@app/utils/scene/placement`
// exposes `onFloor({ side: 'left' | 'centre' | 'right', across, depth, height })`,
// which owns the sign flip so callers never restate it.

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
/**
 * Center z of the two side walls.
 *
 * Lived as a local `SIDE_WALL_CENTER_Z` literal inside `room/walls.ts`, which
 * `room/README.md` forbids in as many words: "shell dimensions come from the
 * authored constants in ../layout.ts; do not invent local sizes that drift
 * from the layout". It drifted — the walls sat 0.8 forward of where the
 * ceiling did — and a local copy is also a value a depth rescale silently
 * misses, which is how a shortened room ends up with full-length walls.
 */
export const SIDE_WALL_CENTER_Z = 1.2;

/**
 * HOW THE DEPTHS IN THIS FILE WERE DERIVED.
 *
 * The room was shortened by 25% on 2026-08-02 — "shorten living room and
 * kitchen by 25%" — and every world z below is the old value under one
 * transform, not a fresh set of authored numbers:
 *
 *     z' = BACK_WALL_CENTER_Z - (BACK_WALL_CENTER_Z - z) * 0.75
 *
 * The back wall does not move; everything else comes 25% of its distance
 * closer to it. POSITIONS are compressed and SIZES are not, so props keep their
 * proportions and only the space between them closes up.
 *
 * `tests/room/room-depth-scale.test.mjs` recomputes every one of these from the
 * pre-shortening value and fails if any has been hand-adjusted since, so the
 * next person to touch one is told that the set was scaled rather than laid out
 * again.
 */

export const ROOM_DEPTH = 15;

/** Ceiling slab thickness. */
export const CEILING_THICKNESS = 0.16;

/**
 * How far forward of the back wall the ceiling slab sits, so it covers the
 * visible shell rather than the oversized floor plane beneath it.
 *
 * Lived as a local `WALL_DEPTH_OFFSET` inside `room/ceiling.ts` until
 * 2026-08-01. `room/README.md` forbids exactly that: "do not invent local sizes
 * that drift from the layout" — a local copy is how the ceiling and the walls
 * end up disagreeing about where the room ends.
 */
export const CEILING_DEPTH_OFFSET = 0.9;

/** Floor dimensions are intentionally larger than the visible shell to hide seams. */
export const FLOOR_WIDTH = 18;
export const FLOOR_DEPTH = 18;

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
export const PLAYROOM_DOOR_Z = 3.9;

/** Z position of the doorway into the Kitchen on the right wall. */
export const KITCHEN_DOOR_Z = 3.9;

// ── Furniture slots ─────────────────────────────────────────────────────────

/** Rug center and radius (large enough to anchor the whole seating area). */
export const RUG_X = 0;
export const RUG_Z = 3.0;
export const RUG_RADIUS = 3.6;

/** Couch slot under the window, facing the camera, clear of the outside door. */
export const COUCH_X = -2.6;
export const COUCH_Z = 6.3;

/** Side table in the corner nook beyond the fireplace, under the moon print. */
export const SIDE_TABLE_X = 4.4;
export const SIDE_TABLE_Z = 7.05;

/** Floor lamp tucked into the back corner beside the couch. */
export const FLOOR_LAMP_X = -4.7;
export const FLOOR_LAMP_Z = 7.65;

/** Sleeping cat plush curled up on the rug. */
export const CAT_X = 1.1;
export const CAT_Z = 4.125;

/*
 * GONE: BOOK_STACK_X = -1.7 and BOOK_STACK_Z = -3.8, under the comment "Stack
 * of picture books on the front floor, between the toyboxes."
 *
 * There is no floor book stack in this room and there never was. The only
 * books the Living Room builds are two on the side table, in `sideTable.ts`,
 * at a different place and a different scale.
 *
 * The reason this pair is worth a note rather than a silent delete is where it
 * sat. Every other slot in this block — RUG, COUCH, SIDE_TABLE, FLOOR_LAMP,
 * CAT, and both toyboxes — is imported by the module that builds the thing it
 * names, between two and six times each. These two had the same JSDoc voice,
 * the same SCREAMING_CASE X/Z pairing and the same position in the list, and
 * zero readers. Nothing about the text distinguishes a coordinate the room was
 * built to from a coordinate for a prop that was never made; only the import
 * graph does, and prose does not have one.
 *
 * If a floor book stack is wanted, build it and let the builder own its
 * position, the way `sideTable.ts` owns the side table's.
 */

// ── Toybox slots ────────────────────────────────────────────────────────────

/** Nature toybox slot (foreground right). */
/**
 * THE TWO TOYBOXES CAME OFF THE WALLS, and it is worth recording why, because
 * the same two props had been the binding constraint on three unrelated things
 * at once:
 *
 *   - the stage aspect band. At a 0.85 floor the living room had ZERO camera
 *     poses that framed every prop without showing the void; the band starts at
 *     1.0 because of these.
 *   - rotation. The frame had to be wide enough to contain the side walls
 *     themselves, which capped every scene in the app at ±12.0 degrees.
 *   - and after the room was shortened by 25%, they were the only two props that
 *     would not fit in frame at ANY clean pose — 1.08 and 1.07 NDC when
 *     everything else was inside 0.97.
 *
 * Three times the note said this was set dressing rather than code and left it.
 * Measured (.probe/toybox-inset.mjs), 0.9 inboard costs nothing — no new
 * collision with the rug, the couch or each other — and takes the room's
 * rotation limit from ±1.6 degrees to ±29.3, which stops it being the room that
 * sets the number for everywhere else.
 *
 * THEY CAME IN AGAIN, TO ±1.76, FOR A FOURTH REASON OF THE SAME KIND. The tap
 * invitation needs the room to OPEN pointing at a toybox on a portrait phone, and
 * pointing means the box is in the picture — bbox centre inside 0.85 NDC with 90%
 * of its projected area on screen. At ±2.7 that costs 37.4 degrees of opening turn
 * at the narrowest shipping aspect, with 5.2 degrees of clamp left over. A narrow
 * frame cannot contain something that far off axis without being aimed almost
 * straight at it, so the room opened nearly three frame-widths crooked.
 *
 * `.probe/toybox-inboard-sweep.mjs` swept the pull toward the centre line:
 *
 *     ±2.70   37.4° of turn    5.2° of clamp slack
 *     ±2.29   33.0°           10.9°
 *     ±2.03   29.6°           12.0°
 *     ±1.76   25.9°           12.0°   <- shipped
 *     ±1.49   21.3°           12.0°   but now under the book slew as well
 *
 * ±1.76 is the furthest in that still clears the front-floor dressing with only
 * the block basket needing to move, and it takes a third off the opening turn. The
 * sweep's collision test is footprints on the floor, so it deliberately ignores
 * the rug: a toybox standing on a rug is a toybox standing on a rug.
 */
export const NATURE_TOYBOX_X = 1.76;
export const NATURE_TOYBOX_Z = -1.8;
export const NATURE_TOYBOX_ROTATION_Y = Math.PI + 0.5;

/** Pirate Cove toybox slot (foreground left). */
export const PIRATE_TOYBOX_X = -1.76;
export const PIRATE_TOYBOX_Z = -2.025;
export const PIRATE_TOYBOX_ROTATION_Y = Math.PI - 0.5;

/** Shared toybox floor offset. */
export const TOYBOX_Y = 0.01;

// ── Front floor ─────────────────────────────────────────────────────────────

/**
 * THE BAND THE CAMERA LOOKS ACROSS BEFORE IT REACHES ANYTHING, and why it now
 * has things on it.
 *
 * With the opening turn added (`utils/scene/openingTurn.ts`) the Living Room
 * opens rotated toward a toybox on a portrait phone, so a child meets the halo
 * over it without having to know to drag. At the narrowest shipping aspect,
 * 0.40, the smallest turn that shows a halo puts 46.6% of the frame on bare
 * boards against a 46.0% bound — a miss of about six rays out of 1024, in the
 * one room whose floor bound was already the loosest of the three.
 *
 * The alternative the solver found was to open THAT one aspect the other way
 * (-28.9° instead of +26.8°), which passes. It was rejected: a schedule that
 * flips sign between 0.40 and 0.43 passes through zero somewhere near 0.416 when
 * interpolated, and a device landing in that band would open facing neither
 * toybox. The guard's own failure message says what to do instead — "this room
 * needs something on its floor, not a different camera".
 *
 * WHERE, MEASURED (`.probe/lr-turned-bare.mjs`). Rays through that frame that
 * land on bare boards concentrate in the near foreground: the heaviest 1x1
 * squares are (1, -4) with 74, (0, -4) with 70, (0, -3) with 63, (1, -3) with 53
 * and (2, -3) with 45. The bottom 40% of the frame covers x [-1.0, 2.9],
 * z [-4.9, -0.5].
 *
 * WHY EVERYTHING IS FORWARD OF z = -2.6. The toyboxes stand at z -1.8 and -2.03
 * and are the things the turn exists to show; a prop between the camera and one
 * of them would be dressing that hides the point of the dressing.
 */

/** Floor cushion, in the heaviest empty square. */
export const FLOOR_CUSHION_X = 0.9;
export const FLOOR_CUSHION_Z = -3.8;

/** Picture books left in a slew, the way a three-year-old leaves them. */
export const FLOOR_BOOKS_X = -0.4;
export const FLOOR_BOOKS_Z = -3.1;

/**
 * Basket of wooden blocks.
 *
 * MOVED OUT FROM (1.9, -2.9) when the nature toybox came in to x 1.76: the box's
 * footprint now runs x 0.8 to 2.7 at z -2.8 to -0.9, and the basket was inside it.
 * Out and forward rather than in, so it stays in the near band the dressing exists
 * to fill.
 */
export const BLOCK_BASKET_X = 2.95;
export const BLOCK_BASKET_Z = -3.5;

/** A soft ball, resting where one would come to rest. */
export const FLOOR_BALL_X = -1.2;
export const FLOOR_BALL_Z = -4.3;
