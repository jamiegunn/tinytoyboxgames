// Controls for session.mjs's monotony statistic.
//
// session.mjs is about to produce the headline number for round 4 axis 2, and
// that number will decide what I spend the next several hours building. This
// project has already shipped three instruments that returned a convenient
// number for a broken reason -- a pixel-difference activity metric that failed
// its own negative control, a lag-1 ratio that turned out to be a constant of
// the statistic, and a lag-1 absolute whose between-run noise floor was larger
// than every effect it claimed to see. So the statistic is run against rigged
// timelines whose right answers are known before it runs.
//
// TWO STATISTICS ARE EVALUATED SIDE BY SIDE, because the first one I wrote
// FAILED here and the failure is the most useful thing in this file.
//
//   distinct    fraction of 1 s marks whose trailing WIN seconds contain <= 1
//               DISTINCT event type. This is what session.mjs computed first.
//   perplexity  fraction of 1 s marks whose trailing WIN seconds have an event
//               type perplexity (exp of Shannon entropy) below 2 -- that is,
//               effectively fewer than two different kinds of thing happening.
//
// The rigs:
//
//   flat        one type every 4 s.            MUST read ~1.0 monotonous.
//   varied      a different type every 2 s.    MUST read ~0.0 monotonous.
//   spam        `flat` at 10x the rate.        MUST NOT beat `flat`. The control
//               against the cheapest possible "fix": emitting more of the thing
//               the game already emits most. If spam scores better than flat,
//               "spawn more bubbles" registers as a gameplay improvement and
//               every conclusion from this instrument is worthless.
//   rich-gets-richer
//               Half varied, half flat, plus a new type added ONLY during the
//               already-varied half. MUST barely move: improvement has to come
//               from filling empty stretches, not decorating full ones.
//   dominated   THE ONE THAT MATTERS. Two types forever, 95% one and 5% the
//               other -- a wallpaper stream plus a rare punctuation. This is
//               exactly the shape of the shipped game after round 4 axis 1:
//               ambient traffic and taps arrive constantly, surprises almost
//               never. A child watching this is watching one thing happen.
//               `distinct` scores it 0.0 -- perfectly varied -- because the
//               trailing window technically contains two type labels. That is
//               a ceiling effect, and it is why the raw distinct count is not
//               fit to be the headline.
//   twotype     Two types in genuine 50/50 alternation. NOT monotonous under
//               either statistic; included so `dominated` cannot be waved away
//               as "the metric just dislikes small alphabets". It is the
//               DOMINANCE that `dominated` is being punished for, not the two.
//
// The statistics are DUPLICATED here rather than imported from session.mjs, for
// the same reason tapfeel-controls duplicates analyse: a control that shares
// code with the thing it checks can only ever confirm the two agree, not that
// either is right.

const WIN = 20;
const SECONDS = 300;

// Type counts inside the trailing `win` seconds at each 1 s mark.
function trailingCounts(evts, seconds, win) {
  const out = [];
  for (let s = win; s <= seconds; s += 1) {
    const c = new Map();
    for (const e of evts) if (e.t > s - win && e.t <= s) c.set(e.type, (c.get(e.type) ?? 0) + 1);
    out.push(c);
  }
  return out;
}

function perplexityOf(counts) {
  let n = 0;
  for (const v of counts.values()) n += v;
  if (n === 0) return 0;
  let H = 0;
  for (const v of counts.values()) {
    const p = v / n;
    H -= p * Math.log(p);
  }
  return Math.exp(H);
}

function longestRun(flags) {
  let longest = 0;
  let run = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  return longest;
}

function score(evts, seconds, win) {
  const windows = trailingCounts(evts, seconds, win);
  const distinct = windows.map((c) => c.size);
  const perp = windows.map(perplexityOf);
  const dFlags = distinct.map((v) => v <= 1);
  const pFlags = perp.map((v) => v < 2);
  return {
    distinctFrac: +(dFlags.filter(Boolean).length / dFlags.length).toFixed(3),
    distinctRun: longestRun(dFlags),
    meanDistinct: +(distinct.reduce((a, b) => a + b, 0) / distinct.length).toFixed(2),
    perpFrac: +(pFlags.filter(Boolean).length / pFlags.length).toFixed(3),
    perpRun: longestRun(pFlags),
    meanPerp: +(perp.reduce((a, b) => a + b, 0) / perp.length).toFixed(2),
  };
}

// ---- rigs ----------------------------------------------------------------

const every = (period, type, from = 0, to = SECONDS) => {
  const out = [];
  for (let t = from; t <= to; t += period) out.push({ t: +t.toFixed(2), type });
  return out;
};

const flat = every(4, 'catch');
const spam = every(0.4, 'catch');

const varied = [];
for (let t = 0, i = 0; t <= SECONDS; t += 2, i += 1) varied.push({ t, type: `type${i % 40}` });

const richBefore = [];
for (let t = 0; t <= SECONDS; t += 2) richBefore.push({ t, type: t < SECONDS / 2 ? `v${Math.floor(t / 6) % 9}` : 'catch' });
const richAfter = [...richBefore];
for (let t = 0; t < SECONDS / 2; t += 5) richAfter.push({ t, type: 'newthing' });
richAfter.sort((a, b) => a.t - b.t);

// 95/5. The rare type lands once every 20 s -- present in essentially every
// trailing window, so `distinct` sees two types the whole way through.
const dominated = [];
for (let t = 0; t <= SECONDS; t += 1) dominated.push({ t, type: 'wallpaper' });
for (let t = 0; t <= SECONDS; t += 20) dominated.push({ t: t + 0.5, type: 'rare' });
dominated.sort((a, b) => a.t - b.t);

const twotype = [];
for (let t = 0, i = 0; t <= SECONDS; t += 1, i += 1) twotype.push({ t, type: i % 2 ? 'a' : 'b' });

// ---- run -----------------------------------------------------------------

const R = {};
for (const [k, v] of Object.entries({ flat, varied, spam, richBefore, richAfter, dominated, twotype })) R[k] = score(v, SECONDS, WIN);

const checks = [];
const check = (stat, name, ok, detail) => checks.push({ stat, check: name, ok, detail });

for (const stat of ['distinctFrac', 'perpFrac']) {
  const runKey = stat === 'distinctFrac' ? 'distinctRun' : 'perpRun';
  check(stat, 'flat reads as monotonous', R.flat[stat] >= 0.99, `${R.flat[stat]} want >=0.99`);
  check(stat, 'varied reads as not monotonous', R.varied[stat] <= 0.01, `${R.varied[stat]} want <=0.01`);
  check(stat, 'spamming the dominant type does not improve it', R.spam[stat] >= R.flat[stat], `spam=${R.spam[stat]} flat=${R.flat[stat]}`);
  check(stat, 'spam does not shorten the worst stretch', R.spam[runKey] >= R.flat[runKey], `spam=${R.spam[runKey]} flat=${R.flat[runKey]}`);
  const delta = +(R.richBefore[stat] - R.richAfter[stat]).toFixed(3);
  check(stat, 'adding variety to already-varied stretches barely helps', Math.abs(delta) <= 0.02, `delta=${delta} want |delta|<=0.02`);
  check(
    stat,
    'rich rig precondition: richBefore is roughly half monotonous',
    R.richBefore[stat] > 0.3 && R.richBefore[stat] < 0.7,
    `${R.richBefore[stat]} want 0.3..0.7`,
  );
  // The discriminating pair.
  check(stat, 'a 95/5 two-type stream reads as monotonous', R.dominated[stat] >= 0.9, `${R.dominated[stat]} want >=0.9`);
  check(stat, 'an even two-type alternation does NOT read as monotonous', R.twotype[stat] <= 0.01, `${R.twotype[stat]} want <=0.01`);
}

// ---- controls for the arc / stationarity statistic -----------------------
//
// session.mjs also reports a Jensen-Shannon divergence between the first and
// last third of the session, to catch the thing every windowed statistic above
// is blind to by construction: whether minute 9 differs from minute 1 at all.
// A divergence near zero on the real game is only meaningful if this statistic
// can produce a large one, so it is run against a rigged timeline that does
// have an arc. Without this control, "the game is stationary" would be
// indistinguishable from "my divergence code always returns zero" -- which is
// the exact failure mode that killed the lag-1 ratio instrument earlier in this
// project, where the number turned out to be a constant of the statistic.

function jsDivergence(a, b) {
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
}
const bucketOf = (evts, from, to) => {
  const c = new Map();
  for (const e of evts) if (e.t >= from && e.t < to) c.set(e.type, (c.get(e.type) ?? 0) + 1);
  return c;
};
const arcOf = (evts) => +jsDivergence(bucketOf(evts, 0, SECONDS / 3), bucketOf(evts, (2 * SECONDS) / 3, SECONDS)).toFixed(4);

// An arc: the session starts as gentle pottering and ends in a frenzy of a
// different kind of event. This is what a game WITH a shape looks like.
const arced = [];
for (let t = 0; t <= SECONDS; t += 2) arced.push({ t, type: t < SECONDS / 2 ? 'potter' : 'frenzy' });
// A partial arc: the mix shifts but both types persist throughout.
const partialArc = [];
for (let t = 0, i = 0; t <= SECONDS; t += 2, i += 1) {
  const pFrenzy = t / SECONDS;
  partialArc.push({ t, type: i % 10 < pFrenzy * 10 ? 'frenzy' : 'potter' });
}

const arcs = { flat: arcOf(flat), varied: arcOf(varied), dominated: arcOf(dominated), arced: arcOf(arced), partialArc: arcOf(partialArc) };
check('arc', 'a stationary timeline has ~zero divergence', arcs.flat <= 0.01, `flat=${arcs.flat} want <=0.01`);
check('arc', 'a shuffled-but-stationary timeline has ~zero divergence', arcs.dominated <= 0.01, `dominated=${arcs.dominated} want <=0.01`);
check('arc', 'a timeline with a real arc has a large divergence', arcs.arced >= 0.3, `arced=${arcs.arced} want >=0.3`);
check(
  'arc',
  'a gradual arc registers, between the two',
  arcs.partialArc > 0.05 && arcs.partialArc < arcs.arced,
  `partialArc=${arcs.partialArc} arced=${arcs.arced}`,
);

// ---- controls for the phase-contrast statistic ---------------------------
//
// arcDivergence over thirds only sees long-run drift. A game built from
// repeating build-and-payoff cycles is stationary at the scale of thirds and is
// plainly not monotonous, so arcDivergence alone would score a good fix as a
// non-fix. phaseContrast measures whether the 20 s windows differ from each
// other, normalised by a timestamp-shuffled null of the same stream so that the
// answer is excess structure over a rate-matched memoryless process rather than
// sampling noise.
//
// The `cyclic` rig is the load-bearing one here: it is the exact shape of the
// fix I intend to ship. If phaseContrast cannot tell a build-and-payoff cycle
// from a flat stream, then I would build the frenzy, measure no change, and
// either abandon a good fix or -- worse -- conclude the metric proved something.

function phaseContrastOf(evts, seconds, win) {
  const total = new Map();
  for (const e of evts) total.set(e.type, (total.get(e.type) ?? 0) + 1);
  const ws = trailingCounts(evts, seconds, win);
  let sum = 0;
  let n = 0;
  for (const w of ws) {
    if (w.size === 0) continue;
    sum += jsDivergence(w, total);
    n += 1;
  }
  return n ? sum / n : 0;
}
let seed = 12345;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
// A bare real/null RATIO was the first form of this and it failed its own
// memoryless control at 1.217 against a 0.85-1.15 band. The reason is that it
// compares ONE draw of the real statistic against a MEAN of many null draws, so
// the numerator carries a full sample's worth of noise that the denominator has
// averaged away, and the band is then a number I would be choosing by hand to
// make the control pass. The z-score against the null's own spread has no such
// free parameter: the noise is measured from the null rather than guessed at.
const SHUFFLES = 50;
function phaseRatioOf(evts, seconds, win) {
  const real = phaseContrastOf(evts, seconds, win);
  const nulls = [];
  for (let s = 0; s < SHUFFLES; s += 1) {
    const times = evts.map((e) => e.t);
    for (let i = times.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [times[i], times[j]] = [times[j], times[i]];
    }
    nulls.push(
      phaseContrastOf(
        evts.map((e, i) => ({ t: times[i], type: e.type })).sort((a, b) => a.t - b.t),
        seconds,
        win,
      ),
    );
  }
  const nm = nulls.reduce((a, b) => a + b, 0) / nulls.length;
  const nsd = Math.sqrt(nulls.reduce((a, b) => a + (b - nm) ** 2, 0) / (nulls.length - 1));
  return {
    real: +real.toFixed(4),
    null: +nm.toFixed(4),
    nullSd: +nsd.toFixed(5),
    ratio: +(nm > 0 ? real / nm : 0).toFixed(3),
    z: +(nsd > 0 ? (real - nm) / nsd : 0).toFixed(2),
  };
}

// A memoryless three-type stream: the shape of the shipped game. z ~ 0.
// Built FIVE times at different points of the RNG stream, because a single
// realisation of a null control that happens to pass proves nothing -- the
// question is whether the statistic is unbiased, and one draw cannot answer it.
const makePoisson = () => {
  const out = [];
  for (let t = 0; t < SECONDS; t += 0.5) {
    if (rnd() < 0.6) out.push({ t, type: rnd() < 0.6 ? 'ambient' : rnd() < 0.5 ? 'catch' : 'miss' });
  }
  return out;
};
const poissonReps = Array.from({ length: 5 }, () => phaseRatioOf(makePoisson(), SECONDS, WIN));
const poissonZ = poissonReps.map((r) => r.z);
const meanAbsZ = +(poissonZ.reduce((a, b) => a + Math.abs(b), 0) / poissonZ.length).toFixed(2);
const poisson = makePoisson();
// Build and payoff every 90 s: quiet catching, then a 20 s frenzy of a
// different kind of event. Stationary over thirds, obviously not monotonous.
const cyclic = [];
for (let t = 0; t < SECONDS; t += 0.5) {
  const inFrenzy = t % 90 >= 70;
  if (inFrenzy) {
    if (rnd() < 0.8) cyclic.push({ t, type: rnd() < 0.5 ? 'frenzy:fish' : 'frenzy:golden' });
  } else if (rnd() < 0.5) {
    cyclic.push({ t, type: rnd() < 0.7 ? 'ambient' : 'catch' });
  }
}

const phases = {
  poisson: phaseRatioOf(poisson, SECONDS, WIN),
  cyclic: phaseRatioOf(cyclic, SECONDS, WIN),
  flat: phaseRatioOf(flat, SECONDS, WIN),
  arced: phaseRatioOf(arced, SECONDS, WIN),
};
check('phase', 'a memoryless stream is unbiased over 5 realisations', meanAbsZ <= 1.5, `mean|z|=${meanAbsZ} of ${JSON.stringify(poissonZ)} want <=1.5`);
check(
  'phase',
  'no single memoryless realisation looks structured',
  Math.max(...poissonZ.map(Math.abs)) <= 3,
  `max|z|=${Math.max(...poissonZ.map(Math.abs))} want <=3`,
);
check('phase', 'a single-type stream has no phases either way', Math.abs(phases.flat.z) <= 3, `flat z=${phases.flat.z} want |z|<=3`);
check('phase', 'a build-and-payoff cycle registers strongly', phases.cyclic.z >= 5, `cyclic z=${phases.cyclic.z} want >=5`);
check('phase', 'a one-shot arc registers too', phases.arced.z >= 5, `arced z=${phases.arced.z} want >=5`);
check('phase', 'cyclic is stationary over thirds, so arcDivergence alone would miss it', arcOf(cyclic) <= 0.05, `arc(cyclic)=${arcOf(cyclic)} want <=0.05`);

// ---- controls for the burstiness statistic --------------------------------
//
// WHY THIS STATISTIC EXISTS AT ALL. phaseContrast is scored against a null that
// permutes which TYPE sits at which time. That null preserves the event times
// exactly, so window COUNTS are identical in the real stream and in every
// shuffle, and the entire phaseZ family is blind by construction to a phase in
// which the same things merely happen faster. That is not a hypothetical gap:
// with the reef gathering during the frenzy, phaseZ reads +21 when a gathering
// ambient entry is given its own label and +1.2 when it is collapsed back into
// plain `ambient`, so almost all of the +21 rests on my judgement about what
// counts as a different kind of event rather than on anything the code does.
//
// burstiness ignores types completely: it is the coefficient of variation of
// the event COUNT per window. Its null must therefore be uniform random times
// with the same total, not a timestamp shuffle -- a shuffle would be a constant
// of the statistic, which is exactly the failure mode that killed the lagcurve
// ratio earlier in this project.
//
// The rigs below try to break it in both directions. `regularBurst` is the
// load-bearing one: a stream whose EVENTS ARE PERFECTLY EVENLY SPACED must come
// out NEGATIVE, because a metronome is less variable than a Poisson process. If
// it did not, a high score would mean "many events" rather than "clumped
// events" and the statistic would reward raising the rate.
function burstinessOf(evts, seconds, win) {
  const cs = [];
  for (let s = win; s <= seconds; s += 1) {
    let n = 0;
    for (const e of evts) if (e.t > s - win && e.t <= s) n += 1;
    cs.push(n);
  }
  const m = cs.reduce((a, b) => a + b, 0) / cs.length;
  if (m === 0) return 0;
  return Math.sqrt(cs.reduce((a, b) => a + (b - m) ** 2, 0) / cs.length) / m;
}
function burstZOf(evts, seconds, win) {
  const real = burstinessOf(evts, seconds, win);
  const vals = [];
  for (let s = 0; s < SHUFFLES; s += 1) {
    const times = Array.from({ length: evts.length }, () => rnd() * seconds).sort((a, b) => a - b);
    vals.push(
      burstinessOf(
        times.map((t) => ({ t, type: 'x' })),
        seconds,
        win,
      ),
    );
  }
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1));
  return +(sd > 0 ? (real - m) / sd : 0).toFixed(2);
}

// Perfectly even spacing at the same total rate as `poisson`: must be NEGATIVE.
const regularBurst = [];
for (let t = 0; t < SECONDS; t += 1 / 1.2) regularBurst.push({ t, type: 'a' });
// Uniform random times: the null itself, must be ~0 over five realisations.
const makeUniform = (n) =>
  Array.from({ length: n }, () => rnd() * SECONDS)
    .sort((a, b) => a - b)
    .map((t) => ({ t, type: 'a' }));
const uniformZ = Array.from({ length: 5 }, () => burstZOf(makeUniform(600), SECONDS, WIN));
const uniformMeanAbs = +(uniformZ.reduce((a, b) => a + Math.abs(b), 0) / uniformZ.length).toFixed(2);
// Same total events as `regularBurst`, but two thirds of them packed into 20 s
// bursts every 90 s: must be strongly POSITIVE.
const clumped = [];
for (let t = 0; t < SECONDS; t += 0.25) {
  const inBurst = t % 90 >= 70;
  if (rnd() < (inBurst ? 0.75 : 0.09)) clumped.push({ t, type: 'a' });
}
// A rate DOUBLING with no clumping: must NOT score high, or the statistic is
// just measuring how much happens.
const denseUniform = makeUniform(1200);

const bursts = {
  regular: burstZOf(regularBurst, SECONDS, WIN),
  uniform: uniformZ,
  uniformMeanAbs,
  clumped: burstZOf(clumped, SECONDS, WIN),
  denseUniform: burstZOf(denseUniform, SECONDS, WIN),
  clumpedN: clumped.length,
  regularN: regularBurst.length,
};
check(
  'burst',
  'uniform random times are unbiased over 5 realisations',
  uniformMeanAbs <= 1.5,
  `mean|z|=${uniformMeanAbs} of ${JSON.stringify(uniformZ)} want <=1.5`,
);
check('burst', 'an evenly spaced metronome scores NEGATIVE', bursts.regular <= -2, `regular=${bursts.regular} want <=-2`);
check('burst', 'a clumped stream scores strongly positive', bursts.clumped >= 5, `clumped=${bursts.clumped} want >=5`);
check('burst', 'doubling the rate without clumping does not score', Math.abs(bursts.denseUniform) <= 3, `denseUniform=${bursts.denseUniform} want |z|<=3`);

const byStat = {};
for (const c of checks) {
  byStat[c.stat] ??= { pass: 0, fail: 0, failed: [] };
  if (c.ok) byStat[c.stat].pass += 1;
  else {
    byStat[c.stat].fail += 1;
    byStat[c.stat].failed.push(`${c.check} (${c.detail})`);
  }
}

console.log(
  JSON.stringify(
    {
      window: WIN,
      seconds: SECONDS,
      results: R,
      byStat,
      checks,
      // Only the statistic session.mjs actually headlines has to pass. The other
      // is reported so the reason for the switch is on the record rather than
      // being a thing I claim happened.
      arcs,
      phases,
      bursts,
      headlineStat: 'perpFrac',
      verdict:
        byStat.perpFrac.fail === 0 && byStat.arc.fail === 0 && byStat.phase.fail === 0 && byStat.burst.fail === 0 ? 'INSTRUMENT VALID' : 'INSTRUMENT INVALID',
    },
    null,
    1,
  ),
);
