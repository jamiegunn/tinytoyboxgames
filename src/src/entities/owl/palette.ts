import { Color } from 'three';

// ── Colour palette — simplified realistic screech owl ───────────────────────
// Twelve core tokens. Each pair has enough value contrast for mobile readability.

/** Rich chocolate brown — crown, nape, upper head, back, body ground. */
export const COL_CROWN = new Color(0.36, 0.2, 0.08);

/** Bright warm cream — facial disc ground colour. High value for face readability. */
export const COL_FACIAL_DISC = new Color(0.96, 0.92, 0.84);

/** Dark umber — eye sockets, facial disc rim, shadow accents. */
export const COL_FACE_SHADOW = new Color(0.18, 0.1, 0.05);

/** Pale warm cream — breast and chest front. Near-white for maximum contrast. */
export const COL_CHEST_BUFF = new Color(0.95, 0.9, 0.8);

/** Dark brown — primary flight feathers, wing leading edge. */
export const COL_WING_DARK = new Color(0.34, 0.2, 0.08);

/** Mid tawny — wing coverts, secondary feathers, flanks, shoulder. */
export const COL_WING_TAWNY = new Color(0.52, 0.34, 0.16);

/** Dark brown — tail feathers. */
export const COL_TAIL_DARK = new Color(0.3, 0.18, 0.08);

/** Warm golden-orange — beak keratin. Visible against the pale facial disc. */
export const COL_BEAK = new Color(0.85, 0.6, 0.15);

/** Warm gray-brown — talon and toe keratin. */
export const COL_TALON = new Color(0.55, 0.48, 0.4);

/** Saturated warm amber — iris colour, large and vivid for readability. */
export const COL_IRIS = new Color(0.95, 0.72, 0.05);

/** Near-black — pupil. */
export const COL_PUPIL = new Color(0.05, 0.03, 0.02);

/** Pure white — eye catch-light highlight. */
export const COL_HIGHLIGHT = new Color(1, 1, 1);

// ── Anatomy constants ────────────────────────────────────────────────────────

/** Vertical centre of the head relative to root origin. */
export const HEAD_Y = 1.22;

/** Height of visible leg shank below the body. */
export const LEG_HEIGHT = 0.24;

/** Resting fold angle for each wing (radians from vertical). */
export const WING_REST_ANGLE = 0.08;

// ── Animation constants ──────────────────────────────────────────────────────

/** Root Y rotation so the owl faces the default camera. */
export const FACING_CAMERA_Y = Math.PI;

/** Duration (ms) for the upper lid to close during a blink. */
export const BLINK_CLOSE_MS = 140;

/** Duration (ms) for the upper lid to open after a blink. */
export const BLINK_OPEN_MS = 190;

/** Frame count for one full breathing cycle at 60 fps. */
export const BREATH_RATE = 55;

/** Peak height of the flight arc above the higher endpoint. */
export const FLY_ARC_HEIGHT = 2.5;

/** Animation playback rate (frames per second). */
export const FLY_SPEED_FPS = 60;

/** Frames per wing-flap half-cycle during flight. */
export const WING_FLAP_RATE = 10;
