/**
 * The one description of Pirate Cove's hull.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The hull used to be written out twice, in full, in two files that never
 * checked each other: `index.ts` (which cut the deck plane and the plank seams
 * from it) and `factory/scaffold/sceneShell/create.ts` (which built the rails
 * from it). Both derived the same five constants — `wallInset`, `halfW`,
 * `halfD`, `sternCut = halfW * 0.35`, `bowNarrow = halfW * 0.5` — from
 * `environment.ground`, and `index.ts` carried the comment "Hull outline —
 * matches railRuns in sceneShell exactly", a claim nothing verified. Those two
 * files were the only consumers, so a single exported plan retires the
 * duplication completely rather than adding a third copy.
 *
 * WHAT CHANGED IN THE PLAN ITSELF
 * -------------------------------
 * The old hull measured 15.3 wide by 13.3 long — beam:length 1 : 0.87, wider
 * than it was long — with a flat transom at BOTH ends, the forward one 7.5
 * units across, 49% of the beam. From a camera standing on it, the side rails
 * made 4.8 degrees with the horizontal at the worst aspect. That is a fenced
 * platform, not a ship: from on deck the only cue that says "ship" is two rails
 * converging on a stem you can see, and there was no stem and no convergence.
 *
 * This plan is 1 : 2.40, with a real stem point forward and a narrow transom
 * aft. The numbers were not chosen by eye. `.probe/pc-hull-solve.mjs` sweeps the
 * hull plan jointly with the camera preset and keeps only candidates that put
 * the stem, the mast top, the crow's nest and the game portal inside the frame
 * at all nine shipping aspects while the bottom edge of the frame still lands on
 * deck. 15,012 candidates qualify; this one is on the length:beam frontier at
 * the deck area the scene already had.
 *
 * ORIENTATION: +z is FORWARD (the bow). The camera orbits at azimuth PI, which
 * places it aft of the transom looking up the deck toward the stem.
 */

/** Hull dimensions, in world units. */
export interface HullPlan {
  /** Maximum width, port to starboard. */
  beam: number;
  /** Overall length, transom to stem. */
  length: number;
  /** Width of the flat transom at the stern. */
  transomWidth: number;
  /** Where maximum beam occurs, as a fraction of `length` forward of the transom. */
  maxBeamAt: number;
}

/**
 * Pirate Cove's hull.
 *
 * Solved by `.probe/pc-hull-solve.mjs`; see the module comment for the criteria.
 * Deck area is 240 square units against the old hull's 224, so nothing that used
 * to fit on deck stops fitting.
 */
export const HULL_PLAN: HullPlan = { beam: 10, length: 24, transomWidth: 6, maxBeamAt: 0.3 };

/** z of the transom (aft-most point of the hull). */
export const HULL_Z_AFT = -HULL_PLAN.length / 2;
/** z of the stem (forward-most point of the hull). */
export const HULL_Z_FWD = HULL_PLAN.length / 2;
/** z at which the hull reaches its maximum beam. */
export const HULL_Z_MAX_BEAM = HULL_Z_AFT + HULL_PLAN.length * HULL_PLAN.maxBeamAt;

/**
 * Half-width of the hull at a given z.
 *
 * @param z - Station along the hull, from {@link HULL_Z_AFT} to {@link HULL_Z_FWD}.
 * @returns Half-width in world units, or `null` outside the hull.
 */
export function hullHalfWidthAt(z: number): number | null {
  if (z < HULL_Z_AFT || z > HULL_Z_FWD) return null;
  const halfBeam = HULL_PLAN.beam / 2;
  const halfTransom = HULL_PLAN.transomWidth / 2;
  if (z <= HULL_Z_MAX_BEAM) {
    const t = (z - HULL_Z_AFT) / (HULL_Z_MAX_BEAM - HULL_Z_AFT);
    return halfTransom + (halfBeam - halfTransom) * t;
  }
  const t = (z - HULL_Z_MAX_BEAM) / (HULL_Z_FWD - HULL_Z_MAX_BEAM);
  return halfBeam * (1 - t);
}

/**
 * The z range of hull that exists at a given distance off the centreline.
 *
 * Used to cut plank seams: a seam at |x| runs from the aft edge of the hull at
 * that station to the forward edge, and both edges move as |x| grows.
 *
 * @param absX - Distance off the centreline, in world units.
 * @returns `[zAft, zForward]`, or `null` where the hull has no width.
 */
export function hullZRangeAt(absX: number): [number, number] | null {
  const halfBeam = HULL_PLAN.beam / 2;
  const halfTransom = HULL_PLAN.transomWidth / 2;
  if (absX > halfBeam) return null;
  const aft = absX <= halfTransom ? HULL_Z_AFT : HULL_Z_AFT + ((absX - halfTransom) / (halfBeam - halfTransom)) * (HULL_Z_MAX_BEAM - HULL_Z_AFT);
  const forward = HULL_Z_MAX_BEAM + (1 - absX / halfBeam) * (HULL_Z_FWD - HULL_Z_MAX_BEAM);
  return forward > aft ? [aft, forward] : null;
}

/**
 * The hull outline as a closed polygon of world `(x, z)` pairs, walked from the
 * port transom corner clockwise when viewed from above.
 *
 * Five vertices: the two transom corners, the two maximum-beam stations, and the
 * stem. Consumers must not re-derive these from {@link HULL_PLAN} — take them
 * from here so the deck plane and the rails cannot drift apart.
 */
export const HULL_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [-HULL_PLAN.transomWidth / 2, HULL_Z_AFT],
  [HULL_PLAN.transomWidth / 2, HULL_Z_AFT],
  [HULL_PLAN.beam / 2, HULL_Z_MAX_BEAM],
  [0, HULL_Z_FWD],
  [-HULL_PLAN.beam / 2, HULL_Z_MAX_BEAM],
] as const;

/** A straight run of railing between two points on the hull outline. */
export interface HullRailRun {
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/**
 * The five railing runs, derived from {@link HULL_OUTLINE} rather than restated.
 *
 * The two long runs are the ones that carry the whole read of the scene: they
 * are what converge on the stem. Their screen-space angle from horizontal is
 * measured at every aspect by `tests/room/pirate-cove-hull.test.mjs`.
 */
export const HULL_RAIL_RUNS: ReadonlyArray<HullRailRun> = HULL_OUTLINE.map((from, i) => {
  const to = HULL_OUTLINE[(i + 1) % HULL_OUTLINE.length];
  const names = ['transom', 'starboard_quarter', 'starboard_side', 'port_side', 'port_quarter'];
  return { name: names[i], x1: from[0], z1: from[1], x2: to[0], z2: to[1] };
});

/**
 * Mast, crow's nest and yardarm geometry.
 *
 * `height` and `z` are solved values, not taste: at this camera a mast 7 units
 * tall steps its truck 0.03 NDC over the top of the frame unless it is moved to
 * z >= 3.6, and the crow's nest has to clear the frame too. 6.5 at z 3.6 leaves
 * 0.09 NDC of headroom at the tightest aspect, which is the whole reason the
 * masthead is visible at all — the shipped rig was cropped at every single one.
 */
export const MAST = {
  /** Overall mast height above the deck. */
  height: 6.5,
  /** Station of the mast along the hull. */
  z: 3.6,
  /** Crow's nest platform height (0.85 of the mast). */
  nestY: 6.5 * 0.85,
  /** Radius of the crow's nest platform and of the hoop around it. */
  nestRadius: 0.5,
  /**
   * Height of the TOP of the crow's nest hoop — the surface a parrot perches on.
   *
   * This is here, rather than as a local in `sceneShell/create.ts` where the hoop
   * is built, because it is the one number two files have to agree on and they
   * previously did not. `staging/parrot.ts` said the parrot was "sitting on the
   * crow's nest rim" and placed it at y 3.85; the rim was at 5.83. The comment was
   * the only thing asserting the relationship, and it was wrong by 1.98 units —
   * the bird hung in mid-air beside the sail. Both the hoop and the perch are now
   * read from here, so the claim is true by construction instead of by assertion.
   */
  nestRailTopY: 6.5 * 0.85 + 0.3 + 0.03,
  /** Yardarm height (0.65 of the mast). */
  yardY: 6.5 * 0.65,
  /** Yardarm span. Wider than the sail head so its tips read as separate spars. */
  yardSpan: 4.2,
} as const;
