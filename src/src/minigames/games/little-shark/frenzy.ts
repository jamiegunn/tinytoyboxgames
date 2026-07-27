// The feeding-frenzy arc.
//
// WHY THIS MODULE EXISTS. Round 4 measured the game's realised event stream and
// found that its variety was fine -- eight distinguishable tap responses, a
// trailing-window perplexity of 2.9, only 1% of the session with effectively
// fewer than two kinds of thing happening -- and that its SHAPE was absent.
// Against a rate-matched shuffled null the session scored a phase z of -0.1,
// where a build-and-payoff cycle scores +27.9 on the control rig, and the
// Jensen-Shannon divergence between the first and last third of a ten-minute
// session was 0.010 out of a possible 0.693. In plain terms: minute nine was
// statistically indistinguishable from minute one, and the stream had no more
// temporal structure than a memoryless process. That is what "boring and
// monotonous" describes -- not too few things, but nothing to anticipate.
//
// So this module adds the one thing the loop had no version of: a build, a
// payoff, and a reset, repeating, with the goal growing each time.
//
// WHY THIS SHAPE FOR A THREE-YEAR-OLD.
//
//  - The build is a COUNT OF CATCHES, not a timer. The child causes it. A timer
//    would have produced the same phase structure on the instrument while
//    teaching the child that waiting, not playing, is what makes things happen.
//  - The goal is small and the payoff is CERTAIN. At 3;0-3;6 a child is a two-
//    or three-knower (Sarnecka & Carey 2008), so `catches` is never rendered as
//    a numeral -- the HUD draws it as a row that fills up. Containing and
//    filling is a schema children have well before they have number.
//  - There is no fail state and no timer to run out. The frenzy is a matter of
//    when, not whether, which is why the goal may grow without becoming a
//    difficulty ramp. Ronimus et al. (2014) found difficulty ramps buy no
//    engagement even at age seven; escalating REWARD is a different lever.
//  - BREWING exists because anticipation is most of the value. The last couple
//    of catches before the payoff are cued -- that is the stretch where a child
//    can tell something is about to happen, which is the part a flat loop can
//    never have.
//
// This file is deliberately pure: no Three.js, no audio, no DOM. Everything is
// a function of state and dt. That is what lets .probe/session.mjs drive the
// REAL module rather than a paraphrase of it, so the measurement of the fix is
// a measurement of the shipped code.

/** Phase of the build-and-payoff cycle. */
export type FrenzyPhase = 'calm' | 'building' | 'brewing' | 'frenzy' | 'afterglow';

/** A phase transition, emitted for exactly one update. */
export interface FrenzyEvent {
  phase: FrenzyPhase;
  /** Which frenzy cycle this is, 1-based. Lets presentation escalate per cycle. */
  cycle: number;
}

/** Mutable state of the frenzy arc. */
export interface FrenzyState {
  phase: FrenzyPhase;
  /** Catches banked toward the current goal. */
  catches: number;
  /** Catches needed for the next frenzy. */
  goal: number;
  /** Seconds spent in the current phase. */
  phaseTime: number;
  /** Completed frenzies so far this session. */
  cycle: number;
}

/**
 * Catches needed for the first frenzy. At a ~55% hit rate and a tap every few
 * seconds this is roughly 35-40 s to the first payoff: long enough to be worth
 * arriving at, short enough that a three-year-old reaches it before losing the
 * thread.
 */
export const FRENZY_GOAL_START = 6;
/** How much harder each successive frenzy is to reach. */
export const FRENZY_GOAL_STEP = 2;
/**
 * Ceiling on the goal. Without it the tenth cycle would be unreachable inside a
 * real sitting, and the arc would flatten back out into the thing this module
 * exists to fix.
 */
export const FRENZY_GOAL_MAX = 14;
/** Catches before the goal at which anticipation cues start. */
export const FRENZY_BREWING_LEAD = 2;
/** Seconds the frenzy itself lasts. */
export const FRENZY_DURATION = 14;
/** Seconds of calm-down after a frenzy before the next build can start. */
export const FRENZY_AFTERGLOW = 5;

/**
 * Creates the frenzy arc state at the start of a session.
 *
 * @returns a fresh state in the `calm` phase
 */
export function createFrenzyState(): FrenzyState {
  return { phase: 'calm', catches: 0, goal: FRENZY_GOAL_START, phaseTime: 0, cycle: 0 };
}

// Moves to a phase and resets the phase clock. Returns the transition event so
// callers can fire presentation exactly once.
function enter(state: FrenzyState, phase: FrenzyPhase): FrenzyEvent {
  state.phase = phase;
  state.phaseTime = 0;
  return { phase, cycle: state.cycle };
}

/**
 * Banks one catch toward the frenzy and advances the phase if it is reached.
 *
 * Catches during the frenzy itself do NOT count toward the next goal: the
 * payoff is a reward, not a shortcut to the next payoff, and letting it feed
 * itself would collapse the cycle into a single runaway frenzy.
 *
 * @param state the frenzy state to mutate
 * @returns the phase transition this catch caused, or null
 */
export function registerFrenzyCatch(state: FrenzyState): FrenzyEvent | null {
  if (state.phase === 'frenzy' || state.phase === 'afterglow') return null;
  state.catches += 1;
  if (state.catches >= state.goal) {
    state.cycle += 1;
    return enter(state, 'frenzy');
  }
  if (state.catches >= state.goal - FRENZY_BREWING_LEAD && state.phase !== 'brewing') {
    return enter(state, 'brewing');
  }
  if (state.phase === 'calm') return enter(state, 'building');
  return null;
}

/**
 * Advances the frenzy clock.
 *
 * @param state the frenzy state to mutate
 * @param dt seconds since the last update
 * @returns the phase transition this tick caused, or null
 */
export function updateFrenzy(state: FrenzyState, dt: number): FrenzyEvent | null {
  state.phaseTime += dt;
  if (state.phase === 'frenzy' && state.phaseTime >= FRENZY_DURATION) {
    return enter(state, 'afterglow');
  }
  if (state.phase === 'afterglow' && state.phaseTime >= FRENZY_AFTERGLOW) {
    state.catches = 0;
    state.goal = Math.min(FRENZY_GOAL_MAX, state.goal + FRENZY_GOAL_STEP);
    return enter(state, 'calm');
  }
  return null;
}

/**
 * How full the build meter is, for the HUD and for escalating cues.
 *
 * Reads 1 for the whole frenzy and falls back to 0 across the afterglow, so a
 * meter driven by this drains visibly instead of snapping to empty.
 *
 * @param state the frenzy state
 * @returns a value in [0, 1]
 */
export function frenzyIntensity(state: FrenzyState): number {
  if (state.phase === 'frenzy') return 1;
  if (state.phase === 'afterglow') return Math.max(0, 1 - state.phaseTime / FRENZY_AFTERGLOW);
  return Math.min(1, state.catches / state.goal);
}

/**
 * How strongly the reef should converge on the shark, in [0, 1].
 *
 * Separate from {@link frenzyIntensity} because the meter and the world want
 * different curves. The meter is linear so a three-year-old can read it as a
 * row filling up. The gather is squared during the build so the reef stays
 * calm through the early catches and visibly closes in over the last two --
 * which is what makes the brewing phase legible without a numeral.
 *
 * This exists because .probe/session-phase.mjs measured the frenzy as changing
 * only about 6% of the salient event stream while ambient traffic, 55% of it,
 * ran on unchanged. A payoff the world does not react to is not a payoff.
 *
 * @param state the frenzy state
 * @returns a value in [0, 1] to pass as `gather` to updateAmbientCreatures
 */
export function frenzyGather(state: FrenzyState): number {
  const i = frenzyIntensity(state);
  return state.phase === 'building' || state.phase === 'brewing' ? i * i : i;
}

/**
 * Whether the extra-generous frenzy spawning and scoring are active.
 *
 * @param state the frenzy state
 * @returns true during the frenzy payoff
 */
export function isFrenzyActive(state: FrenzyState): boolean {
  return state.phase === 'frenzy';
}
