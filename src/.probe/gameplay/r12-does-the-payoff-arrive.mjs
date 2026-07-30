/**
 * r12 — is the frenzy payoff actually delivered?
 *
 * `frenzy.ts` exists because a previous round measured the session as having no
 * temporal shape: minute nine was statistically indistinguishable from minute
 * one. The module's answer is a build-and-payoff cycle, and the payoff's
 * headline is written into `updateSpawning`:
 *
 *     const targetNearby = getTargetFishCount(level) * (frenzyOn ? 2 : 1) * regionFishMultiplier(...)
 *
 * The reef target DOUBLES for the fourteen seconds of the frenzy. That is the
 * only channel of the payoff that lasts longer than a moment — the audio, the
 * vignette, the colour flash and the screen shake all fire once on the phase
 * transition and are over inside 0.5 s, and the HUD meter reads full and then
 * drains. Fourteen seconds is a long time for a three-year-old to be told that
 * something wonderful is happening. Something has to actually be happening.
 *
 * So this probe asks one question and refuses to accept an intention as an
 * answer: DOES THE POPULATION THE CHILD CAN SEE ACTUALLY RISE WHEN THE TARGET
 * DOUBLES, AND BY ENOUGH THAT A THREE-YEAR-OLD COULD TELL?
 *
 * WHY 1.33x IS THE BAR AND NOT SOME NUMBER I LIKED. Past three or four items a
 * child does not count, they estimate, and the approximate number system has a
 * ratio limit rather than a difference limit. Halberda & Feigenson (2008) put
 * three-year-olds at reliable discrimination around a 3:4 ratio and at chance
 * below it. So a reef of 30 has to become a reef of 40 to be seen as "more
 * fish". Ten extra fish that take a set from 30 to 33 are ten fish the child is
 * measurably unable to notice. This is the same literature the frenzy module
 * already cites for why the goal is never rendered as a numeral.
 *
 * The mechanism under suspicion, stated before it is measured so the
 * measurement can refute it: the spawner only ADDS. Nothing removes a fish for
 * being surplus to target — the only exits are being eaten and drifting past
 * `CULL_DISTANCE`, which is 22 against a `CAMERA_VIEW_RADIUS` of 11. So the
 * doubled target may act as a ratchet: the frenzy fills the reef, the frenzy
 * ends, and the reef stays full, which would mean each frenzy after the first
 * has nothing left to give.
 *
 * The session model is r11's, unchanged in every respect that touches physics,
 * spawning, difficulty or the frenzy state machine — all four are the real
 * modules. Only the instrumentation differs. Unattended sessions are not run:
 * after fix E an unattended shark cannot harvest at all, so it banks no catches
 * and the frenzy never fires. The frenzy is a played-session feature and is
 * measured as one.
 *
 * Run from inside the package: `node .probe/gameplay/r12-does-the-payoff-arrive.mjs`
 */

import { readFileSync } from 'node:fs';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';

const SECONDS = Number(process.env.SECS || 300);
const SEED = Number(process.env.SEED || 20260728);
const SEEDS = Number(process.env.SEEDS || 8);
const DT = 1 / 60;

const g = await bundleEntry(
  'r12_payoff',
  `
  export * from './src/minigames/games/little-shark/shark/movement';
  export * from './src/minigames/games/little-shark/shark/huntFSM';
  export * from './src/minigames/games/little-shark/fish/effects';
  export { createProximitySpawnState, updateProximitySpawning, notifyFishEaten, notifyGoldenLost, CULL_DISTANCE, FISH_HARD_CEILING, CAMERA_VIEW_RADIUS } from './src/minigames/games/little-shark/waves';
  export { getTargetFishCount, getSpeedMultiplier, getFishEvasiveness } from './src/minigames/games/little-shark/helpers';
  export * from './src/minigames/games/little-shark/frenzy';
  export { regionFishMultiplier } from './src/minigames/games/little-shark/environment/regions';
  export { createDifficultyController } from './src/minigames/framework/DifficultyController';
  export { FISH_HIT_RADIUS, GOLDEN_HIT_RADIUS, GOLDEN_SPAWN_RING, GOLDEN_MAX_DODGES, FISH_POINTS, FISH_BASE_SPEED_MIN, FISH_BASE_SPEED_MAX, BOUNDS, FISH_DESPAWN_SCALE_DURATION } from './src/minigames/games/little-shark/types';
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
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

const AUTO_HUNT_RADIUS = 9.0;
const AUTO_HUNT_IDLE_DELAY = 3.5;
const FISH_ARRIVAL_DURATION = 0.9;
const RAMP_START = 4;
const RAMP_END = 40;

const here = (p) => readFileSync(new URL(`../../src/minigames/games/little-shark/${p}`, import.meta.url), 'utf8');
const orchestrator = here('index.ts');
const frenzySrc = here('frenzy.ts');

function constFromSource(src, name, where) {
  const m = src.match(new RegExp(`const ${name} = ([\\d.]+);`));
  if (!m) throw new Error(`${name} is not declared in ${where} — this probe will not report a tuning it cannot find.`);
  return Number(m[1]);
}
const AUTO_HUNT_MIN_RANGE = constFromSource(orchestrator, 'AUTO_HUNT_MIN_RANGE', 'index.ts');
const AUTO_HUNT_COOLDOWN = constFromSource(orchestrator, 'AUTO_HUNT_COOLDOWN', 'index.ts');

/**
 * The multiplier the frenzy applies to the spawn target, READ OUT OF index.ts.
 *
 * This is the quantity on trial. Writing `2` here would let this probe report a
 * verdict on a payoff size the game does not have.
 */
const FRENZY_TARGET_MULTIPLIER = (() => {
  const m = orchestrator.match(/getTargetFishCount\(context\.difficulty\.level\) \* \(frenzyOn \? (\d+) : 1\)/);
  if (!m) throw new Error('the spawn target is no longer `difficulty x frenzy x region` — this probe is measuring a game that has moved.');
  return Number(m[1]);
})();

/**
 * The ratio at which a three-year-old can tell two sets apart.
 *
 * Halberda & Feigenson (2008): reliable at 3:4, at chance below it. Set as a
 * ratio and not a difference because that is how the approximate number system
 * works — the same literature `frenzy.ts` already cites for never printing the
 * goal as a numeral.
 */
const ANS_RATIO_3YO = 4 / 3;

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
 * One played session, instrumented per frame with the frenzy phase.
 *
 * @param opts.taps - seconds between taps.
 * @param opts.seed - RNG seed.
 * @param opts.drainMode - which candidate fix to apply, if any.
 *   'none'         - the shipped game: the spawner only ever adds.
 *   'visible-edge' - retire surplus from the far edge of the band the child can
 *                    see. Direct, and perceptually risky.
 *   'reservoir'    - retire surplus only from the offscreen 11-22 band. Safe by
 *                    construction, and only indirectly moves what the child sees.
 */
function runSession({ taps = 3.5, seed = SEED, drainMode = 'none' } = {}) {
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

  // Per-frame trace. Everything the report needs is derived from this rather
  // than from running totals, so a claim about "the ten seconds after a frenzy"
  // can be checked against the same data as a claim about the whole session.
  const trace = {
    phase: [],
    visible: [],
    target: [],
    score: [],
    catches: [],
    surplusRetired: 0,
    retireDistMin: Infinity,
    retireDistSum: 0,
  };
  let catches = 0;

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
    catches += 1;
    if (fish.kind === 'golden') goldenFish = null;
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
    // The golden is deliberately absent from this list (fix E, r11).
    if (!best) return;
    autoHuntActive = true;
    g.triggerHunt(huntState, best.root);
  }

  const totalFrames = Math.round(SECONDS / DT);
  for (let frame = 0; frame < totalFrames; frame++) {
    secondsSinceInput += DT;
    difficulty.update(score);
    const level = difficulty.level;
    const speedMultiplier = g.getSpeedMultiplier(level);
    const evasiveness = g.getFishEvasiveness(level);
    g.updateFrenzy(frenzyState, DT);

    if (taps > 0) {
      tapTimer -= DT;
      if (tapTimer <= 0) {
        tapTimer = taps;
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
        if (pick) {
          secondsSinceInput = 0;
          chaseFish(pick);
        }
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
    const targetNearby = g.getTargetFishCount(level) * (frenzyOn ? FRENZY_TARGET_MULTIPLIER : 1) * g.regionFishMultiplier(sharkPos.x, sharkPos.z);
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

    // ── the candidate fixes, run as further arms ──────────────────────
    //
    // The spawner has an appetite but no digestion: it fills toward the target
    // and nothing ever gives a fish back for being surplus. Both arms below give
    // fish back at a bounded rate, so the reef can fall as well as rise. The
    // rate cap exists because a reef that snaps back the instant a frenzy ends
    // would read as a punishment; at one fish per 0.25 s a doubling drains over
    // roughly the afterglow.
    //
    // They differ in WHERE they take the fish from, and that difference is the
    // whole question:
    //
    //   'visible-edge' retires the outermost fish INSIDE the band the child can
    //     see. It is the direct fix — it moves the number being measured — but a
    //     fish fades out on screen, and this probe cannot tell you that is safe.
    //     The tap model here always picks the fish NEAREST the shark, so it can
    //     never tap the one this retires; any "the child never lost a fish"
    //     statistic it produced would be an artefact of the model, not a finding.
    //     A real three-year-old can tap the far edge of the screen.
    //
    //   'reservoir' retires only fish BETWEEN the view radius and the cull
    //     distance — the offscreen crowd that would otherwise drift back in. The
    //     child cannot see these leave, so there is no fish to steal and nothing
    //     to prove about fingers. It is strictly safer and strictly weaker: it
    //     lowers the visible count only later, by starving the inflow. Whether
    //     that is still enough to clear the ANS bar is exactly what gets measured.
    //
    // Neither arm may take the fish the shark is currently hunting: that would
    // dissolve the target mid-chase, which is the Round 1 defect wearing a hat.
    if (drainMode !== 'none') {
      const surplus = countVisibleFish() - Math.round(targetNearby);
      if (surplus > 0 && frame % 15 === 0) {
        // `targetFishRoot`, not `targetFish` — the FSM holds the ROOT node, and a
        // `f === huntState.targetFish` guard would have compared against
        // undefined every frame, excluded nothing, and looked like it worked.
        const huntTargetRoot = huntState.targetFishRoot ?? null;
        const viewSq = g.CAMERA_VIEW_RADIUS * g.CAMERA_VIEW_RADIUS;
        const cullSq = g.CULL_DISTANCE * g.CULL_DISTANCE;
        let far = null;
        let farD = -1;
        for (const f of fishArray) {
          if (!f.active || f.spawning) continue;
          if (f.root === huntTargetRoot || (goldenFish && f === goldenFish)) continue;
          const dx = f.root.position.x - sharkPos.x;
          const dz = f.root.position.z - sharkPos.z;
          const d = dx * dx + dz * dz;
          const eligible = drainMode === 'visible-edge' ? d < viewSq : d >= viewSq && d < cullSq;
          if (eligible && d > farD) {
            farD = d;
            far = f;
          }
        }
        if (far) {
          far.active = false;
          far.despawnTimer = g.FISH_DESPAWN_SCALE_DURATION;
          trace.surplusRetired += 1;
          const dist = Math.sqrt(farD);
          trace.retireDistMin = Math.min(trace.retireDistMin, dist);
          trace.retireDistSum += dist;
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

    trace.phase.push(frenzyState.phase);
    trace.visible.push(countVisibleFish());
    trace.target.push(targetNearby);
    trace.score.push(score);
    trace.catches.push(catches);
  }

  trace.score_final = score;
  trace.catches_final = catches;
  return trace;
}

// ── Analysis ────────────────────────────────────────────────────────

/** Every frenzy window in a trace, as [startFrame, endFrame) pairs. */
function frenzyWindows(trace) {
  const out = [];
  let start = -1;
  for (let i = 0; i < trace.phase.length; i++) {
    const on = trace.phase[i] === 'frenzy';
    if (on && start === -1) start = i;
    if (!on && start !== -1) {
      out.push([start, i]);
      start = -1;
    }
  }
  if (start !== -1) out.push([start, trace.phase.length]);
  return out;
}

const sliceMean = (arr, a, b) => mean(arr.slice(Math.max(0, a), Math.min(arr.length, b)));

/**
 * The payoff as the child experiences it, per cycle.
 *
 * Baseline is the ten seconds BEFORE the frenzy opens — the brewing stretch the
 * child has just been cued to pay attention through. The payoff is the frenzy
 * window itself. A cycle "arrives" when the payoff clears the baseline by the
 * three-year-old discrimination ratio.
 */
function payoffPerCycle(trace) {
  const BASE = Math.round(10 / DT);
  return frenzyWindows(trace).map(([a, b]) => {
    const baseline = sliceMean(trace.visible, a - BASE, a);
    const during = sliceMean(trace.visible, a, b);
    const targetBase = sliceMean(trace.target, a - BASE, a);
    const targetDuring = sliceMean(trace.target, a, b);
    return {
      baseline,
      during,
      ratio: baseline > 0 ? during / baseline : 0,
      targetRatio: targetBase > 0 ? targetDuring / targetBase : 0,
      arrives: baseline > 0 && during / baseline >= ANS_RATIO_3YO,
      // The ratchet: where the reef sits ten seconds after the payoff is over,
      // relative to where it sat ten seconds before it started.
      after: sliceMean(trace.visible, b + Math.round(5 / DT), b + Math.round(15 / DT)),
    };
  });
}

/** Score and catch rate inside vs outside the frenzy window. */
function rates(trace) {
  const windows = frenzyWindows(trace);
  const inFrenzy = new Array(trace.phase.length).fill(false);
  for (const [a, b] of windows) for (let i = a; i < b; i++) inFrenzy[i] = true;
  let fIn = 0;
  let fOut = 0;
  let cIn = 0;
  let cOut = 0;
  let pIn = 0;
  let pOut = 0;
  for (let i = 1; i < trace.phase.length; i++) {
    const dc = trace.catches[i] - trace.catches[i - 1];
    const dp = trace.score[i] - trace.score[i - 1];
    if (inFrenzy[i]) {
      fIn += 1;
      cIn += dc;
      pIn += dp;
    } else {
      fOut += 1;
      cOut += dc;
      pOut += dp;
    }
  }
  return {
    catchesPerMinIn: fIn ? (cIn / (fIn * DT)) * 60 : 0,
    catchesPerMinOut: fOut ? (cOut / (fOut * DT)) * 60 : 0,
    pointsPerMinIn: fIn ? (pIn / (fIn * DT)) * 60 : 0,
    pointsPerMinOut: fOut ? (pOut / (fOut * DT)) * 60 : 0,
    duty: fIn / (fIn + fOut),
  };
}

// ── Structural premises ─────────────────────────────────────────────

/**
 * Which of this probe's two arms does the shipped source actually match?
 *
 * The earlier premise here asserted the ABSENCE of the drain — which meant it
 * was guaranteed to report BROKEN the moment the fix it exists to justify was
 * implemented, turning a passing probe into a failing one for the crime of
 * being right. A premise must describe what makes the measurement admissible,
 * not which side of the fix the game happens to be on today. So: read the
 * spawner and say which arm is live. Either answer is legitimate; not being
 * able to tell is not.
 */
const shippedArm = (() => {
  // Brace-matched, not `slice(start, start + 4000)`. The first version of this
  // used a fixed 4000-character window and confidently reported "no-drain"
  // against a source tree where the drain had already been written — the
  // function's comments are long enough that the new code sat past the window.
  // A premise that can only see the top of what it claims to describe is worse
  // than no premise, because it reports success.
  const start = orchestrator.indexOf('function updateSpawning');
  if (start === -1) throw new Error('updateSpawning is gone — this probe is measuring a game that has moved.');
  const open = orchestrator.indexOf('{', start);
  let depth = 0;
  let body = null;
  for (let i = open; i < orchestrator.length; i += 1) {
    if (orchestrator[i] === '{') depth += 1;
    else if (orchestrator[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        body = orchestrator.slice(open, i + 1);
        break;
      }
    }
  }
  if (body === null) throw new Error('updateSpawning is not brace-balanced — this probe cannot read the game.');
  return /surplusRetire/.test(body) ? 'drain' : 'no-drain';
})();

/**
 * The frenzy's payoff channels, counted rather than pattern-matched.
 *
 * The first form of this check stripped `getTargetFishCount[^;]+;` out of the
 * source and then looked for a surviving `frenzyOn ? n : 1`. The strip was
 * non-global and `getTargetFishCount` appears FIRST in the import on line 4, so
 * it ate the import, left the spawn line standing, and reported BROKEN against
 * a game that had not moved an inch. Never edit the source to make an assertion
 * easier — read the uses.
 */
const frenzyReadsTheSpawnTargetAndNothingElse = (() => {
  const uses = orchestrator.split('\n').filter((l) => l.includes('frenzyOn'));
  const declarations = uses.filter((l) => /const frenzyOn =/.test(l));
  const readers = uses.filter((l) => !/const frenzyOn =/.test(l));
  return declarations.length === 1 && readers.length === 1 && /targetNearby/.test(readers[0]);
})();

const premises = [
  ['the frenzy is still the only thing that scales the spawn target', FRENZY_TARGET_MULTIPLIER > 1],
  [
    'the frenzy is a phase of a build-and-payoff cycle, not a timer',
    /export function registerFrenzyCatch/.test(frenzySrc) && /state\.catches \+= 1;/.test(frenzySrc),
  ],
  ['the frenzy still lasts long enough to need substance', constFromSource(frenzySrc, 'FRENZY_DURATION', 'frenzy.ts') >= 8],
  [`the shipped spawner matches exactly one of this probe's two arms (it is the "${shippedArm}" arm)`, shippedArm === 'drain' || shippedArm === 'no-drain'],
  ['the only exits from the reef are being eaten and drifting past CULL_DISTANCE', /CULL_DISTANCE \* CULL_DISTANCE/.test(orchestrator)],
  ['the cull radius is well outside the band the child can see', g.CULL_DISTANCE > g.CAMERA_VIEW_RADIUS * 1.5],
  ['the frenzy pays nothing in points — the reef is the whole reward', frenzyReadsTheSpawnTargetAndNothingElse],
];

console.log(`\nr12 — does the frenzy payoff arrive?    ${SECONDS}s x ${SEEDS} seeds, seed base ${SEED}, 60fps\n`);
console.log(`  read out of index.ts:   frenzy target multiplier = ${FRENZY_TARGET_MULTIPLIER}x`);
console.log(
  `  read out of frenzy.ts:  FRENZY_DURATION = ${constFromSource(frenzySrc, 'FRENZY_DURATION', 'frenzy.ts')}s, FRENZY_AFTERGLOW = ${constFromSource(frenzySrc, 'FRENZY_AFTERGLOW', 'frenzy.ts')}s`,
);
console.log(`  the bar for "the child can tell": ${ANS_RATIO_3YO.toFixed(2)}x (Halberda & Feigenson 2008, 3:4 at age three)\n`);

console.log('STRUCTURAL PREMISES');
let allHold = true;
for (const [label, ok] of premises) {
  if (!ok) allHold = false;
  console.log(`  ${ok ? 'holds  ' : 'BROKEN '} ${label}`);
}

const CADENCES = [2, 3.5, 5];
const seeds = Array.from({ length: SEEDS }, (_, i) => SEED + i * 7919);

console.log('\nTHE PAYOFF, AS THE CHILD MEETS IT');
console.log('  Baseline is the 10s before the frenzy opens — the stretch the brewing cue told them to watch.');
console.log(
  `  ${'tap every'.padStart(10)}${'cycles'.padStart(8)}${'target x'.padStart(10)}${'reef before'.padStart(13)}${'reef during'.padStart(13)}${'realised x'.padStart(12)}${'cycles the child can see'.padStart(26)}`,
);

const perCadence = new Map();
for (const cadence of CADENCES) {
  const traces = seeds.map((seed) => runSession({ taps: cadence, seed }));
  perCadence.set(cadence, traces);
  const cycles = traces.flatMap(payoffPerCycle);
  const seen = cycles.filter((c) => c.arrives).length;
  console.log(
    `  ${`${cadence}s`.padStart(10)}${String(cycles.length).padStart(8)}${`${mean(cycles.map((c) => c.targetRatio)).toFixed(2)}x`.padStart(10)}${mean(
      cycles.map((c) => c.baseline),
    )
      .toFixed(1)
      .padStart(13)}${mean(cycles.map((c) => c.during))
      .toFixed(1)
      .padStart(13)}${`${mean(cycles.map((c) => c.ratio)).toFixed(2)}x`.padStart(12)}${`${seen} of ${cycles.length}`.padStart(26)}`,
  );
}

console.log('\nTHE RATCHET — where the reef sits before, during, and after each payoff');
console.log(
  `  ${'tap every'.padStart(10)}${'cycle'.padStart(8)}${'before'.padStart(10)}${'during'.padStart(10)}${'5-15s after'.padStart(13)}${'after / before'.padStart(16)}`,
);
for (const cadence of CADENCES) {
  const byIndex = [];
  for (const trace of perCadence.get(cadence)) {
    payoffPerCycle(trace).forEach((c, i) => {
      (byIndex[i] ??= []).push(c);
    });
  }
  byIndex.slice(0, 5).forEach((cs, i) => {
    if (cs.length < 3) return;
    const b = mean(cs.map((c) => c.baseline));
    const a = mean(cs.map((c) => c.after));
    console.log(
      `  ${(i === 0 ? `${cadence}s` : '').padStart(10)}${String(i + 1).padStart(8)}${b.toFixed(1).padStart(10)}${mean(cs.map((c) => c.during))
        .toFixed(1)
        .padStart(10)}${a.toFixed(1).padStart(13)}${`${b > 0 ? (a / b).toFixed(2) : '—'}x`.padStart(16)}`,
    );
  });
}

console.log('\nWHAT ELSE THE FRENZY PAYS');
console.log(
  `  ${'tap every'.padStart(10)}${'duty'.padStart(8)}${'catches/min in'.padStart(16)}${'out'.padStart(8)}${'points/min in'.padStart(15)}${'out'.padStart(8)}`,
);
for (const cadence of CADENCES) {
  const rs = perCadence.get(cadence).map(rates);
  console.log(
    `  ${`${cadence}s`.padStart(10)}${`${(mean(rs.map((r) => r.duty)) * 100).toFixed(0)}%`.padStart(8)}${mean(rs.map((r) => r.catchesPerMinIn))
      .toFixed(1)
      .padStart(16)}${mean(rs.map((r) => r.catchesPerMinOut))
      .toFixed(1)
      .padStart(8)}${mean(rs.map((r) => r.pointsPerMinIn))
      .toFixed(1)
      .padStart(15)}${mean(rs.map((r) => r.pointsPerMinOut))
      .toFixed(1)
      .padStart(8)}`,
  );
}

// ── Is the reef above the number the game itself asked for? ─────────
//
// Every ratio above is a reef compared against another reef. This compares the
// reef against the TARGET — the count the spawner computes and then never
// enforces downward. It decides whether a drain would bring the reef down TO
// the game's own number or BELOW it, which is the difference between a fix and
// a nerf, and no ratio in this file can answer it.
console.log('\nTHE REEF AGAINST THE GAME’S OWN NUMBER');
console.log('  The spawner computes a target every frame. Nothing ever brings the reef back down to it.');
console.log(`  ${'tap every'.padStart(10)}${'calm target'.padStart(13)}${'calm reef'.padStart(11)}${'over target by'.padStart(16)}`);
for (const cadence of CADENCES) {
  const traces = perCadence.get(cadence);
  const calmTarget = [];
  const calmReef = [];
  for (const t of traces) {
    for (let i = 0; i < t.phase.length; i += 1) {
      if (t.phase[i] === 'calm') {
        calmTarget.push(t.target[i]);
        calmReef.push(t.visible[i]);
      }
    }
  }
  const tgt = mean(calmTarget);
  const reef = mean(calmReef);
  console.log(`  ${`${cadence}s`.padStart(10)}${tgt.toFixed(1).padStart(13)}${reef.toFixed(1).padStart(11)}${`${(reef / tgt).toFixed(2)}x`.padStart(16)}`);
}

// ── The candidate fixes, measured against the same charge ───────────
console.log('\nTHE FIXES — a reef that can fall as well as rise');
console.log('  Surplus fish are retired at 4/s while the reef holds more than the target asks for,');
console.log('  never taking the hunt target or the golden. The arms differ only in WHERE they take from:');
console.log('    visible-edge  the far edge of the band the child can see  — direct, but a fish fades on screen');
console.log('    reservoir     the offscreen 11-22 band only               — the child cannot see these leave');
console.log(
  `  ${'arm'.padStart(14)}${'tap every'.padStart(10)}${'cycles'.padStart(8)}${'reef before'.padStart(13)}${'reef during'.padStart(13)}${'realised x'.padStart(12)}${'cycles the child can see'.padStart(26)}${'retired'.padStart(9)}${'nearest retire'.padStart(16)}`,
);
for (const arm of ['visible-edge', 'reservoir']) {
  for (const cadence of CADENCES) {
    const traces = seeds.map((seed) => runSession({ taps: cadence, seed, drainMode: arm }));
    const cycles = traces.flatMap(payoffPerCycle);
    const seen = cycles.filter((c) => c.arrives).length;
    const nearest = Math.min(...traces.map((t) => t.retireDistMin));
    console.log(
      `  ${arm.padStart(14)}${`${cadence}s`.padStart(10)}${String(cycles.length).padStart(8)}${mean(cycles.map((c) => c.baseline))
        .toFixed(1)
        .padStart(13)}${mean(cycles.map((c) => c.during))
        .toFixed(1)
        .padStart(13)}${`${mean(cycles.map((c) => c.ratio)).toFixed(2)}x`.padStart(12)}${`${seen} of ${cycles.length}`.padStart(26)}${mean(
        traces.map((t) => t.surplusRetired),
      )
        .toFixed(0)
        .padStart(9)}${(Number.isFinite(nearest) ? `${nearest.toFixed(1)}u` : '—').padStart(16)}`,
    );
    const scoreBefore = mean(perCadence.get(cadence).map((t) => t.score_final));
    const scoreAfter = mean(traces.map((t) => t.score_final));
    console.log(
      `  ${''.padStart(24)}score ${scoreBefore.toFixed(0)} -> ${scoreAfter.toFixed(0)}, catches ${mean(perCadence.get(cadence).map((t) => t.catches_final)).toFixed(0)} -> ${mean(traces.map((t) => t.catches_final)).toFixed(0)}`,
    );
  }
}
console.log(`\n  For scale: the child can see out to ${g.CAMERA_VIEW_RADIUS}u; fish are culled at ${g.CULL_DISTANCE}u.`);
console.log('  "nearest retire" is the closest any fish was ever retired, across every seed and cadence.');

console.log(allHold ? '\nAll structural premises hold.\n' : '\nSOME PREMISES ARE BROKEN — the numbers above describe this file, not the game.\n');
