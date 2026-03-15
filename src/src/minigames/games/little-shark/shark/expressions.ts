// ── Shark emotional expression system ───────────────────────────────

/** Possible emotional states for the shark. */
export type SharkMood = 'neutral' | 'curious' | 'excited' | 'satisfied' | 'playful';

/** Interpolatable visual parameters driven by mood. */
export interface MoodParams {
  /** Vertical eye scale (1.0 = normal, <1 = squint, >1 = wide). */
  eyeScaleY: number;
  /** Average blinks per second. */
  blinkRate: number;
  /** Multiplier applied to tail wag frequency. */
  tailFreqMult: number;
  /** Multiplier applied to tail wag amplitude. */
  tailAmpMult: number;
  /** Multiplier applied to body wobble intensity. */
  bodyWobbleMult: number;
  /** Warm colour shift amount (0 = none, higher = warmer). */
  colorWarmth: number;
}

/** Mutable state tracking mood transitions and interpolated parameters. */
export interface ExpressionState {
  /** The mood we are blending from. */
  currentMood: SharkMood;
  /** The mood we are blending toward. */
  targetMood: SharkMood;
  /** Transition progress from 0 (current) to 1 (target). */
  blendT: number;
  /** Duration of the current blend in seconds. */
  blendDuration: number;
  /** Interpolated mood parameters for the current frame. */
  current: MoodParams;
}

// ── Mood lookup table ──────────────────────────────────────────────

/** Canonical mood parameter presets keyed by mood name. */
const MOOD_TABLE: Readonly<Record<SharkMood, Readonly<MoodParams>>> = {
  neutral: {
    eyeScaleY: 1.0,
    blinkRate: 5.0,
    tailFreqMult: 1.0,
    tailAmpMult: 1.0,
    bodyWobbleMult: 1.0,
    colorWarmth: 0.0,
  },
  curious: {
    eyeScaleY: 1.2,
    blinkRate: 7.0,
    tailFreqMult: 1.3,
    tailAmpMult: 0.8,
    bodyWobbleMult: 0.5,
    colorWarmth: 0.1,
  },
  excited: {
    eyeScaleY: 0.8,
    blinkRate: 3.0,
    tailFreqMult: 2.0,
    tailAmpMult: 1.5,
    bodyWobbleMult: 1.5,
    colorWarmth: 0.3,
  },
  satisfied: {
    eyeScaleY: 0.6,
    blinkRate: 8.0,
    tailFreqMult: 0.7,
    tailAmpMult: 0.6,
    bodyWobbleMult: 0.3,
    colorWarmth: 0.2,
  },
  playful: {
    eyeScaleY: 1.1,
    blinkRate: 4.0,
    tailFreqMult: 1.8,
    tailAmpMult: 1.3,
    bodyWobbleMult: 2.0,
    colorWarmth: 0.15,
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Linearly interpolate between two values.
 * @param a - Start value.
 * @param b - End value.
 * @param t - Interpolation factor (0–1).
 * @returns The interpolated value.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Ease-in-out cubic curve for smooth mood transitions.
 * @param t - Input value (0–1).
 * @returns The eased value.
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Interpolate every field of two MoodParams using a 0→1 factor.
 * @param a - Start mood parameters.
 * @param b - End mood parameters.
 * @param t - Interpolation factor (0–1).
 * @returns The interpolated MoodParams.
 */
function lerpParams(a: Readonly<MoodParams>, b: Readonly<MoodParams>, t: number): MoodParams {
  return {
    eyeScaleY: lerp(a.eyeScaleY, b.eyeScaleY, t),
    blinkRate: lerp(a.blinkRate, b.blinkRate, t),
    tailFreqMult: lerp(a.tailFreqMult, b.tailFreqMult, t),
    tailAmpMult: lerp(a.tailAmpMult, b.tailAmpMult, t),
    bodyWobbleMult: lerp(a.bodyWobbleMult, b.bodyWobbleMult, t),
    colorWarmth: lerp(a.colorWarmth, b.colorWarmth, t),
  };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Creates a fresh expression state initialised to the neutral mood.
 * @returns A new ExpressionState ready for per-frame updates.
 */
export function createExpressionState(): ExpressionState {
  return {
    currentMood: 'neutral',
    targetMood: 'neutral',
    blendT: 1,
    blendDuration: 0.3,
    current: { ...MOOD_TABLE.neutral },
  };
}

/**
 * Initiates a smooth transition to a new mood.
 *
 * If the shark is already at (or transitioning to) the requested mood this is a no-op.
 * @param state - The expression state to mutate.
 * @param mood - The target mood to blend toward.
 * @param blendDuration - Transition time in seconds (default 0.3).
 */
export function setMood(state: ExpressionState, mood: SharkMood, blendDuration = 0.3): void {
  if (state.targetMood === mood) return;

  // Snapshot whatever the shark looks like right now as the blend source
  state.currentMood = state.targetMood;
  state.targetMood = mood;
  state.blendT = 0;
  state.blendDuration = blendDuration;
}

/**
 * Advances the mood blend timer and recalculates interpolated parameters.
 *
 * Call once per frame. When a transition completes, blendT clamps at 1.
 * @param state - The expression state to advance.
 * @param dt - Frame delta time in seconds.
 */
export function updateExpressions(state: ExpressionState, dt: number): void {
  if (state.blendT < 1) {
    state.blendT = Math.min(state.blendT + dt / state.blendDuration, 1);
  }

  const eased = easeInOutCubic(state.blendT);
  const from = MOOD_TABLE[state.currentMood];
  const to = MOOD_TABLE[state.targetMood];
  state.current = lerpParams(from, to, eased);
}

/**
 * Returns the current interpolated mood parameters.
 * @param state - The expression state to read.
 * @returns The interpolated MoodParams for this frame.
 */
export function getMoodParams(state: ExpressionState): MoodParams {
  return state.current;
}

/**
 * Maps a hunt-FSM phase name to the appropriate shark mood.
 * @param phase - The current phase identifier from the hunt state machine.
 * @returns The SharkMood corresponding to the given phase.
 */
export function getMoodForPhase(phase: string): SharkMood {
  switch (phase) {
    case 'idle':
      return 'neutral';
    case 'notice':
      return 'curious';
    case 'pursuit':
    case 'strike':
      return 'excited';
    case 'celebrate':
    case 'recovery':
      return 'satisfied';
    default:
      return 'neutral';
  }
}
