/**
 * DOES A TAP ON THE CANNON SOUND ANY DIFFERENT FROM A TAP ON NOTHING?
 *
 * Round 3's charge, stated before it is measured, so the measurement can refute it.
 *
 * Six things in the pirate cove answer a tap. Four call a sound of their own:
 * the sea `sfx_shared_splash`, the sail `sfx_shared_whoosh`, the parrot and the
 * treasure chest `sfx_shared_chime`. Two — `cannon/interaction.ts:28` and
 * `shipWheel/interaction.ts:25` — call `sfx_shared_tap_fallback`, which
 * `uiSounds.ts` documents as "a gentle acknowledgement chirp for tap-fallback
 * feedback": the sound the controller plays when your finger found nothing.
 *
 * THE CHARGE IS A COMPARISON, AND THE SCENE IS ITS OWN CONTROL. This is not the
 * rooms' standard imported into the cove; it is the cove's own standard, met by
 * four of its six answers and skipped by two. The two that skipped it are the
 * cannon and the ship's wheel — which, on a pirate ship, are the two props that
 * most look like controls, and so are the two a child is likeliest to reach for.
 *
 * THREE HYPOTHESES, ORDERED, EACH FALSIFIABLE BY A COLUMN BELOW
 * ------------------------------------------------------------
 * H1  The two props sound EXACTLY like a miss. Predicts: the cannon row and the
 *     ship-wheel row carry `sfx_shared_tap_fallback` in `sounds`, and so does the
 *     empty-sky row, and the three are indistinguishable in that column.
 *
 * H2  They also SUPPRESS the shared sparkle, by the same mechanism the room floor
 *     used. `fire()` decides a handler answered for itself by counting sounds
 *     across the call; a handler that plays the acknowledgement cue *itself* ticks
 *     that counter, so the controller concludes the prop answered and withholds
 *     `acknowledgeTap`. Predicts: neither row carries `sceneSparkle`, while the
 *     empty-sky row does. If a row shows `sceneSparkle` anyway, H2 is dead and the
 *     dispatcher is not routing these props through `fire` at all.
 *
 * H3  The cost is unequal between them, and only the wheel pays it in full. The
 *     cannon emits `cannonConfetti` from its own handler, so it keeps a visible
 *     answer and loses only the sparkle. The ship wheel emits NOTHING anywhere in
 *     its file. Predicts: cannon `emits` = `cannonConfetti`, wheel `emits` = empty.
 *
 * WHAT WOULD MAKE ALL THREE MEANINGLESS, CHECKED FIRST
 * ---------------------------------------------------
 * The treasure chest is the guard, and it is a better guard than empty sky alone
 * because it is a PROP, in the same folder, built by the same factory, registered
 * through the same dispatcher. It calls `sfx_shared_chime` and emits
 * `PARTICLES.treasureGold`. If the chest row does not show both, this recorder
 * cannot see a prop's own answer on this page, and every other row here is
 * uninterpretable — the two accused props would look silent because the
 * instrument is deaf, not because they are quiet. The empty-sky row is kept as a
 * second guard, for the opposite failure: it exercises `acknowledgeTap` from its
 * original caller, where no handler runs at all, so it shows whether the shared
 * answer is reachable on this page before any prop is asked to have lost it.
 *
 * Both guards are printed FIRST, so a reader who stops after two rows has already
 * seen whether to trust the rest.
 *
 * ── 2026-07-30, AFTER THE FIRST RUN: THE MISS GUARD WAS MISLOCATED, AND IT LIED
 * IN THE DIRECTION THAT FLATTERED THE CODE.
 *
 * The first run used NDC (0, 0.92) as "empty sky", copied from `r2-floor.mjs`
 * where it is empty. In the pirate cove it is not: it lands on the parrot, which
 * plays `sfx_shared_chime`. So the baseline row read `sfx_shared_chime` and the
 * verdict line dutifully reported `H1 sounds-exactly-like-a-miss = false` for both
 * accused props — an ACQUITTAL, produced entirely by comparing them against a prop
 * instead of against a miss.
 *
 * The crude guard condition of the first run (`sky.emits.length > 0`) passed,
 * because the parrot's tap does emit a sparkle. A guard that only asks "did
 * something happen" cannot tell you whether the RIGHT thing happened, which is
 * the same lesson this round learned from a test harness that could not run.
 *
 * The coordinate is fixed below and the guard now asserts the baseline row is
 * actually a miss. A grid sweep of 98 points found 37 genuine misses, every one
 * of them `sfx_shared_tap_fallback` + `sceneSparkle`; (-0.9, 0.98) is one, and the
 * histogram of that sweep is recorded here so the choice is not a magic number:
 *   sfx_shared_splash 53 (the sea, which is most of the frame) · tap_fallback 37
 *   · tap_fallback+hub_toybox_open 4 (the portal) · whoosh 3 (the sail) · chime 1.
 * That single chime is the parrot, and it is the point the first run picked.
 */

import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`));
await page.goto('http://localhost:5199/.probe/render/room.html?room=pirate-cove', { waitUntil: 'load' });
await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

const out = await page.evaluate(() => {
  window.__gsapSleep();
  const targets = window.__propTargets();
  const rows = [];

  // GUARD 1 -- the shared answer is reachable on this page at all. See the dated
  // note above for why this coordinate is (-0.9, 0.98) and not (0, 0.92).
  rows.push({ label: 'empty sky (miss)', kind: 'guard', r: window.__tapThroughCanvas(-0.9, 0.98) });

  const pick = (re) => targets.find((t) => re.test(t.name || ''));
  const chest = pick(/chest|treasure/i);
  const cannon = pick(/cannon/i);
  const wheel = pick(/wheel|helm/i);

  // GUARD 2 -- a prop's OWN answer is visible to this recorder.
  if (chest) rows.push({ label: chest.name, kind: 'guard', r: window.__tapThroughCanvas(chest.ndcX, chest.ndcY) });
  else rows.push({ label: '(chest not found)', kind: 'guard', r: { sounds: [], emits: [] } });

  for (const t of [cannon, wheel].filter(Boolean)) {
    rows.push({ label: t.name, kind: 'accused', r: window.__tapThroughCanvas(t.ndcX, t.ndcY) });
  }

  return { rows, names: targets.map((t) => t.name || `(unnamed ${t.type})`) };
});

console.log('\n=== pirate-cove');
console.log(`  ${'target'.padEnd(26)} ${'role'.padEnd(8)} ${'sounds'.padEnd(28)} emits`);
for (const r of out.rows) {
  console.log(`  ${r.label.slice(0, 25).padEnd(26)} ${r.kind.padEnd(8)} ${(r.r.sounds.join(',') || '(silent)').padEnd(28)} ${r.r.emits.join(',') || '(none)'}`);
}

const MISS = 'sfx_shared_tap_fallback';
const sky = out.rows[0];
const chest = out.rows[1];
// The baseline must be an actual MISS, not merely a tap that did something. The
// first run checked only `emits.length > 0`, landed on the parrot, and acquitted
// both accused props by comparing them against a prop's answer.
const skyIsReallyAMiss = sky.r.sounds.join(',') === MISS && sky.r.emits.some((e) => /sparkle/i.test(e));
const guardsOk = chest.r.sounds.length > 0 && chest.r.emits.length > 0 && skyIsReallyAMiss;
if (!skyIsReallyAMiss) console.log(`\n  GUARD 1 FAILED: the baseline row is not a miss (${sky.r.sounds.join(',') || 'silent'}) -- it has landed on a prop.`);
console.log(
  `\n  INSTRUMENT: ${guardsOk ? 'both guards passed -- rows below are interpretable' : 'GUARD FAILED -- every row above is uninterpretable, do not read a verdict off it'}`,
);
if (guardsOk) {
  for (const r of out.rows.filter((x) => x.kind === 'accused')) {
    const sameAsMiss = r.r.sounds.join(',') === sky.r.sounds.join(',');
    const noSparkle = !r.r.emits.some((e) => /sparkle/i.test(e));
    console.log(
      `  ${r.label}: H1 sounds-exactly-like-a-miss = ${sameAsMiss} | H2 sparkle-suppressed = ${noSparkle} | H3 own visible answer = ${r.r.emits.join(',') || 'NONE'}`,
    );
  }
}
console.log(`\n  (all tap targets seen: ${out.names.join(', ')})`);

await page.close();
await browser.close();
