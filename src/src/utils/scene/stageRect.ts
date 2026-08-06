/**
 * How much of the viewport the 3D stage takes. On every real device: all of it.
 *
 * WHAT THIS USED TO DO, AND WHY IT WAS WRONG
 * ------------------------------------------
 * The band was [1.0, 1.4]. A phone is 0.46, so the scene was cropped to a square
 * across the top and the remaining 54% of the screen was painted brown and given
 * three buttons. That is more than half a child's screen showing no toys, and
 * "the picturebox sucks for ux" is the correct reading of it.
 *
 * The band existed to hold ONE rule: every way out of a room must be on screen
 * without the player moving. Four toyboxes and a doorway only fit a frame at
 * once if the frame is nearly as wide as it is tall, so the frame was made
 * nearly square and the screen cropped to match.
 *
 * `.probe/narrow-binding.mjs` measured which constraints actually move with
 * aspect. Sweeping 392,040 candidate poses at each of eight aspects from 0.40 to
 * 1.00, the survivor counts after the void test and the ceiling test are
 * IDENTICAL at every one of them — 276,996 and 126,603, to the pose. The camera's
 * field of view is vertical and fixed, so what escapes the top or bottom of the
 * shell does not care how wide the window is. Only "the exits are on screen"
 * moves, and it moves as exactly 1/aspect: the playroom's worst exit sits at 0.70
 * NDC at aspect 1.00, 0.98 at 0.70 and 1.71 at 0.40.
 *
 * So the letterbox was never a fact about rooms. It was the price of that one
 * rule. `.probe/joint-solve.mjs` relaxes it from "on screen" to "reachable by
 * turning" and finds 27,679 playroom poses, 2,965 kitchen poses and 4,132 living
 * room poses that hold at EVERY aspect from 0.40 to 2.60 with no void, no
 * ceiling, and every exit within a turn the room can safely make. The turn
 * carries what the crop used to. See `ROTATION_BUDGET` in `scene/rotationRange.ts`,
 * which is solved jointly with this band and not independently of it.
 *
 * WHAT THE BAND IS FOR NOW
 * ------------------------
 * A backstop, not a layout. Every phone, tablet and laptop is inside [0.4, 2.6]
 * in BOTH orientations, so on real hardware the stage is the whole viewport and
 * there is no chrome band at all. Outside it — a desktop window dragged to a
 * column, a 32:9 monitor — the stage letterboxes to the nearest edge, because
 * past the edges the measurements above stop holding.
 *
 * 2.6 IS A PHONE ON ITS SIDE, AND IT COST A RE-SOLVE. The first pass ran the
 * solver to 2.00 on the reasoning that no laptop is wider. A 393x852 handset
 * turned sideways is 2.168, and a tall Android is 2.5 — every phone in landscape
 * was outside the band and getting pillarboxed. Re-running the solve to 2.60
 * changed which poses qualify: the kitchen dropped from 6,975 clean poses to
 * 2,965 and moved its camera, because a wide frame runs out of side wall first
 * and this is the narrowest room. The band was widened by moving the cameras that
 * could not survive it, not by asserting that they could.
 *
 * WHY THE STAGE SITS AT THE TOP WHEN THERE IS A BAND
 * --------------------------------------------------
 * The chrome band goes below the scene, not above it and not split around it. A
 * three-year-old holds a tablet low and reaches with a thumb; controls at the
 * bottom are the ones they can hit. Splitting the band would also mean the scene
 * never sits still as the keyboard or a browser bar changes the height.
 */

/**
 * The narrowest aspect the scene is ever rendered at.
 *
 * Below this the viewport is letterboxed: full width, height capped, and the
 * remainder becomes the chrome band. No phone reaches it — the tallest shipping
 * handsets are around 0.40 and a 393x852 device is 0.461 — so in practice this
 * only fires for a desktop window dragged into a column.
 */
export const MIN_STAGE_ASPECT = 0.4;

/**
 * The widest aspect the scene is ever rendered at.
 *
 * Above this the viewport is pillarboxed. Set by the widest device a child holds
 * — a tall Android on its side is 2.5 — and by what the sets can still take
 * there: the tightest of the three rooms turns ±9.8° at 2.60, against ±19.6° at
 * 2.00, so this is close to where a wide frame stops having a turn worth having.
 * A 32:9 monitor gets a pillarbox; nothing a child holds does.
 */
export const MAX_STAGE_ASPECT = 2.6;

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
