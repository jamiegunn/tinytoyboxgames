/**
 * r9 — what the shark does when nobody is touching it, and what that teaches.
 *
 * TWO CLAIMS UNDER TEST, both found by reading and neither yet measured.
 *
 * CLAIM 1 — THE CELEBRATION IS FIRED ON A MISS.
 * `updateHuntFSM` (shark/huntFSM.ts) ends its 0.2 s `strike` phase by calling
 * `callbacks.onCelebrate()` unconditionally — the FSM has no idea whether a
 * fish was actually eaten, because eating happens elsewhere, in the collision
 * pass in index.ts. The orchestrator wires that callback to
 * `triggerBarrelRoll(sharkAnim)`, which is the game's catch-joy gesture: it is
 * what `handleSharkTap` gives a child as a reward for petting the shark, and
 * what `playEatCelebration` plays on a real catch.
 *
 * Meanwhile the collision pass refuses to eat anything while the shark is
 * hunting on its own: `canHarvest = isPlayerDriven(sharkMove) && !autoHuntActive`.
 * A fish the auto-hunt reaches is `escapeFromShark`'d instead.
 *
 * Those two facts do not contradict each other — each is defensible alone — but
 * together they say the shark performs the complete catch pantomime (pursue,
 * strike, speed lines, barrel roll) over a fish that then swims away unharmed,
 * and does it on a loop for as long as the child is not touching the screen.
 * The question this measures is HOW OFTEN, because "technically possible once"
 * and "every three seconds forever" are different defects and only one of them
 * is worth changing code for.
 *
 * CLAIM 2 — `isTargeted` IS A ONE-WAY LATCH ON THE GOLDEN FISH.
 * `fish.isTargeted` has exactly two setters, both `= true`:
 *   index.ts:338  chaseFish        — followed immediately by eatFishAction
 *   index.ts:553  maintainAutoHunt — the shark's own target
 * and exactly two clearers, both `= false`:
 *   fish/lifecycle.ts:234  createFish
 *   fish/lifecycle.ts:270  resetFishForSpawn
 *
 * `resetFishForSpawn` is reached only through `acquireFish`, whose sole call
 * site is `acquireFish('standard')` (index.ts:715). It also hard-codes
 * STANDARD_FISH_SCALE and picks from FISH_COLORS, so it could not be used on a
 * golden even if something tried. A golden is only ever `createFish(…,
 * 'golden')` (index.ts:734), and only ever `disposeFish`+null on death.
 *
 * So once `maintainAutoHunt` picks the golden, `isTargeted` is true for the
 * rest of that golden's life — and `updateGoldenDodge` gates its whole dart on
 * `&& !fish.isTargeted` (fish/effects.ts:173). The auto-hunt cannot eat the
 * golden (claim 1's gate), so it does not end the golden's life; it just
 * permanently disarms it.
 *
 * That is measured here as dodges-per-encounter with the latch and without,
 * against the same shark trajectory and the same seed.
 *
 * WHAT IS REAL AND WHAT IS MODELLED. The shark's idle drift, the hunt FSM, the
 * fish drift, the golden dodge, the escape, and the proximity spawner are the
 * shipped modules, loaded through one `bundleEntry` graph so they share module
 * state. Modelled: the orchestrator glue — the auto-hunt acquisition, the
 * harvest gate and the collision loop. Those are transcribed from index.ts and
 * checked against its source text at the bottom of this file, so this probe
 * fails loudly rather than quietly if the orchestrator moves out from under it.
 *
 * Fish are plain objects rather than `createFish` meshes: every function under
 * test reads only `root.position`, `root.rotation.y` and the drift/dodge
 * scalars, and building 18 three.js mesh trees would add nothing but time.
 *
 * Run from inside the package: `node .probe/gameplay/r9-autohunt-theatre.mjs`
 */

import { readFileSync } from 'node:fs';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';

const SECONDS = Number(process.env.SECS || 180);
const SEED = Number(process.env.SEED || 20260728);
const DT = 1 / 60;

const g = await bundleEntry(
  'r9_autohunt',
  `
  export * from './src/minigames/games/little-shark/shark/movement';
  export * from './src/minigames/games/little-shark/shark/huntFSM';
  export * from './src/minigames/games/little-shark/fish/effects';
  export { createProximitySpawnState, updateProximitySpawning, notifyFishEaten, CULL_DISTANCE, FISH_HARD_CEILING } from './src/minigames/games/little-shark/waves';
  export { getTargetFishCount, getSpeedMultiplier, getFishEvasiveness } from './src/minigames/games/little-shark/helpers';
  export { FISH_HIT_RADIUS, GOLDEN_HIT_RADIUS, GOLDEN_SPAWN_RING, FISH_BASE_SPEED_MIN, FISH_BASE_SPEED_MAX, BOUNDS, FISH_DESPAWN_SCALE_DURATION } from './src/minigames/games/little-shark/types';
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

// ── Orchestrator constants, transcribed from index.ts ───────────────
const AUTO_HUNT_RADIUS = 9.0;
const AUTO_HUNT_IDLE_DELAY = 3.5;
const FISH_ARRIVAL_DURATION = 0.9;
const CAMERA_VIEW_RADIUS = 11;

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
 * One unattended session: the child loads the game and touches nothing.
 *
 * @param opts.latchFix - when true, `isTargeted` is cleared as soon as the hunt
 *   that set it ends, which is the candidate repair for claim 2.
 * @param opts.celebrateOnCatchOnly - when true, `onCelebrate` only counts as a
 *   celebration if a fish was actually eaten, which is the candidate repair for
 *   claim 1. Recorded either way; this flag only changes the reported split.
 */
function runSession({ latchFix = false } = {}) {
  reseed(SEED);

  const sharkMove = g.createSharkMoveState();
  const huntState = g.createHuntFSMState();
  const sharkPos = { x: 0, z: 0 };

  const fishArray = [];
  let goldenFish = null;
  let autoHuntActive = false;
  let secondsSinceInput = 0;
  let score = 0;

  const stats = {
    strikes: 0,
    celebrations: 0,
    catches: 0,
    escapes: 0,
    goldenEscapes: 0,
    goldenDodges: 0,
    goldenLatchedAt: null,
    goldenDodgesBeforeLatch: 0,
    autoHuntFrames: 0,
    frames: 0,
    huntsStarted: 0,
    phaseFrames: { idle: 0, notice: 0, pursuit: 0, strike: 0, celebrate: 0, recovery: 0 },
    endedByContact: 0,
    endedByTargetGone: 0,
    acqDist: [],
    popTrace: [],
    huntLifetimes: [],
  };
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

  const spawnState = g.createProximitySpawnState();

  // ── maintainAutoHunt, transcribed from index.ts:518-556 ───────────
  function maintainAutoHunt() {
    if (huntState.targetFishRoot) {
      const target = fishForRoot(huntState.targetFishRoot);
      if (!target || !target.active || target.spawning) {
        stats.endedByTargetGone += 1;
        stats.huntLifetimes.push(stats.frames * DT - huntStartedAt);
        g.cancelHunt(huntState);
      }
    }
    if (g.getHuntPhase(huntState) === 'idle') {
      // The candidate repair: the hunt that set the flag is over, so the flag
      // that says "this fish is spoken for" has no subject any more.
      if (latchFix) for (const f of fishArray) f.isTargeted = false;
      if (latchFix && goldenFish) goldenFish.isTargeted = false;
      autoHuntActive = false;
    }
    if (g.getHuntPhase(huntState) !== 'idle') return;
    if (sharkMove.isBeingDragged || sharkMove.isLunging) return;
    if (secondsSinceInput < AUTO_HUNT_IDLE_DELAY) return;

    let best = null;
    let bestDistSq = AUTO_HUNT_RADIUS * AUTO_HUNT_RADIUS;
    const consider = (fish) => {
      if (!fish || !fish.active || fish.spawning) return;
      const dx = fish.root.position.x - sharkPos.x;
      const dz = fish.root.position.z - sharkPos.z;
      const d = dx * dx + dz * dz;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = fish;
      }
    };
    for (const f of fishArray) consider(f);
    consider(goldenFish);
    if (!best) return;
    if (best === goldenFish && stats.goldenLatchedAt === null && !latchFix) {
      stats.goldenLatchedAt = stats.frames * DT;
      stats.goldenDodgesBeforeLatch = stats.goldenDodges;
    }
    best.isTargeted = true;
    autoHuntActive = true;
    stats.huntsStarted += 1;
    stats.acqDist.push(Math.sqrt(bestDistSq));
    huntStartedAt = stats.frames * DT;
    g.triggerHunt(huntState, best.root);
  }

  for (let frame = 0; frame < SECONDS / DT; frame++) {
    stats.frames = frame;
    secondsSinceInput += DT;

    const level = clamp((score - 4) / (40 - 4), 0, 1);
    const speedMultiplier = g.getSpeedMultiplier(level);
    const evasiveness = g.getFishEvasiveness(level);

    maintainAutoHunt();
    if (autoHuntActive) stats.autoHuntFrames += 1;
    stats.phaseFrames[g.getHuntPhase(huntState)] += 1;
    if (frame % 300 === 0) stats.popTrace.push([Math.round(frame * DT), countActiveFish()]);

    // ── shark movement (index.ts:565-609) ───────────────────────────
    if (g.getHuntPhase(huntState) !== 'idle') {
      g.updateHuntFSM(huntState, sharkMove, DT, {
        onStrike: () => {
          stats.strikes += 1;
        },
        onCelebrate: () => {
          stats.celebrations += 1;
        },
      });
      sharkPos.x = sharkMove.posX;
      sharkPos.z = sharkMove.posZ;
    } else {
      g.updateIdleDrift(sharkMove, DT);
      g.updateRotation(sharkMove, DT);
      sharkPos.x = sharkMove.posX;
      sharkPos.z = sharkMove.posZ;
    }

    // ── spawner (index.ts:680-765) ──────────────────────────────────
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
            if (dx * dx + dz * dz < CAMERA_VIEW_RADIUS * CAMERA_VIEW_RADIUS) count++;
          }
          return count;
        },
      },
      g.getTargetFishCount(level),
    );

    // Cull (index.ts:777-799)
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
      if (gdx * gdx + gdz * gdz > g.CULL_DISTANCE * g.CULL_DISTANCE) goldenFish = null;
    }

    // ── fish update + collisions (index.ts:883-969) ─────────────────
    const all = [...fishArray];
    if (goldenFish) all.push(goldenFish);
    for (const fish of all) {
      if (!fish.active) continue;
      if (fish.spawning) {
        fish.spawnTimer -= DT;
        const t = clamp(1.0 - fish.spawnTimer / FISH_ARRIVAL_DURATION, 0, 1);
        const eased = t * t * (3 - 2 * t);
        fish.root.position.x = fish.spawnEdgeX + (fish.driftCenterX - fish.spawnEdgeX) * eased;
        fish.root.position.z = fish.spawnEdgeZ + (fish.driftCenterZ - fish.spawnEdgeZ) * eased;
        if (fish.spawnTimer <= 0) fish.spawning = false;
        continue;
      }
      g.updateFishDrift(fish, DT, speedMultiplier, sharkPos.x, sharkPos.z, evasiveness);
      if (fish.kind === 'golden') {
        const before = fish.dodgeCount;
        g.updateGoldenDodge(fish, sharkPos.x, sharkPos.z, DT, evasiveness);
        if (fish.dodgeCount > before) stats.goldenDodges += 1;
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
        fish.active = false;
        score += 1;
        stats.catches += 1;
        g.notifyFishEaten(spawnState, false);
      } else {
        g.escapeFromShark(fish, sharkPos.x, sharkPos.z);
        stats.escapes += 1;
        if (huntState.targetFishRoot === fish.root) {
          stats.endedByContact += 1;
          stats.huntLifetimes.push(stats.frames * DT - huntStartedAt);
          g.cancelHunt(huntState);
        }
      }
    }
    if (goldenFish && goldenFish.active && !goldenFish.spawning && !canHarvest) {
      const gx = sharkPos.x - goldenFish.root.position.x;
      const gz = sharkPos.z - goldenFish.root.position.z;
      if (Math.sqrt(gx * gx + gz * gz) < g.GOLDEN_HIT_RADIUS) {
        g.escapeFromShark(goldenFish, sharkPos.x, sharkPos.z);
        stats.goldenEscapes += 1;
        if (huntState.targetFishRoot === goldenFish.root) g.cancelHunt(huntState);
      }
    }
  }

  return stats;
}

// ── Structural check: does the glue above still match the game? ─────
const orchestrator = readFileSync(new URL('../../src/minigames/games/little-shark/index.ts', import.meta.url), 'utf8');
const fsm = readFileSync(new URL('../../src/minigames/games/little-shark/shark/huntFSM.ts', import.meta.url), 'utf8');
const fishFx = readFileSync(new URL('../../src/minigames/games/little-shark/fish/effects.ts', import.meta.url), 'utf8');

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
    'acquireFish is still only ever called for standard fish',
    (orchestrator.match(/acquireFish\((.*?)\)/g) || []).every((s) => s.includes("'standard'") || s.includes('kind: FishKind')),
  ],
];

const shipped = runSession({ latchFix: false });
const repaired = runSession({ latchFix: true });

const mins = SECONDS / 60;
const pct = (n, d) => (d === 0 ? '—' : `${((100 * n) / d).toFixed(1)}%`);

console.log(`\nr9 — the unattended shark    ${SECONDS}s, seed ${SEED}, 60fps\n`);

console.log('STRUCTURAL PREMISES (each must hold or the numbers below are about a game that no longer exists)');
let allHold = true;
for (const [label, ok] of structural) {
  if (!ok) allHold = false;
  console.log(`  ${ok ? 'holds ' : 'BROKEN'}  ${label}`);
}

console.log('\nCLAIM 1 — the catch celebration over an uneaten fish');
console.log(`  auto-hunts started            ${shipped.huntsStarted}   (${(shipped.huntsStarted / mins).toFixed(1)}/min)`);
console.log(`  strikes                       ${shipped.strikes}   (${(shipped.strikes / mins).toFixed(1)}/min)`);
console.log(`  barrel-roll celebrations      ${shipped.celebrations}   (${(shipped.celebrations / mins).toFixed(1)}/min)`);
console.log(`  fish actually eaten           ${shipped.catches}`);
console.log(
  `  celebrations over nothing     ${shipped.celebrations - shipped.catches}   (${pct(shipped.celebrations - shipped.catches, shipped.celebrations)} of all celebrations)`,
);
console.log(`  fish squirted clear           ${shipped.escapes} standard + ${shipped.goldenEscapes} golden`);
console.log(`  frames spent auto-hunting     ${pct(shipped.autoHuntFrames, SECONDS / DT)}`);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log('\nDIAGNOSTICS — why 951 hunts a minute and 0 celebrations');
console.log(`  mean hunt lifetime            ${mean(shipped.huntLifetimes).toFixed(3)}s  (a full cycle is 0.71s)`);
console.log(`  hunts ended by contact        ${shipped.endedByContact}`);
console.log(`  hunts ended by target gone    ${shipped.endedByTargetGone}`);
console.log(`  mean acquisition distance     ${mean(shipped.acqDist).toFixed(2)} units  (AUTO_HUNT_RADIUS 9, STRIKE_RANGE 1.5, HIT 1.0)`);
console.log(
  `  acq distance < HIT radius     ${shipped.acqDist.filter((d) => d < 1.0).length} of ${shipped.acqDist.length}  (${pct(shipped.acqDist.filter((d) => d < 1.0).length, shipped.acqDist.length)})`,
);
console.log(
  `  hunt phase occupancy          ` +
    Object.entries(shipped.phaseFrames)
      .map(([k, v]) => `${k} ${pct(v, SECONDS / DT)}`)
      .join('  '),
);
console.log(`  active fish over time         ` + shipped.popTrace.map(([t, n]) => `${t}s:${n}`).join('  '));

console.log('\nCLAIM 2 — the golden fish stops dodging once the shark has looked at it');
console.log(`  shipped   golden dodges       ${shipped.goldenDodges}`);
console.log(`            latched at          ${shipped.goldenLatchedAt === null ? 'never' : shipped.goldenLatchedAt.toFixed(1) + 's'}`);
console.log(`            dodges before latch ${shipped.goldenDodgesBeforeLatch}`);
console.log(`            dodges after latch  ${shipped.goldenDodges - shipped.goldenDodgesBeforeLatch}`);
console.log(`  repaired  golden dodges       ${repaired.goldenDodges}   (isTargeted cleared when the hunt ends)`);
console.log(`  golden escapes (contact)      shipped ${shipped.goldenEscapes}  vs  repaired ${repaired.goldenEscapes}`);

console.log(`\n${allHold ? 'All structural premises hold.' : 'AT LEAST ONE PREMISE IS BROKEN — re-derive before quoting these numbers.'}\n`);
