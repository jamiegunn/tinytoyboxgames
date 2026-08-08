/**
 * How far a room is already turned when it opens, as a function of viewport
 * aspect.
 *
 * WHY THIS EXISTS AT ALL. The rooms open facing the back wall. That was the right
 * pose when the framing rule was "every exit on screen at rest"; the rule is now
 * "every exit REACHABLE BY TURNING", which is what let the letterbox go and gave a
 * phone back the 54% of its screen the bands were eating (see
 * `utils/scene/stageRect.ts`). Nothing looked wrong about the trade until
 * something had to be drawn ON an exit. Measured at rest on a 393x852 phone, the
 * destination toyboxes project to NDC x of
 *
 *     Playroom      -1.27  and  +1.10
 *     Living Room   -1.59  and  +1.63
 *     Kitchen       -1.90
 *
 * where the frame ends at 1.0. So the tap invitation — a halo hung over each
 * toybox, whose entire job is to tell a child who cannot read where to put a
 * finger — was off screen in five cases out of five on the shape of screen this
 * app is designed around. A child who does not already know to drag never meets
 * one, and a three-year-old does not already know to drag.
 *
 * WHAT THIS IS NOT. It is not a second rotation limit, and it must never become
 * one. `rotationRange.ts` owns how far a room MAY be turned, measured from the
 * room's own axis; this owns where the camera is STANDING at the first frame.
 * Round one of the solve conflated them — it assumed offsetting the opening pose
 * also offsets the clamp window, so an exit that needed `r` of turn would need
 * `r + delta`, and on that assumption the Living Room came out over budget at
 * every portrait aspect below 0.78 and the whole idea died. The two are separate
 * facts and `createSceneCamera` keeps them in separate places: `clampSpherical`
 * measures from `preset.azimuth`, and only the INITIAL theta carries this offset.
 * With the window left where it was, every exit stays exactly as reachable as it
 * was before, and the only thing left to check is that the opening pose is itself
 * inside the window.
 *
 * HOW THE NUMBERS WERE FOUND, IN THREE ROUNDS, AND EACH ROUND CORRECTED THE ONE
 * BEFORE IT.
 *
 * ROUND ONE (`.probe/portrait-open-turn.mjs`) solved for the smallest turn either
 * way that puts one halo's whole disc inside the frame with a margin, subject to
 * the frame not seeing past a wall (`frameSeesPastWalls`, over the same polar
 * spread the shipped orbit uses), the frame not catching the ceiling — the
 * complaint that started all of this work — and the turn fitting inside
 * `resolveRotationRange`. Those minima broke two of `room-opening-framing`'s
 * composition bounds at the narrowest shipping aspect: the Playroom at 18.6%
 * objects against 20.0%, the Living Room at 46.8% bare floor against 46.0%.
 *
 * ROUND TWO (`.probe/portrait-turn-composition.mjs`) put both bounds in the
 * search as hard constraints, with a point of frame demanded on the right side of
 * each. Those bounds are the two claims the previous round of work EARNED — "this
 * room is made of things" and "this floor is dressed" — and a new feature crossing
 * them is not a reason to move them.
 *
 * ROUND THREE ADDED THE BOX ITSELF, and it is the round that produced the numbers
 * below. Rounds one and two asked only that the HALO be in frame, which a pose
 * satisfies with the ring clear of the edge and the toybox under it cut in half by
 * it. That is exactly what shipped: on a 393x852 frame the Kitchen's chest and the
 * Living Room's nature box both sat clipped against the left edge with a tidy ring
 * floating above them. A halo is a pointer, and a pointer at something half off
 * screen points at half a thing. So a candidate angle now also has to put the
 * box's bbox centre inside 0.85 NDC with at least 90% of its projected area on
 * screen.
 *
 * Trying the SHIPPED reachability rule first — 0.85 and 60%, the predicate
 * `room-opening-framing` and `.probe/joint-solve` use — changed almost nothing:
 * the Living Room and Kitchen schedules came back identical. That is the finding,
 * not a null result. Those boxes were already passing `tappable` at the
 * clipped-looking angles, because 0.85 of a half frame with 60% of the area
 * showing IS "jammed against the edge with a corner missing". The predicate was
 * never wrong; it answers "could a finger find this", and the question here is
 * "did the room open onto it". Going the other way, 90% area with the centre held
 * inside 0.55, was infeasible for the Kitchen across seven aspects. 0.85 and 90%
 * is the pair that holds everywhere.
 *
 * AND IT COST FIVE TOYBOXES THEIR PLACES, which is where most of the work went.
 * Solving this standard against the rooms as they stood wanted 37 to 38 degrees of
 * opening turn on a phone in the Living Room and the Kitchen — nearly three
 * frame-widths of crooked — and in the Kitchen, at x 3.1, there was NO ANGLE AT ALL
 * at any aspect from 0.60 to 0.90. A big turn is a symptom; the cause is that a
 * narrow portrait frame cannot contain something far off the room's axis without
 * being aimed almost straight at it. So the boxes came in:
 *
 *     Kitchen       3.1  ->  2.6  ->  1.69      38.3° of turn  ->  26.4°
 *     Living Room  ±2.7        ->   ±1.76       37.4°          ->  25.9°
 *
 * and both rooms went from 5.2 degrees of clamp slack to the full 12. Three floor
 * toys in the Kitchen and a block basket in the Living Room moved out of the new
 * footprints; each layout carries the sweep its position was chosen from
 * (`.probe/toybox-inboard-sweep.mjs`, `.probe/kitchen-toybox-inboard.mjs`). The
 * Playroom's boxes did not move: its worst turn was already 14 degrees, and the
 * only room further in is on top of its train track.
 *
 * SHRINKING THE BOXES WAS TRIED FIRST AND IS NOT IN HERE. At scale 0.6 instead of
 * 0.75 the mid-range turns dropped, the NARROWEST aspects got worse — the Playroom
 * from 14.2° to 25.9° at 0.40 — and every room's bare-floor share went up, because
 * a smaller box covers less floor. The halo is clamped to a maximum diameter, so
 * shrinking the box makes the ring relatively larger and its own frame margin
 * starts binding instead. Position is the lever; size is not.
 *
 * The shipped schedule, in degrees:
 *
 *     aspect      0.40   0.45   0.46   0.50   0.60   0.65   0.70   0.75   crossover
 *     Playroom    14.2   12.4   12.1    6.2    2.5    0.9      -      -   0.675
 *     Living Rm   25.9   22.7   22.0   19.3   12.6    9.2    5.7    2.3   0.765
 *     Kitchen     26.4   22.7   22.0   19.0   11.7    8.0    4.1    0.2   0.755
 *
 * THERE IS A ROW AT 0.45 BECAUSE A DEVICE IS. 412x915 is aspect 0.4503, and an
 * earlier table with rows only at 0.43 and 0.46 interpolated to 8.1° there, which
 * put 19.3% of the Playroom's frame on objects against a 20.0% bound. Every
 * portrait row now sits on or just below a shipping aspect instead of on round
 * numbers between them.
 *
 * THE LAST NON-ZERO VALUE IS HELD, NOT RAMPED, and that is the one place the
 * table is not a straight read of the solve. Interpolating the final segment down
 * to zero undershoots: for the Living Room the solve wants 2.8 degrees at aspect
 * 1.01, and a ramp from 3.2 at 1.00 to 0 at 1.05 supplies 2.6. So each table
 * repeats its last non-zero value at the aspect just below the crossover and drops
 * to zero there — 0.016 held to 0.67, 0.04 held to 0.76. The Kitchen gets no hold:
 * its last solved value is 0.2 of a degree and its crossover is five thousandths
 * of an aspect away, so the ramp cannot undershoot by anything that exists. The
 * crossovers themselves are measured, not guessed: an earlier version held to
 * round numbers past the real crossover and put a turn at aspects where the room
 * was already opening onto a framed box, which the "no gratuitous row" test
 * correctly rejected. `.probe/turn-crossover.mjs` sweeps for them.
 * Inside that band the room turns slightly further than it strictly needs to,
 * which composition has ten points of slack for at those aspects, and the
 * alternative was a ramp that quietly stops working a hundredth of an aspect past
 * its last solved row.
 *
 * THE MARGIN IS IN THE COMPOSITION CONSTRAINT, NOT IN THE ANGLE, and the
 * distinction matters because the two pull opposite ways. Padding the ANGLE would
 * buy safety against interpolation error on the halo side and spend it on the
 * composition side, where the bounds must not move; padding the COMPOSITION TEST
 * buys safety on both, because every angle that survives it shows a halo and a
 * framed box by construction. So each value is the smallest turn that satisfies
 * all of it with a point of frame to spare, and nothing is added afterwards. The
 * framing side is guarded by sampling instead: rows sit at most 0.05 of aspect
 * apart and on or just below every shipping aspect, and
 * `tests/room/opening-turn.test.mjs` re-derives the halo, the box framing and
 * frame-cleanliness on a grid ten times finer than the rows.
 *
 * WHY ONE EXIT AND NOT ALL OF THEM. In both two-exit rooms the exits sit on
 * opposite sides of the opening axis, so any turn that brings one in pushes the
 * other further out. No angle shows both, and a child needs to find A box, not
 * every box. The far box stays reachable by dragging, which is what the clamp
 * window was preserved for.
 */

import type { SceneId } from '@app/types/scenes';

/**
 * Opening turn in radians, as `[aspect, radians]` pairs in ascending aspect.
 *
 * Signed, and one sign per room throughout: positive and negative turn the room
 * opposite ways, and a table that changed its mind between two adjacent aspects
 * would interpolate through zero on the way. See the header for the one room
 * where holding to a single direction cost something.
 */
export const OPENING_TURN: Readonly<Record<string, readonly (readonly [aspect: number, turn: number])[]>> = {
  playroom: [
    [0.4, 0.248],
    [0.45, 0.216],
    [0.46, 0.212],
    [0.5, 0.108],
    [0.55, 0.076],
    [0.56, 0.068],
    [0.6, 0.044],
    [0.65, 0.016],
    [0.67, 0.016],
    [0.675, 0.0],
  ],
  'living-room': [
    [0.4, 0.452],
    [0.45, 0.396],
    [0.46, 0.384],
    [0.5, 0.336],
    [0.55, 0.276],
    [0.56, 0.264],
    [0.6, 0.22],
    [0.65, 0.16],
    [0.7, 0.1],
    [0.75, 0.04],
    [0.76, 0.04],
    [0.765, 0.0],
  ],
  kitchen: [
    [0.4, 0.46],
    [0.45, 0.396],
    [0.46, 0.384],
    [0.5, 0.332],
    [0.55, 0.268],
    [0.56, 0.256],
    [0.6, 0.204],
    [0.65, 0.14],
    [0.7, 0.072],
    // The ramp used to run to [0.75, 0.004] with a 0.755 terminator. The
    // Baseball Park toybox (deep by the left cabinets, x 3.5 z 4.6) projects
    // wholly into the resting frame at 0.75, so the Kitchen now shows a halo
    // at rest there and a row that still turned it — however slightly — was
    // exactly the gratuitous turn opening-turn.test.mjs claim 4 exists to
    // catch. The ramp ends at 0.75 instead.
    [0.75, 0.0],
  ],
};

/**
 * The opening turn for a scene at a viewport aspect.
 *
 * Linear between table rows, held at the first row below the table and zero above
 * it. A scene with no entry gets zero — every immersive scene and every generated
 * room opens on its axis, which is what they did before this module existed, and
 * a scene that wants a turn has to earn one through the probe.
 *
 * FAILS TO ZERO, not to the widest entry, for a non-finite aspect. A zero-sized
 * canvas during layout produces `NaN`, and the safe answer to "how crooked should
 * this room open" when the answer is unknown is "not at all". `rotationRange`
 * fails to its TIGHTEST value for the same reason: in both cases the safe
 * direction is toward the pose that was already known to be legal.
 *
 * @param aspect - Viewport width divided by height.
 * @param sceneId - The scene being opened; scenes with no table get zero.
 * @returns The signed opening turn in radians, to be added to the preset azimuth.
 */
export function resolveOpeningTurn(aspect: number, sceneId?: SceneId | string): number {
  if (sceneId === undefined) return 0;
  const table = OPENING_TURN[sceneId];
  if (table === undefined || table.length === 0) return 0;
  if (!Number.isFinite(aspect)) return 0;
  const first = table[0];
  const last = table[table.length - 1];
  if (aspect <= first[0]) return first[1];
  if (aspect >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [a1, t1] = table[i];
    if (aspect > a1) continue;
    const [a0, t0] = table[i - 1];
    return t0 + ((t1 - t0) * (aspect - a0)) / (a1 - a0);
  }
  return last[1];
}
