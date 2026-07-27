/**
 * Placement for the rail stowage — the only furniture in this scene that is
 * allowed to stand outboard of the narrowest shipping frame.
 *
 * THE CHARGE: A LOWEST-COMMON-DENOMINATOR LAYOUT
 * ----------------------------------------------
 * Every other staging file here was solved against three rules (see
 * `shipWheel.ts`): ON DECK, IN FRAME, CLEAR. IN FRAME was applied to every prop
 * at all nine shipping aspects at once, which makes the layout the INTERSECTION
 * of nine framings — and `.probe/pc-aspect-binding.mjs` measured that the
 * intersection IS the narrowest framing, binding 6 stations out of 6:
 *
 *   widest |x| each aspect alone would allow, by station
 *   aspect                  z=-5   z=-3   z=-1   z= 1   z= 3
 *   landscape 1280x720      5.56   7.14   8.00   8.00   8.00
 *   extreme 360x900         0.96   1.32   1.67   2.03   2.38
 *   ALL NINE (what shipped) 0.96   1.32   1.67   2.03   2.38
 *
 * Landscape surrendered 75% of its own usable width so one 360x900 phone could
 * see the same props without panning. `.probe/pc-deck-composition.mjs` measured
 * the cost: deck coverage falls monotonically as the viewport widens — 48.8% of
 * visible deck furnished at aspect 0.40, 21.5% at 1.78 — leaving a bare column of
 * planking 30% of the frame width on landscape and 35% on tablet. vision.md asks
 * for "scene composition intentional at all breakpoints"; it was intentional at
 * exactly one, and the rest merely fit.
 *
 * THREE FIXES WERE PROPOSED. TWO WERE KILLED BY MEASUREMENT, AND SO WAS THE
 * FIRST DRAFT OF THE THIRD.
 * ------------------------------------------------------------------------
 * (1) Close the camera in on wide screens (`.probe/pc-frame-budget.mjs`): DEAD.
 * The frame is HEIGHT-limited at all nine aspects, with an identical worst
 * |ndc.y| of 0.911 set by the mast top — identical because a PerspectiveCamera
 * holds VERTICAL fov fixed and varies HORIZONTAL fov with aspect, so vertical
 * framing is aspect-invariant by construction. Distance is a scalar and shrinks
 * both axes together, so the axis with 83% slack is held hostage by the axis with
 * 9%. The whole available push-in is 10.2% and buys landscape 6% relative
 * coverage. Round 2 was right to delete it from `distanceMultiplierForAspect`.
 *
 * (2) Spread the existing props outboard per aspect (`.probe/pc-spread-sim.mjs`):
 * DEAD. Coverage is AREA and translation preserves area — landscape went 4.0% to
 * 4.0%. It also broke CLEAR (a barrel slid into the cannon) and moved props on
 * every real phone, since the reference aspect 0.40 is no shipping device.
 *
 * (3) Add discrete scenery — barrels and rope coils — on the bare outboard
 * quarters. This was drafted, staged, and then KILLED by its own test, which is
 * the useful part of the story:
 *
 *   Viewport aspect is CONTINUOUS. A prop wholly in frame at 1.78 and wholly out
 *   at 0.40 must, by the intermediate value theorem, pass through every state
 *   between them — including "sliced by the frame edge". So there is no staging of
 *   a compact prop outboard of the narrowest frame that avoids being clipped;
 *   only a staging that hides the clip at nine sampled aspects, which is tuning to
 *   the test rather than fixing the scene. `.probe/pc-sliver-band.mjs` measured
 *   the draft over a 601-point continuous sweep: the shipped scene shows an
 *   unreadable sliver over 0.0% of the aspect range, the six added barrels and
 *   coils over 43.3%.
 *
 * WHAT THAT PROVED, AND THE RULE IT YIELDS
 * ----------------------------------------
 * The old layout was not merely timid. Keeping everything inside the narrowest
 * frame was buying something real — no object is ever cut by the screen edge —
 * and any outboard furniture spends it. So the question is not "may furniture be
 * clipped" but "what kind of thing survives being clipped".
 *
 * The scene already answers that, and the answer was in front of me the whole
 * time: the side rails and the deck plank seams run off the edge of the frame at
 * every single aspect, and nobody has ever called that a defect. They survive the
 * cut because they are SELF-SIMILAR along their length — any run of rail still
 * reads as rail. A barrel is not: cut a barrel and you get an unidentifiable
 * strip of brown hugging the screen edge.
 *
 *   ELONGATED, SELF-SIMILAR elements may stand outboard of the narrowest frame,
 *   because the edge shortens them instead of mutilating them.
 *
 *   COMPACT, SINGULAR objects may not, and neither may anything REACHABLE. A
 *   tappable prop a phone cannot reach is an interaction that does not exist for
 *   that player; every existing prop stays exactly where it is.
 *
 * THE FIX
 * -------
 * Spare spars, chocked and lashed along the inboard face of each side rail —
 * which is where a ship stows spare spars, and is the same idiom `barrels.ts`
 * already argues for: stores stand where they were landed. Each run is 6 units
 * long and about 0.84 wide, an elongation of roughly 7 : 1, and it is built from
 * `hullHalfWidthAt` so it follows the rail rather than restating it.
 *
 * WHAT THE FIX ACTUALLY DOES, WHICH IS NOT WHAT THIS FILE FIRST CLAIMED
 * --------------------------------------------------------------------
 * The first version of this note claimed a run "is cut by the frame edge on
 * narrow screens exactly as the rail beside it is cut". That is false, and it
 * was measured false. Three silhouette metrics were built to test it and they
 * contradicted each other:
 *
 *   visible AREA fraction   condemned the ship's OWN side rails (out of band over
 *                           44.4% of the aspect range) worse than the spars (23.5%)
 *                           and far worse than a forbidden barrel (5.0%).
 *   spanFill                condemned the spars: worst 3.4% against the rails' 98.1%.
 *   residue size            reversed the ranking again — the spars' residue is
 *                           3.6-4.8% of the frame, four times any forbidden prop's.
 *
 * The question all three were proxying for — "does a clipped prop still read?" —
 * is about pixels, so `.probe/render/diff.mjs` renders the real frame through the
 * real renderer with each subject shown and hidden and counts the pixels that
 * change. Percent of frame the subject actually paints:
 *
 *   aspect            1.778  1.333  1.000  0.750  0.562  0.461  0.450  0.400
 *   spare spars        4.42   5.45   4.11   2.40   0.29      0      0      0
 *   ship's own rail    4.64   5.84   5.21   4.51   4.04   3.26   3.08   2.71
 *   forbidden barrel   0.47   0.63   0.83   0.13      0      0      0      0
 *
 * So the truth is milder and better than the claim. The spars do not behave like
 * the rail — the rail is anchored inside the narrowest frame and is therefore cut
 * MID-RUN at every aspect, while the spars stand wholly outboard of it and are
 * cut at the TIP. What they do instead is DECAY MONOTONICALLY. Measured as
 * painted pixels on a fixed-height frame, which is the quantity that answers
 * "does a narrower screen show less of it" (the percentages above cannot: the
 * frame is shrinking too, which is why 1.778 reads lower than 1.333):
 *
 *   aspect     1.778   1.333   1.000   0.750   0.562   0.461  0.450  0.400
 *   spar px  100 203  98 919  58 815  22 191   1 435       0      0      0
 *
 * They pay landscape back 4.42% of its frame — within 5% of what a whole side
 * rail contributes there — thin as the frame narrows, and are gone by aspect
 * 0.461. At the one aspect where a fragment survives (0.562) it paints 0.29% of
 * the frame: a rounded spar end at the rail, smaller than the barrel the rule
 * forbids is at its own best, and smaller than the rail's own 4.04% there.
 *
 * AND ONE MORE CORRECTION, BECAUSE THE FIRST ONE OVERSOLD ITS REPLACEMENT
 * ----------------------------------------------------------------------
 * The paragraph above used to end by calling monotone decay "the property this
 * staging actually has, and the one the test asserts". Half of that is false too.
 *
 * Monotone decay is not a property of THIS staging. It is a property of EVERY
 * staging. Painted pixels are the area of a fixed pixel-space hull clipped to a
 * frame whose only aspect-dependent term is its half-width, so narrowing the
 * viewport can never add area — for spars, for barrels, for anything.
 * `.probe/pc-monotone-tautology.mjs` failed to break it over 400 random stowage
 * runs and 200 random barrels, and three mutations of this file never turned
 * that clause red. A test that cannot fail is not evidence, and the suite now
 * says so where it makes the assertion.
 *
 * What the staging does have to earn, and what mutation testing does kill, is
 * narrower: it is ELONGATED where a forbidden prop is compact (7.2 : 1 against
 * 1.0 : 1), it is GONE by the narrowest shipping aspect rather than lingering as
 * a fragment (dragging it inboard leaves 43 060 px at 360x900 and goes red), and
 * it PAYS FOR ITSELF on the wide viewports it was added for. Those are the
 * claims; the render table above is why they are believed.
 *
 * The proxies were not wrong to be suspicious. They were wrong about which way,
 * none of them could have been trusted without the render — and the metric that
 * replaced them still had to be checked for whether it could fail at all.
 */

import type { RailStowageRun } from '../factory/props/simple/railStowage/create';

/**
 * The two stowage runs, port and starboard.
 *
 * The stretch z -6.5 to -0.5 is where `.probe/pc-outboard-deck.mjs` found the
 * bare deck: on landscape 38.6% of visible deck lies outboard of the entire
 * existing furniture envelope (|x| = 2.60), which is 10.5% of the whole frame,
 * and it is concentrated at the near stations — z = -5 alone holds 5.92% of the
 * landscape frame as bare outboard planking. Near stations are also where the
 * eye, standing on the deck, spends the most pixels.
 *
 * `inset` 0.5 puts the outboard edge of the chocks just inboard of the rail and
 * the inboard edge at |x| >= 2.80, clear of the existing furniture envelope at
 * 2.60 — checked, not assumed, by `tests/room/pirate-cove-composition.test.mjs`.
 */
export const RAIL_STOWAGE_STAGING: ReadonlyArray<RailStowageRun> = [
  { side: -1, zAft: -6.5, zFwd: -0.5, inset: 0.5 },
  { side: 1, zAft: -6.5, zFwd: -0.5, inset: 0.5 },
];
