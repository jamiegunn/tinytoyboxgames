/**
 * ROUND 5, THE PRE-REGISTRATION — NATURE'S ONLY SOUND IS THE SOUND FOR FAILURE.
 *
 * This file is written and committed BEFORE the runtime measurement, because the
 * charge is falsifiable and the refutation conditions have to be fixed before the
 * numbers exist. Four rounds of this review have now produced two published
 * refutations of my own charges (the ship wheel's visible half, and the portal
 * "answers on a DELAY" mechanism), and both were only survivable because the bars
 * were written down first.
 *
 * ── THE CHARGE ────────────────────────────────────────────────────────────────
 *
 * The Nature scene contains six interactive props. A child taps a mushroom and it
 * squashes, stretches and glows. A child taps a flower and its petals bloom open.
 * A child taps a leaf and it FLIPS OVER TO REVEAL A LADYBUG, which then crawls
 * away. These are real moments of discovery, and they are the best-authored tap
 * reactions in the scene.
 *
 * Every one of them is answered, audibly, with `sfx_shared_tap_fallback` — the cue
 * `interactionController.acknowledgeTap` plays for a tap that hit NOTHING.
 *
 * soul.md §6, Every Tap Matters: "A dead tap is a broken promise." soul.md, The
 * Promise: "Nothing will confuse you." A child who taps a leaf, watches a ladybug
 * walk out from under it, and hears the noise that means "there was nothing there"
 * is being told two contradictory things about the same event by the same app.
 *
 * ── WHAT MAKES THIS ROUND 5 AND NOT A REPEAT OF ROUND 3 ───────────────────────
 *
 * Round 3 found two Pirate Cove props PLAYING the miss cue as their own answer.
 * That was a wrong line of code. This is not that. Nature's handlers do not play
 * the wrong sound; they play NO sound, and fall through to the controller's safety
 * net, which is working exactly as designed. Nothing here is a bug in the ordinary
 * sense and no test could have caught it, which is why it survived four rounds.
 *
 * ── THE AGGRAVATION, WHICH IS THE REASON THIS IS THE ROUND ────────────────────
 *
 * The sounds already exist. `assets/audio/nature/index.ts` defines four one-shot
 * effects, and `assets/audio/index.ts` registers all four in `SFX_REGISTRY`:
 *
 *     sfx_nature_mushroom_bounce   "springy, rubbery mushroom bounce (boing)"
 *     sfx_nature_leaf_flip         "papery leaf flip"
 *     sfx_nature_stream_splash     "gentle stream splash"
 *     sfx_nature_butterfly_flutter "airy butterfly wingbeat flutter"
 *
 * They are named after the exact props that exist. They are not sketches: the
 * mushroom boing is a 600->200 Hz sine sweep with a SECOND, softer re-trigger at
 * +0.15 s, which is a sound written for a two-stage squash-and-stretch bounce —
 * and the mushroom's bounce is exactly that, `BOUNCE_WIDE_FRAME = 8` then
 * `BOUNCE_TALL_FRAME = 16`. Somebody designed the picture and the sound together.
 * Then the wire between them was never run.
 *
 * ── THE FOUR HYPOTHESES, WITH THE MECHANISM STATED BEFORE MEASUREMENT ─────────
 *
 * H1 (source, already confirmed): no file under `naturescene/` calls
 *     `triggerSound`. Measured: zero occurrences, against twelve in `pirate-cove/`.
 *
 * H2 (runtime, THIS PROBE'S JOB): therefore every Nature prop's tap answer both
 *     BEGINS AND ENDS with `sfx_shared_tap_fallback`, and it must be measured
 *     through `__tapThroughCanvas` and never `__firePropMuted` — apparatus defect
 *     (ix): the direct-handler hook is structurally blind to the controller's own
 *     contribution, which in this scene is the ENTIRE audible answer.
 *
 * H3 (the sounds are stranded, not missing): all four ids are unreached by any
 *     literal outside the registry. The refutation path was checked before this
 *     was written, and closed: `triggerSound` is called with a non-literal in only
 *     six places, and the only scene-level one is `sceneHelpers.ts:262`'s
 *     `config.firstTapSoundId`, which exactly three call sites set — the Playroom,
 *     Living Room and Kitchen floors. Nature sets neither sound id. There is no
 *     dynamic route by which these four ids could be reached.
 *
 * H4 (this is not a framework limitation): the Pirate Cove's single bespoke sound,
 *     `sfx_pirate_cove_wheel_creak`, IS wired — Round 3 wired it — so a scene prop
 *     playing a scene-specific sound is a thing this codebase does.
 *
 * ── THE CENSUS THIS ROUND CORRECTS ───────────────────────────────────────────
 *
 * A figure of "37 of 51 registered sound ids never reached by a literal" was
 * carried in my own notes from an earlier round and used to justify opening this
 * one. Recomputed against the current tree it is WRONG, and it is corrected here
 * rather than quietly dropped: `SFX_REGISTRY` holds 45 ids and 11 are unreached.
 * The earlier number was measured before Rounds 1-4 wired several, and probably
 * counted music and ambient loops as well. The corrected number is worse for the
 * dramatic version of the charge and better for the real one — because of those
 * 11 stranded ids, FOUR are Nature's, and Nature is the only scene in the app
 * where 100% of its bespoke sounds are stranded. The Pirate Cove strands 0 of 1,
 * Bubble Pop 1 of 6, the Hub 3 of 8.
 *
 * ── WHAT A SUFFICIENT FIX MUST CLEAR, WRITTEN BEFORE THE FIX EXISTS ──────────
 *
 * (a) Every interactive Nature prop's FIRST cue on a real canvas tap is not
 *     `sfx_shared_tap_fallback`. This is the charge, stated so it can fail.
 *
 * (b) The prop's VISIBLE answer must not regress. Round 3 nearly shipped a fix
 *     that bought a cue at the price of the picture: a handler that plays any
 *     sound ticks `fire`'s counter and the controller then correctly withholds
 *     its shared sparkle. So every prop that gains a voice must be re-measured in
 *     PIXELS, and must still clear `propHigh > sparkleHigh`. soul.md's Sound World
 *     clause — "a muted experience must be fully playable and emotionally
 *     complete" — makes (b) load-bearing and (a) the lesser bar, not the reverse.
 *
 * (c) The sound a prop plays must be the sound written FOR that prop where one
 *     exists. Wiring `sfx_shared_pop` to all six would clear (a) and (b) and would
 *     be a worse app: it would leave the four bespoke sounds stranded and give the
 *     forest the vocabulary of a UI.
 *
 * ── WHAT WOULD REFUTE THE CHARGE, STATED BEFORE THE RUN ──────────────────────
 *
 * Any Nature prop whose first cue on a real canvas tap is NOT the fallback refutes
 * H2 for that prop, and the charge shrinks to the props that remain. A prop that
 * cannot be reached by any aim point is NOT evidence either way and must be
 * reported as ungraded rather than counted — Round 4 nearly recorded an occluded
 * aim at `portal_bubble-pop` as a refutation, and the bare-miss-plus-sparkle
 * signature that exposed it is checked for here.
 *
 * If H2 is refuted broadly, this round publishes that as loudly as a confirmation
 * and moves to the next candidate. The charge is not defended; it is tested.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTE ADDED 2026-07-30, AFTER RUN 1. THE PREMISE ABOVE IS UNCHANGED. THE
 * GRADING BELOW IS NOT, AND THIS RECORDS WHY, BECAUSE RUN 1 REPORTED THE CHARGE
 * REFUTED AND THE CHARGE WAS TRUE.
 *
 * Run 1 inferred "this aim point reached nothing" from the signature: exactly one
 * sound, that sound is the fallback, and a sparkle was emitted. Every clause is
 * true of a genuine miss. Every clause is ALSO true of a prop that fired
 * perfectly, emitted its own `sceneSparkle`, and has no voice — which is the
 * definition of every prop in this scene and therefore the exact population the
 * round exists to measure. **The exclusion predicate and the finding were the
 * same predicate.** That is Round 1's apparatus defect (iii) recurring in a new
 * costume, which is worth admitting plainly: knowing the shape of a mistake did
 * not stop me making it again five rounds later.
 *
 * Run 1's output, kept because it is the evidence that this was caught rather
 * than assumed: 34 of 35 rows discarded as "bare misses"; `gradeable rows: 1 of
 * 35`; verdict `H2 REFUTED`. Two rows in that discarded pile refute the discard
 * on their face — `flower_center` emitted `pollen,sceneSparkle`, and `pollen` is
 * the flower's own preset that only its own handler can ask for, so that tap
 * unambiguously landed. Had run 1's verdict been believed, Round 5 would have
 * closed the review's last round by publishing a false exoneration.
 *
 * The single row run 1 did grade was also wrong, in the opposite direction: `log`
 * returned `sfx_shared_star_chime` — a cue no Nature prop can play, because it is
 * the tap voice Round 4 gave the game portals four hours earlier. That aim point
 * had landed on a portal. Run 1 would have published it as the one genuine
 * refutation in the scene.
 *
 * Both errors have one cause: the probe was inferring what the tap hit from what
 * the tap sounded like, in a round whose entire subject is that the sound carries
 * no information about what was hit. `__tapThroughCanvas` now returns `hit`, the
 * name of the prop whose handler actually ran, by wrapping the live registry for
 * the duration of the tap — filed as apparatus defect (xv). `hit === null` is a
 * miss and nothing else; a non-null `hit` that is not the aimed-at prop is an aim
 * artefact and is reported as such rather than graded.
 */

import { chromium } from 'playwright';

const MISS = 'sfx_shared_tap_fallback';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`));

await page.goto('http://localhost:5199/.probe/render/room.html?room=nature', { waitUntil: 'load' });
await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

console.log('\n=== nature — Round 5 PRE-FIX: what does a tap on each prop actually SAY?');

// The miss baseline is identified POSITIVELY — the miss cue AND a sparkle — because
// "no sound at all" is also what an off-canvas coordinate produces, and a probe that
// cannot tell those apart cannot grade a scene whose whole charge is about the miss cue.
const missBaseline = await page.evaluate((miss) => {
  for (const y of [0.98, 0.92, 0.85, 0.75])
    for (const x of [-0.98, -0.9, 0.9, 0.98, -0.5, 0.5, 0]) {
      const r = window.__tapThroughCanvas(x, y);
      if (r.sounds.join(',') === miss && r.emits.some((e) => /sparkle/i.test(e))) return { x, y, ...r };
    }
  return null;
}, MISS);
if (!missBaseline) {
  console.log('  GUARD FAILED: no verified miss in this scene, so "the miss cue" has no referent here.');
  await browser.close();
  process.exit(1);
}
console.log(
  `  miss baseline verified at ndc(${missBaseline.x}, ${missBaseline.y}): sounds=[${missBaseline.sounds.join(',')}] emits=[${missBaseline.emits.join(',')}]`,
);

const targets = await page.evaluate(() => window.__propTargets());
const props = targets.filter((t) => t.onScreen && !t.background && !/^portal_/.test(t.name));
console.log(`\n  ${props.length} on-screen, non-background, non-portal targets\n`);

console.log(`  ${'aimed at'.padEnd(20)} ${'handler that RAN'.padEnd(20)} ${'sounds a real tap produced'.padEnd(28)} emits`);
const rows = [];
for (const t of props) {
  const r = await page.evaluate(([x, y]) => window.__tapThroughCanvas(x, y), [t.ndcX, t.ndcY]);
  // POSITIVE identification, not inference. `hit === null` means the controller picked
  // nothing — that is a miss, and it is the only thing it can be. A `hit` that is not
  // the prop aimed at is an aim artefact: the aim landed on a neighbour, and the row is
  // evidence about the neighbour, not about the target. Both are excluded from grading
  // and both are printed, because run 1 produced one of each and graded both wrongly.
  const status = r.hit === null ? 'MISS' : r.hit === t.name ? 'ok' : 'DRIFTED';
  rows.push({ aimed: t.name, ...r, status });
  console.log(
    `  ${t.name.slice(0, 19).padEnd(20)} ${(r.hit ?? '(nothing)').slice(0, 19).padEnd(20)} ` +
      `${(r.sounds.join(',') || '(silent)').padEnd(28)} ${r.emits.join(',') || '(none)'}` +
      (status === 'MISS' ? '   <- picked nothing; a real miss, ungraded' : '') +
      (status === 'DRIFTED' ? '   <- aim landed on another prop, ungraded' : ''),
  );
}

const graded = rows.filter((r) => r.status === 'ok');
const firstIsMiss = graded.filter((r) => r.sounds[0] === MISS);
const distinctProps = new Set(graded.map((r) => r.aimed.replace(/_\d+$/, '')));
console.log(
  `\n  gradeable rows: ${graded.length} of ${rows.length} ` +
    `(${rows.filter((r) => r.status === 'MISS').length} real misses, ${rows.filter((r) => r.status === 'DRIFTED').length} aim drifts)`,
);
console.log(`  distinct props reached: ${[...distinctProps].join(', ')}`);
console.log(`  rows whose FIRST cue is the miss cue: ${firstIsMiss.length} of ${graded.length}`);
console.log(`  rows that produced ANY non-miss cue:  ${graded.filter((r) => r.sounds.some((s) => s !== MISS)).length} of ${graded.length}`);

if (graded.length === 0) console.log('\n  H2 UNGRADED — no aim point reached any prop. The charge is untested, not confirmed.');
else if (firstIsMiss.length === graded.length) console.log('\n  H2 CONFIRMED — every prop this run REACHED answers a tap with the cue for touching nothing.');
else console.log(`\n  H2 REFUTED for ${graded.length - firstIsMiss.length} row(s) — the charge shrinks, and this is published as loudly as a confirmation.`);

/*
 * ── ADDENDUM, 2026-07-30, ADDED AFTER THE POST-FIX RUN ────────────────────────
 *
 * Nothing above this line has been edited. The pre-registration, its hypotheses
 * and its verdict logic are exactly as committed before the numbers existed, and
 * the post-fix run's "H2 REFUTED for 34 rows" is the correct and intended
 * reading: H2 was the CHARGE, the fix landed, and so the charge is now false.
 * A probe whose verdict flips when the defect is repaired is a probe that works.
 *
 * This addendum exists because that run exposed TWO PROPS THE PASS ABOVE CANNOT
 * GRADE, and leaving them uncounted would let the round claim eight props on
 * six props' worth of evidence.
 *
 * APPARATUS DEFECT (xvi) — A SINGLE CENTROID AIM CANNOT REACH AN OCCLUDED PROP,
 * AND REPORTS IT AS "DRIFTED" RATHER THAN AS UNREACHABLE. The `log` row aimed at
 * the log's centroid and hit `portal_bubble-pop_b`, which sits in front of it.
 * Both post-fix runs produced the identical drift, so this is geometry and not
 * noise. The pass above then correctly refused to grade the row — but "ungraded"
 * was silently doing duty for "untested", and the log is one of the three props
 * Round 5 authored a new synth for. It is tested here with a ring of offsets.
 *
 * APPARATUS DEFECT (xvii) — THE CENSUS FILTERS OUT `background: true`, WHICH IS
 * RIGHT FOR EVERY PURPOSE IT WAS BUILT FOR AND WRONG FOR THIS ONE. The stream is
 * marked background precisely so raycasts read PAST it to the leaves staged
 * underneath, and the census filter therefore removes it by construction. But
 * the stream has a tap handler and a voice of its own, so "excluded from the
 * census" must not be allowed to read as "has no answer". It is aimed at
 * directly below, at open water rather than through its centroid.
 */
console.log('\n=== ADDENDUM: the two props the census above cannot reach\n');

const ringOf = (radii) => {
  const ring = [[0, 0]];
  for (const r of radii)
    for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) ring.push([r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)]);
  return ring;
};

// A prop no aim point can reach is reported UNREACHABLE — an honest third answer,
// not a pass. `hit === name` is the only proof the tap arrived where it was sent.
const reach = async (t, radii) => {
  for (const [dx, dy] of ringOf(radii)) {
    const r = await page.evaluate(([x, y]) => window.__tapThroughCanvas(x, y), [t.ndcX + dx, t.ndcY + dy]);
    if (r.hit === t.name) return { dx, dy, ...r };
  }
  return null;
};

const addendum = [];
for (const [label, t, radii] of [
  ['log', targets.find((x) => x.name === 'log'), [0.02, 0.04, 0.06, 0.09, 0.13]],
  ['stream', targets.find((x) => /stream/.test(x.name)), [0.03, 0.06, 0.1, 0.15, 0.2]],
]) {
  if (!t) {
    console.log(`  ${label}: NOT IN THE TARGET REGISTRY AT ALL — that is a different and larger finding.`);
    continue;
  }
  const landed = await reach(t, radii);
  if (!landed) {
    console.log(`  ${t.name}: UNREACHABLE — every aim point read past it to something else. Its voice is proven in source only.`);
    continue;
  }
  console.log(
    `  ${t.name.padEnd(20)} reached at centroid+(${landed.dx.toFixed(2)}, ${landed.dy.toFixed(2)}) — ` +
      `sounds=[${landed.sounds.join(',') || '(silent)'}] emits=[${landed.emits.join(',') || '(none)'}]`,
  );
  addendum.push({ name: t.name, ...landed });
}

const addendumMiss = addendum.filter((r) => r.sounds[0] === MISS);
console.log(`\n  addendum rows graded: ${addendum.length} of 2`);
console.log(`  addendum rows whose FIRST cue is the miss cue: ${addendumMiss.length} of ${addendum.length}`);
console.log(
  `\n  BAR (a), WHOLE SCENE: ${firstIsMiss.length + addendumMiss.length} of ${graded.length + addendum.length} graded rows still answer a real tap with the miss cue,` +
    ` across ${new Set([...distinctProps, ...addendum.map((r) => r.name)]).size} distinct props.`,
);

await page.close();
await browser.close();
