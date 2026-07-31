/**
 * ROOMS ROUND 2 -- IS THE REWARD FOR FINDING SOMETHING DIFFERENT FROM TOUCHING A WALL?
 *
 * Run with vite already serving the package:
 *   npx vite --port 5199 --strictPort &
 *   node .probe/render/rooms-reward-legible.mjs
 *
 * WHY THIS ROUND EXISTS AND WHY ROUND 1 CAUSED IT
 * ----------------------------------------------
 * Round 1 established that a missed tap in a room produced a sound and nothing a
 * muted child could see, and fixed it: `createMissAcknowledgement` now finds the
 * depth from the geometry and emits `PARTICLES.sceneSparkle` there, visible at
 * every viewport in every room. That fix is right and it is shipped.
 *
 * It also removed the only thing that distinguished a discovery from a miss. Read
 * the seven authored room reactions -- kitchen kettle, three pots, three fruit,
 * living-room cushions, fireplace, floor lamp, cat -- and every one has the same
 * three lines: `triggerSound(...)`, `getParticleEngine(scene).emit(
 * PARTICLES.sceneSparkle, ...)`, and a short gsap tween on the prop. The middle
 * line is now byte-identical to what a tap on the plaster does. `createTapInteraction`
 * is a pass-through to `dispatcher.register` and adds no highlight, no flash and no
 * shared squash, so there is no fourth channel.
 *
 * So of the three channels a room reaction has, one (sound) is forbidden by the
 * Sound World clause from carrying comprehension, one (the burst) is now shared
 * with the fallback, and the whole distinction rests on the third.
 *
 * THE MECHANISM I SUSPECT, STATED BEFORE ANY OF IT IS MEASURED
 * -----------------------------------------------------------
 * The third channel is small in world units and the rooms are viewed from far
 * away, so I predict it is small in PIXELS -- much smaller than the burst it is
 * supposed to be distinguished against. Arithmetic from the shipped source, before
 * running anything:
 *
 *   - all three rooms orbit at `distance: 14` with `SCENE_CAMERA_FOV = 50`, and
 *     the kitchen's back-wall props sit near z = +8.2 against a camera at
 *     z = -13.0, which puts them about 20.7 units along the view axis;
 *   - at 720 px of frame height that is 360 * f / 20.7 = 37 px per world unit,
 *     with f = 1/tan(25 deg) = 2.1445;
 *   - the kettle tween is `rotation.z -> 0.22` about the kettle's own origin. Its
 *     furthest point is the knob at y = 0.46, which travels 2*0.46*sin(0.11) =
 *     0.101 units, or 3.8 px. Its visual mass, the body centred at y = 0.20,
 *     travels 0.044 units: 1.6 px;
 *   - a pot swings `pivot.rotation.x -> 0.45` about the rail, and its base hangs
 *     0.33-0.39 below, so the base travels about 0.17 units: 6.5 px;
 *   - the fruit is the outlier and the one I expect to survive: it TRANSLATES
 *     `position.y -> +0.45`, which is 0.45 units outright, near 20 px. Its other
 *     tween is a full 2*pi spin of a near-sphere in a single flat colour, which I
 *     expect to change no pixels at all;
 *   - the shared burst's core is 0.5 units (Round 1's `CORE_RADIUS`), so at the
 *     same depth it spans about 18.6 px of radius -- a 37 px blob of additive gold.
 *
 * The prediction, therefore: the kettle's reaction changes the picture by a few
 * pixels while the burst it shares with the wall changes it by hundreds, so on a
 * muted device the child cannot tell the kettle from the plaster behind it. The
 * pots are better and still small. The fruit clears, because it moves its whole
 * body instead of rotating it.
 *
 * WHAT THE OBSERVABLE IS, AND WHY IT IS NOT MY ARITHMETIC
 * ------------------------------------------------------
 * The arithmetic above can be wrong in a specific way that matters: it models each
 * tween as a rigid displacement, and two of these reactions are not displacements.
 * A 2*pi spin of a uniform sphere displaces every point on it and changes no
 * pixels. A `scale` yoyo displaces nothing at the centre and everything at the rim.
 * So the instrument reads the framebuffer instead: how many pixels of the rendered
 * frame differ from the frame before the tap, at the tween's worst moment.
 *
 * That is measured three ways per prop, and the third is what makes the other two
 * mean anything:
 *
 *   PROP     the prop's real handler with the particle engine muted at the engine.
 *   SPARKLE  the same burst the handler asked for, replayed at the same point, with
 *            no tween running.
 *   AMBIENT  the same time window advanced with NO tap. Every one of these rooms
 *            has looping idle motion, so some pixels change whether the child taps
 *            or not, and a reaction that does nothing would otherwise still score
 *            above zero.
 *
 * CAN THIS INSTRUMENT DETECT THE FAILURE IT WOULD BE DISMISSING?
 * -------------------------------------------------------------
 * The failure mode that would make this probe lie is under-counting: a reaction
 * that IS legible read as illegible, which would let me condemn working code. Two
 * guards. Changed pixels are counted at two thresholds, 8/255 and 24/255, so a
 * conclusion cannot rest on a cutoff -- if a reaction clears the low one and not
 * the high one, that is itself the finding ("it moved the buffer, not the
 * picture") and it is reported as such rather than rounded to zero. And the fruit
 * is a built-in positive control: it is the one prop whose tween is a whole-body
 * translation of a size the arithmetic says must be visible, so if the fruit reads
 * as illegible the instrument is broken and no other row may be believed.
 *
 * THE BAR, TAKEN FROM THE CODEBASE RATHER THAN FROM TASTE
 * ------------------------------------------------------
 * Two numbers are reported, in the pattern `nature-tap-reach.mjs` established.
 * `PROXIMITY_PX = 70` is this app's own written belief about screen distance: a tap
 * within 70 px of a small target was MEANT for it, i.e. at this scale 70 px is the
 * app's own claim about what counts as the same place. `STEADY_PX = 24` is the
 * strict column that probe added so that no conclusion depends on the generous
 * figure. A reaction whose changed region does not span even the strict figure has
 * not visibly happened.
 *
 * The primary verdict, though, is a RATIO and invents nothing at all: prop pixels
 * over sparkle pixels, at the same prop, same depth, same frame. Under 1.0 the
 * shared burst dominates the percept and the reward looks like the fallback. That
 * comparison is internal to the app, so it cannot be wrong about the screen.
 *
 * PASS CONDITION FOR ANY FIX, COMMITTED TO BEFORE MEASURING
 * --------------------------------------------------------
 * A fix passes when, at every one of the five shipping viewports in all three
 * rooms, EVERY registered non-background prop reaction (a) changes at least as many
 * pixels at the 24/255 threshold as the shared burst does, i.e. ratio >= 1.0, and
 * (b) spans at least STEADY_PX = 24 px of extent, and (c) exceeds the ambient floor
 * measured over the same window by at least 4x, so a reaction cannot be credited
 * to a breathing cat. Anything short of that is a failed fix and is published as
 * one.
 *
 * AMENDMENT TO (c), MADE AFTER THE FIRST RUN AND RECORDED RATHER THAN SUBSTITUTED
 * -----------------------------------------------------------------------------
 * (c) as pre-committed above is ill-posed, and it is ill-posed in the direction that
 * flatters the charge, which is why it has to be said out loud rather than quietly
 * rewritten. "The ambient floor" was every changed pixel in the crop, and the crop is
 * sized to a burst's whole reach, so a breathing owl on the far side of a doorway was
 * counted as competition for a tap on a kettle. It competes for neither the same
 * pixels nor the same attention, and no fix to the kettle could ever move it.
 *
 * The bar (c) should have been, and is measured as, `ambMask`: ambient change
 * restricted to the pixels the prop's own reaction changes, maximised independently
 * over the window. Both numbers are printed. `ambAll` — the original — stays in the
 * table so the amendment can be audited instead of taken on trust, and the verdict
 * reports what each of them concludes.
 *
 * A SECOND EXCLUSION, STATED BEFORE IT WAS APPLIED AND THEN CAUGHT BEING WRONG
 * ---------------------------------------------------------------------------
 * Two registered kitchen targets are doorways, not props: their handlers navigate.
 * Grading a scene transition as tap delight is meaningless — the doorway "passed"
 * with 6957 changed pixels — so they are out of scope and listed separately. That
 * exclusion is right. The TEST for it was wrong, and it was wrong in the one way
 * that mattered: `emitted === 0`, "a target that asks for no burst must be a
 * doorway."
 *
 * Three of the twelve room handlers also emit no burst, and they emit none because
 * they are DEFECTIVE — they answer a hit with the miss's own fallback cue and no
 * particles at all, so since Round 1 gave a missed room tap a sparkle, the miss is
 * answered more richly than the hit. `emitted === 0` is simultaneously this
 * runner's exclusion criterion and this round's finding. Every one of the three
 * would have been filed under "navigates rather than delights" and the run would
 * have reported a clean sweep with total confidence.
 *
 * That is the discipline "interrogate whether your instrument can even detect the
 * failure you are dismissing" landing on the author rather than on the code, and it
 * is left written here rather than tidied away, because the next person to reach for
 * a cheap proxy should see what this one cost. Navigation is now identified
 * POSITIVELY: `room.ts` records every `nav.navigateTo` call and the row carries
 * `navigated` plus the destination it asked for. A target that emits nothing and
 * navigates nowhere is now graded, which is the whole point.
 *
 * BAR (d), ADDED AFTER THE PRE-REGISTERED CHARGE WAS REFUTED
 * ---------------------------------------------------------
 * (a) through (c) all ask whether a prop's own motion can be told apart from the
 * burst it shares with the miss. Round 2's measurement refuted that charge — every
 * authored kitchen prop clears it at 1.243-2.341 — so the surviving question is
 * blunter, and it is bar (d): A HIT MUST CHANGE AT LEAST AS MANY PIXELS AS A MISS AT
 * THE SAME PLACE. A child who taps a lamp and gets less than a child who taps the
 * shelf beside it has been taught that finding things is not worth doing.
 *
 * It is decided per row without a fourth rendering pass, because it is decidable by
 * deduction. `missAcknowledgement.ts:139,158` emits `PARTICLES.sceneSparkle` with no
 * overrides. So:
 *   - a prop that emits `sceneSparkle` with no `count` override draws everything the
 *     miss draws AND moves itself, a superset, and PASSES (d) by construction;
 *   - a prop that emits nothing is measured: `propHigh` (its tween alone) against
 *     `sparkleHigh`, which is a REAL miss fired through the prop's own screen point by
 *     the shipped `createMissAcknowledgement`. It was briefly a burst this probe placed
 *     at the prop's own world position, which is inside the prop, where the depth test
 *     buried it: `sparkleHigh` measured 0 and an emit-nothing prop would have scored
 *     `Infinity` and passed. That is published in the round, not just fixed;
 *   - a prop that emits a different preset, or the same preset with the count turned
 *     down, is measured the same way and flagged, because preset identity alone would
 *     pass `sceneSparkle` with `{ count: 4 }` while it draws a tenth of the burst.
 * Summing `propHigh + sparkleHigh` would have been the obvious numerator and is
 * wrong: the two pixel sets overlap and the sum double-counts every pixel in both.
 * A live unmuted re-fire is barred by five handler latches (see `__firePropMuted`).
 */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// PROXIMITY_PX is IMPORTED, not restated. Round 11 found this one constant
// obtained four different ways across seventeen sites — six hard literals, eight
// hand-rolled regex resolvers, and two real imports — with the correct mechanism
// already present and adopted twice. A regex over the source cannot survive the
// constant becoming an expression; a literal cannot survive anything.
//
// The bundle slug is deliberately shared with the twelve sibling probes that
// need the same constant. bundleEntry emits `.tstest-tmp/entry_<slug>.bundle.mjs`,
// so a shared slug means a shared temp file — safe here only because the entry
// source below is byte-identical everywhere it appears. If you change this
// entry, change it in all of them or give yours a different slug.
const RULES = await bundleEntry('r11_gesture_rules', `export { PROXIMITY_PX } from './src/utils/interaction/gestureRules';`);
const PROXIMITY_PX = RULES.PROXIMITY_PX;
const STEADY_PX = 24;
const AMBIENT_MARGIN = 4;

const ROOMS = ['playroom', 'kitchen', 'living-room'];
const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone SE 375x667', 375, 667],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 360x900', 360, 900],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const rows = [];

for (const room of ROOMS) {
  for (const [label, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => console.error(`  [pageerror ${room} ${label}] ${e.message}`));
    await page.goto(`http://localhost:5199/.probe/render/room.html?room=${room}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

    const projection = await page.evaluate('window.__projection()');
    const coreRadius = await page.evaluate('window.__coreRadius()');
    const scan = await page.evaluate(async () => {
      window.__gsapSleep();
      try {
        // 8 steps over 0.4 s, not 20 over 0.6 s. Every shipped room reaction is a
        // 0.08-0.22 s half-cycle, so 0.4 s still closes over all of them, and 0.05 s
        // brackets a 0.09 s peak either side. The cut is forced by measurement, not
        // taste: a full-frame `readPixels` costs 1214 ms on this software renderer
        // against 8 ms for the draw, so samples, not frames, are the whole budget.
        return window.__reactionScan(0.4, 0.05);
      } finally {
        window.__gsapWake();
      }
    });

    // Buffer pixels are device pixels; the bars are CSS px, so convert once here
    // rather than in every comparison below.
    const ratio = projection.w > 0 ? (await page.evaluate('window.devicePixelRatio')) || 1 : 1;

    for (const r of scan) {
      const pxPerUnit = ((projection.h * ratio) / 2) * (projection.f / r.depth);
      rows.push({
        room,
        view: label,
        ...r,
        predictedSparkleRadiusPx: (coreRadius * pxPerUnit) / ratio,
        bboxCss: r.propBbox / ratio,
        sparkleBboxCss: r.sparkleBbox / ratio,
        ambientBboxCss: r.ambientBbox / ratio,
      });
    }
    console.error(`  scanned ${room} @ ${label}: ${scan.length} props`);
    await page.close();
  }
}

// TEARDOWN IS BOUNDED, BECAUSE EVERY MEASUREMENT IS ALREADY IN HAND AND NONE OF THE
// REPORT DEPENDS ON THE BROWSER. Observed on the one-pair smoke run: `browser.close()`
// sat for over 90 s after the last row had been printed, on a SwiftShader context this
// process is about to abandon anyway. This report costs ~15 pairs at ~12 minutes each,
// and it is printed AFTER this line, so a teardown that never returns would discard the
// entire run's findings to tidy up a process that is exiting. So it is raced, its
// failure is reported rather than swallowed, and the numbers are printed either way.
const closed = await Promise.race([
  browser
    .close()
    .then(() => 'closed')
    .catch((e) => `failed: ${e.message}`),
  new Promise((resolve) => setTimeout(() => resolve('timed out after 30 s — abandoning the context, the measurements are already collected'), 30000).unref()),
]);
if (closed !== 'closed') console.error(`  browser teardown ${closed}`);

const f = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : 'n/a');

console.log(
  `==== ROOMS ROUND 2: IS THE REWARD LEGIBLE?  bars: ratio >= 1.0, extent >= ${STEADY_PX} px (generous ${PROXIMITY_PX}), ambient x${AMBIENT_MARGIN}, hit >= miss (vs PARTICLES.${MISS_PRESET})\n`,
);

let failures = 0;
let measured = 0;
let clipped = 0;
let failedOnOriginalC = 0;
const worstByProp = new Map();
const navigation = [];
const answerFailures = [];

/**
 * The preset the miss acknowledgement itself emits, parsed rather than restated.
 *
 * Bar (d) compares a hit's burst against the miss's burst, so the miss's burst has
 * to come from the miss's own source. If `missAcknowledgement.ts` ever emits
 * something else, this throws instead of silently grading against a stale name:
 * no default, no fallback.
 *
 * This one stays a source read on purpose, and it is worth saying why, because
 * round 11 replaced the OTHER reader in this file — a generic `shipped(file,
 * name)` regex that fetched PROXIMITY_PX — with a real import. The difference is
 * what is being asked. PROXIMITY_PX is a VALUE the probe needs, so importing it
 * is strictly better: an import survives the constant becoming an expression and
 * a regex does not. This block asks a question about the SHAPE of the source —
 * that exactly one preset is emitted, and that it is emitted with no overrides —
 * and no import can answer that. A claim about how code is written has to read
 * the code. That is the line round 11 drew, and it is the reason this file now
 * contains one of each.
 */
const MISS_PRESET = (() => {
  const src = readFileSync(path.join(packageRoot, 'src', 'utils/interaction/missAcknowledgement.ts'), 'utf8');
  const names = [...src.matchAll(/\.emit\(PARTICLES\.(\w+)/g)].map((m) => m[1]);
  const unique = [...new Set(names)];
  if (unique.length !== 1)
    throw new Error(`missAcknowledgement.ts emits ${unique.length} distinct presets (${unique.join(', ')}); bar (d) assumed exactly one`);
  if (/\.emit\(PARTICLES\.\w+\s*,[^)]*,\s*\{/.test(src))
    throw new Error('missAcknowledgement.ts now passes EmitOverrides; bar (d) assumed the miss burst is unmodified');
  return unique[0];
})();

// THE PARSE ABOVE IS CROSS-CHECKED AGAINST THE MISS'S OWN OBSERVED BEHAVIOUR.
//
// Bar (d)'s deduction — "a prop emitting the same preset unweakened draws a superset of
// the miss's answer" — is an argument about shipped code, and it is only as good as its
// premise. `MISS_PRESET` is that premise read out of source text; `missEmits` is the same
// premise read off the real handler as it fired at each prop. Neither is sufficient
// alone: a source parse cannot see a preset chosen behind a branch this viewport never
// takes, and an observation cannot see that the file it credits is the file it read. So
// both are taken and required to agree, and disagreement throws rather than picking one.
const missObserved = new Set(rows.flatMap((r) => r.missEmits.map((e) => `${e.preset}${e.count === null ? '' : `x${e.count}`}${e.tinted ? '+tint' : ''}`)));
if (missObserved.size !== 1 || !missObserved.has(MISS_PRESET)) {
  throw new Error(
    `bar (d) parsed PARTICLES.${MISS_PRESET} with no overrides out of missAcknowledgement.ts, but the shipped handler was observed ` +
      `emitting ${missObserved.size === 0 ? 'nothing at all' : [...missObserved].join(', ')} across ${rows.length} rows; ` +
      `the deduction's premise is false, so every superset verdict in this run is void`,
  );
}

for (const room of ROOMS) {
  console.log(`---- ${room} ----`);
  console.log(
    ['prop', 'viewport', 'depth', 'propHi', 'sparkHi', 'ratio', 'extentPx', 'ambMask', 'ambX', 'ambAll', 'peak s', 'verdict'].map((s) => s.padEnd(11)).join(''),
  );
  for (const r of rows.filter((x) => x.room === room)) {
    // Positive test, not `emitted === 0`. See the docblock: the old proxy's blind
    // spot and this round's finding were the same predicate.
    if (r.navigated) {
      navigation.push({ ...r, key: `${room}/${r.name}` });
      continue;
    }
    measured += 1;
    const ratio = r.sparkleHigh > 0 ? r.propHigh / r.sparkleHigh : Infinity;
    const ambX = r.ambientInMask > 0 ? r.propHigh / r.ambientInMask : Infinity;
    const ambXOriginal = r.ambientHigh > 0 ? r.propHigh / r.ambientHigh : Infinity;
    const okRatio = ratio >= 1;
    const okExtent = r.bboxCss >= STEADY_PX;
    const okAmbient = ambX >= AMBIENT_MARGIN;
    // Bar (d). `superset` is the deduction: this handler draws the miss's own burst
    // unweakened and moves the prop as well, so its answer contains the miss's answer
    // and no pixel count can overturn that. Where the deduction is unavailable the
    // row is measured — tween alone against the reference burst — and `dWhy` records
    // which of the three ways it lost the deduction, so a `{ count: 4 }` override
    // cannot hide behind a matching preset name.
    const missLike = r.emits.filter((e) => e.preset === MISS_PRESET && e.count === null);
    const superset = missLike.length > 0;
    const okAnswer = superset || ratio >= 1;
    const dWhy = superset
      ? ''
      : r.emits.length === 0
        ? 'no-burst'
        : r.emits.some((e) => e.preset !== MISS_PRESET)
          ? `preset:${r.emits.map((e) => e.preset).join('/')}`
          : `count:${r.emits.map((e) => e.count).join('/')}`;
    const pass = okRatio && okExtent && okAmbient && okAnswer;
    if (!pass) failures += 1;
    if (!okAnswer) answerFailures.push({ key: `${room}/${r.name}`, view: r.view, ratio, propHigh: r.propHigh, sparkleHigh: r.sparkleHigh, dWhy });
    if (!(okRatio && okExtent && ambXOriginal >= AMBIENT_MARGIN)) failedOnOriginalC += 1;
    // The readback is cropped for cost, so every row has to earn the right to be
    // read. `propEdge`/`sparkleEdge` count changed pixels on a crop boundary that
    // is not also the frame boundary; zero on both PROVES the crop discarded
    // nothing. A non-zero count means these are floors, not measurements, and the
    // row is disqualified rather than quietly averaged in.
    const clip = r.propEdge > 0 || r.sparkleEdge > 0;
    if (clip) clipped += 1;
    const why = clip
      ? `CLIPPED(${r.propEdge}/${r.sparkleEdge})`
      : pass
        ? 'ok'
        : [!okRatio && 'ratio', !okExtent && 'extent', !okAmbient && 'ambient', !okAnswer && `hit<miss(${dWhy})`].filter(Boolean).join('+');
    const key = `${room}/${r.name}`;
    if (!clip) {
      const prev = worstByProp.get(key);
      if (!prev || ratio < prev.ratio) worstByProp.set(key, { ratio, view: r.view, extent: r.bboxCss, propHigh: r.propHigh, sparkleHigh: r.sparkleHigh });
    }
    console.log(
      [
        r.name.slice(0, 10),
        r.view.replace(/ \d+x\d+$/, '').slice(0, 10),
        f(r.depth, 1),
        String(r.propHigh),
        String(r.sparkleHigh),
        f(ratio, 3),
        f(r.bboxCss, 1),
        String(r.ambientInMask),
        Number.isFinite(ambX) ? f(ambX, 1) : 'inf',
        String(r.ambientHigh),
        f(r.peakAt, 2),
        why,
      ]
        .map((s) => String(s).padEnd(11))
        .join(''),
    );
  }
  console.log('');
}

console.log('==== WORST VIEWPORT PER PROP (ranked by prop/sparkle pixel ratio)\n');
for (const [key, v] of [...worstByProp.entries()].sort((a, b) => a[1].ratio - b[1].ratio)) {
  console.log(
    `  ${key.padEnd(34)} ratio ${f(v.ratio, 3).padStart(8)}  (${String(v.propHigh).padStart(6)} prop px vs ${String(v.sparkleHigh).padStart(6)} sparkle px)  extent ${f(v.extent, 1).padStart(6)} px  at ${v.view}`,
  );
}

if (answerFailures.length > 0) {
  console.log('==== BAR (d) FAILURES: THE HIT IS ANSWERED LESS RICHLY THAN A MISS AT THE SAME PLACE\n');
  console.log(`  The miss emits PARTICLES.${MISS_PRESET} with no overrides, parsed from source and confirmed`);
  console.log('  by observing the shipped handler fire. A prop emitting the same preset unweakened');
  console.log('  passes (d) by deduction. These did not, so they were measured against a real miss');
  console.log("  fired through each prop's own screen point:");
  for (const a of answerFailures) {
    console.log(
      `  ${a.key.padEnd(40)} ${a.dWhy.padEnd(16)} ${String(a.propHigh).padStart(6)} hit px vs ${String(a.sparkleHigh).padStart(6)} miss px  ratio ${f(a.ratio, 3).padStart(7)}  at ${a.view}`,
    );
  }
  console.log('');
}

if (navigation.length > 0) {
  console.log('==== EXCLUDED: REGISTERED TARGETS THAT NAVIGATE\n');
  console.log('  Identified positively, by recording nav.navigateTo, NOT by inferring it from a');
  console.log("  missing burst — that inference is what would have hidden this round's finding.");
  for (const n of navigation) {
    console.log(
      `  ${n.key.padEnd(34)} ${String(n.navVia).padEnd(22)} ${String(n.propHigh).padStart(6)} changed px  extent ${f(n.bboxCss, 1).padStart(7)} px  at ${n.view}`,
    );
  }
  console.log('');
}

console.log(`==== VERDICT`);
console.log(`  ${clipped} of ${measured} rows were CLIPPED by the cropped readback and are excluded above.`);
if (clipped > 0) console.log(`  Those rows report floors, not measurements. Widen the crop before believing them.`);
console.log(`  ${measured - failures} of ${measured} prop/viewport pairs clear all four bars.`);
console.log(`  Bar (d) — a hit answered at least as richly as a miss at the same place: ${measured - answerFailures.length} of ${measured} pass.`);
const legible = [...worstByProp.values()].filter((v) => v.ratio >= 1).length;
console.log(`  ${legible} of ${worstByProp.size} distinct props are legible at EVERY viewport.`);
// Both readings of (c) are reported. The amended bar is the one the verdict follows;
// the original is printed beside it so the amendment is auditable and so it is on the
// record that changing the bar changed the answer.
console.log(`  Bar (c) as amended (ambient within the prop's own changed pixels): ${measured - failures} of ${measured} pass.`);
console.log(`  Bar (c) as originally pre-committed (ambient anywhere in the crop): ${measured - failedOnOriginalC} of ${measured} pass.`);
console.log(
  failures === 0
    ? '  THE REWARD IS DISTINGUISHABLE FROM THE FALLBACK EVERYWHERE.'
    : `  ${failures} pairs fail. On those, the burst a child gets for finding a prop is the\n  same burst they get for touching the plaster, and the prop's own motion is not\n  large enough to say otherwise. Publish and iterate.`,
);
