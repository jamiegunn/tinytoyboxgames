/**
 * r13 — the ramp only goes up.
 *
 * `MiniGameShell` builds one difficulty controller per mount and drives it from
 * exactly one input:
 *
 *     difficulty.update(newScore)      // MiniGameShell.tsx
 *     currentLevel = clamp((score - rampStart) / (rampEnd - rampStart), 0, 1)
 *
 * little-shark's manifest sets that ramp to `{ start: 4, end: 40 }`, and the
 * game feeds `context.difficulty.level` into three consumers:
 *
 *     getTargetFishCount(level)   14 -> 18 fish        (more generous)
 *     getSpeedMultiplier(level)   0.55 -> 1.45         (against the child)
 *     getFishEvasiveness(level)   0 -> 1               (against the child)
 *
 * and the evasiveness fans out further inside `fish/effects.ts`: the startle
 * radius doubles (1.5 -> 3.0), the startle burst goes 1.3x -> 2.2x, the golden's
 * dodge trigger widens (2.0 -> 3.5), it is granted two extra dodges, and half
 * its dodge cooldown is removed.
 *
 * THE MECHANISM UNDER SUSPICION, stated before it is measured so the measurement
 * can refute it. Score within a session only rises — `addPoints` is the only
 * mutation and every `FISH_POINTS` entry is positive. `level` is a monotone
 * non-decreasing function of score. Therefore `level` is a RATCHET: the only
 * thing that can move it is the child succeeding, and nothing can ever move it
 * back. A child who has a good minute and then tires, or who hands the tablet to
 * a smaller sibling, plays the rest of the session at the hardness their best
 * moment earned. That is not a suspicion, it is a composition of two monotone
 * functions, and premises 1-3 below check it against the real modules.
 *
 * What is left to measure is whether the ratchet costs the child anything they
 * could feel, and how much of a session is spent at the top of it.
 *
 * WHY THE INSTRUMENT HAS TO CHANGE. r11 and r12 modelled a tap as "the fish
 * nearest the shark is caught", which is fine for counting reef population but
 * is structurally blind to this charge: a tap that resolves in the same
 * statement it is issued can never be made to miss by a fish moving. Absence of
 * evidence, manufactured by the instrument — the Round 4 lesson. So this probe
 * models the tap the way the shipped `findFishNearTap` resolves it, with the two
 * quantities `index.ts` already recorded when it chose the snap radius:
 *
 *   - aiming error is a Gaussian, sigma = 65 px, "the 12 mm that preschool touch
 *     accuracy runs to at this canvas scale"
 *   - a fish counts as tapped if it lands within FISH_TAP_SNAP_RADIUS_PX of the
 *     touch, and the NEAREST such fish is the one caught — not the intended one
 *
 * Both are read out of the source, including the px-per-world-unit conversion
 * `index.ts` records for the shark's depth. Add the one thing that comment did
 * not model — that a child is not instantaneous — and speed and evasiveness get
 * a channel through which they can actually take a catch away: the fish is no
 * longer where it was when the child decided to touch it.
 *
 * WHY THE LATENCY IS SWEPT AND NOT CHOSEN. Kenward et al.'s Early Childhood
 * Inhibitory Touchscreen Task puts median touch latency on a STATIONARY iPad
 * target, whose position is already known, at 1,038 ms for thirty-month-olds and
 * 1,089 ms at twenty-four (prepotent trials — the easy condition). A
 * three-year-old is faster than that and has already picked their fish, so the
 * true figure is somewhere below a second and above zero. Rather than pick one
 * and defend it, the charge is measured at 0.3 s, 0.6 s and 1.0 s. If it only
 * survives at the top of that range, this file says so.
 *
 * CALIBRATION. At zero latency and difficulty 0 this tap model must reproduce
 * the number `index.ts` published for the constant it chose: P(hit | the child
 * aimed at a fish) = 0.906 at a 120 px snap. That check is printed first. An
 * instrument that cannot reproduce the game's own recorded figure is not
 * entitled to report a new one.
 *
 * Run from inside the package: `node .probe/gameplay/r13-the-ramp-only-goes-up.mjs`
 */

import { readFileSync } from 'node:fs';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';

const SECONDS = Number(process.env.SECS || 300);
const SEED = Number(process.env.SEED || 20260729);
const SEEDS = Number(process.env.SEEDS || 6);
const DT = 1 / 60;

const g = await bundleEntry(
  'r13_ramp',
  `
  export * from './src/minigames/games/little-shark/shark/movement';
  export * from './src/minigames/games/little-shark/shark/huntFSM';
  export * from './src/minigames/games/little-shark/fish/effects';
  export { createProximitySpawnState, updateProximitySpawning, notifyFishEaten, notifyGoldenLost, CULL_DISTANCE, FISH_HARD_CEILING, CAMERA_VIEW_RADIUS } from './src/minigames/games/little-shark/waves';
  export { getTargetFishCount, getSpeedMultiplier, getFishEvasiveness } from './src/minigames/games/little-shark/helpers';
  export * from './src/minigames/games/little-shark/frenzy';
  export { regionFishMultiplier } from './src/minigames/games/little-shark/environment/regions';
  export { createDifficultyController } from './src/minigames/framework/DifficultyController';
  export { FISH_HIT_RADIUS, GOLDEN_HIT_RADIUS, GOLDEN_SPAWN_RING, GOLDEN_MAX_DODGES, FISH_POINTS, FISH_BASE_SPEED_MIN, FISH_BASE_SPEED_MAX, BOUNDS, FISH_DESPAWN_SCALE_DURATION, MIN_FISH_COUNT, MAX_FISH_COUNT, MIN_SPEED_MULTIPLIER, MAX_SPEED_MULTIPLIER } from './src/minigames/games/little-shark/types';
`,
);

let rngState = SEED;
function seeded() {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
Math.random = seeded;
const reseed = (s) => {
  rngState = s;
  shadowState = s ^ 0x5bf03635;
};

/**
 * A second, independent stream for measurements that must not disturb the run.
 *
 * The shadow random-tap check needs two random numbers per resolved tap. Drawing
 * them from the simulation's stream moved every downstream fish, and the only
 * reason I noticed is that CALIBRATION drifted from 0.890 to 0.873 the moment I
 * added it — an observer that changes what it observes. A measurement is not
 * allowed to cost the run its comparability with the run before it.
 */
let shadowState = SEED ^ 0x5bf03635;
function shadowRandom() {
  shadowState |= 0;
  shadowState = (shadowState + 0x6d2b79f5) | 0;
  let t = Math.imul(shadowState ^ (shadowState >>> 15), 1 | shadowState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** One standard normal sample, off the same seeded stream. */
function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = seeded();
  while (v === 0) v = seeded();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);
/**
 * Standard error of the mean across seeds.
 *
 * This exists because the first run of this probe invited me to rank four arms
 * on dead-tap differences of 1 to 3 points from six seeds, with no idea whether
 * three points was a result or a coin toss. Any arm comparison narrower than
 * roughly two of these is not a finding, and the table prints it so I cannot
 * quietly forget that.
 */
const stderr = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) / a.length);
};

const AUTO_HUNT_RADIUS = 9.0;
const AUTO_HUNT_IDLE_DELAY = 3.5;
const FISH_ARRIVAL_DURATION = 0.9;

const here = (p) => readFileSync(new URL(`../../src/minigames/games/little-shark/${p}`, import.meta.url), 'utf8');
const orchestrator = here('index.ts');
const manifestSrc = readFileSync(new URL('../../src/minigames/framework/MiniGameManifest.ts', import.meta.url), 'utf8');
const shellSrc = readFileSync(new URL('../../src/minigames/framework/MiniGameShell.tsx', import.meta.url), 'utf8');
const adaptiveSrc = readFileSync(new URL('../../src/minigames/games/bubble-pop/adaptive.ts', import.meta.url), 'utf8');

function constFromSource(src, name, where) {
  const m = src.match(new RegExp(`const ${name} = ([\\d.]+);`));
  if (!m) throw new Error(`${name} is not declared in ${where} — this probe will not report a tuning it cannot find.`);
  return Number(m[1]);
}
const AUTO_HUNT_MIN_RANGE = constFromSource(orchestrator, 'AUTO_HUNT_MIN_RANGE', 'index.ts');
const AUTO_HUNT_COOLDOWN = constFromSource(orchestrator, 'AUTO_HUNT_COOLDOWN', 'index.ts');

/** Brace-matched body of a named function. Never a fixed-width window. */
function functionBody(src, needle) {
  const start = src.indexOf(needle);
  if (start === -1) throw new Error(`\`${needle}\` is gone — this probe is reading a game that has moved.`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`\`${needle}\` is not brace-balanced — this probe cannot read the game.`);
}

/**
 * little-shark's own ramp, out of the manifest rather than out of my memory.
 *
 * The manifest holds five games; taking the first `difficultyRamp` in the file
 * would have measured bubble-pop's. Scoped to the little-shark entry.
 */
const [RAMP_START, RAMP_END] = (() => {
  const at = manifestSrc.indexOf("'little-shark'");
  if (at === -1) throw new Error('little-shark has no manifest entry — this probe cannot know its ramp.');
  const m = manifestSrc.slice(at).match(/difficultyRamp: \{ start: (\d+), end: (\d+) \}/);
  if (!m) throw new Error('little-shark has no difficultyRamp — this probe cannot know its ramp.');
  return [Number(m[1]), Number(m[2])];
})();

/**
 * The tap geometry, read out of the file that chose it.
 *
 * `FISH_TAP_SNAP_RADIUS_PX` is a real constant. The other two numbers exist only
 * inside the comment that justifies it — the px-per-world-unit conversion at the
 * shark's depth ("2.5 world units = 224 px") and the preschool aiming sigma
 * ("sigma = 65 px"). Parsing a comment is unusual and I would rather not, but
 * the alternative is restating them here, and a probe that restates the tuning
 * it validates is the first thing this project learned not to write. If that
 * note is ever rewritten, this throws and someone re-derives the conversion
 * deliberately, which is the correct outcome.
 */
const FISH_TAP_SNAP_RADIUS_PX = constFromSource(orchestrator, 'FISH_TAP_SNAP_RADIUS_PX', 'index.ts');
const PX_PER_WORLD_UNIT = (() => {
  // Round 5 promoted this from a number living in a comment to a real constant,
  // because the shipped fix needs it too. Parse the declaration, not the prose.
  const m = orchestrator.match(/const PX_PER_WORLD_UNIT_AT_SHARK_DEPTH = ([\d.]+) \/ ([\d.]+);/);
  if (!m) throw new Error('index.ts no longer declares PX_PER_WORLD_UNIT_AT_SHARK_DEPTH — this probe cannot convert a snap radius.');
  return Number(m[1]) / Number(m[2]);
})();
const AIM_SIGMA_PX = (() => {
  const m = orchestrator.match(/sigma = (\d+) px/);
  if (!m) throw new Error('index.ts no longer records the preschool aiming sigma — this probe cannot model a child aiming.');
  return Number(m[1]);
})();
/** The figure index.ts published for P(hit | aimed) at this snap radius. */
const PUBLISHED_AIMED_HIT_RATE = (() => {
  const m = orchestrator.match(new RegExp(`^\\s*//\\s*${FISH_TAP_SNAP_RADIUS_PX}\\s+([\\d.]+)\\s+[\\d.]+\\s+[\\d.]+`, 'm'));
  if (!m) throw new Error(`index.ts's snap sweep no longer has a row for ${FISH_TAP_SNAP_RADIUS_PX} px — this probe has nothing to calibrate against.`);
  return Number(m[1]);
})();

const SNAP_WORLD = FISH_TAP_SNAP_RADIUS_PX / PX_PER_WORLD_UNIT;
const AIM_SIGMA_WORLD = AIM_SIGMA_PX / PX_PER_WORLD_UNIT;
/** Mean drift speed a fish is built with, from types.ts, before any multiplier. */
const MEAN_BASE_SPEED = (g.FISH_BASE_SPEED_MIN + g.FISH_BASE_SPEED_MAX) / 2;

/**
 * The damper's shape and numbers, read out of bubble-pop's `adaptive.ts`.
 *
 * The `damped` arm is not invented here. A sibling game in this codebase already
 * modulates the score ramp by an inferred player profile, and it can fall. This
 * probe reads that module's constants so the arm it measures is the one the
 * codebase already contains rather than one I tuned to win.
 */
const DAMP_FLOOR = (() => {
  const body = functionBody(adaptiveSrc, 'export function computeEffectiveDifficulty');
  const m = body.match(/scoreDifficulty \* \(([\d.]+) \+ ([\d.]+) \* playerProfile\)/);
  if (!m) throw new Error('bubble-pop no longer modulates difficulty by profile — the `damped` arm has no precedent to read.');
  if (Number(m[1]) + Number(m[2]) !== 1) throw new Error('bubble-pop’s damper no longer reaches 1.0 at a perfect profile — this probe cannot reuse its shape.');
  return Number(m[1]);
})();
const [ACC_FLOOR, ACC_SPAN] = (() => {
  const m = adaptiveSrc.match(/clamp\(\(accuracy - ([\d.]+)\) \/ ([\d.]+), 0, 1\)/);
  if (!m) throw new Error('bubble-pop no longer maps accuracy to a signal — the `damped` arm has no precedent to read.');
  return [Number(m[1]), Number(m[2])];
})();
/**
 * `windowDuration` and the profile's starting value are not `const`s — they are
 * defaults inside `createPlayerProfile`'s returned object. Brace-scoped to that
 * function so this cannot pick up a `windowDuration` from somewhere else, and it
 * throws rather than defaulting: the first run of this probe carried
 * `... || 30`, which would have silently reported bubble-pop's window as 30
 * seconds long after bubble-pop stopped saying so.
 */
const [PROFILE_WINDOW, PROFILE_INIT] = (() => {
  const body = functionBody(adaptiveSrc, 'export function createPlayerProfile');
  const w = body.match(/windowDuration: ([\d.]+),/);
  const v = body.match(/value: ([\d.]+),/);
  if (!w || !v) throw new Error("bubble-pop's profile no longer declares a window and a starting value — the `damped` arm has no precedent to read.");
  return [Number(w[1]), Number(v[1])];
})();
const PROFILE_ALPHA = (() => {
  const m = adaptiveSrc.match(/const alpha = ([\d.]+);/);
  if (!m) throw new Error('bubble-pop’s profile no longer has a smoothing constant — the `damped` arm has no precedent to read.');
  return Number(m[1]);
})();

/** The cap the `capped` arm applies. The only number in this file I chose. */
const LEVEL_CAP = 0.5;

/**
 * Speed ceilings to sweep. A range to search, not a tuning — the point of the
 * sweep is that the game's own dead-tap curve picks the value, and the row that
 * wins has to be defensible as arithmetic too. Anchored at the shipped ceiling
 * so the table always contains the status quo to be judged against.
 */
const SPEED_CEILINGS = [g.MAX_SPEED_MULTIPLIER, 1.3, 1.15, 1.0, 0.85, 0.7];
/** The ceiling the `speed-capped` arm carries into the full-session table. */
const SPEED_CEILING_FIX = 1.0;

/**
 * The reaction time the `snap-comp` fix ASSUMES — read out of the shipped fix.
 *
 * This was a number I chose while the fix was a candidate. It is now a constant
 * in index.ts, so it is parsed like every other tuning this probe validates: if
 * the game's assumption moves, these tables move with it rather than quietly
 * grading the old fix.
 *
 * The Early Childhood Inhibitory Touchscreen Task reports mean median reaction
 * times on prepotent (easy) trials of 1,089 ms at 24 months and 1,038 ms at 30
 * months, on a STATIONARY iPad target. A three-year-old is faster than that, and
 * the child modelled here has already chosen their fish before the clock starts,
 * so 0.6 s is deliberately below the measured floor rather than at it: the fix
 * should under-compensate a slow child rather than over-compensate a fast one,
 * because the cost of over-compensating is paid in the random-tap column.
 *
 * The fix's whole magnitude scales linearly with this number, so the latency
 * table sweeps the child's real reaction time INDEPENDENTLY of it. An arm that
 * only works when this constant happens to match the child is not a fix.
 */
const ASSUMED_TOUCH_LATENCY = constFromSource(orchestrator, 'ASSUMED_TOUCH_LATENCY_S', 'index.ts');
const MEAN_BASE_SPEED_SHIPPED = (() => {
  const m = orchestrator.match(/const MEAN_FISH_BASE_SPEED = \(FISH_BASE_SPEED_MIN \+ FISH_BASE_SPEED_MAX\) \/ 2;/);
  if (!m) throw new Error('index.ts no longer averages the fish base speeds — this probe cannot check its own arithmetic against the fix.');
  return (g.FISH_BASE_SPEED_MIN + g.FISH_BASE_SPEED_MAX) / 2;
})();

function makeFish(kind, x, z) {
  return {
    root: { position: { x, y: 0, z }, rotation: { y: 0 }, scale: { setScalar: () => {} } },
    kind,
    active: true,
    spawning: false,
    spawnTimer: 0,
    spawnEdgeX: 0,
    spawnEdgeZ: 0,
    driftPhaseX: Math.random() * Math.PI * 2,
    driftPhaseZ: Math.random() * Math.PI * 2,
    driftSpeed: g.FISH_BASE_SPEED_MIN + Math.random() * (g.FISH_BASE_SPEED_MAX - g.FISH_BASE_SPEED_MIN),
    driftCenterX: x,
    driftCenterZ: z,
    despawnTimer: -1,
    dodgeCount: 0,
    dodgeCooldown: 0,
    dodgeTimer: -1,
    dodgeDirX: 0,
    dodgeDirZ: 0,
  };
}

/**
 * One played session.
 *
 * @param opts.taps     - seconds between taps.
 * @param opts.latency  - seconds between the child DECIDING and the finger landing.
 * @param opts.seed     - RNG seed.
 * @param opts.levelMode - which difficulty arm to run.
 *   'shipped'      - `level` straight off the score ramp, as the game does today.
 *   'pin0' / 'pin1' - the bottom and the top of the ramp, held there all session.
 *                     Not candidate fixes; they exist to size the harm.
 *   'capped'       - `min(level, LEVEL_CAP)`. Still one-way, but bounded.
 *   'damped'       - bubble-pop's shape: the score ramp scaled by an inferred
 *                    profile that CAN fall. Applied to all three consumers.
 *   'damped-motor' - the same damper, but only on the two consumers that work
 *                    against the child. The reef target keeps the raw ramp,
 *                    because fish count is a generosity dial, not a difficulty
 *                    one, and damping it would thin the reef the child taps into.
 */
function runSession({ taps = 3.5, latency = 0.6, seed = SEED, levelMode = 'shipped', speedCeiling = null, snapComp = false } = {}) {
  reseed(seed);
  const sharkMove = g.createSharkMoveState();
  const huntState = g.createHuntFSMState();
  const sharkPos = { x: 0, z: 0 };
  const spawnState = g.createProximitySpawnState();
  const frenzyState = g.createFrenzyState();
  const difficulty = g.createDifficultyController({ rampStart: RAMP_START, rampEnd: RAMP_END });

  const fishArray = [];
  let goldenFish = null;
  let autoHuntActive = false;
  let secondsSinceInput = 0;
  let score = 0;
  let tapTimer = taps;
  let cooldownTimer = 0;

  /** The tap in flight: aimed at a point, resolving `latency` seconds later. */
  let pendingTap = null;

  const profile = { value: PROFILE_INIT, taps: [] };
  let profileTick = 0;
  /** Per frame for `damped-frame` (bubble-pop literally), once a second otherwise. */
  const profileTickSeconds = levelMode === 'damped-frame' ? DT : 1;

  const trace = {
    motorLevel: [],
    visible: [],
    score: [],
    elapsedAtTop: -1,
    framesNearTop: 0,
    framesMotorNearTop: 0,
    motorLevelSum: 0,
    motorDrawdownMax: 0,
    levelDropMax: 0,
    tapsIssued: 0,
    tapsWithNothingToAimAt: 0,
    tapsHit: 0,
    tapsHitIntended: 0,
    goldensCaught: 0,
    catches: 0,
    randomTapsIssued: 0,
    randomTapsHit: 0,
    snapUsedSum: 0,
    resolveMissDist: [],
  };
  let lastMotorLevel = 0;
  let peakMotorLevel = 0;

  const fishForRoot = (root) => {
    if (!root) return null;
    if (goldenFish && goldenFish.root === root) return goldenFish;
    for (const f of fishArray) if (f.root === root) return f;
    return null;
  };
  const countActiveFish = () => {
    let c = 0;
    for (const f of fishArray) if (f.active) c++;
    return c;
  };
  const countVisibleFish = () => {
    let c = 0;
    for (const f of fishArray) {
      if (!f.active || f.spawning) continue;
      const dx = f.root.position.x - sharkPos.x;
      const dz = f.root.position.z - sharkPos.z;
      if (dx * dx + dz * dz < g.CAMERA_VIEW_RADIUS * g.CAMERA_VIEW_RADIUS) c++;
    }
    return c;
  };

  function eatFishAction(fish) {
    fish.active = false;
    fish.spawning = false;
    fish.despawnTimer = g.FISH_DESPAWN_SCALE_DURATION;
    score += g.FISH_POINTS[fish.kind];
    if (huntState.targetFishRoot === fish.root) g.notifyHuntCatch(huntState);
    g.registerFrenzyCatch(frenzyState);
    trace.catches += 1;
    if (fish.kind === 'golden') {
      trace.goldensCaught += 1;
      goldenFish = null;
    }
    g.notifyFishEaten(spawnState, fish.kind === 'golden');
  }

  function chaseFish(fish) {
    autoHuntActive = false;
    g.cancelHunt(huntState);
    g.startLunge(sharkMove, fish.root.position.x, fish.root.position.z, 6.0);
    eatFishAction(fish);
  }

  function maintainAutoHunt() {
    if (huntState.targetFishRoot) {
      const target = fishForRoot(huntState.targetFishRoot);
      if (!target || !target.active || target.spawning) g.cancelHunt(huntState);
    }
    if (g.getHuntPhase(huntState) === 'idle') {
      if (autoHuntActive) cooldownTimer = AUTO_HUNT_COOLDOWN;
      autoHuntActive = false;
    }
    if (g.getHuntPhase(huntState) !== 'idle') return;
    if (sharkMove.isBeingDragged || sharkMove.isLunging) return;
    if (secondsSinceInput < AUTO_HUNT_IDLE_DELAY) return;
    if (cooldownTimer > 0) {
      cooldownTimer -= DT;
      return;
    }
    let best = null;
    let bestDistSq = AUTO_HUNT_RADIUS * AUTO_HUNT_RADIUS;
    for (const f of fishArray) {
      if (!f || !f.active || f.spawning) continue;
      const dx = f.root.position.x - sharkPos.x;
      const dz = f.root.position.z - sharkPos.z;
      const d = dx * dx + dz * dz;
      if (d < AUTO_HUNT_MIN_RANGE * AUTO_HUNT_MIN_RANGE) continue;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = f;
      }
    }
    if (!best) return;
    autoHuntActive = true;
    g.triggerHunt(huntState, best.root);
  }

  /**
   * The fish the child would pick out to touch: the nearest one they can see.
   *
   * The salient fish is the one under the camera's attention, which is the one
   * near the shark. Deliberately NOT "a uniformly random visible fish" — that
   * models a child poking about, which index.ts already measured separately as
   * the random-tap arm, and it would soften every number here by spreading taps
   * into sparse water.
   */
  function pickIntended() {
    let pick = null;
    let bestD = g.CAMERA_VIEW_RADIUS * g.CAMERA_VIEW_RADIUS;
    for (const f of fishArray) {
      if (!f.active || f.spawning) continue;
      const dx = f.root.position.x - sharkPos.x;
      const dz = f.root.position.z - sharkPos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        pick = f;
      }
    }
    if (goldenFish && goldenFish.active && !goldenFish.spawning) {
      const dx = goldenFish.root.position.x - sharkPos.x;
      const dz = goldenFish.root.position.z - sharkPos.z;
      if (dx * dx + dz * dz < g.CAMERA_VIEW_RADIUS * g.CAMERA_VIEW_RADIUS) pick = goldenFish;
    }
    return pick;
  }

  /** `findFishNearTap`, in world space: nearest fish within the snap, or null. */
  function resolveTap(px, pz, snap = SNAP_WORLD) {
    let best = null;
    let bestD = snap * snap;
    const consider = (f) => {
      if (!f || !f.active) return;
      const dx = f.root.position.x - px;
      const dz = f.root.position.z - pz;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    };
    for (const f of fishArray) consider(f);
    consider(goldenFish);
    return best;
  }

  const totalFrames = Math.round(SECONDS / DT);
  for (let frame = 0; frame < totalFrames; frame++) {
    const elapsed = frame * DT;
    secondsSinceInput += DT;
    difficulty.update(score);
    const scoreLevel = difficulty.level;

    // How often the profile EMA is stepped is not a detail — it IS the damper's
    // time constant, and I got it wrong on the first pass. bubble-pop's comment
    // says alpha 0.05 is meant for "once per frame or once per second", so I
    // picked once per second and reasoned that per-frame "converges inside a
    // third of a second, which is a damper with no memory". But bubble-pop's own
    // call site (index.ts:401) steps it every frame inside `update(deltaTime)`,
    // so the slower variant was mine, not the codebase's. Rather than defend a
    // number I chose, both cadences run as separate arms: `damped` at 1 s
    // (time constant ~20 s) and `damped-frame` per frame, which is bubble-pop
    // literally. The 1 s variant was measurably the weaker one for the sparse
    // tapper, which is exactly the child who needs the damper most.
    profileTick += DT;
    if (profileTick >= profileTickSeconds) {
      profileTick -= profileTickSeconds;
      while (profile.taps.length && profile.taps[0].t < elapsed - PROFILE_WINDOW) profile.taps.shift();
      if (profile.taps.length >= 3) {
        const hits = profile.taps.reduce((n, x) => n + (x.hit ? 1 : 0), 0);
        const signal = clamp((hits / profile.taps.length - ACC_FLOOR) / ACC_SPAN, 0, 1);
        profile.value = clamp(profile.value + PROFILE_ALPHA * (signal - profile.value), 0, 1);
      }
    }
    const damped = scoreLevel * (DAMP_FLOOR + (1 - DAMP_FLOOR) * profile.value);

    let motorLevel;
    let reefLevel;
    switch (levelMode) {
      case 'pin0':
        motorLevel = 0;
        reefLevel = 0;
        break;
      case 'pin1':
        motorLevel = 1;
        reefLevel = 1;
        break;
      case 'capped':
        motorLevel = Math.min(scoreLevel, LEVEL_CAP);
        reefLevel = motorLevel;
        break;
      case 'damped':
      case 'damped-frame':
        motorLevel = damped;
        reefLevel = damped;
        break;
      case 'damped-motor':
        motorLevel = damped;
        reefLevel = scoreLevel;
        break;
      // The ramp drives two hostile dials at once, and "the top of the ramp
      // costs 15 points of dead taps" does not say which one spends them. These
      // two arms hold the reef at the top and pin ONE hostile dial to 1 with the
      // other at 0, so the harm can be attributed before anything is fixed. A
      // fix aimed at the wrong dial would have measured as a partial success and
      // been shipped as a whole one.
      case 'pin1-speed':
      case 'pin1-evasion':
        motorLevel = 1;
        reefLevel = 1;
        break;
      default:
        motorLevel = scoreLevel;
        reefLevel = scoreLevel;
    }
    const speedLevel = levelMode === 'pin1-evasion' ? 0 : motorLevel;
    const evasionLevel = levelMode === 'pin1-speed' ? 0 : motorLevel;
    if (frame > 0) trace.levelDropMax = Math.max(trace.levelDropMax, lastMotorLevel - motorLevel);
    lastMotorLevel = motorLevel;
    if (trace.elapsedAtTop < 0 && scoreLevel >= 0.99) trace.elapsedAtTop = elapsed;
    if (scoreLevel >= 0.9) trace.framesNearTop += 1;

    // The charge has two halves, and per-frame `levelDropMax` only answers one of
    // them badly. A ramp that sheds 0.01 in a frame and immediately climbs back
    // has not "come down" in any sense a child could feel. Drawdown from the
    // running peak is the honest measure: how far below its own high-water mark
    // did the difficulty the fish actually ran at ever get, and did the session
    // in fact spend its life at the top of whatever range this arm allows.
    peakMotorLevel = Math.max(peakMotorLevel, motorLevel);
    trace.motorDrawdownMax = Math.max(trace.motorDrawdownMax, peakMotorLevel - motorLevel);
    if (motorLevel >= 0.9) trace.framesMotorNearTop += 1;
    trace.motorLevelSum += motorLevel;

    // `speedCeiling` models "MAX_SPEED_MULTIPLIER was lowered to M" without
    // restating the ramp: the floor comes from the module, only the top moves,
    // and the ramp stays smooth across the whole 0..1 range rather than going
    // flat after a cap. At speedCeiling === null this is getSpeedMultiplier
    // itself, which the calibration section relies on.
    const speedMultiplier =
      speedCeiling === null ? g.getSpeedMultiplier(speedLevel) : g.MIN_SPEED_MULTIPLIER + (speedCeiling - g.MIN_SPEED_MULTIPLIER) * speedLevel;
    const evasiveness = g.getFishEvasiveness(evasionLevel);

    // The competing fix: leave the fish alone and grow the forgiveness circle by
    // exactly the extra distance the faster fish covers inside the child's
    // reaction time. Nothing here is chosen — it is the displacement arithmetic
    // that makes the fast fish miss in the first place, run backwards.
    // NOT `latency`. The first version of this line sized the circle from the
    // session's actual reaction time, which quietly granted the fix perfect
    // knowledge of the child in front of it and inflated its every number. The
    // shipped game cannot measure a child's reaction time; it can only assume
    // one. So the arm assumes a fixed constant while the swept `latency` varies
    // underneath it, and the latency table below is what says whether the fix
    // survives being wrong about the child.
    const snapUsed = snapComp ? SNAP_WORLD + Math.max(0, speedMultiplier - g.getSpeedMultiplier(0)) * MEAN_BASE_SPEED * ASSUMED_TOUCH_LATENCY : SNAP_WORLD;
    g.updateFrenzy(frenzyState, DT);

    // ── the child's hands ────────────────────────────────────────────
    //
    // Two events, not one. The decision fixes a point in the water; the finger
    // arrives `latency` later and the game resolves whatever is there THEN.
    // Collapsing the two — which every earlier probe in this directory does —
    // makes a tap unmissable and this charge unmeasurable.
    if (taps > 0) {
      tapTimer -= DT;
      if (tapTimer <= 0) {
        tapTimer = taps;
        const intended = pickIntended();
        trace.tapsIssued += 1;
        secondsSinceInput = 0;
        if (!intended) {
          trace.tapsWithNothingToAimAt += 1;
          profile.taps.push({ t: elapsed, hit: false });
        } else {
          pendingTap = {
            at: frame + Math.max(1, Math.round(latency / DT)),
            x: intended.root.position.x + gauss() * AIM_SIGMA_WORLD,
            z: intended.root.position.z + gauss() * AIM_SIGMA_WORLD,
            intended,
          };
        }
      }
    }
    if (pendingTap && frame >= pendingTap.at) {
      const { x, z, intended } = pendingTap;
      pendingTap = null;
      secondsSinceInput = 0;
      const got = resolveTap(x, z, snapUsed);
      profile.taps.push({ t: elapsed, hit: !!got });

      // Shadow measurement, taken at the same instant against the same water and
      // changing nothing: would a tap at a RANDOM point inside the shark's view
      // also have caught something? index.ts chose 120 px over 220 px precisely
      // to keep this number low — a snap so generous that poking anywhere works
      // makes aiming decorative, which is the same defect as a dead tap wearing
      // the opposite mask. Any arm that widens the snap has to be priced here or
      // it is being evaluated on its benefit alone.
      {
        const ang = shadowRandom() * Math.PI * 2;
        const rad = Math.sqrt(shadowRandom()) * g.CAMERA_VIEW_RADIUS;
        trace.randomTapsIssued += 1;
        if (resolveTap(sharkPos.x + Math.cos(ang) * rad, sharkPos.z + Math.sin(ang) * rad, snapUsed)) trace.randomTapsHit += 1;
      }
      trace.snapUsedSum += snapUsed;
      if (got) {
        trace.tapsHit += 1;
        if (got === intended) trace.tapsHitIntended += 1;
        chaseFish(got);
      } else if (intended.active) {
        const dx = intended.root.position.x - x;
        const dz = intended.root.position.z - z;
        trace.resolveMissDist.push(Math.sqrt(dx * dx + dz * dz));
      }
    }

    maintainAutoHunt();

    if (g.getHuntPhase(huntState) !== 'idle') {
      g.updateHuntFSM(huntState, sharkMove, DT, { onStrike: () => {}, onCelebrate: () => {}, onMiss: () => {} });
      if (Math.abs(sharkMove.velX) > 0.01 || Math.abs(sharkMove.velZ) > 0.01) {
        sharkMove.rotY = g.steerTowardAngle(sharkMove.rotY, Math.atan2(-sharkMove.velZ, sharkMove.velX), g.TURN_RATE_HUNT, DT);
      }
    } else if (sharkMove.swimPhase !== 'idle') {
      g.updateSwim(sharkMove, DT);
      g.updateRotation(sharkMove, DT);
    } else {
      g.updateIdleDrift(sharkMove, DT);
      g.updateRotation(sharkMove, DT);
    }
    sharkPos.x = sharkMove.posX;
    sharkPos.z = sharkMove.posZ;

    const frenzyOn = g.isFrenzyActive(frenzyState);
    const targetNearby = g.getTargetFishCount(reefLevel) * (frenzyOn ? 2 : 1) * g.regionFishMultiplier(sharkPos.x, sharkPos.z);
    g.updateProximitySpawning(
      spawnState,
      DT,
      sharkPos.x,
      sharkPos.z,
      {
        spawnFish: (edgeX, edgeZ, targetX, targetZ) => {
          if (countActiveFish() >= g.FISH_HARD_CEILING) return;
          const fish = makeFish('standard', edgeX, edgeZ);
          fish.spawning = true;
          fish.spawnTimer = FISH_ARRIVAL_DURATION;
          fish.spawnEdgeX = edgeX;
          fish.spawnEdgeZ = edgeZ;
          fish.driftCenterX = targetX;
          fish.driftCenterZ = targetZ;
          fishArray.push(fish);
        },
        spawnGoldenFish: () => {
          if (goldenFish) return;
          const angle = Math.random() * Math.PI * 2;
          goldenFish = makeFish(
            'golden',
            clamp(sharkPos.x + Math.cos(angle) * g.GOLDEN_SPAWN_RING, -g.BOUNDS, g.BOUNDS),
            clamp(sharkPos.z + Math.sin(angle) * g.GOLDEN_SPAWN_RING, -g.BOUNDS, g.BOUNDS),
          );
        },
        countNearbyFish: () => {
          let count = 0;
          for (const f of fishArray) {
            if (!f.active) continue;
            if (f.spawning) {
              count++;
              continue;
            }
            const dx = f.root.position.x - sharkPos.x;
            const dz = f.root.position.z - sharkPos.z;
            if (dx * dx + dz * dz < g.CAMERA_VIEW_RADIUS * g.CAMERA_VIEW_RADIUS) count++;
          }
          return count;
        },
      },
      targetNearby,
    );

    // The shipped surplus drain (Round 4), so the reef this probe taps into is
    // the reef the game actually holds rather than the pre-drain ratchet.
    if (frame % 15 === 0) {
      const surplus = countVisibleFish() - Math.round(targetNearby);
      if (surplus > 0) {
        const huntTargetRoot = huntState.targetFishRoot ?? null;
        const viewSq = g.CAMERA_VIEW_RADIUS * g.CAMERA_VIEW_RADIUS;
        const cullSq = g.CULL_DISTANCE * g.CULL_DISTANCE;
        let far = null;
        let farD = -1;
        for (const f of fishArray) {
          if (!f.active || f.spawning) continue;
          if (f.root === huntTargetRoot) continue;
          const dx = f.root.position.x - sharkPos.x;
          const dz = f.root.position.z - sharkPos.z;
          const d = dx * dx + dz * dz;
          if (d >= viewSq && d < cullSq && d > farD) {
            farD = d;
            far = f;
          }
        }
        if (far) {
          far.active = false;
          far.despawnTimer = g.FISH_DESPAWN_SCALE_DURATION;
        }
      }
    }

    for (const fish of fishArray) {
      if (!fish.active || fish.spawning) continue;
      const dx = fish.root.position.x - sharkPos.x;
      const dz = fish.root.position.z - sharkPos.z;
      if (dx * dx + dz * dz > g.CULL_DISTANCE * g.CULL_DISTANCE) {
        fish.active = false;
        fish.despawnTimer = g.FISH_DESPAWN_SCALE_DURATION;
      }
    }
    if (goldenFish && goldenFish.active && !goldenFish.spawning) {
      const gdx = goldenFish.root.position.x - sharkPos.x;
      const gdz = goldenFish.root.position.z - sharkPos.z;
      if (gdx * gdx + gdz * gdz > g.CULL_DISTANCE * g.CULL_DISTANCE) {
        goldenFish = null;
        g.notifyGoldenLost(spawnState);
      }
    }

    const all = [...fishArray];
    if (goldenFish) all.push(goldenFish);
    for (const fish of all) {
      if (!fish.active) continue;
      if (fish.spawning) {
        fish.spawnTimer -= DT;
        const p = clamp(1.0 - fish.spawnTimer / FISH_ARRIVAL_DURATION, 0, 1);
        const eased = p * p * (3 - 2 * p);
        fish.root.position.x = fish.spawnEdgeX + (fish.driftCenterX - fish.spawnEdgeX) * eased;
        fish.root.position.z = fish.spawnEdgeZ + (fish.driftCenterZ - fish.spawnEdgeZ) * eased;
        if (fish.spawnTimer <= 0) fish.spawning = false;
        continue;
      }
      g.updateFishDrift(fish, DT, speedMultiplier, sharkPos.x, sharkPos.z, evasiveness);
      if (fish.kind === 'golden') g.updateGoldenDodge(fish, sharkPos.x, sharkPos.z, DT, evasiveness);
    }

    const canHarvest = g.isPlayerDriven(sharkMove) && !autoHuntActive;
    for (let i = fishArray.length - 1; i >= 0; i--) {
      const fish = fishArray[i];
      if (!fish.active) continue;
      const ex = sharkPos.x - fish.root.position.x;
      const ez = sharkPos.z - fish.root.position.z;
      if (Math.sqrt(ex * ex + ez * ez) >= g.FISH_HIT_RADIUS) continue;
      if (canHarvest) eatFishAction(fish);
      else g.escapeFromShark(fish, sharkPos.x, sharkPos.z);
    }
    if (goldenFish && goldenFish.active && !goldenFish.spawning) {
      const gx = sharkPos.x - goldenFish.root.position.x;
      const gz = sharkPos.z - goldenFish.root.position.z;
      if (Math.sqrt(gx * gx + gz * gz) < g.GOLDEN_HIT_RADIUS) {
        if (canHarvest) eatFishAction(goldenFish);
        else g.escapeFromShark(goldenFish, sharkPos.x, sharkPos.z);
      }
    }

    for (let i = fishArray.length - 1; i >= 0; i--) {
      const f = fishArray[i];
      if (!f.active) {
        f.despawnTimer -= DT;
        if (f.despawnTimer <= 0) fishArray.splice(i, 1);
      }
    }

    trace.motorLevel.push(motorLevel);
    trace.visible.push(countVisibleFish());
    trace.score.push(score);
  }

  trace.frames = totalFrames;
  trace.score_final = score;
  return trace;
}

// ── Structural premises ─────────────────────────────────────────────

/**
 * Is `level` really monotone in score? Asked of the real controller.
 *
 * A regex over `DifficultyController.ts` would prove that the file contains a
 * clamped division. Driving the shipped controller across every score a session
 * can reach and checking that it never once comes back down proves the property
 * the charge rests on. Prefer the deduction, and execute it.
 */
const levelIsMonotoneInScore = (() => {
  const d = g.createDifficultyController({ rampStart: RAMP_START, rampEnd: RAMP_END });
  let prev = -1;
  for (let s = 0; s <= RAMP_END * 20; s += 1) {
    d.update(s);
    if (d.level < prev) return false;
    prev = d.level;
  }
  return true;
})();

/**
 * Is score really monotone within a session?
 *
 * Every mutation of the shell's score, and every point value the game can award.
 * `reset()` is a mutation that lowers it, so it is checked separately: it must
 * appear only where a session BEGINS, never on the frame path.
 */
const scoreOnlyRises = (() => {
  const positive = Object.values(g.FISH_POINTS).every((p) => p > 0);
  const addSites = (orchestrator.match(/score\.addPoints\(/g) ?? []).length;
  const resetSites = (orchestrator.match(/score\.reset\(\)/g) ?? []).length;
  const inUpdate = /score\.reset\(\)/.test(functionBody(orchestrator, 'update(deltaTime: number): void'));
  return positive && addSites === 1 && resetSites === 1 && !inUpdate;
})();

/** The shell drives difficulty from score and from nothing else. */
const shellDrivesDifficultyFromScoreAlone = (() => {
  const calls = shellSrc.match(/difficulty\.update\([^)]*\)/g) ?? [];
  return calls.length === 1 && /difficulty\.update\(newScore\)/.test(calls[0]);
})();

/**
 * Which arm is shipped?
 *
 * A premise asserting the ABSENCE of the fix breaks the moment the fix lands,
 * which is the Round 4 lesson. So: read `update()` and say which arm is live.
 */
const shippedArm = (() => {
  const body = functionBody(orchestrator, 'update(deltaTime: number): void');
  if (/effectiveLevel|skillWindow/.test(body)) return 'damped';
  if (/Math\.min\(context\.difficulty\.level/.test(body)) return 'capped';
  if (/getSpeedMultiplier\(context\.difficulty\.level\)/.test(body)) return 'raw-score';
  return 'unrecognised';
})();

/**
 * Which snap arm does the shipped tap resolution actually implement?
 *
 * The mirror of `shippedArm`, and it exists for the same reason: once a fix
 * ships, an arm labelled "shipped" that does not implement it is a lie printed
 * in a table. Brace-matched to `findFishNearTap`, because `tapSnapRadiusPx`
 * appears in the comment above it too and an unscoped match would find that.
 */
const shippedSnapArm = (() => {
  const body = functionBody(orchestrator, 'function findFishNearTap');
  if (/tapSnapRadiusPx\(\)/.test(body)) return 'speed-aware';
  if (/FISH_TAP_SNAP_RADIUS_PX \* FISH_TAP_SNAP_RADIUS_PX/.test(body)) return 'flat';
  return 'unrecognised';
})();

const spd0 = g.getSpeedMultiplier(0);
const spd1 = g.getSpeedMultiplier(1);
const eva0 = g.getFishEvasiveness(0);
const eva1 = g.getFishEvasiveness(1);

const premises = [
  ['difficulty.level never falls as score rises (driven, not pattern-matched)', levelIsMonotoneInScore],
  ['score never falls inside a session — one addPoints site, all point values positive, reset off the frame path', scoreOnlyRises],
  ['the shell drives difficulty from the score and nothing else', shellDrivesDifficultyFromScoreAlone],
  ['the ramp makes fish faster as it rises', spd1 > spd0],
  ['the ramp makes fish more evasive as it rises', eva1 > eva0],
  ['the ramp also makes the reef more generous — the ramp is not uniformly hostile', g.getTargetFishCount(1) > g.getTargetFishCount(0)],
  [`the shipped difficulty path matches exactly one of this probe's arms (it is the "${shippedArm}" arm)`, shippedArm !== 'unrecognised'],
  ['the tap still resolves in screen space against a snap radius', FISH_TAP_SNAP_RADIUS_PX > 0 && PX_PER_WORLD_UNIT > 0],
  [`the shipped snap radius matches exactly one of this probe's two snap arms (it is the "${shippedSnapArm}" arm)`, shippedSnapArm !== 'unrecognised'],
  [
    `the fix's magnitude in this probe equals the fix's magnitude in index.ts (${(MEAN_BASE_SPEED_SHIPPED * ASSUMED_TOUCH_LATENCY * (spd1 - spd0) * PX_PER_WORLD_UNIT).toFixed(1)} px of widening at the top of the ramp)`,
    Math.abs(MEAN_BASE_SPEED_SHIPPED - MEAN_BASE_SPEED) < 1e-9,
  ],
];

console.log(`\nr13 — the ramp only goes up    ${SECONDS}s x ${SEEDS} seeds, seed base ${SEED}, 60fps\n`);
console.log(`  read out of the manifest:  little-shark ramps 0 -> 1 over score ${RAMP_START} -> ${RAMP_END}`);
console.log(
  `  read out of helpers.ts:    speed ${spd0} -> ${spd1}, evasiveness ${eva0} -> ${eva1}, reef ${g.getTargetFishCount(0)} -> ${g.getTargetFishCount(1)} fish`,
);
console.log(`  read out of index.ts:      snap ${FISH_TAP_SNAP_RADIUS_PX} px, aim sigma ${AIM_SIGMA_PX} px, ${PX_PER_WORLD_UNIT.toFixed(1)} px per world unit`);
console.log(`                             => snap ${SNAP_WORLD.toFixed(2)}u, aim sigma ${AIM_SIGMA_WORLD.toFixed(2)}u at the shark's depth`);
console.log(
  `  read out of bubble-pop:    damper = score x (${DAMP_FLOOR} + ${(1 - DAMP_FLOOR).toFixed(2)} x profile), accuracy ${ACC_FLOOR} -> ${ACC_FLOOR + ACC_SPAN} maps to 0 -> 1\n`,
);

console.log('STRUCTURAL PREMISES');
let allHold = true;
for (const [label, ok] of premises) {
  if (!ok) allHold = false;
  console.log(`  ${ok ? 'holds  ' : 'BROKEN '} ${label}`);
}

const CADENCES = [2, 3.5, 5];
const LATENCIES = [0.3, 0.6, 1.0];
const MAIN_LATENCY = 0.6;
const seeds = Array.from({ length: SEEDS }, (_, i) => SEED + i * 7919);

// ── Calibration ─────────────────────────────────────────────────────
console.log('\nCALIBRATION — can this tap model reproduce the number index.ts published?');
{
  const cal = seeds.map((seed) => runSession({ taps: 3.5, latency: 0, seed, levelMode: 'pin0' }));
  const aimed = mean(cal.map((t) => t.tapsHit / Math.max(1, t.tapsIssued - t.tapsWithNothingToAimAt)));
  console.log(`  index.ts recorded P(hit | aimed) = ${PUBLISHED_AIMED_HIT_RATE.toFixed(3)} at a ${FISH_TAP_SNAP_RADIUS_PX} px snap.`);
  console.log(`  this model, zero latency, difficulty 0:  ${aimed.toFixed(3)}`);
  const off = Math.abs(aimed - PUBLISHED_AIMED_HIT_RATE);
  console.log(
    `  ${off <= 0.05 ? 'agrees to within' : 'DISAGREES BY'} ${off.toFixed(3)} — ${off <= 0.05 ? 'the instrument may report' : 'the numbers below are not entitled to be believed'}.`,
  );
}

// ── Where does a session actually sit on the ramp? ───────────────────
console.log('\nWHERE THE RAMP PUTS A REAL SESSION');
console.log('  A ramp is a promise that the game grows with the child. Check when it is spent.');
console.log(
  `  ${'tap every'.padStart(10)}${'score'.padStart(9)}${'reaches level 1 at'.padStart(20)}${'% of session at >=0.9'.padStart(23)}${'mean level'.padStart(12)}`,
);
const flatSnapByCadence = new Map();
for (const cadence of CADENCES) {
  const traces = seeds.map((seed) => runSession({ taps: cadence, latency: MAIN_LATENCY, seed }));
  flatSnapByCadence.set(cadence, traces);
  const reached = traces.filter((t) => t.elapsedAtTop >= 0);
  console.log(
    `  ${`${cadence}s`.padStart(10)}${mean(traces.map((t) => t.score_final))
      .toFixed(0)
      .padStart(
        9,
      )}${(reached.length ? `${mean(reached.map((t) => t.elapsedAtTop)).toFixed(0)}s (${reached.length}/${traces.length})` : 'never').padStart(20)}${`${pct(
      mean(traces.map((t) => t.framesNearTop)),
      mean(traces.map((t) => t.frames)),
    ).toFixed(0)}%`.padStart(23)}${mean(traces.map((t) => mean(t.motorLevel)))
      .toFixed(2)
      .padStart(12)}`,
  );
}

// ── What the top of the ramp costs ──────────────────────────────────
console.log('\nWHAT THE TOP OF THE RAMP COSTS — the same child, the two ends of the ramp');
console.log('  pin0 and pin1 are not candidate fixes. They are the ramp’s own endpoints, held all session,');
console.log(`  so the difference between them is what the ratchet hands the child for succeeding. Latency ${MAIN_LATENCY}s.`);
console.log(
  `  ${'tap every'.padStart(10)}${'level'.padStart(7)}${'dead taps'.padStart(11)}${'hit the one aimed at'.padStart(22)}${'catches/min'.padStart(13)}${'goldens'.padStart(9)}${'reef seen'.padStart(11)}`,
);
const endpoints = new Map();
for (const cadence of CADENCES) {
  for (const mode of ['pin0', 'pin1']) {
    const traces = seeds.map((seed) => runSession({ taps: cadence, latency: MAIN_LATENCY, seed, levelMode: mode }));
    endpoints.set(`${cadence}:${mode}`, traces);
    const dead = mean(traces.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued)));
    console.log(
      `  ${(mode === 'pin0' ? `${cadence}s` : '').padStart(10)}${(mode === 'pin0' ? '0.0' : '1.0').padStart(7)}${`${dead.toFixed(1)}%`.padStart(11)}${`${mean(
        traces.map((t) => pct(t.tapsHitIntended, t.tapsIssued)),
      ).toFixed(1)}%`.padStart(22)}${mean(traces.map((t) => (t.catches / SECONDS) * 60))
        .toFixed(1)
        .padStart(13)}${mean(traces.map((t) => t.goldensCaught))
        .toFixed(1)
        .padStart(9)}${mean(traces.map((t) => mean(t.visible)))
        .toFixed(1)
        .padStart(11)}`,
    );
  }
  const a = endpoints.get(`${cadence}:pin0`);
  const b = endpoints.get(`${cadence}:pin1`);
  const da = mean(a.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued)));
  const db = mean(b.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued)));
  console.log(
    `  ${''.padStart(17)}dead taps ${da.toFixed(1)}% -> ${db.toFixed(1)}% (${(db / Math.max(0.01, da)).toFixed(2)}x), goldens ${mean(a.map((t) => t.goldensCaught)).toFixed(1)} -> ${mean(b.map((t) => t.goldensCaught)).toFixed(1)}`,
  );
}

console.log('\n  ...and the same comparison across every plausible latency for a three-year-old (tap every 3.5s):');
console.log(`  The last two columns are the candidate fix, and they are the point of this table. snap-comp sizes its`);
console.log(`  forgiveness circle from a FIXED assumed ${ASSUMED_TOUCH_LATENCY}s while the swept latency moves underneath it, so every row`);
console.log(`  except ${ASSUMED_TOUCH_LATENCY}s is the fix being wrong about the child. A fix that only works on the child it was`);
console.log(`  tuned for is not a fix; it is a coincidence. Watch whether the ${ASSUMED_TOUCH_LATENCY}s row is the only good one.`);
console.log(`  The last column is the one entitled to veto the fix. index.ts's own criterion for a snap radius is not`);
console.log(`  "how often does a tap land" but "does aiming still pay" — aimed hits minus random hits. Printing it per`);
console.log(`  latency rather than deriving it in prose, because a fix that is only safe for the child it assumed`);
console.log(`  would show up here and nowhere else.`);
console.log(
  `  ${'latency'.padStart(10)}${'dead @0'.padStart(9)}${'dead @1'.padStart(9)}${'extra'.padStart(7)}${'@1 + fix'.padStart(10)}${'recovers'.padStart(10)}${'random @1'.padStart(11)}${'random + fix'.padStart(14)}${'gap @1'.padStart(9)}${'gap + fix'.padStart(11)}`,
);
for (const latency of LATENCIES) {
  const a = seeds.map((seed) => runSession({ taps: 3.5, latency, seed, levelMode: 'pin0' }));
  const b = seeds.map((seed) => runSession({ taps: 3.5, latency, seed, levelMode: 'pin1' }));
  const c = seeds.map((seed) => runSession({ taps: 3.5, latency, seed, levelMode: 'pin1', snapComp: true }));
  const da = mean(a.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued)));
  const db = mean(b.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued)));
  const dc = mean(c.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued)));
  const rb = mean(b.map((t) => pct(t.randomTapsHit, t.randomTapsIssued)));
  const rc = mean(c.map((t) => pct(t.randomTapsHit, t.randomTapsIssued)));
  console.log(
    `  ${`${latency}s`.padStart(10)}${`${da.toFixed(1)}%`.padStart(9)}${`${db.toFixed(1)}%`.padStart(9)}${`+${(db - da).toFixed(1)}`.padStart(7)}${`${dc.toFixed(1)}%`.padStart(10)}${`${(db - dc).toFixed(1)} pts`.padStart(10)}${`${rb.toFixed(1)}%`.padStart(11)}${`${rc.toFixed(1)}%`.padStart(14)}${`${(
      100 -
      db -
      rb
    ).toFixed(1)}`.padStart(9)}${`${(100 - dc - rc).toFixed(1)}`.padStart(11)}`,
  );
}

// ── Which dial spends the child's taps? ─────────────────────────────
console.log('\nWHICH OF THE TWO HOSTILE DIALS SPENDS THE TAPS');
console.log('  The reef sits at the top of the ramp in all four rows. Only speed and evasion move.');
console.log(`  Tap every 3.5s, latency ${MAIN_LATENCY}s.`);
console.log(
  `  ${'speed'.padStart(12)}${'evasion'.padStart(9)}${'dead taps'.padStart(11)}${'+/- se'.padStart(9)}${'vs both off'.padStart(13)}${'hit the one aimed at'.padStart(22)}${'catches/min'.padStart(13)}`,
);
{
  const rows = [
    ['0', '0', 'pin0'],
    ['1', '0', 'pin1-speed'],
    ['0', '1', 'pin1-evasion'],
    ['1', '1', 'pin1'],
  ];
  let floor = null;
  for (const [sp, ev, mode] of rows) {
    // pin0 zeroes the reef too, so its dead-tap rate is not a clean "both dials
    // off at a full reef" baseline. It is still the right floor for the delta:
    // the reef only ever helps, so if anything this understates each dial's cost.
    const traces = seeds.map((seed) => runSession({ taps: 3.5, latency: MAIN_LATENCY, seed, levelMode: mode }));
    const deadEach = traces.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued));
    const dead = mean(deadEach);
    if (floor === null) floor = dead;
    console.log(
      `  ${sp.padStart(12)}${ev.padStart(9)}${`${dead.toFixed(1)}%`.padStart(11)}${stderr(deadEach).toFixed(2).padStart(9)}${(mode === 'pin0' ? '—' : `${dead - floor >= 0 ? '+' : ''}${(dead - floor).toFixed(1)} pts`).padStart(13)}${`${mean(
        traces.map((t) => pct(t.tapsHitIntended, t.tapsIssued)),
      ).toFixed(1)}%`.padStart(22)}${mean(traces.map((t) => (t.catches / SECONDS) * 60))
        .toFixed(1)
        .padStart(13)}`,
    );
  }
}

// ── The deduction, and the constant it implies ──────────────────────
//
// This section is the argument. Everything above it is scene-setting.
console.log('\nWHY SPEED IS THE DIAL — arithmetic first, measurement second');
{
  const dispAt = (m) => m * MEAN_BASE_SPEED * MAIN_LATENCY;
  console.log(`  A tap lands only if the fish is still inside the snap circle when the finger arrives.`);
  console.log(`  Snap radius ${SNAP_WORLD.toFixed(2)}u. Mean base drift ${MEAN_BASE_SPEED.toFixed(2)}u/s. Child's reaction ${MAIN_LATENCY}s.`);
  console.log(`  Distance a fish covers in that reaction, at each end of the speed ramp:`);
  console.log(
    `    level 0, x${g.getSpeedMultiplier(0).toFixed(2)}:  ${dispAt(g.getSpeedMultiplier(0)).toFixed(2)}u = ${((dispAt(g.getSpeedMultiplier(0)) / SNAP_WORLD) * 100).toFixed(0)}% of the snap radius`,
  );
  console.log(
    `    level 1, x${g.getSpeedMultiplier(1).toFixed(2)}:  ${dispAt(g.getSpeedMultiplier(1)).toFixed(2)}u = ${((dispAt(g.getSpeedMultiplier(1)) / SNAP_WORLD) * 100).toFixed(0)}% of the snap radius`,
  );
  console.log(`  At the top of the ramp the fish very nearly clears the entire forgiveness circle`);
  console.log(`  inside the child's reaction time. The tap does not miss by bad luck; it misses by arithmetic.`);
  console.log(`\n  So: how far must the top of the speed ramp come down before the dial stops costing taps?`);
  console.log(`  All rows pin the level at 1 with evasion and the reef fully on, so only the ceiling moves.`);
  console.log(
    `  ${'ceiling'.padStart(11)}${'travel/snap'.padStart(13)}${'dead taps'.padStart(11)}${'+/- se'.padStart(9)}${'vs speed floor'.padStart(16)}${'hit the one aimed at'.padStart(22)}${'reef seen'.padStart(11)}`,
  );
  const floorTraces = seeds.map((seed) => runSession({ taps: 3.5, latency: MAIN_LATENCY, seed, levelMode: 'pin1-evasion' }));
  const floorDead = mean(floorTraces.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued)));
  console.log(
    `  ${`x${g.getSpeedMultiplier(0).toFixed(2)}`.padStart(11)}${`${((dispAt(g.getSpeedMultiplier(0)) / SNAP_WORLD) * 100).toFixed(0)}%`.padStart(13)}${`${floorDead.toFixed(1)}%`.padStart(11)}${stderr(
      floorTraces.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued)),
    )
      .toFixed(2)
      .padStart(9)}${'— (target)'.padStart(16)}${`${mean(floorTraces.map((t) => pct(t.tapsHitIntended, t.tapsIssued))).toFixed(1)}%`.padStart(22)}${mean(
      floorTraces.map((t) => mean(t.visible)),
    )
      .toFixed(1)
      .padStart(11)}`,
  );
  for (const ceiling of SPEED_CEILINGS) {
    const traces = seeds.map((seed) => runSession({ taps: 3.5, latency: MAIN_LATENCY, seed, levelMode: 'pin1', speedCeiling: ceiling }));
    const deadEach = traces.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued));
    const dead = mean(deadEach);
    console.log(
      `  ${`x${ceiling.toFixed(2)}`.padStart(11)}${`${((dispAt(ceiling) / SNAP_WORLD) * 100).toFixed(0)}%`.padStart(13)}${`${dead.toFixed(1)}%`.padStart(11)}${stderr(
        deadEach,
      )
        .toFixed(2)
        .padStart(9)}${`${dead - floorDead >= 0 ? '+' : ''}${(dead - floorDead).toFixed(1)} pts`.padStart(16)}${`${mean(
        traces.map((t) => pct(t.tapsHitIntended, t.tapsIssued)),
      ).toFixed(1)}%`.padStart(22)}${mean(traces.map((t) => mean(t.visible)))
        .toFixed(1)
        .padStart(11)}`,
    );
  }
  console.log(`  (x${g.getSpeedMultiplier(1).toFixed(2)} is what ships today.)`);
}

// ── The arms ────────────────────────────────────────────────────────
console.log('\nTHE FIXES — a ramp that can come back down');
console.log('  capped        min(level, 0.5). One line, no new state, still one-way.');
console.log('  damped        score ramp x (0.5 + 0.5 x profile), profile from a 30s window of tap accuracy, EMA stepped once a second.');
console.log('  damped-frame  the same, EMA stepped every frame — bubble-pop literally (adaptive.ts via index.ts:401).');
console.log('  damped-motor  the once-a-second damper on speed and evasion only; the reef target keeps the raw ramp.');
console.log('  speed-capped  the whole ramp untouched except MAX_SPEED_MULTIPLIER, lowered to the swept value.');
console.log('  snap-comp     nothing about the fish changes. The snap circle grows by exactly the extra distance');
console.log('                a faster fish covers inside the reaction time — the miss arithmetic, run backwards.');
console.log(
  `  ${'arm'.padStart(14)}${'tap every'.padStart(10)}${'dead taps'.padStart(11)}${'+/- se'.padStart(9)}${'vs flat'.padStart(12)}${'got the one aimed at'.padStart(22)}${'random tap hits'.padStart(17)}${'catches/min'.padStart(13)}${'goldens'.padStart(9)}${'reef seen'.padStart(11)}${'level: mean'.padStart(13)}${'% at >=0.9'.padStart(12)}${'drawdown'.padStart(10)}`,
);
// Every arm but the last runs at the FLAT pre-round-5 snap, on purpose: this is
// the table that chose between them, and re-running the losers against the winner
// they lost to would not tell anyone anything. `flat` is therefore the baseline
// the "vs" column is measured from, and it is labelled for what it is rather than
// as "shipped" — which it stopped being the moment snap-comp landed.
const ARMS = [
  ['flat (pre-r5)', { snapComp: false }],
  ['capped', { levelMode: 'capped' }],
  ['damped', { levelMode: 'damped' }],
  ['damped-frame', { levelMode: 'damped-frame' }],
  ['damped-motor', { levelMode: 'damped-motor' }],
  ['speed-capped', { speedCeiling: SPEED_CEILING_FIX }],
  ['snap-comp', { snapComp: true }],
];
for (const [arm, opts] of ARMS) {
  for (const cadence of CADENCES) {
    const traces =
      arm === 'flat (pre-r5)' ? flatSnapByCadence.get(cadence) : seeds.map((seed) => runSession({ taps: cadence, latency: MAIN_LATENCY, seed, ...opts }));
    const deadEach = traces.map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued));
    const dead = mean(deadEach);
    const base = mean(flatSnapByCadence.get(cadence).map((t) => pct(t.tapsIssued - t.tapsHit, t.tapsIssued)));
    console.log(
      `  ${arm.padStart(14)}${`${cadence}s`.padStart(10)}${`${dead.toFixed(1)}%`.padStart(11)}${stderr(deadEach).toFixed(2).padStart(9)}${(arm === 'flat (pre-r5)' ? '—' : `${(dead - base).toFixed(1)} pts`).padStart(12)}${`${mean(traces.map((t) => pct(t.tapsHitIntended, t.tapsIssued))).toFixed(1)}%`.padStart(
        22,
      )}${`${mean(traces.map((t) => pct(t.randomTapsHit, t.randomTapsIssued))).toFixed(1)}%`.padStart(17)}${mean(traces.map((t) => (t.catches / SECONDS) * 60))
        .toFixed(1)
        .padStart(13)}${mean(traces.map((t) => t.goldensCaught))
        .toFixed(1)
        .padStart(9)}${mean(traces.map((t) => mean(t.visible)))
        .toFixed(1)
        .padStart(11)}${mean(traces.map((t) => t.motorLevelSum / t.frames))
        .toFixed(2)
        .padStart(13)}${`${mean(traces.map((t) => pct(t.framesMotorNearTop, t.frames))).toFixed(0)}%`.padStart(12)}${mean(traces.map((t) => t.motorDrawdownMax))
        .toFixed(3)
        .padStart(10)}`,
    );
  }
}
console.log(`\n  "random tap hits" prices generosity. index.ts chose 120 px over 220 px because at 220 a tap`);
console.log(`  at nothing caught something 72% of the time. An arm that widens the snap buys its dead-tap`);
console.log(`  reduction with this column, and a snap so wide that aiming stops mattering is the same defect`);
console.log(`  as a dead tap seen from the other side. Shipped sits at ${FISH_TAP_SNAP_RADIUS_PX} px.`);
console.log('  "drawdown" is the honest measure: the furthest the level ever got BELOW its own high-water mark');
console.log('  in a session. 0.000 means the ramp never gave anything back. "% at >=0.9" is the charge\'s other');
console.log('  half — whether the session lives at the top of whatever range the arm allows.');

console.log(allHold ? '\nAll structural premises hold.\n' : '\nSOME PREMISES ARE BROKEN — the numbers above describe this file, not the game.\n');
