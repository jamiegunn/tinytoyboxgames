/**
 * ROUND 4, THE EVALUATION — DOES THE REPAIRED PORTAL CLEAR THE BARS THE CHARGE SET?
 *
 * `r4-portal.mjs` pre-registered three bars for a sufficient fix, and they are quoted
 * here verbatim rather than paraphrased, because the whole point of writing them
 * before the measurement is that the evaluation cannot move them afterwards:
 *
 *   (a) `propHigh > sparkleHigh` on every portal row — the portal's own answer must
 *       out-draw the sparkle it suppresses, measured the same way the controls were;
 *   (b) the first cue a portal tap produces must not be `sfx_shared_tap_fallback`;
 *   (c) whatever answers must still be there on a MUTED device, per soul.md's Sound
 *       World clause, which is why (a) is the load-bearing bar and not (b).
 *
 * Bar (c) is not a separate measurement. It is the reason bar (a) is graded with a
 * pixel instrument and not with the emit recorder: a particle preset that was ASKED
 * for is not a picture, and Round 3 nearly published that mistake.
 *
 * THIS RUN USES `__reactionScan`'s NEW `only` FILTER, AND OWES AN ACCOUNT OF IT.
 * Nature has 65 gradeable groups at roughly two minutes each. Grading Round 4's fix
 * on the Pirate Cove's single portal was the alternative, and one portal is an
 * anecdote. The filter fires a named subset; it changes nothing about how a fired row
 * is measured, and the scan's pre-fire census still prints every target in the scene.
 * What is given up is stated plainly: this run cannot show that the portals are the
 * worst props in Nature, and it cannot catch a regression in a prop not named below.
 * The Pirate Cove is therefore ALSO run unfiltered, as the round's unfiltered run, so
 * that at least one scene is graded whole against Round 3's published numbers.
 *
 * THE GUARD IS THE SAME GUARD, AND IT IS CHECKED TWICE OVER.
 * Round 3's three cove props — `chest_body` 9.68x, `cannon_barrel` 6.97x, `wheel_ring`
 * 6.18x — must reproduce. If they do not, the instrument has drifted and nothing here
 * is readable. They are also the check on the `only` filter itself: the cove is run
 * filtered AND unfiltered in the same session, and if a control's number depends on
 * whether its neighbours were fired, the filter is not the no-op it claims to be.
 *
 * WHAT WOULD REFUTE THE FIX, STATED BEFORE IT IS RUN. Any portal row with
 * `propHigh <= sparkleHigh` fails bar (a) and the fix is insufficient — it does not
 * matter how good the new sounds are, because a muted child sees only the picture.
 * Any portal whose first cue is still the miss cue fails bar (b). Either outcome gets
 * published exactly as loudly as a pass, and the round iterates rather than ships.
 */

import { chromium } from 'playwright';

const scene = process.argv[2] ?? 'pirate-cove';
const filter = process.argv[3] ?? '';
const MISS = 'sfx_shared_tap_fallback';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('[scan]')) console.log(`  ${t}`);
});

await page.goto(`http://localhost:5199/.probe/render/room.html?room=${scene}`, { waitUntil: 'load' });
await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

console.log(`\n=== ${scene} — Round 4 EVALUATION${filter ? ` (only=/${filter}/)` : ' (unfiltered)'}`);

// ── Bar (b): the audible half, through a real pointer event ────────────────────
//
// `__tapThroughCanvas` is the only hook that sees the CONTROLLER's contribution as
// well as the handler's, which is what bar (b) is about: the FIRST cue a child hears.
const targets = await page.evaluate(() => window.__propTargets());
const portals = targets.filter((t) => /^portal_/.test(t.name) && t.onScreen && !t.background);
const byPortal = new Map();
for (const t of portals) {
  const id = t.name.replace(/^(portal_[a-z-]+)_.*$/, '$1');
  if (!byPortal.has(id)) byPortal.set(id, []);
  byPortal.get(id).push(t);
}
console.log(`\n  ${byPortal.size} portal(s) on screen, from ${portals.length} registered pick meshes`);

// The miss baseline is SEARCHED FOR and identified POSITIVELY — miss cue AND a
// sparkle — because "no prop fired" is also what an off-canvas coordinate produces.
const missBaseline = await page.evaluate((miss) => {
  for (const y of [0.98, 0.92, 0.85, 0.75])
    for (const x of [-0.98, -0.9, 0.9, 0.98, -0.5, 0.5, 0]) {
      const r = window.__tapThroughCanvas(x, y);
      if (r.sounds.join(',') === miss && r.emits.some((e) => /sparkle/i.test(e))) return { x, y, ...r };
    }
  return null;
}, MISS);
if (!missBaseline) {
  console.log('  GUARD FAILED: no verified miss in this scene, so "not the miss cue" has no referent.');
  await browser.close();
  process.exit(1);
}
console.log(`  miss baseline verified at ndc(${missBaseline.x}, ${missBaseline.y}): sounds=[${missBaseline.sounds.join(',')}]`);

console.log(`\n  ${'portal'.padEnd(30)} ${'sounds a real tap produced'.padEnd(50)} emits`);
const audible = [];
for (const [id, group] of byPortal) {
  // Aim at each pick mesh in turn and keep the first aim that actually REACHED the
  // portal. Round 4's first Nature run recorded `portal_bubble-pop` answering with a
  // bare miss cue plus a sparkle, and reading that as "the controller supplied a
  // sparkle after all" would have been wrong: a bare miss with a sparkle is the
  // signature of a tap that hit NOTHING, i.e. of an aim point occluded or off-prop.
  // A row is only evidence about a portal if the portal fired.
  let hit = null;
  for (const t of group) {
    const r = await page.evaluate(([x, y]) => window.__tapThroughCanvas(x, y), [t.ndcX, t.ndcY]);
    const bareMiss = r.sounds.length === 1 && r.sounds[0] === MISS;
    if (!bareMiss) {
      hit = { ...r, aimedAt: t.name };
      break;
    }
    if (!hit) hit = { ...r, aimedAt: t.name, suspectedMiss: true };
  }
  audible.push({ id, ...hit });
  console.log(
    `  ${id.padEnd(30)} ${(hit.sounds.join(',') || '(silent)').padEnd(50)} ${hit.emits.join(',') || '(none)'}` +
      (hit.suspectedMiss ? '   <- every aim produced a BARE MISS; the tap never reached this portal' : ''),
  );
}

// ── DRAIN THE FLOURISH BEFORE SCANNING. This line exists because run 1 of this
// probe needed it, and the reason is the fix itself. Before Round 4 a portal tap was
// three synchronous statements, so the canvas taps above finished the instant they
// returned. The repaired portal defers its navigation to the end of a 0.34 s tween —
// that deferral IS the fix — so those taps left a launch in flight, and the scan's
// first row came back reading `parrot_prop ... nav=launchMiniGame:cannonball-splash`.
// The parrot did not launch a game; it was simply the row being measured when
// somebody else's `onComplete` landed. The harness's attribution guard is what made
// this visible, one round after that guard was itself repaired, and a probe that had
// only checked "did the numbers look plausible" would have shipped a mis-attributed
// nav column. Any probe that taps a deferred-navigation prop and then measures
// something else owes this wait.
await page.waitForTimeout(1500);
const drained = await page.evaluate(() => window.__navCalls().length);
console.log(`\n  flourish drained; ${drained} nav call(s) recorded by the audible phase and now settled`);

// ── Bar (a): the visible half, in pixels ──────────────────────────────────────
console.log(`  running __reactionScan(1.5, 0.15${filter ? `, "${filter}"` : ''})...`);
const rows = await page.evaluate(([f]) => window.__reactionScan(1.5, 0.15, f || undefined), [filter]);

console.log(`\n  ${'target'.padEnd(30)} ${'propHigh'.padEnd(10)} ${'sparkleHigh'.padEnd(12)} ${'ratio'.padEnd(8)} ${'ambient'.padEnd(8)} nav`);
for (const r of rows) {
  const ratio = r.sparkleHigh > 0 ? (r.propHigh / r.sparkleHigh).toFixed(3) : 'n/a';
  console.log(
    `  ${r.name.slice(0, 29).padEnd(30)} ${r.propHigh.toFixed(0).padEnd(10)} ${r.sparkleHigh.toFixed(0).padEnd(12)} ` +
      `${ratio.padEnd(8)} ${String(r.ambientInMask).padEnd(8)} ${r.navVia || '-'}`,
  );
}

// ── The guard ─────────────────────────────────────────────────────────────────
const ROUND3 = [
  ['chest_body', /^chest_body/, 9.68],
  ['cannon_barrel', /^cannon_barrel/, 6.97],
  ['wheel_ring', /^wheel_ring/, 6.18],
];
let guardOk = true;
if (scene === 'pirate-cove') {
  console.log('');
  for (const [label, re, was] of ROUND3) {
    const r = rows.find((x) => re.test(x.name));
    if (!r || r.sparkleHigh <= 0) {
      console.log(`  guard ${label}: NOT MEASURED this run -> guard incomplete`);
      guardOk = false;
      continue;
    }
    const now = r.propHigh / r.sparkleHigh;
    // A generous band, deliberately: the guard asks "is this the same instrument",
    // not "is this the same float". The sparkle column resamples a stochastic burst.
    const ok = now > was * 0.4 && now < was * 2.5;
    if (!ok) guardOk = false;
    console.log(`  guard ${label}: Round 3 = ${was}x, this run = ${now.toFixed(2)}x -> ${ok ? 'reproduced' : 'DRIFTED'}`);
  }
} else {
  console.log('\n  (no Round 3 controls in this scene; the cove run is the instrument guard for this session)');
}

// ── The verdict, against the bars as written ──────────────────────────────────
console.log('');
if (scene === 'pirate-cove' && !guardOk) {
  console.log('  GUARD FAILED: the instrument has drifted since Round 3. Nothing above is readable.');
} else {
  let allPass = true;
  for (const [id, group] of byPortal) {
    const names = new Set(group.map((t) => t.name));
    const portalRows = rows.filter((r) => names.has(r.name.replace(/\+\d+$/, '')));
    const snd = audible.find((a) => a.id === id);
    const barB = snd && !snd.suspectedMiss ? snd.sounds[0] !== MISS : null;
    for (const r of portalRows) {
      if (r.sparkleHigh <= 0) {
        console.log(`  ${r.name}: sparkleHigh is 0 in this crop — not a finding, bar (a) has no denominator here.`);
        continue;
      }
      const barA = r.propHigh > r.sparkleHigh;
      if (!barA) allPass = false;
      console.log(
        `  ${r.name}: bar (a) ${barA ? 'PASSES' : 'FAILS'} — visible answer ${r.propHigh} vs displaced sparkle ${r.sparkleHigh} ` +
          `(${(r.propHigh / r.sparkleHigh).toFixed(2)}x), ambient floor ${r.ambientInMask}`,
      );
    }
    if (barB === null) {
      console.log(`  ${id}: bar (b) NOT GRADED — no aim point reached this portal, so its cue order was never observed.`);
      allPass = false;
    } else {
      if (!barB) allPass = false;
      console.log(`  ${id}: bar (b) ${barB ? 'PASSES' : 'FAILS'} — first cue is \`${snd.sounds[0] ?? '(silence)'}\``);
    }
  }
  console.log(`\n  ${allPass ? 'ALL BARS PASS for this scene.' : 'AT LEAST ONE BAR FAILS — the fix is insufficient and the round iterates.'}`);
}

await page.close();
await browser.close();
