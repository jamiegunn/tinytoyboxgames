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
/**
 * How far forward of the back wall the ceiling slab sits.
 *
 * Lived as a local `WALL_DEPTH_OFFSET` literal inside `room/ceiling.ts` — the
 * same defect as `SIDE_WALL_CENTER_Z` below, and it cost the same thing: the
 * 25% depth rescale scaled every constant in this file and left the ceiling
 * 0.3 units out of place, because it could not see a number that was not here.
 */
export const CEILING_DEPTH_OFFSET = 0.9;

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

/** Floor dimensions are intentionally larger than the visible shell to hide seams. */
export const FLOOR_WIDTH = 18;
export const FLOOR_DEPTH = 18;

/** Sample decor placement near the back wall. */
export const COUNTER_X = -2.4;
export const COUNTER_Y = 0;
export const COUNTER_Z = 7.4625;

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
export const TABLE_Z = 2.325;

/** Oval rug in front of the cabinet run. */
export const RUG_X = 0.6;
export const RUG_Z = 4.65;

/** Default toybox slot for the generated room. */
export const TOYBOX_X = 3.1;
export const TOYBOX_Y = 0.01;
export const TOYBOX_Z = -2.175;
export const TOYBOX_ROTATION_Y = Math.PI + Math.PI / 6;

/** Z position of the doorway back to the Living Room on the left wall. */
export const LIVING_ROOM_DOOR_Z = 2.94;

// ── Side wall slots ─────────────────────────────────────────────────────────
//
// The side walls are ~48% of this room's frame and, until these slots existed,
// carried a baseboard and one door between them. Measured on the render above
// the furniture line (y >= 2.2), the RIGHT wall was 97.7% flat tiles and the
// LEFT 80.7% — against the Playroom's decorated left wall at 32.3% under the
// same camera preset. The Playroom is the reference because it is the same
// house, the same camera, and it was not built to prove anything.
//
// Everything here hangs in that band deliberately. Below it the wall competes
// with the floor toys the child is meant to reach for; above it is the wall the
// camera actually shows.

/** Plate rack on the right wall: rack center Z and lower plank height. */
export const PLATE_RACK_Z = 5.55;
export const PLATE_RACK_Y = 3.15;

/** Framed chalk menu board on the right wall, nearer the camera than the rack. */
export const MENU_BOARD_Z = 2.4;
export const MENU_BOARD_Y = 3.3;

/** Peg rail with hanging cloths on the left wall, behind the doorway. */
export const PEG_RAIL_Z = 5.68;
export const PEG_RAIL_Y = 3.05;

/** Wall clock on the left wall, forward of the doorway. */
export const WALL_CLOCK_Z = 2.175;
export const WALL_CLOCK_Y = 3.9;

// ── Left-wall cabinetry ─────────────────────────────────────────────────────
//
// The left wall is the POSITIVE-x one (see the navigation header at the top of
// this file), so these all hang off `LEFT_WALL_FACE_X`. Only Z varies: on a side
// wall, "where along the wall" is a depth.
//
// The wall's fixed points, front to back, are the clock at WALL_CLOCK_Z, the
// Living Room doorway at LIVING_ROOM_DOOR_Z (2.0 wide, so it owns z 1.4 .. 3.4),
// the peg rail at PEG_RAIL_Z (2.2 long, y 3.05), and the fridge's shoulder in
// the back corner. Everything below the rail and outside the doorway was bare
// floor.

/** Centre of the tall dresser, forward of the Living Room doorway. */
export const LEFT_DRESSER_Z = 0.2;

/** Dresser width along the wall. Its front edge clears the doorway frame by 0.7. */
export const LEFT_DRESSER_WIDTH = 2.6;

/**
 * Top of the dresser's plate hutch.
 *
 * Deliberately under WALL_CLOCK_Y (3.9) so the clock hangs clear above the
 * cornice rather than being swallowed by it.
 */
export const DRESSER_HUTCH_TOP_Y = 3.3;

/**
 * Centre of the low base units. This is PEG_RAIL_Z on purpose — the run stands
 * UNDER the rail, and saying so with the rail's own constant is what keeps the
 * two from drifting apart if the rail moves.
 */
export const LEFT_BASE_CABINET_Z = PEG_RAIL_Z;

/**
 * Base-unit run width along the wall.
 *
 * A shade wider than the peg rail's 2.2 so the run reads as the thing the rail
 * hangs over rather than as a box the same size as it, and short enough that its
 * back end stops at z 6.9 — clear of the fridge's shoulder, which starts at 7.28.
 */
export const LEFT_BASE_CABINET_WIDTH = 2.6;

/** Carcass depth out from the wall, shared by both pieces. */
export const LEFT_CABINET_DEPTH = 0.58;
