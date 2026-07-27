// onscreen -- INSTRUMENT C, and the first one that measures the complaint
// instead of a proxy for it.
//
// THREE INSTRUMENTS DIED TO GET HERE, all of them pixel-difference designs:
//
//  1. activity.mjs   counted salient objects over a free-running session.
//                    Failed its negative control: F = 1.038 on objects and
//                    0.606 on salient pixels, the wrong direction. The shark
//                    wanders and the camera follows, so two arms sampled
//                    different patches of reef.
//  2. lagcurve ratio changeFrac(lag k) / changeFrac(lag 1). Failed its POSITIVE
//                    control: surprises at 100% duty scored 1.958, baseline
//                    1.985, and a camera physically translating through the
//                    world scored 2.063. The ratio saturates near 2.0 no matter
//                    what the scene does -- it is a constant of the statistic,
//                    not a property of the reef.
//  3. lagcurve abs   the raw change fraction. Failed the negative control in
//                    the most embarrassing way available: surprises DISABLED
//                    scored +8.5% against baseline and surprises at 100% duty
//                    scored +9.7% -- same sign, same size. Both are between-run
//                    offsets. The reef is regenerated with unseeded Math.random
//                    on every load, so the run-to-run noise floor is ~9%, which
//                    is larger than every effect worth chasing. Freezing the
//                    ENTIRE ambient layer -- all 21 creatures, the school, the
//                    bubbles, both submarines -- moved it -2.4% (t = -0.72).
//
// That last number is the one that killed the whole family. If turning off
// every moving creature in the game is invisible to a pixel-difference measure,
// the measure is dominated by full-frame water shimmer and is not reporting on
// creatures at all.
//
// SO MEASURE THE CREATURES. The complaint was "there is not a lot of underwater
// activity going on other than a random sub". That is a statement about how
// many creatures are on screen and whether they are ever different ones. Both
// are exactly computable: build the real camera, run the real update loop, and
// test the real creature positions against the real frustum.
//
// The camera is reconstructed from the manifest descriptor
// (orbit, target (0,0.5,0), azimuth PI, polar 0.95, distance 10, fov 0.85 rad)
// which places it at (0, +5.817, -8.134) relative to its target, pitched 35.6
// degrees down over a 24.35-degree half-fov. Those two figures independently
// reproduce the "~36 degrees down over a 24.35-degree half-fov" written in
// index.ts:213 by an earlier pass, which is the check that the reconstruction
// is right.
//
// TWO NUMBERS COME OUT, because the complaint has two halves:
//
//   onScreen     mean creatures inside the frustum        -- "not a lot of
//                                                            activity"
//   distinctSeen how many of the 21 are EVER seen         -- "monotonous"
//
// The second is the one that matters. A reef can hold its population constant
// and still be monotonous if it is the same three crabs every time. Turnover is
// what separates traffic from furniture, and no pixel measure I built could
// see it.
//
// This instrument is deterministic: same seed, same numbers, every run. There
// is no renderer, so there is no shimmer, no swiftshader jitter, and no
// between-run reef regeneration to swamp the effect.

import { Scene, PerspectiveCamera, Frustum, Matrix4, Vector3 } from 'three';
import { bundleTs } from '../tests/framework/_tsload.mjs';

const MODULE = process.env.MODULE || 'src/minigames/games/little-shark/environment/ambientLife.ts';
const amb = await bundleTs(MODULE);

const DT = 1 / 30;
const SECONDS = Number(process.env.SECS || 300);
const MOVING = process.env.MOVING !== '0';
const LEGIBLE_RANGE = Number(process.env.RANGE || 35);
const SEED = Number(process.env.SEED || 20260726);

// Manifest camera descriptor, resolved.
const FOV_DEG = (0.85 * 180) / Math.PI;
const POLAR = 0.95;
const DIST = 10;
const CAM_DY = 0.5 + Math.cos(POLAR) * DIST;
const CAM_DZ = -Math.sin(POLAR) * DIST;

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const scene = new Scene();
const creatures = amb.createAmbientCreatures(scene);

// Every ambient creature that is meant to be part of the reef's population.
// The tiny-fish school is excluded: it is pinned to the shark by construction
// (centre = shark +/- 5) so it is always on screen in every build and would
// mask the thing being measured. Submarines are excluded for the same reason in
// reverse -- they are already known to dominate, and counting them would let a
// broken reef hide behind them.
const classOf = (c) => {
  const g = (arr, name) => arr.map((x) => ({ name, group: x.group ?? x, speed: x.speed ?? Infinity }));
  return [...g(creatures.jellyfish, 'jelly'), ...g(creatures.squids, 'squid'), ...g(creatures.crabs, 'crab'), ...g(creatures.octopuses, 'octo')];
};
const tracked = classOf(creatures);

const cam = new PerspectiveCamera(FOV_DEG, 1200 / 800, 0.1, 2000);
const frustum = new Frustum();
const mat = new Matrix4();
const camPos = new Vector3();

const rnd = mulberry32(SEED);
let sx = 0;
let sz = 0;
let heading = rnd() * Math.PI * 2;
const SHARK_SPEED = 1.5;
const BOUND = 44;

const seen = new Set();
// Turnover. `entries` counts off->on transitions: a creature that sits in frame
// for the whole run contributes 1, a creature that crosses frame five times
// contributes 5. Population without entries is furniture; entries is traffic.
const wasVisible = new Array(21).fill(false);
let entries = 0;
// Proof obligation for the out-of-frame catch-up in ambientLife.ts: no drifter
// may ever move faster than its nominal speed on a frame where the player can
// see it. `nominal` is read off the shipped Drifter records, and `speeding`
// counts violations. A non-zero count means the reef is visibly sprinting and
// the fix is invalid regardless of how good its population numbers look.
const prevPos = tracked.map((c) => c.group.position.clone());
let speeding = 0;
let worstVisibleSpeed = 0;
const onScreenSeries = [];
const legibleSeries = [];
const firstSeenAt = new Map();

const steps = Math.round(SECONDS / DT);
for (let i = 0; i < steps; i += 1) {
  const t = i * DT;

  if (MOVING) {
    // Smooth wander: heading integrates low-frequency noise, so the path is
    // the sort of lazy arc a child dragging the shark actually produces.
    heading += (Math.sin(t * 0.37 + SEED * 0.001) * 0.6 + (rnd() - 0.5) * 0.4) * DT;
    sx += Math.cos(heading) * SHARK_SPEED * DT;
    sz += Math.sin(heading) * SHARK_SPEED * DT;
    if (Math.hypot(sx, sz) > BOUND) heading += Math.PI * DT * 2;
    sx = Math.max(-BOUND, Math.min(BOUND, sx));
    sz = Math.max(-BOUND, Math.min(BOUND, sz));
  }

  amb.updateAmbientCreatures(creatures, DT, t, sx, sz);

  cam.position.set(sx, CAM_DY, sz + CAM_DZ);
  cam.lookAt(sx, 0.35, sz);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  frustum.setFromProjectionMatrix(mat);
  cam.getWorldPosition(camPos);

  let n = 0;
  let legible = 0;
  for (let k = 0; k < tracked.length; k += 1) {
    const p = tracked[k].group.position;
    const inView = frustum.containsPoint(p);
    if (inView) n += 1;
    const vis = inView && camPos.distanceTo(p) <= LEGIBLE_RANGE;
    if (vis) {
      legible += 1;
      if (!seen.has(k)) {
        seen.add(k);
        firstSeenAt.set(tracked[k].name + '#' + k, +t.toFixed(1));
      }
    }
    if (vis && !wasVisible[k]) entries += 1;

    // Horizontal speed this frame, compared against the drifter's nominal speed.
    // Only judged on frames where the creature is visible now or was visible a
    // frame ago -- a jump that starts and ends off camera is legitimate.
    const moved = Math.hypot(p.x - prevPos[k].x, p.z - prevPos[k].z) / DT;
    if ((vis || wasVisible[k]) && Number.isFinite(tracked[k].speed)) {
      if (moved > tracked[k].speed * 1.05 + 1e-6) speeding += 1;
      if (moved > worstVisibleSpeed) worstVisibleSpeed = moved;
    }
    prevPos[k].copy(p);

    wasVisible[k] = vis;
  }
  onScreenSeries.push(n);
  legibleSeries.push(legible);
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const frac = (a, f) => a.filter(f).length / a.length;

// Per-class totals, so a headline number cannot hide one class carrying it.
const byClass = {};
for (const name of ['jelly', 'squid', 'crab', 'octo']) {
  const idx = tracked.map((c, k) => (c.name === name ? k : -1)).filter((k) => k >= 0);
  byClass[name] = { n: idx.length, seen: idx.filter((k) => seen.has(k)).length };
}

console.log(
  JSON.stringify(
    {
      tag: process.env.TAG || 'arm',
      moving: MOVING,
      seconds: SECONDS,
      tracked: tracked.length,
      onScreen: { mean: +mean(onScreenSeries).toFixed(2), emptyFrac: +frac(onScreenSeries, (v) => v === 0).toFixed(3) },
      legible: {
        mean: +mean(legibleSeries).toFixed(2),
        emptyFrac: +frac(legibleSeries, (v) => v === 0).toFixed(3),
        atLeast3: +frac(legibleSeries, (v) => v >= 3).toFixed(3),
      },
      distinctSeen: seen.size,
      range: LEGIBLE_RANGE,
      entries,
      entriesPerMin: +((entries / SECONDS) * 60).toFixed(2),
      speedingFramesWhileVisible: speeding,
      worstVisibleSpeed: +worstVisibleSpeed.toFixed(3),
      byClass,
      firstSeenAt: Object.fromEntries([...firstSeenAt.entries()].slice(0, 30)),
    },
    null,
    1,
  ),
);
