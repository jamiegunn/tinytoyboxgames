/**
 * ROUND 5, BAR (b) — DID BUYING A VOICE COST THE PICTURE?
 *
 * This probe exists because the butterfly's docblock promised it by name before
 * the numbers were taken, and a promise like that is a debt. It answers one
 * question and refuses to answer any other.
 *
 * ── THE MECHANISM, STATED BEFORE MEASUREMENT ──────────────────────────────────
 *
 * `interactionController.fire` reads the audio engine's sound counter around the
 * handler call:
 *
 *     const before = audio && !entry.opts.silent ? audio.soundCount() : 0;
 *     entry.handler({ object: obj, point });
 *     if (audio && !entry.opts.silent && audio.soundCount() === before) acknowledgeTap(clientX, clientY);
 *
 * That is correct and deliberate: a handler that answered for itself does not
 * also get the generic acknowledgement. But it has an edge Round 5 walks
 * straight into. Every Nature prop that GAINED a voice this round therefore
 * LOST the controller's shared sparkle. For six of the eight that costs nothing,
 * because they emit particles of their own on the frame of the tap. For two it
 * might cost everything.
 *
 * ── THE TWO AT RISK, AND HOW THE LIST WAS ARRIVED AT ──────────────────────────
 *
 * The leaf and the stone are `createRevealInteraction` props. Their particles
 * are emitted inside `playAnimation(...).onEnd` — hundreds of milliseconds after
 * the finger lands — so at TAP TIME they now emit nothing at all where before
 * they emitted the controller's sparkle. The post-fix run of
 * `.probe/render/r5-nature-voice.mjs` shows exactly that: `leaf_cover` and
 * `stone_cover` are the only two graded rows reading `emits (none)`.
 *
 * I HAD PREDICTED THE BUTTERFLY, AND I WAS WRONG, WHICH IS WHY THIS PARAGRAPH
 * IS HERE RATHER THAN A TIDIER LIST. The pre-registration named the butterfly as
 * the round's single highest bar-(b) risk on the stated ground that it "emits no
 * particles of its own". It does: `butterflies/animation.ts` hands a
 * `sceneSparkle` `particleFn` to the idle-interruptible and `fleeHandle.trigger()`
 * fires it, and all four `bfly_body` rows in the voice run emit it. The premise
 * was drawn from the file I was editing without opening the sibling that owned
 * the behaviour. The butterfly is measured below anyway, precisely because I got
 * it wrong once and an unmeasured "it's fine now" is worth nothing.
 *
 * ── THE BAR ───────────────────────────────────────────────────────────────────
 *
 * Bar (b) as pre-registered: the prop's VISIBLE answer must not regress, measured
 * in pixels, still clearing `propHigh > sparkleHigh` — the prop's own reaction
 * must move more of the picture than a bare acknowledgement sparkle would.
 *
 * The comparison that actually matters here is not against a threshold but
 * against the ALTERNATIVE: what the child would have seen if the prop had stayed
 * mute. That is the miss sparkle, and `sparkleHigh` is measured in the same crop
 * on the same frames, so the two are directly comparable. A leaf whose flip moves
 * far more pixels than a sparkle would has not been harmed by losing the sparkle.
 *
 * ── WHAT THIS PROBE CANNOT SAY, STATED UP FRONT ───────────────────────────────
 *
 * It uses the `only` filter (apparatus defect (xiii)), because an unfiltered
 * Nature scan costs roughly two minutes per row across ~35 rows. Two things are
 * therefore given up and neither is hidden: this run cannot show that the named
 * props are the worst in their scene, and it cannot catch a regression in a prop
 * nobody thought to name. Round 5 discharges the unfiltered-run debt with the
 * whole-scene voice census in `r5-nature-voice.mjs`, which fires every one of the
 * 35 on-screen targets.
 */
import { chromium } from 'playwright';

const AT_RISK = ['leaf_cover', 'stone_cover'];
const CONTROL = ['bfly_body', 'mush_cap'];
const ONLY = `^(${[...AT_RISK, ...CONTROL].join('|')})`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`));

await page.goto('http://localhost:5199/.probe/render/room.html?room=nature', { waitUntil: 'load' });
await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

console.log('\n=== nature — Round 5 bar (b): does the picture survive the voice?');
console.log(`  filtered to /${ONLY}/ — at-risk: ${AT_RISK.join(', ')} | controls: ${CONTROL.join(', ')}\n`);

const rows = await page.evaluate((only) => window.__reactionScan(2.0, 0.1, only), ONLY);

console.log(`  ${'row'.padEnd(16)} ${'propHigh'.padStart(9)} ${'sparkleHigh'.padStart(12)} ${'ratio'.padStart(8)} ${'peakAt'.padStart(7)}  edge   emits`);
for (const r of rows) {
  const ratio = r.sparkleHigh > 0 ? (r.propHigh / r.sparkleHigh).toFixed(2) : 'inf';
  console.log(
    `  ${r.name.slice(0, 15).padEnd(16)} ${String(r.propHigh).padStart(9)} ${String(r.sparkleHigh).padStart(12)} ${ratio.padStart(8)} ` +
      `${String(r.peakAt).padStart(7)}  ${String(r.propEdge).padStart(4)}   ${r.emits.map((e) => e.preset).join(',') || '(none)'}`,
  );
}

// The ratio is trusted only where the prop's own reaction is not clipped at the
// crop edge — a clipped reaction has had pixels removed from the numerator by the
// instrument rather than by the app, and `room.ts` says so at length.
const clipped = rows.filter((r) => r.propEdge > 0);
if (clipped.length) console.log(`\n  NOTE: ${clipped.map((r) => r.name).join(', ')} clip at the crop edge; their ratios are lower bounds, not values.`);

const failures = rows.filter((r) => !(r.propHigh > r.sparkleHigh));
console.log(`\n  rows measured: ${rows.length} (expected ${AT_RISK.length + CONTROL.length})`);
console.log(`  rows clearing propHigh > sparkleHigh: ${rows.length - failures.length} of ${rows.length}`);

if (rows.length === 0) console.log('\n  BAR (b) UNGRADED — the filter matched nothing. That is an apparatus failure, not a pass.');
else if (failures.length === 0) console.log('\n  BAR (b) CLEARED — every measured prop still moves more of the picture than the sparkle it gave up.');
else
  console.log(
    `\n  BAR (b) FAILED for ${failures.map((r) => r.name).join(', ')} — the voice was bought with the picture, which is the trade this bar exists to forbid.`,
  );

/* ═══════════════════════════════════════════════════════════════════════════════
 * ADDENDUM, 2026-07-30 — APPARATUS DEFECT (xviii): MY VERDICT RULE GRADED ROWS
 * THE INSTRUMENT EXCLUDES FROM IT BY CONSTRUCTION.
 *
 * Everything above this line is left exactly as it was pre-registered and exactly
 * as it ran, including a FAILED verdict on nine rows. Nothing here rewrites the
 * bar; it corrects who the bar applies to, and the run that motivated the
 * correction is printed above rather than deleted, per the standing rule that a
 * probe's stated premise is never back-edited.
 *
 * ── THE RUN THAT PROMPTED THIS ────────────────────────────────────────────────
 *
 *   rows measured: 15 (expected 4)
 *   rows clearing propHigh > sparkleHigh: 6 of 15
 *   BAR (b) FAILED for mush_cap ×5, leaf_cover, stone_cover, bfly_body ×2
 *
 * Two things in that are wrong and only one of them is the app's fault.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────────
 *
 * `room.ts` documents, at length and before I wrote this file, why the
 * prop-versus-sparkle ratio is not the universal test I used it as:
 *
 *   "A prop that emits `sceneSparkle` with no overrides draws the miss's own
 *    burst and then moves itself as well, so its answer CONTAINS the miss's
 *    answer and cannot be smaller than it — no framebuffer required. The rows
 *    where that deduction is unavailable are exactly the rows that emit nothing,
 *    or emit something else, or emit the same preset with the count turned down,
 *    and for those the numerator really is `propHigh` alone against
 *    `sparkleHigh`."
 *
 * `propHigh` is measured WITH THE PARTICLE ENGINE MUTED. So for a sparkle-emitting
 * prop the ratio compares the prop's tween ALONE against a whole burst, while the
 * thing the child actually sees is the tween AND that same burst. The comparison
 * is not strict, it is malformed: the numerator is missing a term the denominator
 * has. `mush_cap` at 0.20 does not mean the mushroom moves a fifth of a sparkle's
 * worth of pixels; it means its bounce alone does, on top of the sparkle it also
 * draws. Nine rows were reported as failures. Seven of them are this.
 *
 * The two that survive the correction are `leaf_cover` and `stone_cover`, which
 * read `emits (none)` — the only graded rows in the whole voice run that do — and
 * those are real Round 5 regressions caused by exactly the mechanism this file's
 * header predicted. The instrument, in other words, was right; my reading of it
 * was noise on top of a true signal, and it is worth noticing that the noise ran
 * three and a half times louder than the signal.
 *
 * ── WHY THIS IS FILED AS AN APPARATUS DEFECT AND NOT A TYPO ───────────────────
 *
 * Because of what it would have done had the fix been good. A corrected run in
 * which every prop passes would still have printed FAILED for the sparkle-emitting
 * majority, and the obvious response to a bar that fails on props nobody touched
 * is to conclude the bar is too strict and relax it. That is the failure mode:
 * not a wrong number, but a wrong number pointed at the bar itself. It joins (iii)
 * and (xv) as a third instance of the same family — the predicate that decides who
 * is graded doing work it was never checked to be capable of.
 *
 * The general rule, which is the part worth keeping: WHEN A HARNESS DOCUMENTS THE
 * SCOPE OF ITS OWN VERDICT, THE SCOPE IS PART OF THE MEASUREMENT. Reading the
 * number without reading the scope is not a shortcut, it is a different experiment.
 *
 * ── AND ONE PLACE THE HARNESS'S SCOPE WAS GENUINELY TOO NARROW ────────────────
 *
 * Applying the documented rule correctly still left the stone graded on the ratio,
 * because it answers with `sceneDust` and the deduction as written covers only the
 * miss's own preset. That is not a bookkeeping problem, it is a measurement asked
 * to grade a frame with half of it removed: `propHigh` is taken with particles
 * muted, so the stone's shift was being compared against a whole burst while the
 * dust it actually draws counted for nothing. A bar in that shape does not push the
 * app toward a better frame, it pushes it toward drawing fairy sparkle over soil to
 * satisfy an instrument.
 *
 * So `room.ts` grew a fourth pass in this same round — `ownHigh`, the prop's own
 * asked-for burst replayed into the live engine under the miss pass's own frozen
 * conditions — and the deduction generalises from "draws the miss's burst" to
 * "draws a burst no smaller than the miss's". Both forms are applied below, and
 * which one exempted each row is printed, because an exemption whose grounds are
 * not stated is indistinguishable from a row nobody checked.
 * ═══════════════════════════════════════════════════════════════════════════════ */

// The deduction of `room.ts:1416-1423`, implemented rather than paraphrased. A row
// is exempt from the ratio when it draws the miss's own burst unmodified: same
// preset, same tint, and a count that is not turned down. `count: null` means the
// preset's default was taken, so null-vs-null is a match and null-vs-number is not
// assumed to be one in either direction.
const drawsTheMissBurst = (r) =>
  r.missEmits.length > 0 &&
  r.missEmits.every((m) =>
    r.emits.some(
      (e) =>
        e.preset === m.preset &&
        e.tinted === m.tinted &&
        (e.count === m.count || (typeof e.count === 'number' && typeof m.count === 'number' && e.count >= m.count)),
    ),
  );

// And the generalisation of it, added to `room.ts` in the same round for the stone.
// A prop that draws a DIFFERENT preset is exempt too, provided that preset is
// measured — under the miss pass's own frozen conditions — to move at least as many
// pixels as the miss's burst does. Same deduction, one weaker premise: the prop's
// answer contains something no smaller than the miss's answer, and then it moves.
// `ownReplayed > 0` is required explicitly, because a row that emitted nothing has
// `ownHigh === 0` and `sparkleHigh === 0` would make `0 >= 0` read as an exemption.
const outdrawsTheMiss = (r) => r.ownReplayed > 0 && r.ownEdge === 0 && r.ownHigh >= r.sparkleHigh;

const exempt = rows.filter((r) => drawsTheMissBurst(r) || outdrawsTheMiss(r));
const byRatio = rows.filter((r) => !(drawsTheMissBurst(r) || outdrawsTheMiss(r)));
const realFailures = byRatio.filter((r) => !(r.propHigh > r.sparkleHigh));

console.log('\n  ── corrected reading (apparatus defect (xviii); see the addendum in this file) ──');
console.log(`  exempt — draw a burst no smaller than the miss's AND move as well: ${exempt.length}`);
for (const r of exempt)
  console.log(
    `      ${r.name.padEnd(16)} emits ${(r.emits.map((e) => e.preset).join(',') || 'none').padEnd(14)} ` +
      `${drawsTheMissBurst(r) ? 'same preset as the miss' : `own ${r.ownHigh} >= miss ${r.sparkleHigh}`}`,
  );
console.log(`  graded on the ratio — draw nothing the miss's burst can be deduced from: ${byRatio.length}`);
for (const r of byRatio)
  console.log(
    `      ${r.name.padEnd(16)} ${String(r.propHigh).padStart(7)} / ${String(r.sparkleHigh).padStart(7)} = ${(r.propHigh / r.sparkleHigh).toFixed(2)}  ` +
      `own ${String(r.ownHigh).padStart(6)} (${r.ownReplayed} replayed)  ${r.propHigh > r.sparkleHigh ? 'PASS' : 'FAIL'}`,
  );

if (byRatio.length === 0)
  console.log('\n  BAR (b) CLEARED BY DEDUCTION ALONE — every measured row draws a burst no smaller than the miss and moves besides. No row needed the ratio.');
else if (realFailures.length === 0)
  console.log(
    `\n  BAR (b) CLEARED — ${exempt.length} by deduction, ${byRatio.length - realFailures.length} on the ratio. No prop bought its voice with its picture.`,
  );
else
  console.log(
    `\n  BAR (b) FAILED for ${realFailures.map((r) => r.name).join(', ')} — and these are the real ones, graded on the only test that applies to them.`,
  );

await page.close();
await browser.close();
