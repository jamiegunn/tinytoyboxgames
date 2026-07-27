// session -- measures MONOTONY, which is the word the complaint actually used.
//
// WHAT WENT WRONG WITH THE PREVIOUS PLAN. The inherited diagnosis said four of
// the tap outcomes emit an identical particle burst and that a missed tap and a
// water tap are indistinguishable in both particle and sound, so the fix was to
// differentiate them. `.probe/tapfeel.mjs` ran the real handlers against a real
// particle engine and found EIGHT distinguishable responses and ZERO confusable
// pairs: six distinct sounds across eight outcomes, and both sound-sharing pairs
// separated on the visual channel (anemone/seaweed differ in particle preset;
// water/miss are the same preset and sound but dE*ab 33.4 apart, which is a
// different colour by any reading). `.probe/tapfeel-controls.mjs` passes five
// rigged controls including the load-bearing one -- two signatures differing
// only in particle COUNT are correctly called confusable -- so the metric is not
// merely counting struct fields. The diagnosis was wrong. I wrote it, and I
// believed it for three rounds, and it was wrong.
//
// WHAT IS ACTUALLY WRONG. An alphabet is not a sentence. The game HAS eight
// distinct answers to a tap; the question is how often a child, playing
// normally, encounters more than one of them, and what else happens in between.
// That is a property of the realised event stream over a session, not of the
// handler table, and nothing in this project has ever measured it.
//
// THE STATISTIC, AND THE ONE I HAD TO THROW AWAY FIRST. Walk a simulated
// session second by second and record every salient event with a type. Then
// score each 1 s mark by what happened in the trailing WINDOW seconds.
//
// My first score was the count of DISTINCT types in the window, monotonous when
// that count was <= 1. Run against the real game it returned 0.000 -- not one
// monotonous second in five minutes -- which is the kind of clean pass that
// should be checked before it is believed. It was wrong, and the `dominated`
// rig in .probe/session-controls.mjs is the proof: a stream that is 95% one
// wallpaper event with a rare punctuation every 20 s scores 0.000 under it,
// because the window does technically contain two labels. That is the shipped
// game's exact shape after round 4 axis 1 -- constant ambient traffic and taps,
// surprises almost never -- so the statistic had a ceiling exactly where the
// game sits, and would have told me there was nothing to fix.
//
// The headline is now the trailing-window PERPLEXITY: exp of the Shannon
// entropy of the event-type distribution inside the window, monotonous when it
// falls below 2, i.e. effectively fewer than two different kinds of thing
// happening. It scores `dominated` at 1.000 and an even two-type alternation at
// 0.000, so it is dominance being punished and not alphabet size.
//
// The anti-gaming property is stronger under perplexity than it was under the
// count. Raising the rate of the type that is ALREADY most common does not
// merely fail to help, it actively makes the number worse, because it deepens
// the dominance -- the `spam` control checks this at 10x. Only putting a
// different kind of event into a stretch that did not have one improves it.
// The raw distinct-count numbers are still reported alongside, so the switch is
// visible in every arm rather than being a claim about a run nobody can see.
//
// WHAT COUNTS AS AN EVENT. Only things a three-year-old would look up at.
// Ambient traffic is included as ONE type however many creatures cross frame,
// which is the honest treatment: round 4 axis 1 made the reef alive, and a
// living reef is a backdrop, not a plot. Folding 32 creature entries a minute in
// as 32 events would let axis 1's win paper over a flat loop, and the whole
// point of this instrument is to find out whether the loop is flat.
//
// REAL MODULES WHERE POSSIBLE. Surprise timing, type selection and duration come
// from the shipped updateSurprises against a stubbed SceneEnvironment -- so the
// interval distribution, the treasure-chest range gate and the durations are the
// game's, not my recollection of the game's. Ambient entries come from the same
// real-module-real-frustum path as .probe/onscreen.mjs. Catches come from a tap
// model, which is the one modelled component and is declared as such below.

import { Scene, PerspectiveCamera, Frustum, Matrix4, Vector3, Mesh, BoxGeometry, MeshBasicMaterial, Group } from 'three';
import { bundleTs } from '../tests/framework/_tsload.mjs';

const AMB = process.env.AMB || 'src/minigames/games/little-shark/environment/ambientLife.ts';
const SURP = process.env.SURP || 'src/minigames/games/little-shark/surprises.ts';
// FRENZY=off measures the loop as it was before the arc was added, so the
// before/after comparison runs the same harness, same seeds, same tap model,
// and differs only in whether the real frenzy module is driving.
const FRENZY = process.env.FRENZY || 'on';
// GATHER=off keeps the frenzy but stops the reef reacting to it, isolating the
// world-reaction from the tap-outcome change.
const GATHER = process.env.GATHER || 'on';
// Whether the frenzy pulls a surprise into its payoff window. See below.
const NUDGE = process.env.NUDGE || 'on';
// 'coarse' (default) stamps every ambient entry with one symbol; 'kind' stamps
// it with the species. See the ambient push site.
const AMBLABEL = process.env.AMBLABEL || 'coarse';
// Above this gather level the convergence is plainly visible -- creatures are
// heading at the child at 1.6x speed -- so an entry is labelled as such.
const GATHER_EVENT_THRESHOLD = 0.5;
const SECONDS = Number(process.env.SECS || 300);
const SEED = Number(process.env.SEED || 20260726);
const WINDOW = Number(process.env.WIN || 20);
// Seconds between taps by a child who is engaged. 3.5 s is deliberately
// generous to the game: a faster tapper sees MORE variety, so this errs toward
// the game looking better than it is.
const TAP_PERIOD = Number(process.env.TAPS || 3.5);

const amb = await bundleTs(AMB);
const surp = await bundleTs(SURP);
const fz = FRENZY === 'off' ? null : await bundleTs('src/minigames/games/little-shark/frenzy.ts');

const DT = 1 / 30;
const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = mulberry32(SEED);

const scene = new Scene();
const creatures = amb.createAmbientCreatures(scene);

// Stub SceneEnvironment. Only the two fields updateSurprises reads are needed:
// the coral list (colorShift walks it) and the treasure chest (its distance
// gates treasureSparkle). The chest sits at a fixed landmark position, which is
// what makes that gate meaningful.
const chest = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
chest.position.set(14, 0, -9);
scene.add(chest);
const corals = Array.from({ length: 12 }, () => new Group());
const env = { corals, treasureChest: chest, seaweeds: [] };

const FOV_DEG = (0.85 * 180) / Math.PI;
const POLAR = 0.95;
const DIST = 10;
const CAM_DY = 0.5 + Math.cos(POLAR) * DIST;
const CAM_DZ = -Math.sin(POLAR) * DIST;
const cam = new PerspectiveCamera(FOV_DEG, 1200 / 800, 0.1, 2000);
const frustum = new Frustum();
const mat = new Matrix4();
const camPos = new Vector3();
const RANGE = 35;

const tracked = [...creatures.jellyfish, ...creatures.squids, ...creatures.crabs, ...creatures.octopuses].map((x) => x.group ?? x);
// Which SPECIES each tracked object is, parallel to `tracked`. Used only by
// AMBLABEL=kind. See the ambient push site for why this arm exists.
const trackedKind = [].concat(
  creatures.jellyfish.map(() => 'jelly'),
  creatures.squids.map(() => 'squid'),
  creatures.crabs.map(() => 'crab'),
  creatures.octopuses.map(() => 'octo'),
);
const wasVisible = new Array(tracked.length).fill(false);

let sx = 0;
let sz = 0;
let heading = rnd() * Math.PI * 2;
const SHARK_SPEED = 1.5;
const BOUND = 44;

// TAP MODEL -- the one modelled component, stated plainly.
//
// A tap resolves to a fish catch when a fish is within the snap radius, and
// otherwise to a water tap. Rather than reconstruct the fish population and the
// screen-space snap test (which needs a renderer), the split is taken from the
// measured hit rate after round 3's snap-radius change: 38% of blind taps score.
// A child aims, so the real rate is higher; CATCH_P is settable and the headline
// is reported at 0.38 and 0.75 so the conclusion does not depend on it.
// Every so often the catch is a golden fish -- 1 in 12, matching the spawn mix.
const TAP_MODEL = process.env.TAPMODEL || 'exp';
const CATCH_P = Number(process.env.CATCHP || 0.55);
const GOLDEN_P = 1 / 12;

const events = [];
const push = (t, type) => events.push({ t: +t.toFixed(2), type });

let nextTap = 2.0;
let streak = 0;
const frenzyState = fz ? fz.createFrenzyState() : null;
let surpriseWasActive = false;
const surpriseState = surp.createSurpriseState();

const steps = Math.round(SECONDS / DT);
for (let i = 0; i < steps; i += 1) {
  const t = i * DT;

  heading += (Math.sin(t * 0.37 + SEED * 0.001) * 0.6 + (rnd() - 0.5) * 0.4) * DT;
  sx += Math.cos(heading) * SHARK_SPEED * DT;
  sz += Math.sin(heading) * SHARK_SPEED * DT;
  if (Math.hypot(sx, sz) > BOUND) heading += Math.PI * DT * 2;
  sx = Math.max(-BOUND, Math.min(BOUND, sx));
  sz = Math.max(-BOUND, Math.min(BOUND, sz));

  if (frenzyState) {
    const ev = fz.updateFrenzy(frenzyState, DT);
    if (ev) push(t, `frenzy:${ev.phase}`);
    // NUDGE=off measures the arc without the surprise coupling. The shipped
    // game pulls a surprise into the payoff window on the frenzy transition
    // (index.ts applyFrenzyEvent), because the previous measurement showed the
    // reef gather alone RAISED monotonousFrac at the low-skill arm: more
    // events, fewer kinds. This line is that fix, driven through the real
    // surprise module so the arm is a measurement and not a hope.
    if (ev && ev.phase === 'frenzy' && NUDGE !== 'off') surp.nudgeSurpriseSoon(surpriseState);
  }
  // The reef converges while the frenzy builds and peaks. GATHER=off measures
  // the arc without it, which is the arm that isolates how much of the effect
  // comes from the world reacting rather than from the tap outcome changing.
  const gather = frenzyState && GATHER !== 'off' ? fz.frenzyGather(frenzyState) : 0;
  amb.updateAmbientCreatures(creatures, DT, t, sx, sz, gather);
  surp.updateSurprises(surpriseState, t, DT, env, scene, sx, sz);

  // A surprise is one event at the moment it starts, named by its type.
  const nowActive = surpriseState.activeSurprise;
  if (nowActive && !surpriseWasActive) push(t, `surprise:${nowActive}`);
  surpriseWasActive = Boolean(nowActive);

  // Ambient traffic: one type, however many creatures.
  cam.position.set(sx, CAM_DY, sz + CAM_DZ);
  cam.lookAt(sx, 0.35, sz);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  frustum.setFromProjectionMatrix(mat);
  cam.getWorldPosition(camPos);
  for (let k = 0; k < tracked.length; k += 1) {
    const p = tracked[k].position;
    const vis = frustum.containsPoint(p) && camPos.distanceTo(p) <= RANGE;
    // A creature entering frame while the reef is gathering is a visibly
    // different event -- it is swimming at the child in a swirling crowd rather
    // than drifting past -- so it gets its own type. That is a judgement call
    // and it is a load-bearing one, so the output reports the phase statistic
    // BOTH ways: `phaseZ` with this distinction and `phaseZFlatAmbient` with
    // every ambient entry collapsed to one label. The gap between them is the
    // part of the improvement that rests on my calling it a different event,
    // and the flat number is the part that rests only on more creatures being
    // on screen at once, which no labelling choice can manufacture.
    //
    // AMBLABEL=kind is a test OF THIS INSTRUMENT, not of the game. The gather
    // was measured to roughly double `monotonousFrac` at the low-skill arm, and
    // the obvious suspect is that a converging reef pushes many creatures across
    // the frame edge at once while this line stamps every one of them with the
    // same symbol. A child does not see one symbol: jellyfish, squid, crab and
    // octopus are four different-looking animals. If the penalty disappears when
    // the label carries the species the game already renders, the penalty was
    // mine; if it survives, the cost is the game's and has to be designed out.
    if (vis && !wasVisible[k]) {
      const base = AMBLABEL === 'kind' ? `ambient:${trackedKind[k]}` : 'ambient';
      push(t, gather >= GATHER_EVENT_THRESHOLD ? `${base}:gather` : base);
    }
    wasVisible[k] = vis;
  }

  // Taps.
  if (t >= nextTap) {
    // Inter-tap intervals are EXPONENTIAL, not a metronome. This matters more
    // than it looks: a fixed period is more regular than a memoryless process,
    // so a deterministic tap model biases phaseZ negative all by itself, and I
    // would have been reporting a property of my own harness as a finding about
    // the game. TAPMODEL=fixed restores the metronome so the size of that
    // artefact can be measured rather than assumed away.
    nextTap = t + (TAP_MODEL === 'fixed' ? TAP_PERIOD : -Math.log(1 - rnd()) * TAP_PERIOD);
    // During the frenzy, fish are dense and generous: the hit rate rises and
    // golden fish are common. These two numbers are the frenzy's entire
    // mechanical content in the simulation, and they are stated here rather
    // than buried, because the measured improvement depends on them.
    const inFrenzy = frenzyState ? fz.isFrenzyActive(frenzyState) : false;
    const pCatch = inFrenzy ? Math.min(0.95, CATCH_P + 0.3) : CATCH_P;
    const pGolden = inFrenzy ? 0.35 : GOLDEN_P;
    if (rnd() < pCatch) {
      streak += 1;
      const golden = rnd() < pGolden;
      push(t, inFrenzy ? (golden ? 'frenzy:golden' : 'frenzy:catch') : golden ? 'catch:golden' : 'catch');
      if (streak === 3 || streak === 5 || streak === 10) push(t, `combo:${streak}`);
      if (frenzyState) {
        const ev = fz.registerFrenzyCatch(frenzyState);
        if (ev) push(t, `frenzy:${ev.phase}`);
      }
    } else {
      streak = 0;
      push(t, 'tap:water');
    }
  }
}

// ---- monotony ------------------------------------------------------------

/**
 * Event-type counts inside the trailing `win` seconds at each 1 s mark.
 *
 * @param {Array<{t: number, type: string}>} evts events, ascending in t
 * @param {number} seconds session length
 * @param {number} win trailing window length in seconds
 * @returns {Array<Map<string, number>>} one count map per 1 s mark
 */
function trailingCounts(evts, seconds, win) {
  const out = [];
  for (let s = win; s <= seconds; s += 1) {
    const c = new Map();
    for (const e of evts) if (e.t > s - win && e.t <= s) c.set(e.type, (c.get(e.type) ?? 0) + 1);
    out.push(c);
  }
  return out;
}

// exp(H) of a count map: the effective number of different kinds of thing.
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

// Longest consecutive run of true: the worst stretch, which is what a bored
// child remembers rather than the average.
function longestRun(flags) {
  let longest = 0;
  let run = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  return longest;
}

const windows = trailingCounts(events, SECONDS, WINDOW);
const distinct = windows.map((c) => c.size);
const trailingPerp = windows.map(perplexityOf);
const monoFlags = trailingPerp.map((v) => v < 2);
const monotonous = monoFlags.filter(Boolean).length / monoFlags.length;
const distinctFlags = distinct.map((v) => v <= 1);
const counts = {};
for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;

// Realised perplexity of the event-type distribution: the effective number of
// different things that happened, as opposed to the number that could have.
let H = 0;
for (const c of Object.values(counts)) {
  const p = c / events.length;
  H -= p * Math.log(p);
}

const longest = longestRun(monoFlags);

// ---- agency --------------------------------------------------------------
//
// The statistic above weights a jellyfish drifting past exactly as heavily as
// a catch, which is the right conservative choice for measuring how busy the
// scene is and the WRONG one for measuring whether the child is playing a game.
// Ambient traffic and surprises happen TO the child; they arrive on a timer and
// are identical whether the child taps or sits still. So the same statistic is
// recomputed over the events the child CAUSED. A large gap between the two is
// the signature of a busy backdrop in front of a thin loop.
const PLAYER_CAUSED = (type) => type.startsWith('catch') || type.startsWith('tap:') || type.startsWith('combo:') || type.startsWith('frenzy:');
const playerEvents = events.filter((e) => PLAYER_CAUSED(e.type));
const pWindows = trailingCounts(playerEvents, SECONDS, WINDOW);
const pPerp = pWindows.map(perplexityOf);
// An empty window has perplexity 0, which is monotonous by any reading: nothing
// the child did produced anything for twenty seconds.
const pFlags = pPerp.map((v) => v < 2);

// ---- arc / stationarity --------------------------------------------------
//
// "Monotonous" colloquially does not mean "few things happen", it means "the
// same things keep happening in the same way". Every windowed statistic above
// is blind to that by construction -- it is computed identically at t=30 and at
// t=560. A session with an arc has a type distribution that CHANGES over its
// duration; a flat loop is stationary. Jensen-Shannon divergence between the
// first and last third of the session measures exactly that, is symmetric,
// bounded in [0, ln 2], and is 0 iff the two distributions are identical.
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
// arcDivergence over thirds catches long-run DRIFT, and drift is only one kind
// of shape. A game built out of repeating build-and-payoff cycles is stationary
// at the scale of thirds -- both thirds contain the same mix of build and
// payoff -- and it is obviously not monotonous. Music is stationary at the
// scale of verses. So a second statistic is needed for LOCAL structure: do the
// 20 s windows differ from each other at all?
//
// phaseContrast is the mean JS divergence between each window's type
// distribution and the session-wide distribution. The problem is that this is
// nonzero for a purely random stream just from sampling noise, and the noise
// depends on the rate and the alphabet size -- so a raw value is unreadable and
// comparing it before-to-after a fix that changes the rate would be a trap of
// exactly the kind that has already cost this project three instruments.
//
// The fix is a null built from the data. Permute the event TIMESTAMPS while
// keeping the types, which destroys all temporal structure and preserves the
// rate and the marginal distribution exactly. The ratio real/shuffled is then
// the excess structure over a rate-matched memoryless stream: 1.0 means the
// session has no phases, above 1 means it does.
function phaseContrast(evts, seconds, win) {
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
// A bare real/null ratio failed its own memoryless control at 1.217, because it
// puts ONE draw of the real statistic over a MEAN of null draws: the numerator
// carries a full sample of noise the denominator has averaged away. The z-score
// against the null's measured spread has no hand-chosen band.
const SHUFFLES = 50;
function shuffledContrast(evts, seconds, win) {
  const vals = [];
  for (let s = 0; s < SHUFFLES; s += 1) {
    const times = evts.map((e) => e.t);
    for (let i = times.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [times[i], times[j]] = [times[j], times[i]];
    }
    const shuffled = evts.map((e, i) => ({ t: times[i], type: e.type })).sort((a, b) => a.t - b.t);
    vals.push(phaseContrast(shuffled, seconds, win));
  }
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1));
  return { mean: m, sd };
}

// ---- burstiness ----------------------------------------------------------
//
// WHY A SECOND SHAPE STATISTIC WAS NEEDED. phaseContrast compares each window's
// type MIX against the session's, and the timestamp-shuffle null it is scored
// against permutes which type sits at which time -- which preserves the window
// COUNTS exactly. So the whole phaseZ family is blind, by construction, to a
// phase in which the same things simply happen faster. That blind spot is not
// hypothetical: with the reef gathering, phaseZ reads +21 when a gathering
// ambient entry is labelled as its own type and +1.2 when it is collapsed back
// into plain `ambient`, even though the entry RATE genuinely rose by ~17%
// overall and far more than that locally. Nearly the whole of the +21 rests on
// a labelling judgement, and a number that depends on my judgement about what
// counts as a different event is not evidence about the game.
//
// burstiness is the missing half: the coefficient of variation of the event
// COUNT per window, which ignores types entirely. Its null cannot be the
// timestamp shuffle for the reason above, so it is n uniform times over the
// session -- same total rate, no structure. A stream with a payoff phase has
// window counts that vary more than uniform; a metronome varies less.
function windowCounts(evts, seconds, win) {
  const out = [];
  for (let s = win; s <= seconds; s += 1) {
    let n = 0;
    for (const e of evts) if (e.t > s - win && e.t <= s) n += 1;
    out.push(n);
  }
  return out;
}
function burstiness(evts, seconds, win) {
  const cs = windowCounts(evts, seconds, win);
  const m = cs.reduce((a, b) => a + b, 0) / cs.length;
  if (m === 0) return 0;
  const sd = Math.sqrt(cs.reduce((a, b) => a + (b - m) ** 2, 0) / cs.length);
  return sd / m;
}
function burstZ(evts, seconds, win) {
  if (evts.length < 10) return 0;
  const real = burstiness(evts, seconds, win);
  const vals = [];
  for (let s = 0; s < SHUFFLES; s += 1) {
    const times = Array.from({ length: evts.length }, () => rnd() * seconds).sort((a, b) => a - b);
    vals.push(
      burstiness(
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

const third = SECONDS / 3;
const bucket = (from, to) => {
  const c = new Map();
  for (const e of events) if (e.t >= from && e.t < to) c.set(e.type, (c.get(e.type) ?? 0) + 1);
  return c;
};
const arcDivergence = jsDivergence(bucket(0, third), bucket(2 * third, SECONDS));
// Event RATE drift as well as event MIX drift: a game that gets busier has an
// arc even if the mix is unchanged.
const rateFirst = [...bucket(0, third).values()].reduce((x, y) => x + y, 0) / third;
const rateLast = [...bucket(2 * third, SECONDS).values()].reduce((x, y) => x + y, 0) / third;
const pcReal = phaseContrast(events, SECONDS, WINDOW);
const pcNull = shuffledContrast(events, SECONDS, WINDOW);
// The same statistic with every ambient entry collapsed to one label, so the
// part of the result that depends on my calling a gathering entry a different
// kind of event is visible and separable from the part that does not.
const flatEvents = events.map((e) => (e.type === 'ambient:gather' ? { t: e.t, type: 'ambient' } : e));
const pcFlatReal = phaseContrast(flatEvents, SECONDS, WINDOW);
const pcFlatNull = shuffledContrast(flatEvents, SECONDS, WINDOW);

// Novelty: fraction of events whose type had not appeared in the previous 60 s.
let novel = 0;
for (let i = 0; i < events.length; i += 1) {
  let fresh = true;
  for (let j = i - 1; j >= 0 && events[j].t > events[i].t - 60; j -= 1) {
    if (events[j].type === events[i].type) {
      fresh = false;
      break;
    }
  }
  if (fresh) novel += 1;
}

// DUMP writes the raw realised event stream so .probe/session-phase.mjs can
// re-analyse the SAME session under different phase treatments without
// re-simulating -- which matters, because if the re-analysis re-ran the sim it
// would be comparing different sessions and any difference could be the seed.
if (process.env.DUMP) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.DUMP, JSON.stringify({ seconds: SECONDS, seed: SEED, catchP: CATCH_P, frenzy: FRENZY, events }));
}

console.log(
  JSON.stringify(
    {
      tag: process.env.TAG || 'arm',
      seconds: SECONDS,
      window: WINDOW,
      catchP: CATCH_P,
      tapModel: TAP_MODEL,
      frenzy: FRENZY,
      nudge: NUDGE,
      ambLabel: AMBLABEL,
      events: events.length,
      typesRealised: Object.keys(counts).length,
      perplexity: +Math.exp(H).toFixed(3),
      // HEADLINE. Fraction of the session whose trailing 20 s has an effective
      // event-type count below 2.
      monotonousFrac: +monotonous.toFixed(3),
      longestMonotonousRun: longest,
      meanTrailingPerplexity: +(trailingPerp.reduce((a, b) => a + b, 0) / trailingPerp.length).toFixed(2),
      // The superseded statistic, reported so the switch stays visible.
      distinctFrac: +(distinctFlags.filter(Boolean).length / distinctFlags.length).toFixed(3),
      meanTrailingDistinct: +(distinct.reduce((a, b) => a + b, 0) / distinct.length).toFixed(2),
      // Agency: the same statistic over events the child caused.
      playerCausedFrac: +(playerEvents.length / events.length).toFixed(3),
      agencyMonotonousFrac: +(pFlags.filter(Boolean).length / pFlags.length).toFixed(3),
      agencyLongestRun: longestRun(pFlags),
      agencyMeanPerplexity: +(pPerp.reduce((a, b) => a + b, 0) / pPerp.length).toFixed(2),
      // Arc: does minute 9 differ from minute 1 at all?
      arcDivergence: +arcDivergence.toFixed(4),
      phaseContrast: +pcReal.toFixed(4),
      phaseContrastNull: +pcNull.mean.toFixed(4),
      phaseRatio: +(pcNull.mean > 0 ? pcReal / pcNull.mean : 0).toFixed(3),
      // HEADLINE for local shape. z ~ 0 = the session has no phases at all;
      // a build-and-payoff cycle scores z ~ 28 on the control rig.
      phaseZ: +(pcNull.sd > 0 ? (pcReal - pcNull.mean) / pcNull.sd : 0).toFixed(2),
      phaseZFlatAmbient: +(pcFlatNull.sd > 0 ? (pcFlatReal - pcFlatNull.mean) / pcFlatNull.sd : 0).toFixed(2),
      // Rate structure, which no labelling choice can manufacture.
      burstZ: burstZ(events, SECONDS, WINDOW),
      burstZAmbient: burstZ(
        events.filter((e) => e.type.startsWith('ambient')),
        SECONDS,
        WINDOW,
      ),
      burstZPlayer: burstZ(playerEvents, SECONDS, WINDOW),
      rateFirstThird: +rateFirst.toFixed(3),
      rateLastThird: +rateLast.toFixed(3),
      noveltyPerMin: +((novel / SECONDS) * 60).toFixed(2),
      counts,
    },
    null,
    1,
  ),
);
