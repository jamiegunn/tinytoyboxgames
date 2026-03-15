import { Vector3 } from 'three';

// ── Playroom Layout Constants ───────────────────────────────────────────────
// Single source of truth for spatial zones in the playroom.
// All playroom modules should reference these instead of scattering literal coords.
// Changing a value here cascades to every wall, trim, floor, ceiling, and decor module.

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
export const BASEBOARD_INSET = 0.05;
export const CROWN_INSET = 0.03;
export const CHAIR_RAIL_INSET = 0.06;

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

export const DECAL_LAYER_1 = 0.03; // clouds, base-star stickers
export const DECAL_LAYER_2 = 0.05; // stars, moon

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

/** Rug band ring thickness (torus tube). */
export const RUG_BAND_THICKNESS = 0.2;

/** Rug band diameters (outer to inner). */
export const RUG_BAND_DIAMETERS = [7.4, 6.8, 6.2, 5.6, 5.0, 4.4, 3.6] as const;

/** Rug centre position. */
export const RUG_CENTER = new Vector3(0, 0, 2.0);

/** Layout radius for prop clearance around rug centre. */
export const RUG_RADIUS = 3.5;

/** Owl and at most 1–2 small props only inside this radius. */
export const RUG_CLEAR_RADIUS = 1.5;

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

// ── Viewport-safe content box ───────────────────────────────────────────────
// Objects inside this box will not be clipped on portrait (9:16) or landscape (16:9).

export const SAFE_X_MIN = -4.8;
export const SAFE_X_MAX = 4.8;
export const SAFE_Z_MIN = -4.5;
export const SAFE_Z_MAX = 8.0;

// ── Window exclusion zone ───────────────────────────────────────────────────
// No wall art, banners, or shelf elements should overlap this region.

export const WINDOW_X_MIN = -4.8;
export const WINDOW_X_MAX = -1.2;
export const WINDOW_Y_MIN = wallY(0.28);
export const WINDOW_Y_MAX = wallY(0.64);

// ── Toybox ring ─────────────────────────────────────────────────────────────
// Toybox positions pulled inward from original values for portrait safety.

export const TOYBOX_POSITIONS = {
  adventure: { pos: new Vector3(5.25, 0.01, 1.5), rot: -Math.PI / 2 },
  animals: { pos: new Vector3(-1.6, 0.01, -6.5), rot: -0.15 },
  creative: { pos: new Vector3(-2.8, 0.01, 8.25), rot: Math.PI },
  nature: { pos: new Vector3(3.67, 0.01, -6.88), rot: Math.PI + Math.PI / 4 },
} as const;

/** Minimum distance from a toybox centre that floor props should maintain. */
export const TOYBOX_CLEARANCE = 1.8;

// ── Wall art positions ──────────────────────────────────────────────────────
// Placed to avoid window exclusion zone. Left picture moved rightward.

export const WALL_ART_POSITIONS = {
  left: new Vector3(-0.5, wallY(0.44), BACK_WALL_FACE_Z + CROWN_INSET),
  center: new Vector3(2.5, wallY(0.48), BACK_WALL_FACE_Z + CROWN_INSET),
  right: new Vector3(5.0, wallY(0.4), BACK_WALL_FACE_Z + CROWN_INSET),
} as const;

// ── Bookshelf ───────────────────────────────────────────────────────────────

export const BOOKSHELF_CENTER_X = 2.5;
export const BOOKSHELF_Z = 8.3;

// ── Floor prop zones ────────────────────────────────────────────────────────
// Three bands for depth layering.

/** Foreground: Z < -2, scattered toys in front of the toybox ring. */
export const FOREGROUND_Z_MAX = -2.0;

/** Midground: -2 ≤ Z ≤ 5, the rug play area. */
export const MIDGROUND_Z_MIN = -2.0;
export const MIDGROUND_Z_MAX = 5.0;

/** Background: Z > 5, near the back wall. */
export const BACKGROUND_Z_MIN = 5.0;
