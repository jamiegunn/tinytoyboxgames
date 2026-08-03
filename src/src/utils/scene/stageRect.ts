/**
 * How much of the viewport the 3D stage takes, and why it is not all of it.
 *
 * THE DEFECT
 * ----------
 * The canvas used to fill the window, so the camera saw whatever aspect the
 * device had — down to 0.40 on a tall phone. The scene sets are landscape
 * shaped: a room is 12 units wide and 6.75 tall. There is no camera pose that
 * fills a 0.40 frame with a 1.8-shaped set. Something has to give, and what gave
 * was the set: the camera was pulled back until the frame ran off the edge of
 * the floor and the child saw sky below their own feet, with the room a small
 * island in the middle of it. "It just makes the entire scene smaller" is the
 * exact description of that.
 *
 * THE RULE
 * --------
 * The stage keeps an aspect inside [{@link MIN_STAGE_ASPECT},
 * {@link MAX_STAGE_ASPECT}]. Outside that band the leftover viewport is not
 * scene at all — it is chrome, and the UI lives there. So the scene is never
 * asked to fill a shape it cannot fill, and the camera only ever sees aspects
 * the framings were solved for.
 *
 * WHERE THE NUMBERS COME FROM
 * ---------------------------
 * Both are solved, not chosen. `.probe/room-pose-final.mjs` sweeps every opening
 * pose for all three rooms and asks, at each candidate band, whether a pose
 * exists that (a) puts every tappable prop's bounding box inside the frame and
 * (b) never shows a corner of the frame off the set — at every tilt the player
 * can reach and at both ends of the rotation clamp. The band is the tightest one
 * where all three rooms still have such a pose with rotation left over:
 *
 *                       playroom     kitchen      living-room
 *     floor 0.85        ±24.8°       ±0.3°        NO POSE AT ALL
 *     floor 1.00        ±30.7°       ±23.0°       ±12.0°
 *
 *     ceiling 1.78      ±31.5°       ±18.8°       ±7.8°
 *     ceiling 1.40      ±30.7°       ±23.0°       ±12.0°
 *
 * A wider ceiling costs rotation rather than buying it, which is not obvious
 * until it is measured: a wider frame reaches further round the room, so it
 * meets the end of a side wall at a smaller turn.
 *
 * The living room binds both ends, and for the same reason in both: its two
 * toyboxes — the exits to Nature and Pirate Cove — stand hard against the side
 * walls, so the frame has to be wide enough to contain the walls themselves.
 * Moving them inboard is the one change that would loosen this band, and it is
 * set dressing rather than code. See `SHARED_ROTATION_RANGE` in
 * `scene/rotationRange.ts`, which is solved jointly with these two constants and
 * not independently of them.
 *
 * WHY THE STAGE SITS AT THE TOP IN PORTRAIT
 * -----------------------------------------
 * The chrome band goes below the scene, not above it and not split around it. A
 * three-year-old holds a tablet low and reaches with a thumb; controls at the
 * bottom are the ones they can hit. Splitting the band would also mean the scene
 * never sits still as the keyboard or a browser bar changes the height.
 */

/**
 * The narrowest aspect the scene is ever rendered at.
 *
 * Below this the viewport is letterboxed: full width, height capped, and the
 * remainder becomes the chrome band.
 */
export const MIN_STAGE_ASPECT = 1.0;

/**
 * The widest aspect the scene is ever rendered at.
 *
 * Above this the viewport is pillarboxed. This is not symmetry for its own sake:
 * a wider frame reaches further round the room before it passes the end of a
 * side wall, so an uncapped desktop window costs rotation everywhere — the
 * living room drops from ±12.0° to ±7.8° between 1.4 and 1.78.
 */
export const MAX_STAGE_ASPECT = 1.4;

/**
 * The smallest a chrome band is allowed to be, in CSS pixels.
 *
 * A band exists to hold the HUD, and the HUD's controls have a floor of their
 * own (`MIN_CONTROL` in `components/UIOverlay.tsx`) because a three-year-old
 * aims worse than the adult every touch-target guideline is written for. A band
 * thinner than a control is worse than no band: the buttons overflow it and sit
 * back on top of the scene, which is the arrangement letterboxing exists to end.
 *
 * This is the control floor plus the padding either side of it. It was found by
 * mutation: dropping `MIN_CONTROL` from 56 to 24 changed nothing, because every
 * viewport the tests used had a band far larger than either number. A viewport
 * at 400x420 is a 20px band.
 */
export const MIN_CHROME_BAND = 76;

/** The rectangle the canvas occupies inside the viewport, in CSS pixels. */
export interface StageRect {
  /** Stage width. */
  width: number;
  /** Stage height. */
  height: number;
  /** Distance from the viewport's left edge. */
  offsetX: number;
  /** Distance from the viewport's top edge. */
  offsetY: number;
}

/**
 * The stage rectangle for a viewport.
 *
 * THE ASPECT INVARIANT COMES FIRST. Every framing in the app is solved for an
 * aspect inside the band, so the stage aspect is clamped into it before anything
 * else is considered — there is no viewport, however odd, for which this returns
 * a shape the camera was not solved for. An earlier version had an escape hatch
 * for tiny viewports and it broke exactly that: a 200x67 window came back at
 * 2.99.
 *
 * WITHIN that constraint the stage gives up as much as it can to leave the
 * chrome band its floor. Usually it can give up all of it and still sit at the
 * band edge. On a very small viewport it cannot, and the stage stops at the far
 * edge of the band with a thinner band than the HUD would like — `UIOverlay`
 * handles that by floating over the stage instead, which is the same thing it
 * does when there is no band at all.
 *
 * Degenerate viewports (zero or negative in either dimension) return a zero
 * rect rather than a NaN one — a renderer handed NaN throws deep inside WebGL
 * with no indication of where it came from, and a browser really does report a
 * zero height for a frame or two during an orientation change.
 *
 * @param viewportWidth - Available width in CSS pixels.
 * @param viewportHeight - Available height in CSS pixels.
 * @returns The stage size and its offset inside the viewport.
 */
export function resolveStageRect(viewportWidth: number, viewportHeight: number): StageRect {
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);
  const aspect = viewportWidth / viewportHeight;

  if (aspect < MIN_STAGE_ASPECT) {
    // Too narrow: keep the width, cut the height, chrome below. The height that
    // would leave the band its floor, clamped so the aspect stays in the band —
    // a SHORTER stage is a WIDER one, so the band's floor pushes toward the
    // ceiling and the clamp's upper argument is what stops it going past.
    const height = clamp(viewportHeight - MIN_CHROME_BAND, viewportWidth / MAX_STAGE_ASPECT, viewportWidth / MIN_STAGE_ASPECT);
    return { width: viewportWidth, height, offsetX: 0, offsetY: 0 };
  }

  if (aspect > MAX_STAGE_ASPECT) {
    // Too wide: keep the height, cut the width, chrome either side. Two bands,
    // so the floor is charged twice.
    const width = clamp(viewportWidth - 2 * MIN_CHROME_BAND, viewportHeight * MIN_STAGE_ASPECT, viewportHeight * MAX_STAGE_ASPECT);
    return { width, height: viewportHeight, offsetX: (viewportWidth - width) / 2, offsetY: 0 };
  }

  return { width: viewportWidth, height: viewportHeight, offsetX: 0, offsetY: 0 };
}

/**
 * The aspect the camera is given for a viewport.
 *
 * Always inside the band, which is the property every framing solve depends on.
 * Callers that already have a {@link StageRect} should divide it themselves;
 * this exists for tests and for camera code that has no rect in hand.
 *
 * @param viewportWidth - Available width in CSS pixels.
 * @param viewportHeight - Available height in CSS pixels.
 * @returns The stage aspect ratio, clamped to the band. Zero for a degenerate viewport.
 */
export function stageAspectFor(viewportWidth: number, viewportHeight: number): number {
  const rect = resolveStageRect(viewportWidth, viewportHeight);
  return rect.height > 0 ? rect.width / rect.height : 0;
}

/**
 * The chrome band left over after the stage, in CSS pixels.
 *
 * One of the two is always zero: a viewport is either too narrow or too wide,
 * never both. Returned as a pair anyway so the overlay can lay itself out from
 * one call instead of re-deriving which case it is in.
 *
 * @param viewportWidth - Available width in CSS pixels.
 * @param viewportHeight - Available height in CSS pixels.
 * @returns Height of the band below the stage, and width of each band beside it.
 */
export function resolveChromeBand(viewportWidth: number, viewportHeight: number): { below: number; beside: number } {
  const rect = resolveStageRect(viewportWidth, viewportHeight);
  return {
    below: Math.max(0, viewportHeight - rect.height),
    beside: Math.max(0, rect.offsetX),
  };
}
