// session-phase -- diagnoses a NULL RESULT on my own headline shape statistic.
//
// THE SITUATION THIS EXISTS TO RESOLVE. .probe/session-controls.mjs contains a
// rig called `cyclic` -- a repeating build-and-payoff cycle, deliberately built
// as "the exact shape of the fix I intend to ship" -- and phaseZ scores it
// +27.9 against a rate-matched shuffled null. I then shipped that shape as
// src/minigames/games/little-shark/frenzy.ts, drove the REAL module from
// .probe/session.mjs, and measured phaseZ before and after:
//
//     off: -0.105 / -0.820 / -1.383     on: -0.594 / -0.019 / +0.274
//
// Every other statistic moved a lot and in the right direction -- agency
// perplexity +53% to +63%, novelty +160%, worst player-caused dead stretch down
// 37-42%. The one statistic built specifically to detect this exact fix did not
// move. Exactly one of the following is true and it is not honest to ship until
// I know which:
//
//   H1 THE FIX IS TOO WEAK. In the simulation the frenzy's entire mechanical
//      content is a hit-rate bump and a golden-fish bump plus renamed event
//      types. The `cyclic` rig swaps in a DISJOINT alphabet. If so the
//      instrument is fine and the DESIGN needs a bigger payoff -- a real product
//      finding, not a measurement artefact.
//   H2 AMBIENT IS DROWNING IT. Ambient traffic is ~57% of all events and runs
//      unchanged straight through the frenzy. If so the fix works and is buried
//      under wallpaper, which is a finding about axis 1 colliding with axis 2.
//   H3 THE WINDOW IS WRONG. A 14 s frenzy plus 5 s afterglow inside a ~60 s
//      cycle, measured with a 20 s trailing window, may be smeared out.
//   H4 THE INSTRUMENT CANNOT SEE STRUCTURE IN A STREAM OF THIS SHAPE AT ALL.
//      581 events over 600 s is ~19 events per 20 s window against a 17-symbol
//      alphabet. The expected Jensen-Shannon divergence between a 19-sample
//      empirical distribution and its own parent is of order 0.1 nats purely
//      from sampling noise, and the measured phaseContrast is 0.086. The
//      statistic may be almost entirely noise here even though it works on the
//      control rigs, which are much denser.
//
// HOW THIS TELLS THEM APART. It re-analyses the SAME dumped session under
// different treatments, so nothing between treatments can be blamed on the seed.
//
//   * treatments `all` / `noAmbient` / `player` separate H2.
//   * a WIN sweep separates H3.
//   * a RELABEL LADDER separates H1 from H4. Level 0 is the stream as shipped.
//     Level 1 relabels ambient during the frenzy (the reef visibly changes).
//     Level 2 relabels every event during the frenzy into a disjoint alphabet,
//     which is the `cyclic` rig's contrast applied to the real stream's timing
//     and rate. If level 2 scores high, the instrument CAN see structure in a
//     stream of this density and the design is what is weak (H1). If even level
//     2 scores ~0, the instrument is the problem (H4) and phaseZ must be
//     retired for this stream, not reported as evidence about the game.
//   * a SHIFT control: level-2 relabelling applied to intervals of the same
//     number and length placed at random times instead of at the real frenzy
//     times. This must score ~0. Without it, a high level-2 score could just
//     mean "relabelling anything raises the number".
//
// Every statistic here is duplicated from .probe/session.mjs rather than
// imported, for the same reason .probe/session-controls.mjs duplicates them: a
// diagnosis that shares code with the thing it diagnoses can only show the two
// agree.

import { readFileSync } from 'node:fs';

const FILE = process.argv[2];
if (!FILE) throw new Error('usage: node .probe/session-phase.mjs <dump.json>');
const dump = JSON.parse(readFileSync(FILE, 'utf8'));
const SECONDS = dump.seconds;
const SHUFFLES = Number(process.env.SHUFFLES || 50);

let seed = Number(process.env.SEED || 987654321);
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const trailingCounts = (evts, seconds, win) => {
  const out = [];
  for (let s = win; s <= seconds; s += 1) {
    const c = new Map();
    for (const e of evts) if (e.t > s - win && e.t <= s) c.set(e.type, (c.get(e.type) ?? 0) + 1);
    out.push(c);
  }
  return out;
};

const jsDivergence = (a, b) => {
  const keys = new Set([...a.keys(), ...b.keys()]);
  const nA = [...a.values()].reduce((x, y) => x + y, 0);
  const nB = [...b.values()].reduce((x, y) => x + y, 0);
  if (!nA || !nB) return 0;
  let d = 0;
  for (const k of keys) {
    const p = (a.get(k) ?? 0) / nA;
    const q = (b.get(k) ?? 0) / nB;
    const m = (p + q) / 2;
    if (p > 0) d += 0.5 * p * Math.log(p / m);
    if (q > 0) d += 0.5 * q * Math.log(q / m);
  }
  return d;
};

const phaseContrast = (evts, seconds, win) => {
  const total = new Map();
  for (const e of evts) total.set(e.type, (total.get(e.type) ?? 0) + 1);
  let sum = 0;
  let n = 0;
  for (const w of trailingCounts(evts, seconds, win)) {
    if (w.size === 0) continue;
    sum += jsDivergence(w, total);
    n += 1;
  }
  return n ? sum / n : 0;
};

const phaseZ = (evts, seconds, win) => {
  if (evts.length < 10) return { z: 0, real: 0, null: 0, sd: 0, n: evts.length };
  const real = phaseContrast(evts, seconds, win);
  const vals = [];
  for (let s = 0; s < SHUFFLES; s += 1) {
    const times = evts.map((e) => e.t);
    for (let i = times.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [times[i], times[j]] = [times[j], times[i]];
    }
    vals.push(
      phaseContrast(
        evts.map((e, i) => ({ t: times[i], type: e.type })).sort((a, b) => a.t - b.t),
        seconds,
        win,
      ),
    );
  }
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1));
  return { z: +(sd > 0 ? (real - m) / sd : 0).toFixed(2), real: +real.toFixed(4), null: +m.toFixed(4), sd: +sd.toFixed(5), n: evts.length };
};

// Frenzy windows recovered from the event stream itself: a `frenzy:frenzy`
// marks the payoff starting and the following `frenzy:calm` marks the cycle
// closing, so [start, end) covers frenzy + afterglow.
const frenzyIntervals = (evts) => {
  const out = [];
  let open = null;
  for (const e of evts) {
    if (e.type === 'frenzy:frenzy') open = e.t;
    else if (e.type === 'frenzy:calm' && open !== null) {
      out.push([open, e.t]);
      open = null;
    }
  }
  if (open !== null) out.push([open, SECONDS]);
  return out;
};

const inAny = (t, ivals) => ivals.some(([a, b]) => t >= a && t < b);

// Relabel ladder. Level 1 is a design that is actually buildable: the reef
// itself reacts during the frenzy. Level 2 is the ceiling -- everything in the
// window becomes a different kind of thing -- and exists as an instrument check,
// not as a proposal.
const relabel = (evts, ivals, level) =>
  evts.map((e) => {
    if (!inAny(e.t, ivals)) return e;
    if (level === 2) return { t: e.t, type: `F:${e.type}` };
    if (level === 1 && e.type === 'ambient') return { t: e.t, type: 'ambient:frenzy' };
    return e;
  });

// NEGATIVE CONTROL for the ladder. Relabel the SAME NUMBER of events into the
// same disjoint alphabet, but scattered uniformly instead of clustered. The
// marginal distribution after relabelling is near-identical to level 2; the only
// thing removed is the clustering. This must score ~0, otherwise a high level-2
// score would only mean "renaming some events raises the number".
const scatterRelabel = (evts, ivals) => {
  const target = evts.filter((e) => inAny(e.t, ivals)).length;
  const idx = evts.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const chosen = new Set(idx.slice(0, target));
  return evts.map((e, i) => (chosen.has(i) ? { t: e.t, type: `F:${e.type}` } : e));
};

// Same number of intervals, same durations, random placement. Unlike the
// scatter control this KEEPS the clustering, so it is expected to score high
// too -- it is here to show that what level 2 measures is clustering per se and
// not something about the particular moments the frenzy occupies.
const shiftIntervals = (ivals) =>
  ivals.map(([a, b]) => {
    const len = b - a;
    const start = rnd() * Math.max(0, SECONDS - len);
    return [start, start + len];
  });

// DOSE RESPONSE. The ladder above is coarse: level 0 relabels whatever the
// shipped frenzy already changes and level 1 adds the whole ambient channel.
// What a designer actually needs to know is the THRESHOLD -- what share of the
// salient stream a payoff must recruit before it reads as a payoff at all. So
// relabel a controlled fraction of the in-interval events, ordered so the
// cheapest channel to change goes first, and find where z crosses.
const doseRelabel = (evts, ivals, frac) => {
  const idx = [];
  for (let i = 0; i < evts.length; i += 1) if (inAny(evts[i].t, ivals)) idx.push(i);
  for (let i = idx.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const chosen = new Set(idx.slice(0, Math.round(idx.length * frac)));
  return { evts: evts.map((e, i) => (chosen.has(i) ? { t: e.t, type: `F:${e.type}` } : e)), n: chosen.size };
};

const ivals = frenzyIntervals(dump.events);
const noAmbient = dump.events.filter((e) => e.type !== 'ambient');
const PLAYER = (t) => t.startsWith('catch') || t.startsWith('tap:') || t.startsWith('combo:') || t.startsWith('frenzy:');
const player = dump.events.filter((e) => PLAYER(e.type));

const WINS = (process.env.WINS || '10,20,30,45,60').split(',').map(Number);

const report = {
  file: FILE,
  seconds: SECONDS,
  frenzy: dump.frenzy,
  catchP: dump.catchP,
  events: dump.events.length,
  frenzyIntervals: ivals.length,
  frenzyDutySeconds: +ivals.reduce((a, [x, y]) => a + (y - x), 0).toFixed(1),
  eventsPerWindow20: +((dump.events.length / SECONDS) * 20).toFixed(1),
  // H2: does removing the wallpaper reveal the arc?
  byTreatment: {
    all: phaseZ(dump.events, SECONDS, 20),
    noAmbient: phaseZ(noAmbient, SECONDS, 20),
    player: phaseZ(player, SECONDS, 20),
  },
  // H3: is the 20 s window smearing a 19 s payoff?
  byWindow: Object.fromEntries(WINS.map((w) => [w, phaseZ(dump.events, SECONDS, w)])),
  // H1 vs H4: can the statistic see a maximally-contrasted frenzy on THIS
  // stream's timing and density?
  byRelabel: {
    level0: phaseZ(dump.events, SECONDS, 20),
    level1_reefReacts: phaseZ(relabel(dump.events, ivals, 1), SECONDS, 20),
    level2_disjoint: phaseZ(relabel(dump.events, ivals, 2), SECONDS, 20),
    level2_shiftedClustered: phaseZ(relabel(dump.events, shiftIntervals(ivals), 2), SECONDS, 20),
    level2_scatteredNegControl: phaseZ(scatterRelabel(dump.events, ivals), SECONDS, 20),
  },
  byDose: Object.fromEntries(
    [0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 1].map((f) => {
      const d = doseRelabel(dump.events, ivals, f);
      const r = phaseZ(d.evts, SECONDS, 20);
      return [f, { z: r.z, relabelled: d.n, shareOfStream: +(d.n / dump.events.length).toFixed(3) }];
    }),
  ),
};

console.log(JSON.stringify(report, null, 1));
