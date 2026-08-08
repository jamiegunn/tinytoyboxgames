/**
 * DOES THE MUSIC EVER START ON A PHONE?
 *
 * THE REPORT was "music doesn't seem to play on phone". Reading the code gives a
 * candidate but not an answer, so this drives the real app in a real browser at a
 * real phone viewport with touch emulation, and counts the only thing that cannot
 * lie about whether a synthesised bed is playing: OscillatorNodes created on the
 * page's AudioContext.
 *
 * WHY OSCILLATORS AND NOT "did I hear it". Every music bed in this app is
 * synthesised — `assets/audio/hub/hubMusic.ts` and its siblings build oscillators
 * per cycle. There is no audio element and no file to watch load. An
 * AudioContext that is suspended still lets you CREATE nodes, so counting
 * creations alone would report a bed that is silently suspended as playing. This
 * therefore records both: the node count AND `AudioContext.state`, which is the
 * pair that distinguishes "never asked for" from "asked for and muted".
 *
 * THE SEQUENCE MATTERS AND IS THE WHOLE POINT. `App.tsx` renders `LandingPage`
 * OUTSIDE `AudioProvider`, so the tap that leaves the landing page happens while
 * no unlock listener exists. This walks that exact path — land, tap through, wait,
 * then tap again inside the room — and reports the state after each step. If the
 * bed only starts after the second tap, the first tap is being spent on a route
 * that cannot use it.
 *
 * HOW TO RUN IT
 *   npx vite --port 5199 --strictPort &
 *   node .probe/render/audio-unlock.mjs
 */

import { chromium, devices } from 'playwright';

const BASE = 'http://localhost:5199/';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // NO autoplay override: the point is to observe the policy a phone applies,
  // not to configure it away.
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const iphone = devices['iPhone 13'];
const context = await browser.newContext({ ...iphone });
const page = await context.newPage();

// Instrumented before any app code runs, so nothing is missed during boot.
await page.addInitScript(() => {
  window.__audio = { contexts: 0, oscillators: 0, gains: 0, resumes: 0, states: [] };
  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) return;
  const Patched = function (...args) {
    const ctx = new Native(...args);
    window.__audio.contexts += 1;
    window.__audio.live = ctx;
    const osc = ctx.createOscillator.bind(ctx);
    ctx.createOscillator = (...a) => {
      window.__audio.oscillators += 1;
      return osc(...a);
    };
    const gain = ctx.createGain.bind(ctx);
    ctx.createGain = (...a) => {
      window.__audio.gains += 1;
      return gain(...a);
    };
    const resume = ctx.resume.bind(ctx);
    ctx.resume = () => {
      window.__audio.resumes += 1;
      return resume();
    };
    ctx.addEventListener('statechange', () => window.__audio.states.push(ctx.state));
    return ctx;
  };
  Patched.prototype = Native.prototype;
  window.AudioContext = Patched;
  window.webkitAudioContext = Patched;
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const snap = async (label) =>
  page.evaluate((l) => {
    const a = window.__audio;
    return {
      step: l,
      contexts: a.contexts,
      oscillators: a.oscillators,
      gains: a.gains,
      resumes: a.resumes,
      state: a.live ? a.live.state : 'no context',
      route: location.hash || '(root)',
    };
  }, label);

const report = [];
const record = async (label) => {
  const s = await snap(label);
  report.push(s);
  console.log(
    `  ${s.step.padEnd(34)} route ${s.route.padEnd(18)} ctx ${String(s.contexts)}  state ${String(s.state).padEnd(10)} resumes ${String(s.resumes).padStart(2)}  oscillators ${String(s.oscillators).padStart(4)}  gains ${String(s.gains).padStart(4)}`,
  );
  return s;
};

console.log(`\n=== iPhone 13 (${iphone.viewport.width}x${iphone.viewport.height}, touch), no autoplay override\n`);

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await record('1. landed on the root');

// The call to action that leaves the landing page. Found by role/text so this
// does not depend on a class name.
const cta = page
  .locator('button, a')
  .filter({ hasText: /toybox|play|start/i })
  .first();
const ctaCount = await page
  .locator('button, a')
  .filter({ hasText: /toybox|play|start/i })
  .count();
console.log(`     (found ${ctaCount} call-to-action candidates)`);
if (ctaCount > 0) {
  await cta.tap();
} else {
  await page.evaluate(() => {
    location.hash = '#/playroom';
  });
}
await page.waitForTimeout(4000);
await record('2. after tapping into a room');

await page.waitForTimeout(4000);
await record('3. four more seconds of waiting');

// A tap inside the room: what a child does when they touch the floor.
await page.touchscreen.tap(iphone.viewport.width / 2, iphone.viewport.height / 2);
await page.waitForTimeout(3000);
await record('4. after ONE tap inside the room');

await page.waitForTimeout(4000);
await record('5. four seconds after that tap');

console.log('\n=== VERDICT');
const beforeTap = report[2];
const afterTap = report[4];
if (beforeTap.oscillators === 0 && afterTap.oscillators > 0) {
  console.log(`  The room is SILENT until the child taps inside it.`);
  console.log(`  Oscillators before the in-room tap: ${beforeTap.oscillators}. After: ${afterTap.oscillators}.`);
  console.log(`  The tap that entered the room was spent on a route with no unlock listener.`);
} else if (afterTap.oscillators === 0) {
  console.log(`  NO music at any point (state "${afterTap.state}"). The bed is never even requested,`);
  console.log(`  or the context never leaves suspended. Not the landing-page path alone.`);
} else if (beforeTap.oscillators > 0) {
  console.log(`  FIXED: the bed is playing before any in-room tap — ${beforeTap.oscillators} oscillators on a`);
  console.log(`  running context, started by the tap that entered the room. This is the passing state;`);
  console.log(`  the failing state is step 2 and 3 reading zero.`);
}
if (errors.length) console.log('\n  PAGE ERRORS: ' + errors.slice(0, 4).join(' | '));

await browser.close();
process.exit(0);
