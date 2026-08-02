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
// The constants below are the proof, not just an example: LEFT_WALL_X = 6.0
// and RIGHT_WALL_X = -6.0. The wall the child sees on the LEFT is the
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

// ── Playroom Layout Constants ───────────────────────────────────────────────
// Dimensions and surfaces for the room shell: walls, trim, floor, ceiling, and
// the frames the decor hangs on. Changing a value here cascades to every module
// that builds part of that shell.
//
// This is NOT where an object's position lives. Where a thing is belongs to the
// code that builds it — see the gravestone further down, which lists eight
// blocks of coordinates that were kept here in parallel with the real ones and
// were wrong about the room by the time anyone read them.

// ── Room vertical ───────────────────────────────────────────────────────────

/** Ceiling height (Y coordinate). Change this single value to resize the room vertically. */
export const CEILING_Y = 6.75;

/** Wall height (same as ceiling since floor is Y=0). */
export const WALL_HEIGHT = CEILING_Y;

/** Wall vertical center. */
export const WALL_CENTER_Y = CEILING_Y / 2;

/**
 * Maps a normalised vertical position (0 = floor, 1 = ceiling) to a world Y.
 * @param t - Normalised vertical position between 0 and 1
 * @returns The corresponding world-space Y coordinate
 */
export function wallY(t: number): number {
  return t * CEILING_Y;
}

// ── Room structure ──────────────────────────────────────────────────────────

/** Wall box thickness (depth of wall meshes). */
export const WALL_THICKNESS = 0.3;

/** Room length along Z axis (side-wall depth). */
export const ROOM_DEPTH = 24;

/** Right wall centre X. */
export const RIGHT_WALL_X = -6.0;

/** Left wall centre X. */
export const LEFT_WALL_X = 6.0;

/** Back wall centre Z (position of the wall box mesh). */
export const BACK_WALL_CENTER_Z = 9.0;

/** Outer room width (wall-centre to wall-centre plus thickness, for ceiling/back-wall span). */
export const ROOM_SPAN_X = LEFT_WALL_X - RIGHT_WALL_X + WALL_THICKNESS; // 12.3

/** Thickness of the ceiling box. */
export const CEILING_THICKNESS = 0.15;

// ── Wall face positions ─────────────────────────────────────────────────────
// Room-interior surfaces of the wall boxes.

/** Back wall interior face Z. */
export const BACK_WALL_FACE_Z = BACK_WALL_CENTER_Z - WALL_THICKNESS / 2; // 8.85

/** Right wall interior face X. */
export const RIGHT_WALL_FACE_X = RIGHT_WALL_X + WALL_THICKNESS / 2; // -5.85

/** Left wall interior face X. */
export const LEFT_WALL_FACE_X = LEFT_WALL_X - WALL_THICKNESS / 2; // 5.85

// ── Trim profiles ───────────────────────────────────────────────────────────
// Dimensions shared by all three walls. Change once, updates everywhere.

/** Baseboard cross-section. */
export const BASEBOARD_HEIGHT = 0.25;
export const BASEBOARD_DEPTH = 0.15;

/** Crown molding cross-section. */
export const CROWN_HEIGHT = 0.2;
export const CROWN_DEPTH = 0.12;

/** Chair rail cross-section. */
export const CHAIR_RAIL_HEIGHT = 0.08;
export const CHAIR_RAIL_DEPTH = 0.06;

/** Baseboard Y (centre of baseboard box, half its height). */
export const BASEBOARD_Y = BASEBOARD_HEIGHT / 2; // 0.125

/** Crown molding Y position (just below ceiling). */
export const CROWN_Y = CEILING_Y - CEILING_THICKNESS; // 8.85

/** Chair rail Y position (proportional to room height). */
export const CHAIR_RAIL_Y = CEILING_Y * 0.3; // 2.7

// Trim inset: how far behind the wall face the trim centre sits.
// A positive inset means the front half of the trim protrudes into the room.
// Not exported: nothing outside this file wants an inset, it wants the finished
// position. Keeping the `export` on an intermediate is how a file ends up with
// a public surface nobody reads, which is indistinguishable at a glance from a
// public surface everybody reads.
const BASEBOARD_INSET = 0.05;
const CROWN_INSET = 0.03;
const CHAIR_RAIL_INSET = 0.06;

// ── Trim attachment helpers ─────────────────────────────────────────────────
// Pre-computed positions where trim attaches on each wall.

/** Back wall trim Z positions (face + inset, toward wall centre). */
export const BACK_TRIM = {
  baseboard: BACK_WALL_FACE_Z + BASEBOARD_INSET, // 8.9
  crown: BACK_WALL_FACE_Z + CROWN_INSET, // 8.88
  chairRail: BACK_WALL_FACE_Z + CHAIR_RAIL_INSET, // 8.91
} as const;

/** Right wall trim X positions (face − inset, toward wall centre). */
export const RIGHT_TRIM = {
  baseboard: RIGHT_WALL_FACE_X - BASEBOARD_INSET, // -5.9
  crown: RIGHT_WALL_FACE_X - CROWN_INSET, // -5.88
  chairRail: RIGHT_WALL_FACE_X - CHAIR_RAIL_INSET, // -5.91
} as const;

/** Left wall trim X positions (face + inset, toward wall centre). */
export const LEFT_TRIM = {
  baseboard: LEFT_WALL_FACE_X + BASEBOARD_INSET, // 5.9
  crown: LEFT_WALL_FACE_X + CROWN_INSET, // 5.88
  chairRail: LEFT_WALL_FACE_X + CHAIR_RAIL_INSET, // 5.91
} as const;

// ── Decal surface layers ────────────────────────────────────────────────────
// Offsets from the wall face (toward room interior) for flat decals.
// layer2 sits slightly in front of layer1 (closer to camera).

// Not exported, for the same reason as the trim insets: the wall builders use
// BACK_DECAL_Z / RIGHT_DECAL_X / LEFT_DECAL_X, never the raw offset.
const DECAL_LAYER_1 = 0.03; // clouds, base-star stickers
const DECAL_LAYER_2 = 0.05; // stars, moon

/** Back wall decal Z positions (in front of wall face, toward camera). */
export const BACK_DECAL_Z = {
  layer1: BACK_WALL_FACE_Z - DECAL_LAYER_1,
  layer2: BACK_WALL_FACE_Z - DECAL_LAYER_2,
} as const;

/** Right wall decal X positions (in front of wall face, toward room centre). */
export const RIGHT_DECAL_X = {
  layer1: RIGHT_WALL_FACE_X + DECAL_LAYER_1,
  layer2: RIGHT_WALL_FACE_X + DECAL_LAYER_2,
} as const;

/** Left wall decal X positions (in front of wall face, toward room centre). */
export const LEFT_DECAL_X = {
  layer1: LEFT_WALL_FACE_X - DECAL_LAYER_1,
  layer2: LEFT_WALL_FACE_X - DECAL_LAYER_2,
} as const;

// ── Ceiling ─────────────────────────────────────────────────────────────────
// (CEILING_THICKNESS is declared above, before trim, to avoid forward-reference issues.)

// ── Floor ───────────────────────────────────────────────────────────────────

/** Floor ground-plane width (oversized to prevent edge visibility). */
export const FLOOR_WIDTH = 20;

/** Floor ground-plane depth (oversized to prevent edge visibility). */
export const FLOOR_DEPTH = 30;

/** Spacing between plank seam lines. */
export const PLANK_SPACING = 2.2;

/** Number of plank seams (symmetric around centre). */
export const PLANK_HALF_COUNT = 4;

// ── Rug ─────────────────────────────────────────────────────────────────────

/** Physical rug mesh diameter. */
export const RUG_DIAMETER = 7.6;

/** Rug mesh thickness (cylinder height). */
export const RUG_THICKNESS = 0.06;

/** Rug band diameters (outer to inner). */
export const RUG_BAND_DIAMETERS = [7.4, 6.8, 6.2, 5.6, 5.0, 4.4, 3.6] as const;

// ── Window ──────────────────────────────────────────────────────────────────

/** Window centre X on the back wall. */
export const WINDOW_CENTER_X = -3.0;

/** Window opening width. */
export const WINDOW_WIDTH = 2.2;

/** Window vertical positions (normalised wall-height fractions). */
export const WINDOW_TOP_T = 0.76;
export const WINDOW_BOTTOM_T = 0.46;
export const WINDOW_CENTER_T = 0.61;

/** Frame bar thickness. */
export const WINDOW_FRAME_BAR = 0.15;

/** Frame bar depth. */
export const WINDOW_FRAME_DEPTH = 0.12;

/** Mullion (cross-bar) thickness. */
export const WINDOW_MULLION_BAR = 0.06;

/** Mullion depth. */
export const WINDOW_MULLION_DEPTH = 0.07;

/** Curtain width. */
export const CURTAIN_WIDTH = 0.5;

/** Curtain rod diameter. */
export const CURTAIN_ROD_DIAMETER = 0.06;

/** Curtain rod length. */
export const CURTAIN_ROD_LENGTH = 3.6;

/** Curtain rod offset above window top. */
export const CURTAIN_ROD_OFFSET_Y = 0.2;

/** Rod finial (ball end) diameter. */
export const ROD_FINIAL_DIAMETER = 0.12;

/** Rod finial offset from rod centre. */
export const ROD_FINIAL_OFFSET = 1.85;

/** Curtain outward tilt (rotation Y). */
export const CURTAIN_TILT = 0.08;

// ── Pennant banner ──────────────────────────────────────────────────────────

/** Pennant vertical position as normalised wall height. */
export const PENNANT_STRING_T = 0.78;

/** Pennant flag vertical position. */
export const PENNANT_FLAG_T = 0.74;

/** Pennant string length. */
export const PENNANT_STRING_LENGTH = 9.0;

/** Number of pennant flags. */
export const PENNANT_COUNT = 10;

/** Pennant flag radius. */
export const PENNANT_FLAG_RADIUS = 0.28;

/** Pennant spacing between flags. */
export const PENNANT_SPACING = 0.95;

/** Pennant first flag X offset. */
export const PENNANT_START_X = -3.8;

/** Maximum pennant droop at string centre. */
export const PENNANT_DROOP = 0.2;

/**
 * NOT HERE EITHER: a hand-written box saying what fits on screen.
 *
 * This file used to export SAFE_X_MIN/SAFE_X_MAX/SAFE_Z_MIN/SAFE_Z_MAX under
 * the header "Viewport-safe content box" and the comment "Objects inside this
 * box will not be clipped on portrait (9:16) or landscape (16:9)". Nothing
 * imported them, nothing checked them, and all three toyboxes were outside
 * them — one of them, the pirate-cove entrance, by enough to hang 20% off the
 * side of a portrait phone.
 *
 * The reason the replacement is a test and not a corrected box is that no box
 * can be correct. What fits on screen is a frustum cross-section, so the X
 * limit moves with depth. Sweeping the `adventure` toybox with the real camera
 * preset at portrait 9:16, the furthest its outer edge may reach is:
 *
 *   z = -4   ->  3.52        z = +2.7  ->  5.19
 *   z = -2   ->  4.02        z = +4    ->  5.52
 *   z =  0   ->  4.52        z = +6    ->  6.02
 *   z = +2   ->  5.02        z = +8    ->  6.52
 *
 * A single SAFE_X_MAX of 4.8 is too permissive across the whole front half of
 * the room and too strict across the whole back half. It read as measured
 * because at z 1.5 — where `adventure` happened to sit — the true limit is
 * 4.83, and landing within 0.03 of the truth at the one depth anyone would
 * check it against is a coincidence that is very hard to tell from rigour.
 *
 * SAFE_Z_MIN/SAFE_Z_MAX were not even coincidentally right. The real visible-Z
 * span depends on the object's X, because coming toward the camera magnifies
 * whatever sideways offset it already has: `animals` at x -1.6 is visible back
 * to z -7.25, while `adventure` at x 4.05 is cut off below z +0.60. One pair of
 * numbers cannot describe both. In +z nothing is ever clipped; the limit there
 * is the back wall.
 *
 * `playroom-toybox-framing.test.mjs` builds the toyboxes for real and projects
 * their real bounds through the real camera at both aspect ratios. That asks
 * the question directly instead of consulting a copied-down answer.
 */

// ── Bookshelf ───────────────────────────────────────────────────────────────

export const BOOKSHELF_CENTER_X = 2.5;
export const BOOKSHELF_Z = 8.3;

/**
 * NOT HERE, DELIBERATELY: a second copy of where things are.
 *
 * This file used to also export TOYBOX_POSITIONS, TOYBOX_CLEARANCE,
 * WALL_ART_POSITIONS, RUG_CENTER, RUG_RADIUS, RUG_CLEAR_RADIUS,
 * RUG_BAND_THICKNESS, a WINDOW_X_MIN/WINDOW_X_MAX/WINDOW_Y_MIN/WINDOW_Y_MAX
 * exclusion zone, and FOREGROUND_Z_MAX / MIDGROUND_Z_MIN / MIDGROUND_Z_MAX /
 * BACKGROUND_Z_MIN depth bands. Nothing imported a single one of them. They
 * sat under a header calling this file the single source of truth for the
 * room's spatial zones, which is exactly why they were believable — and they
 * did not merely sit idle, they disagreed with the room:
 *
 *   TOYBOX_POSITIONS      4 entries, incl. `nature`  vs  PLAYROOM_TOYBOXES, 3 entries
 *   RUG_CENTER (0, 0, 2)                             vs  floor.ts builds the rug at the origin
 *   RUG_RADIUS 3.5                                   vs  RUG_DIAMETER / 2 = 3.8
 *   RUG_CLEAR_RADIUS 1.5  "owl and 1-2 props only"   vs  nothing, no prop consults it
 *   WALL_ART_POSITIONS    3 back-wall pictures       vs  wallArt.ts builds 1, plus a left-wall
 *                                                        cork board these coordinates never mention
 *   WINDOW_X/Y exclusion  "no wall art may overlap"  vs  nothing, no check exists
 *   depth bands           "midground is the rug"     vs  the rug spans -3.8..3.8 and crosses two of them
 *
 * The `nature` entry is the sharpest. It described a toybox that had already
 * been removed, and the same stale coordinate in a different hand-kept copy is
 * what left the kitty perching on empty air (see the comment in room.ts, which
 * was written about this defect while the copy that caused it stayed here).
 *
 * Positions are answered by the thing that builds the object: toyboxes by
 * `PLAYROOM_TOYBOXES`, the rug by `createFloor`, wall art by `createWallArt`.
 * Put dimensions here; do not write down a second copy of a placement.
 */
