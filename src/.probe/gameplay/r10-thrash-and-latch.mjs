/**
 * r10 — closing the two holes r9 left open.
 *
 * r9 measured a 180 s unattended session and produced two results it could not
 * turn into findings:
 *
 *   1. It REFUTED its own headline claim. 579 strikes, 0 barrel rolls: the
 *      celebration never fires, because contact with a fish the auto-hunt may
 *      not eat calls `cancelHunt` and the strike is killed before its 0.2 s
 *      timer expires. What it surfaced instead was a thrash loop — 2 855 hunts
 *      in 180 s, mean lifetime 0.045 s against a designed cycle of 0.71 s.
 *   2. It could not EVALUATE its second claim at all, because no golden fish
 *      ever came within dodging range in the whole run: 0 dodges against 0
 *      dodges proves nothing.
 *
 * Both results carry the same caveat, and it is a serious one: r9's shark never
 * eats, so `score` stays 0, difficulty stays 0, the replenish burst never
 * fires, and the population sits at 17-42 instead of the intended 14-18. A
 * thrash loop measured on a reef twice as dense as the real one is not evidence
 * about the real one. This probe therefore adds:
 *
 *   ARM B — A CHILD WHO IS ACTUALLY PLAYING. A tap every TAP_PERIOD seconds on
 *   the nearest fish the camera can see, through the real `chaseFish` path
 *   (score, combo, frenzy, replenish burst, lunge). 3.5 s is the same tap
 *   cadence `.probe/session.mjs` uses and defends as generous to the game — a
 *   three-year-old taps faster than that, and a faster tapper only strengthens
 *   whatever this shows, because every tap is a hunt the shark did not have to
 *   start on its own.
 *
 *   ARM D — A FORCED GOLDEN ENCOUNTER. The claim is not "the golden never
 *   dodges", it is "once the shark has looked at the golden on its own, the
 *   golden never dodges again". That is a two-phase story and it needs to be
 *   staged rather than waited for: let the auto-hunt acquire the golden, then
 *   hand the shark to a child and drive it at the golden, and count the dodges
 *   the child gets. Against a control where the child engages first and the
 *   auto-hunt never touches it, which is what the design intends.
 *
 * WHAT IS REAL AND WHAT IS MODELLED. Real, from the shipped modules through one
 * `bundleEntry` graph so module state is shared: shark movement (idle drift,
 * spring-follow drag, lunge/swim, rotation), the hunt FSM, fish drift, the
 * golden dodge, the escape, the proximity spawner, the frenzy state machine,
 * the difficulty controller and the region fish multiplier. Modelled, because
 * it lives inline in `index.ts` and cannot be imported: the auto-hunt
 * acquisition, `chaseFish`, the harvest gate and the collision loop. Every one
 * of those is transcribed from `index.ts` and its source text is asserted at
 * the bottom of this file, so the probe fails loudly rather than quietly if the
 * orchestrator moves out from under it.
 *
 * Fish are plain objects rather than `createFish` meshes: everything under test
 * reads only `root.position`, `root.rotation.y` and the drift/dodge scalars.
 *
 * Run from inside the package: `node .probe/gameplay/r10-thrash-and-latch.mjs`
 */

import { readFileSync } from 'node:fs';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';

const SECONDS = Number(process.env.SECS || 180);
const SEED = Number(process.env.SEED || 20260728);
const TAP_PERIOD = Number(process.env.TAP || 3.5);
const DT = 1 / 60;

const g = await bundleEntry(
  'r10_thrash',
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
    isTargeted: false,
  };
}

/**
 * One session.
 *
 * @param opts.taps - seconds between taps, or 0 for an unattended session.
 * @param opts.latchFix - clear `isTargeted` when the hunt that set it ends.
 * @param opts.minRange - candidate fix A: refuse to start an auto-hunt on a
 *   fish nearer than this, because a hunt that begins at contact range has no
 *   approach to watch. 0 disables.
 * @param opts.cooldown - candidate fix B: seconds of rest after a hunt ends
 *   before another may start. 0 disables.
 * @param opts.letItFinish - candidate fix C: contact with an unharvestable
 *   fish squirts it clear but does NOT cancel the hunt, so the FSM runs out
 *   into `celebrate`/`recovery` instead of being cut off mid-strike. The
 *   terminal callback is then split by outcome: a catch gets the barrel roll,
 *   a miss gets the head-look the game already plays on a missed player lunge.
 * @param opts.noAutoLatch - candidate fix D: the auto-hunt does not write
 *   `isTargeted` at all, because that flag's only reader is the golden's dodge
 *   gate and "the AI has selected you" is not "the child has claimed you".
 */
function runSession({ taps = 0, latchFix = false, minRange = 0, cooldown = 0, letItFinish = false, noAutoLatch = false, seed = SEED } = {}) {
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
    phaseFrames: { idle: 0, notice: 0, pursuit: 0, strike: 0, celebrate: 0, recovery: 0 },
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
    if (huntState.targetFishRoot === fish.root) caughtThisHunt = true;
    g.registerFrenzyCatch(frenzyState);
    s.catches += 1;
    if (fish.kind === 'golden') {
      s.goldenCatches += 1;
      goldenFish = null;
    }
    g.notifyFishEaten(spawnState, fish.kind === 'golden');
  }

  function chaseFish(fish) {
    fish.isTargeted = true;
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
        cooldownTimer = cooldown;
        g.cancelHunt(huntState);
      }
    }
    if (g.getHuntPhase(huntState) === 'idle') {
      // The candidate repair: the hunt that set the flag is over, so the flag
      // saying "this fish is spoken for" no longer has a subject.
      if (latchFix) {
        for (const f of fishArray) f.isTargeted = false;
        if (goldenFish) goldenFish.isTargeted = false;
      }
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
    consider(goldenFish);
    if (!best) return;
    if (best === goldenFish && s.goldenLatchedAt === null && !latchFix) {
      s.goldenLatchedAt = t;
      s.goldenDodgesBeforeLatch = s.goldenDodges;
    }
    if (!noAutoLatch) best.isTargeted = true;
    autoHuntActive = true;
    caughtThisHunt = false;
    s.huntsStarted += 1;
    s.acqDist.push(Math.sqrt(bestDistSq));
    huntStartedAt = t;
    g.triggerHunt(huntState, best.root);
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
        onCelebrate: () => {
          // Fix C splits the terminal beat by outcome. Without it the FSM's
          // single callback is the barrel roll unconditionally, which is what
          // it is in the shipped game.
          s.huntsCompleted += 1;
          s.huntLifetimes.push(t - huntStartedAt);
          if (letItFinish && !caughtThisHunt) s.missBeats += 1;
          else s.celebrations += 1;
          cooldownTimer = cooldown;
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
        if (huntState.targetFishRoot === fish.root && !letItFinish) {
          s.endedByContact += 1;
          s.huntLifetimes.push(t - huntStartedAt);
          cooldownTimer = cooldown;
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
        if (huntState.targetFishRoot === goldenFish.root && !letItFinish) {
          s.endedByContact += 1;
          s.huntLifetimes.push(t - huntStartedAt);
          cooldownTimer = cooldown;
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
 * in a real session — which sets `isTargeted`.
 *
 * Phase 2: the child takes over. The finger is placed on the golden and the
 * shark is spring-dragged at it for `ENGAGE` seconds. This is the moment the
 * whole golden-fish feature exists for: the reward fish is supposed to slip
 * aside GOLDEN_MAX_DODGES times before it can be caught.
 *
 * The measured quantity is dodges the child gets, and whether the golden is
 * caught. Three arms, same seed, same geometry:
 *   control — the child engages an untouched golden (what the design intends)
 *   shipped — the auto-hunt looked at it first
 *   fixed   — the auto-hunt looked at it first, with the latch cleared on end
 */
function forcedGoldenEncounter({ preHunt, latchFix, seed }) {
  reseed(seed);
  const ENGAGE = 8.0;
  const sharkMove = g.createSharkMoveState();
  const huntState = g.createHuntFSMState();
  const sharkPos = { x: 0, z: 0 };
  const angle = Math.random() * Math.PI * 2;
  const golden = makeFish('golden', Math.cos(angle) * g.GOLDEN_SPAWN_RING, Math.sin(angle) * g.GOLDEN_SPAWN_RING);
  const out = { dodges: 0, caught: false, latched: false, escapes: 0, contactFrames: 0 };
  let autoHuntActive = false;
  const evasiveness = 0;
  const speedMultiplier = 1;

  // ── Phase 1: let the shark notice it on its own ────────────────
  if (preHunt) {
    // Put the shark in range so the acquisition is certain rather than lucky:
    // the question under test is what the latch does once it is set, not how
    // often it gets set.
    sharkMove.posX = golden.root.position.x - 4;
    sharkMove.posZ = golden.root.position.z;
    sharkPos.x = sharkMove.posX;
    sharkPos.z = sharkMove.posZ;
    golden.isTargeted = true;
    out.latched = true;
    autoHuntActive = true;
    g.triggerHunt(huntState, golden.root);
    for (let i = 0; i < Math.round(2.0 / DT); i++) {
      if (g.getHuntPhase(huntState) !== 'idle') {
        g.updateHuntFSM(huntState, sharkMove, DT, { onStrike: () => {}, onCelebrate: () => {} });
      } else {
        if (latchFix) golden.isTargeted = false;
        autoHuntActive = false;
        g.updateIdleDrift(sharkMove, DT);
      }
      sharkPos.x = sharkMove.posX;
      sharkPos.z = sharkMove.posZ;
      g.updateFishDrift(golden, DT, speedMultiplier, sharkPos.x, sharkPos.z, evasiveness);
      const before = golden.dodgeCount;
      g.updateGoldenDodge(golden, sharkPos.x, sharkPos.z, DT, evasiveness);
      if (golden.dodgeCount > before) out.dodges += 1;
      if (Math.hypot(sharkPos.x - golden.root.position.x, sharkPos.z - golden.root.position.z) < g.GOLDEN_HIT_RADIUS) {
        g.escapeFromShark(golden, sharkPos.x, sharkPos.z);
        if (huntState.targetFishRoot === golden.root) g.cancelHunt(huntState);
      }
    }
    // Only phase-2 dodges count toward the child's experience.
    out.dodgesInPhase1 = out.dodges;
    out.dodges = 0;
  } else {
    sharkMove.posX = golden.root.position.x - 4;
    sharkMove.posZ = golden.root.position.z;
    sharkPos.x = sharkMove.posX;
    sharkPos.z = sharkMove.posZ;
    out.dodgesInPhase1 = 0;
  }

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
    g.updateGoldenDodge(golden, sharkPos.x, sharkPos.z, DT, evasiveness);
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
const here = (p) => readFileSync(new URL(`../../src/minigames/games/little-shark/${p}`, import.meta.url), 'utf8');
const orchestrator = here('index.ts');
const fsm = here('shark/huntFSM.ts');
const fishFx = here('fish/effects.ts');

const structural = [
  ['onCelebrate is wired to the barrel roll', /onCelebrate: \(\) => \{\s*\n\s*triggerBarrelRoll\(sharkAnim\);/.test(orchestrator)],
  [
    'the FSM fires onCelebrate unconditionally at the end of strike',
    /state\.phase = 'celebrate';\s*\n\s*state\.phaseTimer = CELEBRATE_DURATION;\s*\n\s*callbacks\.onCelebrate\(\);/.test(fsm),
  ],
  [
    'contact with an unharvestable fish cancels the hunt',
    /escapeFromShark\(fish, sharkPos\.x, sharkPos\.z\);\s*\n\s*if \(huntState\.targetFishRoot === fish\.root\) cancelHunt\(huntState\);/.test(orchestrator),
  ],
  ['the harvest gate still excludes the auto-hunt', /const canHarvest = isPlayerDriven\(sharkMove\) && !autoHuntActive;/.test(orchestrator)],
  ['the auto-hunt still latches isTargeted', /target\.isTargeted = true;/.test(orchestrator)],
  ['the golden dodge is still gated on !isTargeted', /&& !fish\.isTargeted\)/.test(fishFx)],
  ['isTargeted is still never cleared outside lifecycle.ts', (orchestrator.match(/isTargeted = false/g) || []).length === 0],
  [
    'chaseFish still resolves the catch on the tap itself',
    /function chaseFish\(fish: FishState\): void \{[\s\S]{0,600}?eatFishAction\(fish\);/.test(orchestrator),
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
  // The one reader of `isTargeted` in the entire game is the golden dodge gate.
  // If a second one ever appears, the argument that the flag exists only to
  // disarm the golden stops holding and must be re-derived.
  ['isTargeted still has exactly one reader in the whole game', countReaders() === 1],
];

/** Occurrences of `isTargeted` that are reads rather than writes or the type decl. */
function countReaders() {
  let n = 0;
  for (const file of ['index.ts', 'shark/huntFSM.ts', 'fish/effects.ts', 'fish/lifecycle.ts', 'types.ts', 'waves.ts', 'interactions.ts']) {
    for (const line of here(file).split('\n')) {
      if (!line.includes('isTargeted')) continue;
      if (/isTargeted\s*[:=]/.test(line)) continue; // a write or the interface field
      if (/^\s*\*/.test(line) || /^\s*\/\//.test(line)) continue; // prose
      n += 1;
    }
  }
  return n;
}

// ── Run ─────────────────────────────────────────────────────────────
const unattended = runSession({ taps: 0, latchFix: false });
const played = runSession({ taps: TAP_PERIOD, latchFix: false });
const playedFixed = runSession({ taps: TAP_PERIOD, latchFix: true });

const mins = SECONDS / 60;
const totalFrames = Math.round(SECONDS / DT);

console.log(`\nr10 — the thrash loop and the golden latch    ${SECONDS}s, seed ${SEED}, tap every ${TAP_PERIOD}s, 60fps\n`);

console.log('STRUCTURAL PREMISES (each must hold or the numbers below describe a game that no longer exists)');
let allHold = true;
for (const [label, ok] of structural) {
  if (!ok) allHold = false;
  console.log(`  ${ok ? 'holds ' : 'BROKEN'}  ${label}`);
}

const row = (label, f) => console.log(`  ${label.padEnd(32)}${String(f(unattended)).padStart(12)}${String(f(played)).padStart(12)}`);

console.log('\nA/B — THE SAME REEF, UNATTENDED vs BEING PLAYED');
console.log(`  ${''.padEnd(32)}${'unattended'.padStart(12)}${'played'.padStart(12)}`);
row('score', (x) => x.score);
row('difficulty level', (x) => x.finalLevel.toFixed(2));
row('mean visible fish', (x) => mean(x.popSamples).toFixed(1));
row('fish eaten', (x) => x.catches);
row('taps that found a fish', (x) => x.tapsFired);
row('taps that found nothing', (x) => x.tapsWithNoTarget);
console.log('');
row('auto-hunts started', (x) => x.huntsStarted);
row('  per minute', (x) => (x.huntsStarted / mins).toFixed(0));
row('strikes', (x) => x.strikes);
row('barrel-roll celebrations', (x) => x.celebrations);
row('mean hunt lifetime (s)', (x) => mean(x.huntLifetimes).toFixed(3));
row('  ended by contact', (x) => x.endedByContact);
row('  ended by target gone', (x) => x.endedByTargetGone);
row('  ended by the child tapping', (x) => x.endedByTap);
row('mean acquisition dist', (x) => mean(x.acqDist).toFixed(2));
row('fish squirted clear', (x) => x.escapes);
row('  per minute', (x) => (x.escapes / mins).toFixed(0));
row('frames auto-hunting', (x) => pct(x.autoHuntFrames, totalFrames));
console.log('');
for (const phase of ['idle', 'notice', 'pursuit', 'strike', 'celebrate', 'recovery']) {
  row(`  phase: ${phase}`, (x) => pct(x.phaseFrames[phase], totalFrames));
}
console.log('\n  WHAT IT LOOKS LIKE FROM THE SOFA');
row('nose swing (rad/s)', (x) => (x.headingSwing / SECONDS).toFixed(2));
row('turn reversals/s', (x) => (x.reversals / SECONDS).toFixed(1));
row('path length (units)', (x) => x.pathLength.toFixed(0));
row('net displacement', (x) => x.netFromStart.toFixed(1));
row('path / net (1 = straight)', (x) => (x.pathLength / Math.max(x.netFromStart, 0.01)).toFixed(0));
row('fish-units shoved aside', (x) => x.escapeDisplacement.toFixed(0));

console.log('\n  visible fish over time');
console.log(`    unattended  ${unattended.popTrace.map(([t, n]) => `${t}s:${n}`).join(' ')}`);
console.log(`    played      ${played.popTrace.map(([t, n]) => `${t}s:${n}`).join(' ')}`);

console.log('\nGOLDEN FISH — what r9 could not see');
row('goldens spawned', (x) => x.goldensSpawned);
row('goldens culled uncaught', (x) => x.goldensCulled);
row('goldens caught', (x) => x.goldenCatches);
row('seconds a golden was alive', (x) => (x.goldenAliveFrames * DT).toFixed(0));
row('closest shark approach', (x) => (x.goldenClosestApproach === Infinity ? '—' : x.goldenClosestApproach.toFixed(2)));
row('frames inside dodge band', (x) => x.goldenFramesInDodgeBand);
row('dodges', (x) => x.goldenDodges);
row('auto-hunt latched it at', (x) => (x.goldenLatchedAt === null ? 'never' : x.goldenLatchedAt.toFixed(0) + 's'));
console.log(`  played WITH the latch fix       golden dodges ${playedFixed.goldenDodges}, caught ${playedFixed.goldenCatches}, score ${playedFixed.score}`);

console.log('\nARM D — A STAGED GOLDEN ENCOUNTER (the claim-2 experiment)');
console.log(`  GOLDEN_MAX_DODGES = ${g.GOLDEN_MAX_DODGES}; each trial gives the child 8s of dragging the shark at the golden.`);
const TRIALS = 200;
const arms = [
  ['control  (child engages first)', { preHunt: false, latchFix: false }],
  ['shipped  (auto-hunt looked first)', { preHunt: true, latchFix: false }],
  ['fixed    (latch cleared on end)', { preHunt: true, latchFix: true }],
];
console.log(`  ${''.padEnd(36)}${'mean dodges'.padStart(13)}${'0-dodge trials'.padStart(16)}${'caught'.padStart(9)}${'mean t-to-catch'.padStart(17)}`);
for (const [label, opts] of arms) {
  const runs = [];
  for (let i = 0; i < TRIALS; i++) runs.push(forcedGoldenEncounter({ ...opts, seed: SEED + i * 7919 }));
  const dodges = runs.map((r) => r.dodges);
  const caught = runs.filter((r) => r.caught);
  console.log(
    `  ${label.padEnd(36)}${mean(dodges).toFixed(2).padStart(13)}${`${dodges.filter((d) => d === 0).length}/${TRIALS}`.padStart(16)}${pct(caught.length, TRIALS).padStart(9)}${(caught.length ? mean(caught.map((r) => r.caughtAt)).toFixed(2) + 's' : '—').padStart(17)}`,
  );
}

console.log('\nWHERE THE THRASH STARTS — a sweep over how often the child touches the screen');
console.log('  AUTO_HUNT_IDLE_DELAY is 3.5s and every tap resets it, so a child tapping faster than');
console.log('  that never sees the auto-hunt at all. The question is what the gap costs once it opens.');
console.log(
  `  ${'tap every'.padStart(11)}${'hunts/min'.padStart(11)}${'escapes/min'.padStart(13)}${'% frames thrashing'.padStart(20)}${'score'.padStart(8)}${'mean visible'.padStart(14)}`,
);
for (const period of [2, 3, 3.5, 4, 5, 6, 8, 12, 20, 0]) {
  const r = runSession({ taps: period, latchFix: false });
  console.log(
    `  ${(period === 0 ? 'never' : period + 's').padStart(11)}` +
      `${(r.huntsStarted / mins).toFixed(0).padStart(11)}` +
      `${(r.escapes / mins).toFixed(0).padStart(13)}` +
      `${pct(r.autoHuntFrames, totalFrames).padStart(20)}` +
      `${String(r.score).padStart(8)}` +
      `${mean(r.popSamples).toFixed(1).padStart(14)}`,
  );
}

console.log('\nTHE CANDIDATE FIX, EVALUATED AGAINST THE CHARGE (unattended session — the worst case)');
console.log('  The charge is that the attract loop is frantic, never finishes anything, and shoves');
console.log('  the reef around. The fix has to move all three, and must not simply switch the shark off.');
const fixArms = [
  ['shipped', {}],
  ['A: min range 4.0', { minRange: 4.0 }],
  ['B: cooldown 2.5s', { cooldown: 2.5 }],
  ['C: let the hunt finish', { letItFinish: true }],
  ['A+B', { minRange: 4.0, cooldown: 2.5 }],
  ['A+B+C', { minRange: 4.0, cooldown: 2.5, letItFinish: true }],
  ['A+B+C+D (no auto-latch)', { minRange: 4.0, cooldown: 2.5, letItFinish: true, noAutoLatch: true }],
];
console.log(
  `  ${''.padEnd(26)}${'hunts/min'.padStart(10)}${'finished'.padStart(10)}${'life(s)'.padStart(9)}${'acq dist'.padStart(10)}${'escapes/min'.padStart(12)}${'swing r/s'.padStart(11)}${'rev/s'.padStart(7)}${'idle%'.padStart(7)}`,
);
const fixRuns = {};
for (const [label, opts] of fixArms) {
  const r = runSession({ taps: 0, ...opts });
  fixRuns[label] = r;
  console.log(
    `  ${label.padEnd(26)}` +
      `${(r.huntsStarted / mins).toFixed(0).padStart(10)}` +
      `${`${r.huntsCompleted}/${r.huntsStarted}`.padStart(10)}` +
      `${mean(r.huntLifetimes).toFixed(2).padStart(9)}` +
      `${mean(r.acqDist).toFixed(2).padStart(10)}` +
      `${(r.escapes / mins).toFixed(0).padStart(12)}` +
      `${(r.headingSwing / SECONDS).toFixed(2).padStart(11)}` +
      `${(r.reversals / SECONDS).toFixed(1).padStart(7)}` +
      `${pct(r.phaseFrames.idle, totalFrames).padStart(7)}`,
  );
}
{
  const r = fixRuns['A+B+C+D (no auto-latch)'];
  console.log(`\n  Under A+B+C+D the terminal beat splits: ${r.celebrations} barrel rolls over a real catch, ${r.missBeats} head-looks over a miss.`);
  console.log(`  Golden dodges in the same unattended run: shipped ${unattended.goldenDodges}, fixed ${r.goldenDodges}.`);
}

console.log('\nTUNING — the two numbers the fix invents, swept rather than guessed');
console.log("  Target: a stalk the eye can follow (lifetime near the FSM's designed 0.71s cycle, and an");
console.log('  approach long enough to read), at the pace of a sleeping cat (soul.md §5) rather than a');
console.log('  metronome — and the shark must still be doing SOMETHING, so idle must not approach 100%.');
console.log(
  `  ${'minRange'.padStart(10)}${'cooldown'.padStart(10)}${'hunts/min'.padStart(11)}${'life(s)'.padStart(9)}${'acq'.padStart(7)}${'escapes/min'.padStart(12)}${'rev/s'.padStart(7)}${'idle%'.padStart(8)}`,
);
for (const minRange of [3.0, 4.0, 5.0, 6.0]) {
  for (const cooldown of [1.5, 2.5, 4.0]) {
    const r = runSession({ taps: 0, minRange, cooldown, letItFinish: true, noAutoLatch: true });
    console.log(
      `  ${minRange.toFixed(1).padStart(10)}${cooldown.toFixed(1).padStart(10)}` +
        `${(r.huntsStarted / mins).toFixed(0).padStart(11)}${mean(r.huntLifetimes).toFixed(2).padStart(9)}` +
        `${mean(r.acqDist).toFixed(1).padStart(7)}${(r.escapes / mins).toFixed(0).padStart(12)}` +
        `${(r.reversals / SECONDS).toFixed(1).padStart(7)}${pct(r.phaseFrames.idle, totalFrames).padStart(8)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// The grid above is ONE run per cell, and every number in it is the mean of a
// stochastic session. Picking the winning cell off a single sample is exactly
// the mistake this whole probe exists to avoid, so the shortlist gets re-run
// across eight seeds and judged on the WORST seed, not the mean.
//
// The acceptance criteria, stated before the numbers are looked at:
//   readable   mean acquisition distance >= 3.0u (2x STRIKE_RANGE) AND mean
//              hunt lifetime >= 0.70s (the FSM's own designed cycle)
//   unhurried  turn reversals/s <= 2.0 and hunts/min <= 20 (shipped: 5.8, 824)
//   gentle     escapes/min as low as possible (shipped: 1116)
//   alive      idle occupancy <= 75%, or the fix is just an off switch
// ---------------------------------------------------------------------------
console.log('\nFINALISTS — the shortlist re-run over 8 seeds, judged on the WORST seed');
console.log('  readable: acq >= 3.0u and life >= 0.70s | unhurried: rev/s <= 2.0, hunts/min <= 20');
console.log('  gentle: escapes/min as low as possible | alive: idle <= 75%');
const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => SEED + i * 104729);
const worst = (xs, dir) => (dir === 'hi' ? Math.max(...xs) : Math.min(...xs));
console.log(
  `  ${'minRange'.padStart(10)}${'cooldown'.padStart(10)}${'hunts/min'.padStart(11)}${'life(s)'.padStart(17)}${'acq'.padStart(14)}${'escapes/min'.padStart(16)}${'rev/s'.padStart(14)}${'idle%'.padStart(14)}  verdict`,
);
for (const [minRange, cooldown] of [
  [3.0, 2.5],
  [4.0, 2.5],
  [4.0, 4.0],
  [6.0, 4.0],
]) {
  const rs = SEEDS.map((seed) => runSession({ taps: 0, seed, minRange, cooldown, letItFinish: true, noAutoLatch: true }));
  const hunts = rs.map((r) => r.huntsStarted / mins);
  const life = rs.map((r) => mean(r.huntLifetimes));
  const acq = rs.map((r) => mean(r.acqDist));
  const esc = rs.map((r) => r.escapes / mins);
  const rev = rs.map((r) => r.reversals / SECONDS);
  const idle = rs.map((r) => (r.phaseFrames.idle / totalFrames) * 100);
  const cell = (xs, d, f = 2) => `${mean(xs).toFixed(f)} (${worst(xs, d).toFixed(f)})`;
  const ok = worst(acq, 'lo') >= 3.0 && worst(life, 'lo') >= 0.7 && worst(rev, 'hi') <= 2.0 && worst(hunts, 'hi') <= 20 && worst(idle, 'hi') <= 75;
  console.log(
    `  ${minRange.toFixed(1).padStart(10)}${cooldown.toFixed(1).padStart(10)}${cell(hunts, 'hi', 0).padStart(11)}` +
      `${cell(life, 'lo').padStart(17)}${cell(acq, 'lo', 1).padStart(14)}${cell(esc, 'hi', 0).padStart(16)}` +
      `${cell(rev, 'hi', 1).padStart(14)}${cell(idle, 'hi', 0).padStart(14)}  ${ok ? 'PASSES' : 'fails'}`,
  );
}
console.log('  (each cell: mean over 8 seeds, worst seed in parentheses)');

console.log('\nDOES THE FIX COST THE CHILD ANYTHING? (same seed, shipped vs fixed, across attention spans)');
console.log(
  `  ${'tap every'.padStart(11)}${'score now'.padStart(11)}${'score fixed'.padStart(13)}${'escapes now'.padStart(13)}${'escapes fixed'.padStart(15)}${'rev/s now'.padStart(11)}${'rev/s fixed'.padStart(13)}`,
);
// The winner of the finalist round: it is the only cell that is best-in-class
// on the one criterion the other four did not separate (escapes/min, 58 vs
// 82-127), while holding the longest readable approach and the steadiest
// hunt rate seed-to-seed.
const FIX = { minRange: 6.0, cooldown: 4.0, letItFinish: true, noAutoLatch: true };
// Score is a stochastic quantity too — a single-seed score delta is not a cost,
// it is a sample. Eight seeds per cell, and the spread is printed.
for (const period of [2, 3.5, 5, 8, 12, 0]) {
  const as = SEEDS.map((seed) => runSession({ taps: period, seed }));
  const bs = SEEDS.map((seed) => runSession({ taps: period, seed, ...FIX }));
  const sc = (rs) => mean(rs.map((r) => r.score));
  const ec = (rs) => mean(rs.map((r) => r.escapes / mins));
  const rv = (rs) => mean(rs.map((r) => r.reversals / SECONDS));
  console.log(
    `  ${(period === 0 ? 'never' : period + 's').padStart(11)}` +
      `${sc(as).toFixed(0).padStart(11)}${sc(bs).toFixed(0).padStart(13)}` +
      `${ec(as).toFixed(0).padStart(13)}${ec(bs).toFixed(0).padStart(15)}` +
      `${rv(as).toFixed(1).padStart(11)}${rv(bs).toFixed(1).padStart(13)}`,
  );
}
console.log('  (means over the same 8 seeds; escapes are per minute)');

// The 5s and 8s cells cost score, and a score drop has two possible causes that
// deserve completely different verdicts. If the child's taps start MISSING, the
// fix breaks `soul.md`'s "every tap is a good tap" and is unshippable. If every
// tap still lands and the loss is frenzy duty, the fix has removed a bonus the
// thrash was farming on the child's behalf, which is the defect, not a cost.
console.log('\n  WHERE THAT SCORE WENT — the same eight seeds, broken out');
console.log(
  `  ${'tap every'.padStart(11)}${'taps'.padStart(8)}${'landed now'.padStart(12)}${'landed fixed'.padStart(14)}${'whiffed now'.padStart(13)}${'whiffed fixed'.padStart(15)}${'frenzy now'.padStart(12)}${'frenzy fixed'.padStart(14)}`,
);
for (const period of [5, 8, 12]) {
  const as = SEEDS.map((seed) => runSession({ taps: period, seed }));
  const bs = SEEDS.map((seed) => runSession({ taps: period, seed, ...FIX }));
  const m = (rs, f) => mean(rs.map(f));
  console.log(
    `  ${(period + 's').padStart(11)}${(SECONDS / period).toFixed(0).padStart(8)}` +
      `${m(as, (r) => r.tapsFired)
        .toFixed(1)
        .padStart(12)}${m(bs, (r) => r.tapsFired)
        .toFixed(1)
        .padStart(14)}` +
      `${m(as, (r) => r.tapsWithNoTarget)
        .toFixed(1)
        .padStart(13)}${m(bs, (r) => r.tapsWithNoTarget)
        .toFixed(1)
        .padStart(15)}` +
      `${`${((m(as, (r) => r.frenzyFrames) / totalFrames) * 100).toFixed(1)}%`.padStart(12)}${`${((m(bs, (r) => r.frenzyFrames) / totalFrames) * 100).toFixed(1)}%`.padStart(14)}`,
  );
}
// Not one tap one fish: the tap starts a lunge and the lunge eats everything it
// touches on the way through. So the score delta has to be per-tap yield, and
// the question is whether the thrash was keeping a knot of bystander fish
// parked on the shark's nose for the lunge to scoop up.
console.log('\n  FISH PER TAP — a tap fires a lunge, and the lunge eats whatever it passes through');
console.log(
  `  ${'tap every'.padStart(11)}${'eaten now'.padStart(11)}${'eaten fixed'.padStart(13)}${'per tap now'.padStart(13)}${'per tap fixed'.padStart(15)}${'fish near now'.padStart(15)}${'fish near fixed'.padStart(17)}`,
);
for (const period of [5, 8, 12]) {
  const as = SEEDS.map((seed) => runSession({ taps: period, seed }));
  const bs = SEEDS.map((seed) => runSession({ taps: period, seed, ...FIX }));
  const m = (rs, f) => mean(rs.map(f));
  const per = (rs) => m(rs, (r) => r.catches) / m(rs, (r) => r.tapsFired);
  console.log(
    `  ${(period + 's').padStart(11)}${m(as, (r) => r.catches)
      .toFixed(1)
      .padStart(11)}${m(bs, (r) => r.catches)
      .toFixed(1)
      .padStart(13)}` +
      `${per(as).toFixed(2).padStart(13)}${per(bs).toFixed(2).padStart(15)}` +
      `${m(as, (r) => mean(r.popSamples))
        .toFixed(1)
        .padStart(15)}${m(bs, (r) => mean(r.popSamples))
        .toFixed(1)
        .padStart(17)}`,
  );
}

console.log('\nPOPULATION — is the reef the size the design asks for?');
console.log(`  ${''.padEnd(24)}${'mean target'.padStart(13)}${'mean visible'.padStart(14)}${'peak visible'.padStart(14)}${'frenzy duty'.padStart(13)}`);
for (const [label, r] of [
  ['unattended', unattended],
  [`played (${TAP_PERIOD}s)`, played],
]) {
  console.log(
    `  ${label.padEnd(24)}${mean(r.targetSamples).toFixed(1).padStart(13)}${mean(r.popSamples).toFixed(1).padStart(14)}${String(Math.max(...r.popSamples)).padStart(14)}${pct(r.frenzyFrames, totalFrames).padStart(13)}`,
  );
}

console.log(`\n${allHold ? 'All structural premises hold.' : 'AT LEAST ONE PREMISE IS BROKEN — re-derive before quoting these numbers.'}\n`);
