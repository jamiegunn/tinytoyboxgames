/**
 * WHAT THE SCENE BUILDS vs WHAT THE SCENE ANSWERS FOR.
 *
 * `r6-map.mjs` measures the frame: what a tap at each pixel does. That is the
 * right instrument for coverage and the wrong one for attribution, because a
 * pixel-based probe reports a miss over the ship's sail as NOTHING without ever
 * printing the word "sail". This probe closes that gap. It asks, per named node
 * in the scene graph, whether ANY registered target covers it.
 *
 * IT IS NOT GIVEN A LIST OF THINGS TO LOOK FOR. `__presence()` walks the whole
 * graph and classifies everything; the aggregation here is by name token, so
 * whatever the scene contains shows up whether or not the reviewer suspected it.
 * A probe handed `['owl', 'sail', 'mast']` could only ever confirm the suspicion
 * it was handed, which is how this review has already produced three retractions.
 *
 * READ `NONE` PRECISELY. It means "this object has no registered target of its
 * own anywhere up its ancestry". It does NOT mean a tap over it is dead: the
 * proximity rule can still hand that tap to a registered prop up to PROXIMITY_PX
 * away, and since Round 5 every miss sparkles and sounds regardless. The two
 * facts are kept in two probes on purpose so neither can quietly cover for the
 * other -- the frame map says how much of the screen is inert, and this says
 * which of the scene's own furniture has nothing to say.
 *
 * NODE COUNTS ARE STRUCTURE, NOT IMPORTANCE. A 133-node owl and a 3-node sail
 * are not ranked by that number; it is printed only so a one-node stub is not
 * mistaken for a fully modelled object. Screen area is what matters for the
 * charge, and screen area comes from `r6-map.mjs`.
 */

import { chromium } from 'playwright';

const SCENES = [
  ['NATURE', 'http://localhost:5199/.probe/render/nature.html'],
  ['PIRATE COVE', 'http://localhost:5199/.probe/render/shot.html'],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

console.log('==== ROUND 6 / PRESENCE: WHICH OF THE SCENE HAS AN ANSWER OF ITS OWN\n');
console.log('  PROP     a non-background registry key covers it -- tapping it is a discovery.');
console.log('  SCENERY  a background-flagged registry key covers it -- fires, same answer everywhere.');
console.log('  NONE     no registered target anywhere up its ancestry.\n');

/** Groups node names into a coarse token so a 133-node owl reads as one row. */
const token = (name) =>
  name
    .replace(/_root$/, '')
    .replace(/[0-9]+$/, '')
    .split(/[_.\- ]/)
    .filter(Boolean)[0]
    ?.toLowerCase() ?? '(unnamed)';

for (const [scene, url] of SCENES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });
  const rows = await page.evaluate(() => window.__presence());
  await page.close();

  const agg = new Map();
  for (const r of rows) {
    const t = token(r.name);
    const a = agg.get(t) ?? { n: 0, PROP: 0, SCENERY: 0, NONE: 0 };
    a.n++;
    a[r.state]++;
    agg.set(t, a);
  }

  const sorted = [...agg.entries()].sort((a, b) => b[1].n - a[1].n);
  const dead = sorted.filter(([, a]) => a.PROP === 0 && a.SCENERY === 0);
  const live = sorted.filter(([, a]) => a.PROP > 0 || a.SCENERY > 0);

  console.log(`---- ${scene}   ${rows.length} named nodes, ${agg.size} name groups`);
  console.log(`     with a PROP or SCENERY target: ${live.length} groups`);
  console.log(`     with NO registered target:     ${dead.length} groups\n`);
  console.log('     nodes  state          name group');
  for (const [t, a] of live.slice(0, 14)) {
    const s = a.PROP > 0 ? (a.SCENERY > 0 ? 'PROP+SCENERY' : 'PROP') : 'SCENERY';
    console.log(`     ${String(a.n).padStart(5)}  ${s.padEnd(13)}  ${t}`);
  }
  if (live.length > 14) console.log(`     ...    ${live.length - 14} more live groups`);
  console.log('');
  for (const [t, a] of dead.slice(0, 14)) {
    console.log(`     ${String(a.n).padStart(5)}  ${'NONE'.padEnd(13)}  ${t}`);
  }
  if (dead.length > 14) console.log(`     ...    ${dead.length - 14} more groups with no target`);
  console.log('');
}

await browser.close();
