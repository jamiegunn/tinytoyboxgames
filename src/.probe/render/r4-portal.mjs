/**
 * ROUND 4 — THE DOOR INTO THE GAME IS THE ONE TAP NOBODY ANSWERED.
 *
 * NOTE ADDED 2026-07-30, AFTER RUN 1 THREW. Nothing below is edited; this is what
 * happened when it was first executed. The audible half returned immediately and
 * cleanly, and the scan then printed nine rows and threw inside `__reactionScan`
 * with "1 navigation call(s) of 6 were not attributed to the row that caused them".
 * The cause was this probe, not the app: the `__tapThroughCanvas` call above the
 * scan is a REAL tap on a real portal, so it called `nav.launchMiniGame` and left a
 * permanent entry in the harness's nav recorder. The harness's attribution guard
 * compared its per-row tally against the LIFETIME nav count, so it charged the scan
 * with a call made before the scan began. The guard was correct to fire on the
 * discrepancy and wrong about its cause. Fixed in `room.ts` by taking a baseline at
 * scan start and comparing the delta; the fix changes which calls the guard holds
 * the scan responsible for and changes nothing about how any row is measured. Filed
 * as apparatus defect (xiv): a lifetime-count assertion inside a routine that is
 * meant to be composable with the other hooks. Run 1's nine rows are quoted in the
 * write-up beside run 2's, because they are the check that the fix moved nothing.
 *
 * THE CHARGE, WRITTEN BEFORE ANY MEASUREMENT, AS ROUNDS 1-3 REQUIRE
 * ----------------------------------------------------------------
 * A game portal is the highest-stakes tap in this application. Every other tap is
 * an ornament: the cannon pops, the parrot squawks, the kettle rocks, and if any
 * of them answered poorly the child stays exactly where they were. A portal is the
 * door. It is the only object in the Nature scene a child can tap to start a game
 * — `naturescene/environment.ts:68` says so in its own words — and the whole of
 * vision.md's Promise is spent on the moment it is used.
 *
 * `minigames/framework/gamePortal.ts:576-580` is that moment, entire:
 *
 *     const launchGame = () => {
 *       triggerSound('sfx_shared_tap_fallback');
 *       triggerSound('sfx_hub_toybox_open');
 *       nav.launchMiniGame(gameId);
 *     };
 *
 * Three statements. No tween. No burst. No flash. Nothing in the portal moves
 * because it was touched, and both cues and the navigation are issued in the same
 * synchronous tick.
 *
 * THE APP IS ITS OWN CONTROL, AND IT IS AN UNUSUALLY GOOD ONE. There is exactly
 * one other affordance in this codebase shaped "tap a thing -> it opens -> it takes
 * you somewhere", and it is the toybox. `toyboxes/framework/wireToyboxInteractions
 * .ts:104-144` does it like this: play `tapSoundId` immediately; fly the owl to the
 * lid; run the open animation; pulse the box; and only in the innermost `onComplete`
 * play `openSoundId` and navigate. `framework/defaults.ts:6-7` sets those to
 * `sfx_hub_toybox_tap` and `sfx_hub_toybox_open`. The toybox has a tap voice of its
 * own, a visible opening, and an open cue that arrives WHEN THE THING OPENS.
 *
 * The portal, against that control, substitutes the miss cue where the toybox has a
 * voice, and fires the toybox's opening sound at the instant of the tap with no
 * opening to hear.
 *
 * THIS ROUND OPENS BY PUTTING ROUND 3'S OWN PRODUCT ON TRIAL
 * ---------------------------------------------------------
 * Round 3 wrote an allowlist entry in `tests/audio/tap-answer-vocabulary.contract
 * .test.mjs` excusing this exact call site, and its stated reason was:
 *
 *     "The portal is not answering with the miss cue; it is answering with the
 *      toybox opening and chirping underneath it."
 *
 * That was an argument from reading two adjacent lines of code. It was never
 * measured. It is the kind of reasoning this review exists to distrust, and it was
 * granted by me, one round ago, in the round whose whole subject was props that
 * answer with the miss's cue. If the charge below holds, the entry does not get
 * re-argued — it gets deleted along with the line it excused.
 *
 * WHAT THIS PROBE MEASURES, AND WHAT WOULD REFUTE EACH PART
 * --------------------------------------------------------
 * H1 — THE VISIBLE HALF. A portal's own reaction to a tap changes fewer pixels than
 *   the miss sparkle it suppresses. That is Round 2's bar (d) — "a hit must change
 *   at least as many pixels as a miss at the same place" — and a portal is expected
 *   to fail it outright, at or near the instrument's noise floor, because the
 *   handler contains no visual statement of any kind.
 *   REFUTED IF `propHigh > sparkleHigh` on the portal rows. That would mean there is
 *   a visible answer I failed to find by reading, and the visible half is withdrawn
 *   as loudly as Round 3 withdrew the ship wheel's.
 *   NOTE THE INSTRUMENT'S OWN HAZARD, STATED BEFORE THE RUN: a portal is the one
 *   prop in these scenes that ANIMATES WHILE IDLE — `gamePortal.ts:546-560` runs a
 *   `repeat: -1` bob on `icon.position` and a `repeat: -1` spin on `icon.rotation`.
 *   An instrument that sampled a crop over 1.5 s would see that motion whether or
 *   not the tap did anything, and would report a healthy `propHigh` for a handler
 *   that does nothing at all. `__reactionScan` is safe here only because it calls
 *   `__freezeIdles()` BEFORE firing (room.ts:1693) and the freeze is taken before
 *   the tween the tap would create, so the two `repeat: -1` timelines are paused
 *   for the prop pass. The `ambientHigh`/`ambientInMask` columns are printed beside
 *   `propHigh` precisely so this can be checked rather than trusted: if the freeze
 *   failed, ambient would be large too, and no row would be readable.
 *
 * H2 — THE SUPPRESSED SPARKLE. Because `launchGame` plays sounds, `interactionController
 *   .fire`'s synchronous `soundsRequested()` bracket concludes the prop answered for
 *   itself and withholds the shared acknowledgement. So the portal does not merely
 *   fail to add a visible answer; it REMOVES the one the controller would otherwise
 *   have supplied. A tap on empty sky two centimetres away gets a sparkle; a tap on
 *   the door into the game gets none.
 *   REFUTED IF `__tapThroughCanvas` at a portal returns any emit. That would mean
 *   the controller is answering for it after all and only the audible half stands.
 *
 * H3 — THE AUDIBLE HALF, WHICH IS NOT ROUND 3'S. Round 3's cove props were
 *   INDISTINGUISHABLE from a miss; a portal is not, because the second cue is loud.
 *   The charge here is different and must not be overstated. It is that the FIRST
 *   thing a child hears on the most important tap in the app is the cue the
 *   controller plays for a tap that found nothing, and that the second is a
 *   0.8-second "grand reveal" whose own docblock (`hub/hubSfx.ts:34`) calls it a
 *   "creaky wooden thunk" — a cue whose only other two callers are a wooden toybox
 *   lid and a wooden door, played here by a glowing magic pedestal with no hinge,
 *   at an instant when nothing opens.
 *   REFUTED IF the sound list from a real canvas tap is not exactly
 *   `['sfx_shared_tap_fallback', 'sfx_hub_toybox_open']` — e.g. if some wrapper
 *   between the mesh and the handler substitutes something better.
 *
 * H4 — THE SCENE IS ITS OWN CONTROL, AGAIN. Round 3 measured the cove's other props
 *   with THIS EXACT CALL, `__reactionScan(1.5, 0.15)`, and published chest 9.68x,
 *   cannon 6.97x, wheel 6.18x. Re-running the same call reproduces those rows beside
 *   the portal's, so the comparison is within one instrument on one page load rather
 *   than across a quotation. If those three controls do not come back in the same
 *   neighbourhood, the instrument has drifted since Round 3 and NOTHING here is
 *   readable — that is this probe's guard, and it is checked, not assumed.
 *
 * WHY BOTH SCENES. The cove has one portal and six measured controls; Nature has
 * four portals and, per Round 5's already-filed evidence, no prop with a voice of
 * its own. One portal is an anecdote. Five portals across two scenes built by the
 * same factory is the claim that the defect is in `gamePortal.ts` and not in a
 * scene's wiring.
 *
 * WHAT WOULD MAKE A FIX SUFFICIENT, STATED NOW SO THE EVALUATION CANNOT MOVE:
 *   (a) `propHigh > sparkleHigh` on every portal row — the portal's own answer must
 *       out-draw the sparkle it suppresses, measured the same way the controls were;
 *   (b) the first cue a portal tap produces must not be `sfx_shared_tap_fallback`;
 *   (c) whatever answers must still be there on a MUTED device, per soul.md's Sound
 *       World clause, which is why (a) is the load-bearing bar and not (b).
 */

import { chromium } from 'playwright';

const scene = process.argv[2] ?? 'pirate-cove';
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

console.log(`\n=== ${scene} — Round 4: what a portal answers with`);

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — THE AUDIBLE HALF AND THE SUPPRESSED SPARKLE, THROUGH A REAL TAP.
//
// `__tapThroughCanvas` is the only instrument here that can see the controller's
// own contribution. `__firePropMuted`, which `__reactionScan` uses, calls the
// registry handler DIRECTLY and is therefore structurally blind to whether `fire`
// added or withheld the shared acknowledgement — the exact blindness this repo has
// already filed as apparatus defect (ix). H2 is a claim about `fire`, so it can
// only be asked here.
// ─────────────────────────────────────────────────────────────────────────────
const targets = await page.evaluate(() => window.__propTargets());
const portals = targets.filter((t) => /^portal_/.test(t.name) && t.onScreen && !t.background);

// One row per PORTAL, not per pick mesh. `buildGamePortal` pushes the pedestal and
// every mesh of the icon onto `tappableMeshes` and assigns them all the same
// `launchGame` closure, so a per-mesh loop would tap the same portal a dozen times
// and report a dozen findings about one object.
const byPortal = new Map();
for (const t of portals) {
  const id = t.name.replace(/^(portal_[a-z-]+)_.*$/, '$1');
  if (!byPortal.has(id)) byPortal.set(id, t);
}

console.log(`\n  ${byPortal.size} portal(s) on screen, from ${portals.length} registered pick meshes`);

// THE MISS BASELINE IS FOUND, NOT ASSUMED. Round 3 hard-coded (-0.9, 0.98) for the
// cove, which is fine for the cove and meaningless for Nature. A baseline quoted
// from another scene is the mistake this probe is built to avoid, so the sky point
// is searched for and the one that is used is printed. A miss is identified
// POSITIVELY — it must produce the miss cue AND a sparkle — because "no prop fired"
// is also what an off-canvas coordinate produces.
const missBaseline = await page.evaluate((miss) => {
  const candidates = [];
  for (const y of [0.98, 0.92, 0.85, 0.75]) {
    for (const x of [-0.98, -0.9, 0.9, 0.98, -0.5, 0.5, 0]) candidates.push([x, y]);
  }
  for (const [x, y] of candidates) {
    const r = window.__tapThroughCanvas(x, y);
    if (r.sounds.join(',') === miss && r.emits.some((e) => /sparkle/i.test(e))) {
      return { x, y, sounds: r.sounds, emits: r.emits };
    }
  }
  return null;
}, MISS);

if (!missBaseline) {
  console.log('  GUARD FAILED: no verified miss could be found on this canvas. Without a miss there is');
  console.log('  no baseline, and every claim below is about a comparison that was never made.');
  await page.close();
  await browser.close();
  process.exit(1);
}
console.log(`  miss baseline verified at ndc(${missBaseline.x}, ${missBaseline.y}): sounds=[${missBaseline.sounds}] emits=[${missBaseline.emits}]`);

console.log(`\n  ${'portal'.padEnd(30)} ${'sounds a real tap produced'.padEnd(52)} emits`);
const tapped = [];
for (const [id, t] of byPortal) {
  const r = await page.evaluate(([x, y]) => window.__tapThroughCanvas(x, y), [t.ndcX, t.ndcY]);
  tapped.push({ id, ...r });
  console.log(`  ${id.padEnd(30)} ${(r.sounds.join(',') || '(silent)').padEnd(52)} ${r.emits.join(',') || '(none)'}`);
}

console.log('');
for (const r of tapped) {
  const firstIsMiss = r.sounds[0] === MISS;
  const gotSparkle = r.emits.some((e) => /sparkle/i.test(e));
  console.log(
    `  ${r.id}: first cue ${firstIsMiss ? `IS the miss cue -> H3 stands` : `is '${r.sounds[0] ?? 'none'}' -> H3 REFUTED for this portal`}; ` +
      `${gotSparkle ? 'the controller DID supply a sparkle -> H2 REFUTED' : 'no sparkle -> the acknowledgement was suppressed, H2 stands'}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — THE VISIBLE HALF, ON THE SAME INSTRUMENT ROUND 3 USED FOR THE CONTROLS.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  running __reactionScan(1.5, 0.15) — same call as Round 3, so the rows are comparable...');
const rows = await page.evaluate(() => window.__reactionScan(1.5, 0.15));

console.log(
  `\n  ${'target'.padEnd(28)} ${'propHigh'.padEnd(10)} ${'ambient'.padEnd(9)} ${'sparkleHigh'.padEnd(12)} ${'ratio'.padEnd(8)} ${'nav'.padEnd(26)} emits`,
);
for (const r of rows) {
  const ratio = r.sparkleHigh > 0 ? (r.propHigh / r.sparkleHigh).toFixed(3) : 'n/a';
  console.log(
    `  ${r.name.slice(0, 27).padEnd(28)} ${r.propHigh.toFixed(4).padEnd(10)} ${String(r.ambientInMask).padEnd(9)} ${r.sparkleHigh.toFixed(4).padEnd(12)} ` +
      `${ratio.padEnd(8)} ${(r.navVia || '-').slice(0, 25).padEnd(26)} ${r.emits.map((e) => e.preset).join(',') || '(none)'}`,
  );
}

// THE GUARD. Round 3 published chest 9.68, cannon 6.97, wheel 6.18 from this exact
// call. If the cove's controls do not reproduce, the instrument moved between rounds
// and the portal rows below are not comparable to anything.
console.log('');
const get = (re) => rows.find((r) => re.test(r.name));
if (scene === 'pirate-cove') {
  const ROUND3 = [
    ['chest_body', /chest_body/, 9.68],
    ['cannon_barrel', /cannon_barrel/, 6.97],
    ['wheel_ring', /wheel_ring/, 6.18],
  ];
  let drifted = 0;
  for (const [label, re, was] of ROUND3) {
    const r = get(re);
    if (!r || r.sparkleHigh <= 0) {
      console.log(`  GUARD: ${label} did not produce a gradeable row this run (was ${was} in Round 3)`);
      drifted += 1;
      continue;
    }
    const now = r.propHigh / r.sparkleHigh;
    // Generous: this renderer is stochastic and the sparkle is randomised per burst.
    // The guard is asking "is this the same instrument", not "is this the same float".
    const ok = now > was * 0.4 && now < was * 2.5;
    console.log(`  guard ${label}: Round 3 = ${was}x, this run = ${now.toFixed(2)}x -> ${ok ? 'reproduced' : 'DRIFTED'}`);
    if (!ok) drifted += 1;
  }
  if (drifted > 0) {
    console.log('  GUARD FAILED: the controls did not reproduce. Nothing below is comparable to Round 3.');
  }
}

console.log('');
for (const [id] of byPortal) {
  const r = rows.find((x) => x.name.startsWith(id));
  if (!r) {
    console.log(`  ${id}: NO ROW — the scan did not grade this portal, so H1 is untested for it, not confirmed.`);
    continue;
  }
  if (r.sparkleHigh <= 0) {
    console.log(`  ${id}: sparkleHigh is 0, so the reference burst failed here and the ratio is undefined. Not a finding.`);
    continue;
  }
  const poorer = r.propHigh < r.sparkleHigh;
  const atNoise = r.propHigh <= r.ambientInMask;
  console.log(
    `  ${id}: visible answer ${poorer ? 'SMALLER' : 'larger'} than the sparkle it suppressed ` +
      `(${r.propHigh.toFixed(4)} vs ${r.sparkleHigh.toFixed(4)}) -> H1 ${poorer ? 'STANDS' : 'REFUTED, withdraw the visible half'}` +
      `${atNoise ? '; and it is at or below the ambient floor, i.e. indistinguishable from doing nothing' : ''}`,
  );
}

await page.close();
await browser.close();
