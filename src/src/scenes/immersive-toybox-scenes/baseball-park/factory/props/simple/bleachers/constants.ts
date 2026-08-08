/**
 * Dimensions for the bleacher banks.
 *
 * A bank is three stepped rows facing local -Z (the field once staged), each
 * carrying a plastic seat board, with a pennant pole at one end.
 */

/** Row footprint: width along the bank, rise per step, and tread depth. */
export const ROW_WIDTH = 3.0;
export const STEP_RISE = 0.28;
export const STEP_DEPTH = 0.5;

/** Number of stepped rows per bank. */
export const ROW_COUNT = 3;

/** Seat board thickness sitting on each step. */
export const SEAT_THICKNESS = 0.05;

/** Pennant pole and flag. */
export const POLE_RADIUS = 0.05;
export const POLE_HEIGHT = 1.9;
export const FLAG_WIDTH = 0.42;
export const FLAG_HEIGHT = 0.2;
export const FLAG_THICKNESS = 0.03;
