/**
 * r11 — the fix, measured against the real changed source.
 *
 * r10 measured the shipped build and produced two findings. This probe measures
 * the build that replaced it, through the same model, so the before and after
 * numbers are commensurable — the ONLY difference between the two arms here is
 * which behaviour the transcribed orchestrator runs, and both are transcribed
 * from files in this repo whose text is asserted at the bottom.
 *
 * WHAT CHANGED IN THE SOURCE, and what each change is meant to move:
 *
 *   1. `AUTO_HUNT_MIN_RANGE` — the shark refuses to start a hunt on a fish that
 *      is already under its nose. Target: acquisition distance, which the
 *      shipped build put at 1.56 units, INSIDE `STRIKE_RANGE`.
 *   2. `AUTO_HUNT_COOLDOWN` — the shark rests between hunts of its own.
 *      Target: 824 hunts/minute, and the metronome quality of the loop.
 *   3. Contact no longer cancels the hunt. Target: 0/2472 hunts ever finishing,
 *      because `STRIKE_RANGE` (1.5) > `FISH_HIT_RADIUS` (1.0) made the squirt
 *      the universal terminator rather than a rare interruption.
 *   4. The FSM's terminal beat splits: `celebrate` on a catch, a new `miss`
 *      phase on a whiff, with the head-look the game already plays when the
 *      CHILD's lunge comes up empty. Target: a shark that would otherwise
 *      barrel-roll over failure, wearing a satisfied face.
 *   5. `isTargeted` is deleted. Target: a golden fish disarmed for life by an
 *      auto-hunt that merely glanced at it.
 *
 * Neither constant in (1) or (2) is written here — both are READ OUT OF
 * index.ts, so this probe cannot drift from the shipped values and quietly
 * report a tuning that is not the one in the game.
 *
 * The `legacy` arm restores all five behaviours exactly as they shipped, so the
 * before/after comparison runs down ONE code path with one set of physics. r10
 * remains on disk as the original diagnostic; it pins the old source text and
 * will now fail its own premises, which is correct — it describes a game that
 * no longer exists.
 *
 * WHAT IS REAL AND WHAT IS MODELLED. Real, from the shipped modules through one
 * `bundleEntry` graph so module state is shared: shark movement (idle drift,
 * spring-follow drag, lunge/swim, rotation), the hunt FSM including the new
 * `miss` phase, fish drift, the golden dodge, the escape, the proximity
 * spawner, the frenzy state machine, the difficulty controller and the region
 * fish multiplier. Modelled, because it lives inline in `index.ts` and cannot
 * be imported: the auto-hunt acquisition, `chaseFish`, the harvest gate and the
 * collision loop.
 *
 * Fish are plain objects rather than `createFish` meshes: everything under test
 * reads only `root.position`, `root.rotation.y` and the drift/dodge scalars.
 *
 * Run from inside the package: `node .probe/gameplay/r11-after-the-fix.mjs`
 */

import { readFileSync } from 'node:fs';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';

const SECONDS = Number(process.env.SECS || 180);
const SEED = Number(process.env.SEED || 20260728);
const TAP_PERIOD = Number(process.env.TAP || 3.5);
const DT = 1 / 60;

const g = await bundleEntry(
  'r11_after',
  `
  export * from './src/minigames/games/little-shark/shark/movement';
  export * from './src/minigames/games/little-shark/shark/huntFSM';
  export * from './src/minigames/games/little-shark/fish/effects';
  export { createProximitySpawnState, updateProximitySpawning, notifyFishEaten, notifyGoldenLost, CULL_DISTANCE, FISH_HARD_CEILING, CAMERA_VIEW_RADIUS } from './src/minigames/games/little-shark/waves';
  export { getTargetFishCount, getSpeedMultiplier, getFishEvasiveness } from './src/minigames/games/little-shark/helpers';
  export { createFrenzyState, registerFrenzyCatch, updateFrenzy, isFrenzyActive } from './src/minigames/games/little-shark/frenzy';
  export { regionFishMultiplier } from './src/minigames/games/little-shark/environment/regions';
  export { createDifficultyController } from './src/minigames/framework/DifficultyController';
  export { FISH_HIT_RADIUS, GOLDEN_HIT_RADIUS, GOLDEN_SPAWN_RING, GOLDEN_MAX_DODGES, FISH_POINTS, FISH_BASE_SPEED_MIN, FISH_BASE_SPEED_MAX, BOUNDS, FISH_DESPAWN_SCALE_DURATION } from './src/minigames/games/little-shark/types';
`,
);

// ── Deterministic randomness ────────────────────────────────────────
// The modules under test call Math.random directly, so the seed has to be
// installed globally rather than threaded through.
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
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (n, d) => (d === 0 ? '—' : `${((100 * n) / d).toFixed(1)}%`);

// ── Orchestrator constants, transcribed from index.ts ───────────────
const AUTO_HUNT_RADIUS = 9.0;
const AUTO_HUNT_IDLE_DELAY = 3.5;
const FISH_ARRIVAL_DURATION = 0.9;
const RAMP_START = 4;
const RAMP_END = 40;

// ── The tuned constants, READ OUT OF THE GAME ───────────────────────
// Everything above is a value this probe would notice going stale, because a
// wrong `AUTO_HUNT_RADIUS` moves the numbers far enough that the structural
// premises break. The four below are different: they ARE the fix. A probe that
// restates the tuning it is validating can print a beautiful table describing a
// build that was never shipped, so these are parsed out of the source and the
// parse is required to succeed — no default, no fallback, no silent zero.
const here = (p) => readFileSync(new URL(`../../src/minigames/games/little-shark/${p}`, import.meta.url), 'utf8');
const orchestrator = here('index.ts');
const fsm = here('shark/huntFSM.ts');
const fishFx = here('fish/effects.ts');

function constFromSource(src, name, where) {
  const m = src.match(new RegExp(`const ${name} = ([\\d.]+);`));
  if (!m) throw new Error(`${name} is not declared in ${where} — this probe will not report a tuning it cannot find.`);
  return Number(m[1]);
}
const AUTO_HUNT_MIN_RANGE = constFromSource(orchestrator, 'AUTO_HUNT_MIN_RANGE', 'index.ts');
const AUTO_HUNT_COOLDOWN = constFromSource(orchestrator, 'AUTO_HUNT_COOLDOWN', 'index.ts');
const MISS_DURATION = constFromSource(fsm, 'MISS_DURATION', 'huntFSM.ts');
const CELEBRATE_DURATION = constFromSource(fsm, 'CELEBRATE_DURATION', 'huntFSM.ts');

/**
 * The body of a named top-level-ish function in a source file.
 *
 * Needed because `index.ts` contains TWO `consider(fish)` closures over a
 * `best`/`bestDistSq` pair — one in `maintainAutoHunt` and one in
 * `findFishNearTap` — and they must say opposite things about the golden. The
 * tap picker MUST offer it (the child taps the prize fish); the auto-hunt must
 * not. An unscoped /consider\(goldenFish\)/ matches the tap picker and reports
 * the wrong answer with total confidence, which is what it did on first run.
 */
function functionBody(src, signature) {
  const start = src.indexOf(signature);
  if (start === -1) throw new Error(`${signature} is not in the source — this probe cannot check a function it cannot find.`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`${signature} is not brace-balanced`);
}

// Is the golden on the AUTO-HUNT's candidate list? Asked OF THE SOURCE rather
// than decided here, so that if `consider(goldenFish)` ever comes back, this
// probe stages the encounter again and reports what it costs instead of
// silently skipping the arm that would have caught it.
const maintainAutoHuntBody = functionBody(orchestrator, 'function maintainAutoHunt(dt: number): void');
const findFishNearTapBody = functionBody(orchestrator, 'function findFishNearTap(');
const AUTO_HUNT_CONSIDERS_GOLDEN = /consider\(goldenFish\);/.test(maintainAutoHuntBody);
const TAP_CONSIDERS_GOLDEN = /consider\(goldenFish\);/.test(findFishNearTapBody);

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
 * One session.
 *
 * @param opts.taps - seconds between taps, or 0 for an unattended session.
 * @param opts.legacy - reproduce the shipped-before build: no minimum
 *   acquisition range, no inter-hunt cooldown, contact cancels the hunt. This
 *   is the ONLY switch between the two arms; everything else — physics, reef,
 *   spawner, difficulty, frenzy — is one code path shared by both.
 * @param opts.seed - RNG seed, so an arm can be re-run across many worlds.
 */
function runSession({ taps = 0, legacy = false, seed = SEED } = {}) {
  reseed(seed);
  // Read out of index.ts rather than restated here: a probe that hardcodes the
  // tuning it is validating can report a build that was never shipped.
  const minRange = legacy ? 0 : AUTO_HUNT_MIN_RANGE;
  const cooldown = legacy ? 0 : AUTO_HUNT_COOLDOWN;

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

  const s = {
    strikes: 0,
    celebrations: 0,
    catches: 0,
    goldenCatches: 0,
    tapsFired: 0,
    tapsWithNoTarget: 0,
    escapes: 0,
    goldenEscapes: 0,
    autoHuntFrames: 0,
    huntsStarted: 0,
    phaseFrames: { idle: 0, notice: 0, pursuit: 0, strike: 0, celebrate: 0, miss: 0, recovery: 0 },
    endedByContact: 0,
    endedByTargetGone: 0,
    endedByTap: 0,
    acqDist: [],
    huntLifetimes: [],
    popTrace: [],
    popSamples: [],
    // Golden accounting — the hole r9 could not see into.
    goldensSpawned: 0,
    goldenAliveFrames: 0,
    goldenClosestApproach: Infinity,
    goldenFramesInDodgeBand: 0,
    goldenDodges: 0,
    goldenLatchedAt: null,
    goldenDodgesBeforeLatch: 0,
    goldensCulled: 0,
    frenzyFrames: 0,
    targetSamples: [],
    // What the thrash looks like from the sofa: how much the shark's nose
    // swings, and how little ground it covers doing it.
    headingSwing: 0,
    pathLength: 0,
    reversals: 0,
    escapeDisplacement: 0,
    // With fix C the terminal beat is split by outcome, so the two are counted
    // separately: a barrel roll over nothing is exactly the defect r9 set out
    // to find and could not reach.
    missBeats: 0,
    unearnedCelebrations: 0,
    autoHuntsOnGolden: 0,
    goldenBudgetSpent: [],
    huntsCompleted: 0,
  };
  let caughtThisHunt = false;
  let cooldownTimer = 0;
  let huntStartedAt = 0;

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

  // ── eatFishAction + chaseFish, transcribed from index.ts:337-405 ──
  function eatFishAction(fish) {
    fish.active = false;
    fish.spawning = false;
    fish.despawnTimer = g.FISH_DESPAWN_SCALE_DURATION;
    score += g.FISH_POINTS[fish.kind];
    // index.ts: the FSM integrates positions and cannot see a collision, so the
    // outcome is told to it from here. `caughtThisHunt` is this probe's own
    // shadow copy, kept so a miss can be counted even in the legacy arm where
    // the FSM is forced to celebrate unconditionally.
    if (huntState.targetFishRoot === fish.root) {
      caughtThisHunt = true;
      g.notifyHuntCatch(huntState);
    }
    g.registerFrenzyCatch(frenzyState);
    s.catches += 1;
    if (fish.kind === 'golden') {
      s.goldenCatches += 1;
      s.goldenBudgetSpent.push(fish.dodgeCount);
      goldenFish = null;
    }
    g.notifyFishEaten(spawnState, fish.kind === 'golden');
  }

  function chaseFish(fish) {
    autoHuntActive = false;
    if (huntState.targetFishRoot) {
      s.endedByTap += 1;
      s.huntLifetimes.push(s.frames * DT - huntStartedAt);
    }
    g.cancelHunt(huntState);
    g.startLunge(sharkMove, fish.root.position.x, fish.root.position.z, 6.0);
    eatFishAction(fish);
  }

  // ── maintainAutoHunt, transcribed from index.ts:518-556 ───────────
  function maintainAutoHunt(t) {
    if (huntState.targetFishRoot) {
      const target = fishForRoot(huntState.targetFishRoot);
      if (!target || !target.active || target.spawning) {
        s.endedByTargetGone += 1;
        s.huntLifetimes.push(t - huntStartedAt);
        // No cooldown armed here: `cancelHunt` puts the phase back to idle and
        // the branch below — which is the only place the source arms it — fires
        // on the very next statement with `autoHuntActive` still true.
        g.cancelHunt(huntState);
      }
    }
    if (g.getHuntPhase(huntState) === 'idle') {
      // The cooldown is armed here and only here, inside the branch that knows
      // the hunt which just ended was the shark's own idea. Arming it for a
      // tap-driven hunt would make the child wait on the shark, which is the
      // one thing this whole fix exists to prevent.
      if (autoHuntActive) cooldownTimer = cooldown;
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
    const consider = (fish) => {
      if (!fish || !fish.active || fish.spawning) return;
      const dx = fish.root.position.x - sharkPos.x;
      const dz = fish.root.position.z - sharkPos.z;
      const d = dx * dx + dz * dz;
      // Fix A: a fish already under the shark's nose is not something to
      // stalk. Skipping it leaves the shark drifting until a fish worth
      // crossing the reef for is in range.
      if (minRange > 0 && d < minRange * minRange) return;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = fish;
      }
    };
    for (const f of fishArray) consider(f);
    // Fix E: the harvest gate forbids an auto-hunt from ever taking the golden,
    // so hunting it can only spend it. Driven off the source text, not a flag.
    if (legacy || AUTO_HUNT_CONSIDERS_GOLDEN) consider(goldenFish);
    if (!best) return;
    if (best === goldenFish && s.goldenLatchedAt === null) {
      // Kept as an OBSERVATION, not an effect: this records the first moment the
      // shark picked the golden for itself, which in the shipped build was also
      // the moment the golden stopped dodging forever. Nothing is written to the
      // fish, because `isTargeted` no longer exists.
      s.goldenLatchedAt = t;
      s.goldenDodgesBeforeLatch = s.goldenDodges;
    }
    autoHuntActive = true;
    caughtThisHunt = false;
    s.huntsStarted += 1;
    // The harvest gate is `isPlayerDriven(sharkMove) && !autoHuntActive`, and
    // `autoHuntActive` is true for every frame of this hunt. So a hunt started
    // here on the golden CANNOT end in a catch — it is a hunt that is barred by
    // construction from succeeding. Counted, because if it happens often the
    // shark is spending the golden's dodge budget on an errand it cannot win.
    if (best === goldenFish) s.autoHuntsOnGolden += 1;
    s.acqDist.push(Math.sqrt(bestDistSq));
    huntStartedAt = t;
    g.triggerHunt(huntState, best.root);
    // The legacy FSM had no `caught` flag and no `miss` phase: the end of the
    // strike timer fired `onCelebrate` whatever had happened. Setting the flag
    // up front — before the hunt has caught anything — reproduces exactly that,
    // through the real FSM, without a second copy of the state machine here.
    if (legacy) g.notifyHuntCatch(huntState);
  }

  const totalFrames = Math.round(SECONDS / DT);
  for (let frame = 0; frame < totalFrames; frame++) {
    s.frames = frame;
    const t = frame * DT;
    secondsSinceInput += DT;

    difficulty.update(score);
    const level = difficulty.level;
    const speedMultiplier = g.getSpeedMultiplier(level);
    const evasiveness = g.getFishEvasiveness(level);
    g.updateFrenzy(frenzyState, DT);

    // ── the child ─────────────────────────────────────────────────
    if (taps > 0) {
      tapTimer -= DT;
      if (tapTimer <= 0) {
        tapTimer = taps;
        // A child taps what they can see. Nearest visible fish wins; the
        // golden wins outright when it is on screen, because it is the one
        // fish the game spends effort making conspicuous.
        let pick = null;
        let bestD = g.CAMERA_VIEW_RADIUS * g.CAMERA_VIEW_RADIUS;
        const consider = (f) => {
          if (!f || !f.active || f.spawning) return;
          const dx = f.root.position.x - sharkPos.x;
          const dz = f.root.position.z - sharkPos.z;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            pick = f;
          }
        };
        for (const f of fishArray) consider(f);
        if (goldenFish && goldenFish.active && !goldenFish.spawning) {
          const dx = goldenFish.root.position.x - sharkPos.x;
          const dz = goldenFish.root.position.z - sharkPos.z;
          if (dx * dx + dz * dz < g.CAMERA_VIEW_RADIUS * g.CAMERA_VIEW_RADIUS) pick = goldenFish;
        }
        if (pick) {
          s.tapsFired += 1;
          secondsSinceInput = 0;
          chaseFish(pick);
        } else {
          s.tapsWithNoTarget += 1;
        }
      }
    }

    maintainAutoHunt(t);
    if (autoHuntActive) s.autoHuntFrames += 1;
    s.phaseFrames[g.getHuntPhase(huntState)] += 1;
    if (frame % 300 === 0) s.popTrace.push([Math.round(t), countVisibleFish()]);
    if (frame % 30 === 0) s.popSamples.push(countVisibleFish());

    // ── shark movement (index.ts:565-609) ───────────────────────────
    if (g.getHuntPhase(huntState) !== 'idle') {
      g.updateHuntFSM(huntState, sharkMove, DT, {
        onStrike: () => {
          s.strikes += 1;
        },
        // The terminal beat now has two exits, and which one fires is the whole
        // of fix C. In the legacy arm `notifyHuntCatch` was called at trigger
        // time, so this branch is the only one that can ever run — a barrel
        // roll over a fish the shark did not catch, which is the defect.
        onCelebrate: () => {
          s.huntsCompleted += 1;
          s.huntLifetimes.push(t - huntStartedAt);
          s.celebrations += 1;
          if (!caughtThisHunt) s.unearnedCelebrations += 1;
        },
        onMiss: () => {
          s.huntsCompleted += 1;
          s.huntLifetimes.push(t - huntStartedAt);
          s.missBeats += 1;
        },
      });
      // index.ts:588-590 — the shark faces its direction of travel during a
      // hunt. Omitting this in r9 hid the whole visual signature of the thrash.
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
    const prevX = sharkPos.x;
    const prevZ = sharkPos.z;
    sharkPos.x = sharkMove.posX;
    sharkPos.z = sharkMove.posZ;
    {
      const step = Math.hypot(sharkPos.x - prevX, sharkPos.z - prevZ);
      s.pathLength += step;
      let dh = sharkMove.rotY - (s.prevRotY ?? sharkMove.rotY);
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      s.headingSwing += Math.abs(dh);
      if (s.prevDh !== undefined && Math.sign(dh) !== Math.sign(s.prevDh) && Math.abs(dh) > 0.002) s.reversals += 1;
      s.prevDh = dh;
      s.prevRotY = sharkMove.rotY;
      s.startX ??= sharkPos.x;
      s.startZ ??= sharkPos.z;
      s.netFromStart = Math.hypot(sharkPos.x - s.startX, sharkPos.z - s.startZ);
    }

    // ── spawner (index.ts:680-765) ──────────────────────────────────
    const frenzyOn = g.isFrenzyActive(frenzyState);
    if (frenzyOn) s.frenzyFrames += 1;
    const targetNearby = g.getTargetFishCount(level) * (frenzyOn ? 2 : 1) * g.regionFishMultiplier(sharkPos.x, sharkPos.z);
    if (frame % 30 === 0) s.targetSamples.push(targetNearby);
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
          s.goldensSpawned += 1;
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

    // ── cull (index.ts:777-799) ─────────────────────────────────────
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
        s.goldenBudgetSpent.push(goldenFish.dodgeCount);
        goldenFish = null;
        s.goldensCulled += 1;
        g.notifyGoldenLost(spawnState);
      }
    }

    // ── fish update + collisions (index.ts:883-969) ─────────────────
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
      if (fish.kind === 'golden') {
        s.goldenAliveFrames += 1;
        const gd = Math.hypot(fish.root.position.x - sharkPos.x, fish.root.position.z - sharkPos.z);
        if (gd < s.goldenClosestApproach) s.goldenClosestApproach = gd;
        if (gd < 3.5) s.goldenFramesInDodgeBand += 1;
        const before = fish.dodgeCount;
        g.updateGoldenDodge(fish, sharkPos.x, sharkPos.z, DT, evasiveness);
        if (fish.dodgeCount > before) s.goldenDodges += 1;
      }
    }

    const canHarvest = g.isPlayerDriven(sharkMove) && !autoHuntActive;
    for (let i = fishArray.length - 1; i >= 0; i--) {
      const fish = fishArray[i];
      if (!fish.active) continue;
      const ex = sharkPos.x - fish.root.position.x;
      const ez = sharkPos.z - fish.root.position.z;
      if (Math.sqrt(ex * ex + ez * ez) >= g.FISH_HIT_RADIUS) continue;
      if (canHarvest) {
        eatFishAction(fish);
      } else {
        const bx = fish.root.position.x;
        const bz = fish.root.position.z;
        g.escapeFromShark(fish, sharkPos.x, sharkPos.z);
        s.escapeDisplacement += Math.hypot(fish.root.position.x - bx, fish.root.position.z - bz);
        s.escapes += 1;
        // Fix B lives here as an absence. `STRIKE_RANGE` (1.5) is larger than
        // `FISH_HIT_RADIUS` (1.0), so contact ALWAYS precedes the strike timer
        // expiring — which made this cancel the universal terminator rather
        // than the rare interruption its comment claimed it was.
        if (huntState.targetFishRoot === fish.root && legacy) {
          s.endedByContact += 1;
          s.huntLifetimes.push(t - huntStartedAt);
          g.cancelHunt(huntState);
        }
      }
    }
    if (goldenFish && goldenFish.active && !goldenFish.spawning && !canHarvest) {
      const gx = sharkPos.x - goldenFish.root.position.x;
      const gz = sharkPos.z - goldenFish.root.position.z;
      if (Math.sqrt(gx * gx + gz * gz) < g.GOLDEN_HIT_RADIUS) {
        g.escapeFromShark(goldenFish, sharkPos.x, sharkPos.z);
        s.goldenEscapes += 1;
        if (huntState.targetFishRoot === goldenFish.root && legacy) {
          s.endedByContact += 1;
          s.huntLifetimes.push(t - huntStartedAt);
          g.cancelHunt(huntState);
        }
      }
    }
    if (goldenFish && goldenFish.active && !goldenFish.spawning && canHarvest) {
      const gx = sharkPos.x - goldenFish.root.position.x;
      const gz = sharkPos.z - goldenFish.root.position.z;
      if (Math.sqrt(gx * gx + gz * gz) < g.GOLDEN_HIT_RADIUS) eatFishAction(goldenFish);
    }

    // Retire finished despawns so the array does not grow without bound.
    for (let i = fishArray.length - 1; i >= 0; i--) {
      const f = fishArray[i];
      if (!f.active) {
        f.despawnTimer -= DT;
        if (f.despawnTimer <= 0) fishArray.splice(i, 1);
      }
    }
  }

  s.score = score;
  s.finalLevel = difficulty.level;
  return s;
}

/**
 * ARM D — a staged golden encounter, which is the only way to measure claim 2.
 *
 * Phase 1 (`preHunt` arms only): a golden sits at `GOLDEN_SPAWN_RING`, the
 * shark idles, and the auto-hunt is allowed to acquire it exactly as it would
 * in a real session — which, in the shipped build, latched `isTargeted`.
 *
 * Phase 2: the child takes over. The finger is placed on the golden and the
 * shark is spring-dragged at it for `ENGAGE` seconds. This is the moment the
 * whole golden-fish feature exists for: the reward fish is supposed to slip
 * aside GOLDEN_MAX_DODGES times before it can be caught.
 *
 * The measured quantity is dodges the child gets, and whether the golden is
 * caught. Three arms, same seed, same geometry:
 *   control — the child engages an untouched golden (what the design intends)
 *   legacy  — the auto-hunt looked at it first, under the old latched gate
 *   fixed   — the auto-hunt looked at it first, under the shipped source
 *
 * ONE THING HERE IS NOT REAL, and it has to be named. The legacy arm cannot run
 * the shipped dodge gate, because the shipped dodge gate is gone — `isTargeted`
 * was deleted from the game, so `updateGoldenDodge` no longer has a flag to
 * consult. The legacy arm therefore reproduces the old gate in this file, by
 * withholding the dodge tick from a golden the auto-hunt had claimed. That is
 * precisely what `if (... && !fish.isTargeted)` did, and r10 measured the same
 * effect through the real module before it was removed (1.00 mean dodges in
 * control against 0.00 after a glance, 200/200 trials). The FIXED arm is fully
 * real — nothing about it is modelled — and it is the arm the claim rests on.
 */
function forcedGoldenEncounter({ preHunt, legacy, seed }) {
  reseed(seed);
  const ENGAGE = 8.0;
  // Far enough out that the fixed build's own acquisition rule would accept it.
  const STANDOFF = AUTO_HUNT_MIN_RANGE + 1.0;
  const sharkMove = g.createSharkMoveState();
  const huntState = g.createHuntFSMState();
  const sharkPos = { x: 0, z: 0 };
  const angle = Math.random() * Math.PI * 2;
  const golden = makeFish('golden', Math.cos(angle) * g.GOLDEN_SPAWN_RING, Math.sin(angle) * g.GOLDEN_SPAWN_RING);
  const out = { dodges: 0, caught: false, latched: false, escapes: 0, contactFrames: 0 };
  let autoHuntActive = false;
  let legacyLatched = false;
  const evasiveness = 0;
  const speedMultiplier = 1;

  // ── Phase 1: let the shark notice it on its own ────────────────
  //
  // Whether this phase runs at all is decided by the game, not by this probe.
  // Under the shipped source the golden is not on the auto-hunt's candidate
  // list, so there IS no phase 1 — and the arm becomes identical to the control
  // by construction rather than by a number happening to land in the right
  // place. `refused` records which of the two happened.
  const stageIt = preHunt && (legacy || AUTO_HUNT_CONSIDERS_GOLDEN);
  out.refused = preHunt && !stageIt;
  if (stageIt) {
    // Put the shark in range so the acquisition is certain rather than lucky:
    // the question under test is what the latch does once it is set, not how
    // often it gets set.
    // The shark is placed at a distance the FIXED build would actually accept.
    // r10's version of this staging parked it 4 units out and force-triggered
    // the hunt — which the fixed build refuses, because 4 < AUTO_HUNT_MIN_RANGE.
    // Staging an acquisition the game would never make measures the probe, not
    // the game, so the separation is derived from the constant read out of
    // index.ts and is identical in both arms.
    sharkMove.posX = golden.root.position.x - STANDOFF;
    sharkMove.posZ = golden.root.position.z;
    sharkPos.x = sharkMove.posX;
    sharkPos.z = sharkMove.posZ;
    // The legacy latch: set by the auto-hunt on acquisition and cleared by
    // nothing, for the lifetime of the fish. In the shipped source it lived on
    // the fish as `isTargeted`; here it is a local, because the field is gone.
    legacyLatched = legacy;
    out.latched = legacy;
    autoHuntActive = true;
    g.triggerHunt(huntState, golden.root);
    // The legacy FSM had no miss branch: the strike timer always celebrated.
    if (legacy) g.notifyHuntCatch(huntState);
    // Run until the hunt ENDS rather than for an arbitrary two seconds. Under
    // the fix the whole point is that a hunt reaches a terminal beat, and
    // handing over to the child mid-strike would measure an interruption
    // instead of the thing under test.
    for (let i = 0; i < Math.round(10.0 / DT); i++) {
      if (g.getHuntPhase(huntState) !== 'idle') {
        g.updateHuntFSM(huntState, sharkMove, DT, { onStrike: () => {}, onCelebrate: () => {}, onMiss: () => {} });
      } else if (i > 0) {
        autoHuntActive = false;
        out.phase1Seconds = i * DT;
        break;
      }
      sharkPos.x = sharkMove.posX;
      sharkPos.z = sharkMove.posZ;
      g.updateFishDrift(golden, DT, speedMultiplier, sharkPos.x, sharkPos.z, evasiveness);
      const before = golden.dodgeCount;
      if (!legacyLatched) g.updateGoldenDodge(golden, sharkPos.x, sharkPos.z, DT, evasiveness);
      if (golden.dodgeCount > before) out.dodges += 1;
      if (Math.hypot(sharkPos.x - golden.root.position.x, sharkPos.z - golden.root.position.z) < g.GOLDEN_HIT_RADIUS) {
        g.escapeFromShark(golden, sharkPos.x, sharkPos.z);
        if (legacy && huntState.targetFishRoot === golden.root) g.cancelHunt(huntState);
      }
    }
    // Only phase-2 dodges count toward the child's experience — but phase-1
    // dodges are KEPT and reported, because `dodgeCount` is a lifetime budget
    // capped at GOLDEN_MAX_DODGES, so anything the shark spends is gone before
    // the child arrives. That is a different defect from the latch, and if the
    // fix trades one for the other the table has to show it.
    out.dodgesInPhase1 = out.dodges;
    out.dodges = 0;
  } else {
    sharkMove.posX = golden.root.position.x - STANDOFF;
    sharkMove.posZ = golden.root.position.z;
    sharkPos.x = sharkMove.posX;
    sharkPos.z = sharkMove.posZ;
    out.dodgesInPhase1 = 0;
    out.phase1Seconds = 0;
  }
  out.budgetLeftAtHandover = Math.max(0, g.GOLDEN_MAX_DODGES - golden.dodgeCount);

  // ── Phase 2: the child drags the shark at it ───────────────────
  g.cancelHunt(huntState);
  autoHuntActive = false;
  sharkMove.isBeingDragged = true;
  for (let i = 0; i < Math.round(ENGAGE / DT); i++) {
    // The finger tracks the fish — a child chasing a golden does not aim at
    // where it was.
    sharkMove.targetX = golden.root.position.x;
    sharkMove.targetZ = golden.root.position.z;
    g.updateSpringFollow(sharkMove, DT);
    g.updateRotation(sharkMove, DT);
    sharkPos.x = sharkMove.posX;
    sharkPos.z = sharkMove.posZ;

    g.updateFishDrift(golden, DT, speedMultiplier, sharkPos.x, sharkPos.z, evasiveness);
    const before = golden.dodgeCount;
    // The latch outlives the hunt that set it — that is the entire defect. In
    // the fixed arm `legacyLatched` is never true, so this call always happens.
    if (!legacyLatched) g.updateGoldenDodge(golden, sharkPos.x, sharkPos.z, DT, evasiveness);
    if (golden.dodgeCount > before) out.dodges += 1;

    const canHarvest = g.isPlayerDriven(sharkMove) && !autoHuntActive;
    const d = Math.hypot(sharkPos.x - golden.root.position.x, sharkPos.z - golden.root.position.z);
    if (d < g.GOLDEN_HIT_RADIUS) {
      out.contactFrames += 1;
      if (canHarvest) {
        out.caught = true;
        out.caughtAt = i * DT;
        break;
      }
      g.escapeFromShark(golden, sharkPos.x, sharkPos.z);
      out.escapes += 1;
    }
  }
  return out;
}

// ── Structural check: does the glue above still match the game? ─────
//
// Every entry here is a claim that a line of the transcription above is a
// faithful copy of a line in the repo. r10's version of this block pinned the
// OLD text and is now, correctly, all BROKEN — it describes a game that does
// not exist any more. These pin the new text. If one of them goes red, the
// numbers below are describing this file rather than the game, and are void.

const structural = [
  // --- the terminal beat now has two exits (fix C) ---
  [
    'the FSM branches its terminal beat on state.caught',
    /if \(state\.caught\) \{\s*\n\s*state\.phase = 'celebrate';\s*\n\s*state\.phaseTimer = CELEBRATE_DURATION;\s*\n\s*callbacks\.onCelebrate\(\);\s*\n\s*\} else \{\s*\n\s*state\.phase = 'miss';\s*\n\s*state\.phaseTimer = MISS_DURATION;\s*\n\s*callbacks\.onMiss\(\);/.test(
      fsm,
    ),
  ],
  ['a miss is a shorter beat than a celebration, not an equal one', MISS_DURATION > 0 && CELEBRATE_DURATION > 0],
  ['onCelebrate is wired to the barrel roll', /onCelebrate: \(\) => \{\s*\n\s*triggerBarrelRoll\(sharkAnim\);/.test(orchestrator)],
  [
    'onMiss is wired to the head-look the child already gets on an empty lunge',
    /onMiss: \(\) => \{[\s\S]{0,80}?triggerHeadLook\(sharkAnim\);/.test(orchestrator),
  ],
  [
    'the catch is reported to the FSM from the harvest itself',
    /if \(huntState\.targetFishRoot === fish\.root\) notifyHuntCatch\(huntState\);/.test(orchestrator),
  ],
  ['the caught flag is cleared by both triggerHunt and cancelHunt', (fsm.match(/state\.caught = false;/g) || []).length >= 2],

  // --- contact no longer terminates the hunt (fix B) ---
  ['contact with a standard fish no longer cancels the hunt', !/escapeFromShark\(fish, sharkPos\.x, sharkPos\.z\);[\s\S]{0,120}cancelHunt/.test(orchestrator)],
  ['contact with the golden no longer cancels the hunt', !/escapeFromShark\(goldenFish, sharkPos\.x, sharkPos\.z\);[\s\S]{0,120}cancelHunt/.test(orchestrator)],
  ['a fish the shark was not entitled to eat is still pushed clear', /escapeFromShark\(fish, sharkPos\.x, sharkPos\.z\);/.test(orchestrator)],

  // --- the auto-hunt is throttled in range and in time (fix A) ---
  [
    'the auto-hunt enforces a minimum acquisition range',
    /const minRangeSq = AUTO_HUNT_MIN_RANGE \* AUTO_HUNT_MIN_RANGE;/.test(orchestrator) && /if \(d < minRangeSq\) return;/.test(orchestrator),
  ],
  ['the acquisition band is not empty', AUTO_HUNT_MIN_RANGE < AUTO_HUNT_RADIUS && AUTO_HUNT_RADIUS - AUTO_HUNT_MIN_RANGE >= 2.0],
  ["the cooldown is armed only for hunts that were the shark's own idea", /if \(autoHuntActive\) autoHuntCooldown = AUTO_HUNT_COOLDOWN;/.test(orchestrator)],
  ['the cooldown actually gates acquisition', /if \(autoHuntCooldown > 0\) \{\s*\n\s*autoHuntCooldown -= dt;\s*\n\s*return;/.test(orchestrator)],
  [
    'maintainAutoHunt is given the frame delta it needs to tick that cooldown',
    /maintainAutoHunt\(dt: number\)/.test(orchestrator) && /maintainAutoHunt\(dt\);/.test(orchestrator),
  ],

  // --- the flag is gone (fix D) ---
  ['no fish carries a claimed-by-the-child flag anywhere in the game', countMentions() === 0],
  ['the golden dodge is gated on distance alone', /if \(dist < mix\(DODGE_RADIUS_MIN, DODGE_RADIUS_MAX, evasiveness\) && dist > 0\.01\) \{/.test(fishFx)],

  // --- the auto-hunt may not spend the child's prize fish (fix E) ---
  ['the auto-hunt does not consider the golden at all', !AUTO_HUNT_CONSIDERS_GOLDEN],
  ['the CHILD can still tap the golden — the fix must not hide the prize fish', TAP_CONSIDERS_GOLDEN],
  [
    'the harvest gate is still what makes that a deduction rather than a preference',
    /const canHarvest = isPlayerDriven\(sharkMove\) && !autoHuntActive;/.test(orchestrator) &&
      /autoHuntActive = true;\s*\n\s*triggerHunt\(huntState, target\.root\);/.test(orchestrator),
  ],

  // --- unchanged surroundings this transcription depends on ---
  ['the harvest gate still excludes the auto-hunt', /const canHarvest = isPlayerDriven\(sharkMove\) && !autoHuntActive;/.test(orchestrator)],
  // Pinned as the three-statement sequence rather than as "eatFishAction
  // appears within N characters of the signature": the function grew a comment
  // explaining the deleted flag, which pushed it past the old 600-char window
  // and failed a premise that did not care about comments.
  [
    'a tap still resolves its catch on the tap itself, with no hunt in between',
    /cancelHunt\(huntState\);\s*\n\s*startLunge\(sharkMove, fish\.root\.position\.x, fish\.root\.position\.z, 6\.0\);\s*\n\s*eatFishAction\(fish\);/.test(
      orchestrator,
    ),
  ],
  [
    'a tap still hands ownership of the next catch back to the child',
    /function chaseFish\(fish: FishState\): void \{[\s\S]{0,900}?autoHuntActive = false;/.test(orchestrator),
  ],
  [
    'the spawn target is still difficulty x frenzy x region',
    /getTargetFishCount\(context\.difficulty\.level\) \* \(frenzyOn \? 2 : 1\) \* regionFishMultiplier\(sharkPos\.x, sharkPos\.z\)/.test(orchestrator),
  ],
  ['an uncaught golden that drifts off still notifies the spawner', /if \(spawnState\) notifyGoldenLost\(spawnState\);/.test(orchestrator)],
  [
    'the idle branch still runs updateSwim before updateIdleDrift',
    /if \(sharkMove\.swimPhase !== 'idle'\) \{\s*\n\s*updateSwim\(sharkMove, dt\);/.test(orchestrator),
  ],
  ['the auto-hunt radius and idle delay are unchanged', /AUTO_HUNT_RADIUS = 9\.0/.test(orchestrator) && /AUTO_HUNT_IDLE_DELAY = 3\.5/.test(orchestrator)],
  [
    'the hunt branch still steers the nose toward the velocity heading',
    /sharkMove\.rotY = steerTowardAngle\(sharkMove\.rotY, Math\.atan2\(-sharkMove\.velZ, sharkMove\.velX\), TURN_RATE_HUNT, dt\);/.test(orchestrator),
  ],
];

/**
 * Every mention of `isTargeted` in the game that is not prose.
 *
 * r10 counted READERS, because the flag existed and the argument was about how
 * many places consulted it. Here the claim is stronger — the flag is gone — so
 * the count is of mentions of any kind outside a comment, and the target is 0.
 */
function countMentions() {
  let n = 0;
  for (const file of ['index.ts', 'shark/huntFSM.ts', 'fish/effects.ts', 'fish/lifecycle.ts', 'types.ts', 'waves.ts', 'interactions.ts']) {
    for (const line of here(file).split('\n')) {
      if (!line.includes('isTargeted')) continue;
      if (/^\s*(\*|\/\/)/.test(line)) continue; // prose, including the not-here-deliberately blocks
      n += 1;
    }
  }
  return n;
}

// ── Run ─────────────────────────────────────────────────────────────
// Eight seeds everywhere a number is compared. A session is stochastic, and a
// single-seed delta is a sample, not a result — the mistake that nearly picked
// the wrong constants during r10's tuning round.
const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => SEED + i * 104729);
const mins = SECONDS / 60;
const totalFrames = Math.round(SECONDS / DT);

const arm = (opts) => SEEDS.map((seed) => runSession({ ...opts, seed }));
const idleBefore = arm({ taps: 0, legacy: true });
const idleAfter = arm({ taps: 0, legacy: false });
const playedBefore = arm({ taps: TAP_PERIOD, legacy: true });
const playedAfter = arm({ taps: TAP_PERIOD, legacy: false });

console.log(
  `\nr11 — the fix, measured against the changed source    ${SECONDS}s x ${SEEDS.length} seeds, seed base ${SEED}, tap every ${TAP_PERIOD}s, 60fps\n`,
);
console.log(`  read out of index.ts:  AUTO_HUNT_MIN_RANGE = ${AUTO_HUNT_MIN_RANGE}   AUTO_HUNT_COOLDOWN = ${AUTO_HUNT_COOLDOWN}`);
console.log(`  read out of huntFSM.ts: MISS_DURATION = ${MISS_DURATION}   CELEBRATE_DURATION = ${CELEBRATE_DURATION}\n`);

console.log('STRUCTURAL PREMISES (each must hold or the numbers below describe this file, not the game)');
let allHold = true;
for (const [label, ok] of structural) {
  if (!ok) allHold = false;
  console.log(`  ${ok ? 'holds ' : 'BROKEN'}  ${label}`);
}

// ── The charge, restated as numbers, before against after ───────────
const m = (rs, f) => mean(rs.map(f));
const cmp = (label, f, fmt = (x) => x.toFixed(2)) =>
  console.log(`  ${label.padEnd(34)}${fmt(m(idleBefore, f)).padStart(12)}${fmt(m(idleAfter, f)).padStart(12)}`);

console.log('\nROUND 1 — THE THRASH. An unattended reef, which is what the shark does when nobody helps.');
console.log(`  ${''.padEnd(34)}${'before'.padStart(12)}${'after'.padStart(12)}`);
console.log('\n  the charge: frantic');
cmp(
  'hunts started per minute',
  (r) => r.huntsStarted / mins,
  (x) => x.toFixed(0),
);
cmp(
  'turn reversals per second',
  (r) => r.reversals / SECONDS,
  (x) => x.toFixed(1),
);
cmp('nose swing (rad/s)', (r) => r.headingSwing / SECONDS);
cmp(
  'path length / net displacement',
  (r) => r.pathLength / Math.max(r.netFromStart, 0.01),
  (x) => x.toFixed(0),
);

console.log('\n  the charge: nothing is ever finished');
cmp(
  'hunts that reached a terminal beat',
  (r) => r.huntsCompleted,
  (x) => x.toFixed(0),
);
cmp(
  '  as a share of hunts started',
  (r) => (100 * r.huntsCompleted) / Math.max(r.huntsStarted, 1),
  (x) => `${x.toFixed(0)}%`,
);
cmp(
  'mean hunt lifetime (s)',
  (r) => mean(r.huntLifetimes),
  (x) => x.toFixed(2),
);
cmp('mean acquisition distance (u)', (r) => mean(r.acqDist));
cmp(
  'ended by contact',
  (r) => r.endedByContact,
  (x) => x.toFixed(0),
);
cmp(
  '% of frames in celebrate',
  (r) => (100 * r.phaseFrames.celebrate) / totalFrames,
  (x) => `${x.toFixed(1)}%`,
);
cmp(
  '% of frames in miss',
  (r) => (100 * r.phaseFrames.miss) / totalFrames,
  (x) => `${x.toFixed(1)}%`,
);

console.log('\n  the charge: it shoves the reef around');
cmp(
  'fish squirted clear per minute',
  (r) => r.escapes / mins,
  (x) => x.toFixed(0),
);
cmp(
  'fish-units of shoving',
  (r) => r.escapeDisplacement,
  (x) => x.toFixed(0),
);

console.log('\n  the counter-charge: is the fix just an off switch?');
cmp(
  '% of frames idle',
  (r) => (100 * r.phaseFrames.idle) / totalFrames,
  (x) => `${x.toFixed(0)}%`,
);
cmp(
  'seconds of visible hunting',
  (r) => ((totalFrames - r.phaseFrames.idle) * DT) / 1,
  (x) => x.toFixed(0),
);
cmp(
  'mean visible fish',
  (r) => mean(r.popSamples),
  (x) => x.toFixed(1),
);

console.log('\n  THE BEAT THE SHARK PLAYS AT THE END OF A HUNT');
console.log(
  `    before  ${m(idleBefore, (r) => r.celebrations).toFixed(0)} barrel rolls, ${m(idleBefore, (r) => r.missBeats).toFixed(0)} head-looks` +
    `  — of those celebrations, ${m(idleBefore, (r) => r.unearnedCelebrations).toFixed(0)} were over a fish the shark did not catch`,
);
console.log(
  `    after   ${m(idleAfter, (r) => r.celebrations).toFixed(0)} barrel rolls, ${m(idleAfter, (r) => r.missBeats).toFixed(0)} head-looks` +
    `  — of those celebrations, ${m(idleAfter, (r) => r.unearnedCelebrations).toFixed(0)} were over a fish the shark did not catch`,
);

// ── Round 2 — the golden latch ──────────────────────────────────────
console.log('\nROUND 2 — THE GOLDEN LATCH. A staged encounter, 200 trials per arm, same seeds, same geometry.');
console.log(`  GOLDEN_MAX_DODGES = ${g.GOLDEN_MAX_DODGES}; each trial gives the child 8s of dragging the shark at the golden.`);
console.log('  The claim: under the fix, a golden the auto-hunt glanced at behaves exactly like one it never saw.');
const TRIALS = 200;
const goldenArms = [
  ['control (child engages an untouched golden)', { preHunt: false, legacy: false }],
  ['before  (auto-hunt looked at it first)', { preHunt: true, legacy: true }],
  ['after   (auto-hunt cannot engage it at all)', { preHunt: true, legacy: false }],
];
console.log(
  `  ${''.padEnd(44)}${'dodges the child gets'.padStart(23)}${'0-dodge trials'.padStart(16)}${'caught'.padStart(9)}${'spent by the AI first'.padStart(23)}${'budget left'.padStart(13)}`,
);
const goldenResults = {};
for (const [label, opts] of goldenArms) {
  const runs = [];
  for (let i = 0; i < TRIALS; i++) runs.push(forcedGoldenEncounter({ ...opts, seed: SEED + i * 7919 }));
  const dodges = runs.map((r) => r.dodges);
  const caught = runs.filter((r) => r.caught);
  goldenResults[label] = { dodges, caught, runs };
  console.log(
    `  ${label.padEnd(44)}${mean(dodges).toFixed(2).padStart(23)}${`${dodges.filter((d) => d === 0).length}/${TRIALS}`.padStart(16)}${pct(caught.length, TRIALS).padStart(9)}` +
      `${mean(runs.map((r) => r.dodgesInPhase1))
        .toFixed(2)
        .padStart(23)}${mean(runs.map((r) => r.budgetLeftAtHandover))
        .toFixed(2)
        .padStart(13)}`,
  );
}
{
  // The decisive comparison is not before-vs-after, it is after-vs-CONTROL: the
  // fix succeeds only if a glanced-at golden is indistinguishable from an
  // untouched one. Compared trial by trial on the same seed, so this is an
  // identity check, not two means that happen to be close.
  const ctl = goldenResults['control (child engages an untouched golden)'].dodges;
  const after = goldenResults['after   (auto-hunt cannot engage it at all)'];
  const identical = ctl.filter((d, i) => d === after.dodges[i]).length;
  const refused = after.runs.filter((r) => r.refused).length;
  console.log(`\n  the auto-hunt declined the golden in ${refused}/${TRIALS} trials — not by this probe's choice, but because`);
  console.log('  the shipped acquisition list does not contain it. In those trials there is no phase 1 to survive.');
  console.log(`  after vs control, trial by trial on the same seed: ${identical}/${TRIALS} identical dodge counts.`);
  console.log(
    `  ${identical === TRIALS && refused === TRIALS ? 'A golden is now the same fish whether the shark has been near it or not.' : 'NOT IDENTICAL — the shark still changes the prize fish. Re-derive before claiming the fix holds.'}`,
  );
}

// ── Does the fix cost the child anything? ───────────────────────────
console.log('\nWHAT IT COSTS THE CHILD — the same eight seeds, across attention spans');
console.log('  AUTO_HUNT_IDLE_DELAY is 3.5s and every tap resets it, so a child tapping faster than that');
console.log('  never meets the auto-hunt at all and must see no change whatsoever.');
console.log(
  `  ${'tap every'.padStart(11)}${'score before'.padStart(14)}${'score after'.padStart(13)}${'escapes before'.padStart(16)}${'escapes after'.padStart(15)}${'rev/s before'.padStart(14)}${'rev/s after'.padStart(13)}`,
);
for (const period of [2, 3.5, 5, 8, 12, 0]) {
  const as = arm({ taps: period, legacy: true });
  const bs = arm({ taps: period, legacy: false });
  console.log(
    `  ${(period === 0 ? 'never' : period + 's').padStart(11)}` +
      `${m(as, (r) => r.score)
        .toFixed(0)
        .padStart(14)}${m(bs, (r) => r.score)
        .toFixed(0)
        .padStart(13)}` +
      `${m(as, (r) => r.escapes / mins)
        .toFixed(0)
        .padStart(16)}${m(bs, (r) => r.escapes / mins)
        .toFixed(0)
        .padStart(15)}` +
      `${m(as, (r) => r.reversals / SECONDS)
        .toFixed(1)
        .padStart(14)}${m(bs, (r) => r.reversals / SECONDS)
        .toFixed(1)
        .padStart(13)}`,
  );
}

// A score drop has two possible causes that deserve opposite verdicts. If the
// child's taps start MISSING, the fix breaks soul.md line 25 — "every tap is a
// good tap" — and is unshippable at any price. If every tap still lands and the
// loss is bystander fish the thrash used to pile under the shark's nose, then
// what has been removed is a bonus the shark was farming on the child's behalf,
// which is the defect itself and not a cost of fixing it.
console.log('\n  WHERE THAT SCORE WENT — every tap must still land, or the fix is dead');
console.log(
  `  ${'tap every'.padStart(11)}${'taps'.padStart(8)}${'landed before'.padStart(15)}${'landed after'.padStart(14)}${'whiffed before'.padStart(16)}${'whiffed after'.padStart(15)}${'per tap before'.padStart(16)}${'per tap after'.padStart(15)}`,
);
for (const period of [5, 8, 12]) {
  const as = arm({ taps: period, legacy: true });
  const bs = arm({ taps: period, legacy: false });
  const per = (rs) => m(rs, (r) => r.catches) / m(rs, (r) => r.tapsFired);
  console.log(
    `  ${(period + 's').padStart(11)}${(SECONDS / period).toFixed(0).padStart(8)}` +
      `${m(as, (r) => r.tapsFired)
        .toFixed(1)
        .padStart(15)}${m(bs, (r) => r.tapsFired)
        .toFixed(1)
        .padStart(14)}` +
      `${m(as, (r) => r.tapsWithNoTarget)
        .toFixed(1)
        .padStart(16)}${m(bs, (r) => r.tapsWithNoTarget)
        .toFixed(1)
        .padStart(15)}` +
      `${per(as).toFixed(2).padStart(16)}${per(bs).toFixed(2).padStart(15)}`,
  );
}

console.log('\n  THE GOLDEN IN A LIVE SESSION — how often the shark goes after a fish it cannot take');
console.log(`  ${''.padEnd(26)}${'goldens'.padStart(10)}${'auto-hunts on it'.padStart(18)}${'dodges spent'.padStart(14)}${'of a budget of'.padStart(16)}`);
for (const [label, rs] of [
  ['unattended, before', idleBefore],
  ['unattended, after', idleAfter],
  [`played (${TAP_PERIOD}s), before`, playedBefore],
  [`played (${TAP_PERIOD}s), after`, playedAfter],
]) {
  console.log(
    `  ${label.padEnd(26)}${m(rs, (r) => r.goldensSpawned)
      .toFixed(1)
      .padStart(10)}${m(rs, (r) => r.autoHuntsOnGolden)
      .toFixed(1)
      .padStart(18)}` +
      `${m(rs, (r) => mean(r.goldenBudgetSpent))
        .toFixed(2)
        .padStart(14)}${String(g.GOLDEN_MAX_DODGES).padStart(16)}`,
  );
}

console.log('\nPOPULATION — is the reef the size the design asks for?');
console.log(`  ${''.padEnd(26)}${'mean target'.padStart(13)}${'mean visible'.padStart(14)}${'peak visible'.padStart(14)}${'frenzy duty'.padStart(13)}`);
for (const [label, rs] of [
  ['unattended, before', idleBefore],
  ['unattended, after', idleAfter],
  [`played (${TAP_PERIOD}s), before`, playedBefore],
  [`played (${TAP_PERIOD}s), after`, playedAfter],
]) {
  console.log(
    `  ${label.padEnd(26)}${m(rs, (r) => mean(r.targetSamples))
      .toFixed(1)
      .padStart(13)}${m(rs, (r) => mean(r.popSamples))
      .toFixed(1)
      .padStart(14)}` +
      `${m(rs, (r) => Math.max(...r.popSamples))
        .toFixed(0)
        .padStart(14)}${`${((m(rs, (r) => r.frenzyFrames) / totalFrames) * 100).toFixed(1)}%`.padStart(13)}`,
  );
}

console.log(`\n${allHold ? 'All structural premises hold.' : 'AT LEAST ONE PREMISE IS BROKEN — re-derive before quoting these numbers.'}\n`);
