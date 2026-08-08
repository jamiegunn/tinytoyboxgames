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

/**
 * THE TOYBOX CAME OFF THE WALL, and it is the same move the Living Room's two
 * made for the same kind of reason.
 *
 * IT WAS AT 3.1, with its bounding box reaching x 4.07 against a wall at 5.4. The
 * generated room put it there and nothing had asked it to move, because nothing
 * had needed the frame to CONTAIN it — only to be able to reach it by turning.
 * The tap invitation changed that: a halo is a pointer, and the room has to open
 * pointing at a box that is actually in the picture.
 *
 * WHY 3.1 COULD NOT WORK, measured (`.probe/kitchen-toybox-inboard.mjs`). Asked
 * for an opening turn that brings the box's bbox centre inside 0.85 NDC with 90%
 * of its projected area on screen, the solver reports NO FEASIBLE ANGLE at every
 * aspect from 0.60 to 0.90 — which includes iPad portrait at 0.75 and a square
 * window — and where it succeeds it does so with 0.1 degrees of clamp to spare.
 * Framing something that far outboard needs a bigger turn than the room's own
 * walls allow before a frame corner escapes past the end of one. There was no
 * angle to solve for; the position was the problem.
 *
 * WHY 2.6 AND NOT FURTHER IN. The same probe swept inboard positions:
 *
 *     x 3.1   infeasible at seven aspects        0.1° of slack
 *     x 2.8   40.3° worst case                   2.5°
 *     x 2.6   38.3° worst case                   5.2°     <- shipped
 *     x 2.4   36.2°                              7.9°     but now overlaps kit_pot
 *     x 2.0   31.2°                             12.0°     and the shopping basket
 *             and the rolling pin
 *
 * 2.6 is the first position that clears every aspect with real slack and still
 * collides with nothing but the front runner — which is a rug, and a toybox
 * standing on a rug is a toybox standing on a rug.
 *
 * AND THEN IT CAME IN AGAIN, TO 1.69, once the standard for "in frame" became the
 * box rather than the halo above it. At 2.6 that standard costs 38.3 degrees of
 * opening turn at the narrowest shipping aspect — nearly three frame-widths of
 * crooked — with 5.2 degrees of clamp to spare.
 * `.probe/toybox-inboard-sweep.mjs`:
 *
 *     2.60   38.3° of turn    5.2° of clamp slack   collides with nothing
 *     2.21   33.9°           10.5°                  the toy pot
 *     1.95   30.5°           12.0°                  pot, shopping basket, rolling pin
 *     1.69   26.4°           12.0°                  same three            <- shipped
 *     1.17   16.7°           12.0°                  same three
 *
 * 1.69 takes a third off the turn for the price of moving three floor toys, which
 * is a price worth paying: those three exist to fill the near band and they fill
 * it just as well two feet to the left. Further in buys less and less — 1.17 saves
 * only another ten degrees — and a toybox in the middle of a kitchen floor is not
 * a kitchen.
 */
export const TOYBOX_X = 1.69;
export const TOYBOX_Y = 0.01;
export const TOYBOX_Z = -2.175;
export const TOYBOX_ROTATION_Y = Math.PI + Math.PI / 6;

/**
 * Baseball Park toybox slot — the white-and-red chest deep by the left cabinets.
 *
 * RECOVERED, NOT RE-DERIVED. These three values were lost when a transfer
 * archive was extracted over this file, and they are restored here from the
 * esbuild bundles the test harness leaves in `.tstest-tmp/`, which still held
 * the compiled constants. So the NUMBERS are the originals; the prose that was
 * around them is not, and this docblock is a replacement rather than the
 * original note. If the original reasoning matters, it is worth re-reading the
 * placement against `.probe/toybox-inboard-sweep.mjs` before trusting this
 * paragraph over the geometry.
 *
 * What the recovered numbers say about the placement: x 3.5 puts the chest to
 * the right of the cabinet run's centre (CABINET_RUN_X 1.5, width 4.1, so the
 * run spans -0.55 to 3.55) and clear of the fridge at 4.35; z 4.6 stands it well
 * forward of the counter at 7.46, in the deep half of the room rather than
 * against the back wall. The rotation turns it an eighth of a turn off square so
 * it faces the camera's side of the room rather than presenting a flat face.
 */
export const BASEBALL_TOYBOX_X = 3.5;
export const BASEBALL_TOYBOX_Z = 4.6;
export const BASEBALL_TOYBOX_ROTATION_Y = Math.PI - Math.PI / 8;

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

// ── The front floor ─────────────────────────────────────────────────────────
//
// WHAT WAS WRONG, MEASURED RATHER THAN EYEBALLED. With the letterbox gone the
// scene fills the screen, and on a 393x852 phone 59.7% of the Kitchen's opening
// frame was bare floorboards — the emptiest room in the app by a wide margin
// (the Playroom is 39.5%, the Living Room 42.0%). That is not a camera fault:
// `.probe/joint-solve.mjs` searched 2,965 poses that are clean at every aspect
// from 0.40 to 2.60 and the one that ships is the richest of them. The room
// itself has nothing on its floor forward of the breakfast table.
//
// WHERE THE EMPTINESS ACTUALLY IS. `.probe/kitchen-bare-footprint.mjs` casts a
// ray through every cell of the frame and reports where the bare ones LAND, so
// the dressing goes where the hole is instead of where it looks like it might
// be. On a phone the bottom third of the frame covers x [-2.0, 2.0], z [-4.3,
// -1.3]; on a laptop the same band runs the full width, x [-5.2, 5.2]. The
// single heaviest square is (0, -4) and its neighbours.
//
// So everything below sits in a band around z -4, and the pieces spread wider
// than a phone can see on purpose: the narrow frame is the one that needed
// fixing, but the wide one shows the whole band and would look staged if the
// dressing stopped at x +/-2.
//
// THIS ROOM'S FRONT IS ITS THRESHOLD, not its work surface — the counters are
// at the back wall and there is no fourth wall here. So the pieces are the ones
// a threshold collects: a rag runner, a step stool, a shopping basket set down,
// bowls out for the cat, a broom left leaning.

// TWO SLOTS, NOT ONE, AND THE FIRST ATTEMPT DID NOT KNOW THAT. Everything here
// was first placed from "the bottom third of the frame lands on x [-2.0, 2.0],
// z [-4.3, -1.3]" — a footprint measured from where bare-floor rays land. It
// rendered with the play kitchen and the laundry basket sliced off at the frame
// edge, because that footprint is the union over the whole bottom band and the
// band is a TRIANGLE, not a rectangle: `.probe/where-is-the-bottom.mjs` projects
// floor points directly and finds that on a phone, at z -3, only x [-1.5, 1.5]
// is on screen at all. The corners of the band reach out to x +/-2; the middle
// of it does not.
//
// So there are two slots and they want different things:
//
//   THE PHONE STRIP, |x| <= 1.3 and z [-3.8, -1.6]. About three metres square,
//   directly under the child's eye, and the only near floor a phone shows. Low
//   objects only — a metre-wide unit dead centre here would wall the room off.
//
//   THE WINGS, |x| 2.4 to 4.3. Invisible on a phone, most of a laptop's lower
//   frame. This is where the big silhouettes go.
//
// The frame's bottom edge is at z -4.35 on both, so nothing may sit nearer than
// about z -4.0 or its base falls off the screen.

/** Rag runner across the front of the room, over the emptiest floor cells. */
export const FRONT_RUNNER_X = 0;
export const FRONT_RUNNER_Z = -3.0;
export const FRONT_RUNNER_HALF_WIDTH = 3.3;
export const FRONT_RUNNER_HALF_DEPTH = 1.0;

/** Child's step stool, in the phone strip. */
export const STEP_STOOL_X = -1.0;
export const STEP_STOOL_Z = -2.4;

/** Shopping basket with play food in it, in the phone strip. */
// OUT FROM 0.95 when the toybox came in to 1.69: the box's footprint reaches
// x 2.66 at z -3.14, and this basket was inside it.
export const SHOP_BASKET_X = -1.85;
export const SHOP_BASKET_Z = -3.3;

/** Nesting mixing bowls, one tipped out of the stack. In the phone strip. */
export const MIXING_BOWLS_X = -0.75;
export const MIXING_BOWLS_Z = -3.5;

/** Cat mat and bowls, out in the left wing. */
export const PET_CORNER_X = -4.3;
export const PET_CORNER_Z = -3.2;

// ── Loose floor toys ────────────────────────────────────────────────────────
//
// THESE USED TO BE LITERALS AT THE CALL SITE and it cost something. When the
// room was shortened by 25% on 2026-08-02 the depth transform was applied to
// this file, where world positions are supposed to live — so the toybox moved
// from z -5.7 to -2.175 and the toys did not move at all. Two of them ended up
// INSIDE it. `decor/floorToys.ts` carried a docblock saying the next rescale
// would miss them again unless they moved here first. This is that move.

/** Red ball, near the breakfast table. */
export const TOY_BALL_RED_X = 2.4;
export const TOY_BALL_RED_Z = 1.125;

/** Teal ball, over toward the stove. */
export const TOY_BALL_TEAL_X = -3.7;
export const TOY_BALL_TEAL_Z = -0.375;

/** Stack of three chunky blocks. */
export const TOY_BLOCKS_X = -1.6;
export const TOY_BLOCKS_Z = -0.075;

/** Rubber duck. */
export const TOY_DUCK_X = 3.6;
export const TOY_DUCK_Z = 2.4;

/** Toy cooking pot. */
// OUT FROM (1.2, -1.2), which the moved toybox now stands on.
export const TOY_POT_X = -2.35;
export const TOY_POT_Z = -1.35;

/** Play apple and orange. */
export const TOY_FOOD_X = -1.2;
export const TOY_FOOD_Z = 1.575;

/** Wooden rolling pin. */
// OUT FROM (0.8, -1.95), which the moved toybox now stands on.
export const TOY_ROLLING_PIN_X = -1.15;
export const TOY_ROLLING_PIN_Z = -2.25;

/** Plush bunny. */
export const TOY_PLUSH_X = 4.1;
export const TOY_PLUSH_Z = 0.3;

/**
 * Child's play kitchen, facing the camera across the front of the room.
 *
 * THE BIGGEST PIECE HERE, AND IT EARNS ITS PLACE ON WIDE SCREENS ONLY. It is
 * 1.05 wide and 0.95 tall, which is why it lives out in the left wing rather
 * than in the phone strip: a unit this size in the middle of the near floor
 * would wall the room off. Switching it and the laundry basket off costs 2.3
 * points of the frame's object share at aspect 1.33 and 1.4 at 2.37, and
 * nothing at all on a phone, which cannot see either of them.
 */
export const PLAY_KITCHEN_X = -2.9;
export const PLAY_KITCHEN_Z = -2.6;

/**
 * Laundry basket with cloths, in the right wing.
 *
 * Held at z -3.9 to clear the nature toybox, whose box runs z -3.1 to -1.3 over
 * x 2.1 to 4.1 — the basket would otherwise stand inside it.
 */
export const LAUNDRY_BASKET_X = 2.6;
export const LAUNDRY_BASKET_Z = -3.9;
