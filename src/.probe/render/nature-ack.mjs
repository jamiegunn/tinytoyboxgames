/**
 * DOES EVERY TAP PRODUCE A RESPONSE? -- MEASURED BY TAPPING, NOT BY MODELLING.
 *
 * soul.md#6 is written as a contract rather than a preference:
 *
 *   "A dead tap is a broken promise. If a child touches the screen and nothing
 *    happens, the magic breaks. Every tap -- whether it lands on a designated
 *    interaction or on empty space -- must produce a response. A sparkle, a
 *    ripple, a soft sound. The first-tap fallback is not a technical
 *    requirement. It is an emotional contract."
 *
 * Every other probe in this round predicts the controller's decision from the
 * outside. This one refuses to: it dispatches REAL pointer events over a grid
 * covering the whole canvas, lets the shipped `onPointerUp` run, and counts the
 * sound requests each tap produced. A tap scoring zero is a broken promise, and
 * the point of measuring it this way is that no modelling error can hide one --
 * if the wiring is not actually connected, the count is zero and the probe says
 * so, however good the theory was.
 *
 * WHY A SOUND COUNT IS THE RIGHT OBSERVABLE. It is the only response every path
 * shares. A prop tap answers with animation and particles; the floor answers by
 * flying the owl; a sky tap answers with a sparkle. Those are three different
 * things to observe and each would need its own spy. All four paths route their
 * audio through `triggerSound`, and the counter lives inside that function, so
 * one number covers the whole surface -- and, usefully, it is also the response
 * that was missing everywhere before this round: not one of the Nature scene's
 * tap handlers played a sound, and the controller's own no-dead-tap fallback was
 * never given the audio hooks it needs, because `createWorldTapDispatcher`
 * omitted the argument and `buildScene` -- the only other caller -- has no call
 * sites at all.
 *
 * WHAT THIS PROBE DOES NOT PROVE. A sound request is not audible output; the
 * counter ticks even when the AudioProvider is absent, as it is here. That is
 * deliberate -- the question is whether the scene tried to answer -- but it
 * means a wrong sound id would pass. `sfx_shared_tap_fallback` is checked
 * against `SFX_REGISTRY` separately by the audio-inventory test.
 *
 * The taps are real, so their side effects are real: leaves flip, stones slide,
 * the owl flies. That only makes the measurement harder (a moved prop is a prop
 * the later samples can miss), never easier, so a clean sweep here is not an
 * artefact of a frozen scene.
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';
const STEP = Number(process.env.STEP ?? 20);

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['square 900x900', 900, 900],
  ['iPad portrait 768x1024', 768, 1024],
  ['viewport 480x854', 480, 854],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 360x900', 360, 900],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

console.log('==== EVERY TAP MUST PRODUCE A RESPONSE (soul.md#6), TAPPED FOR REAL\n');
console.log(`  Sampled every ${STEP} px across the full canvas. A tap "answers" when it`);
console.log('  requests at least one sound -- from the handler it fired, or from the');
console.log("  controller's fallback when that handler was silent, or from the sky");
console.log('  acknowledgement when it fired nothing at all.\n');
console.log('  viewport                   taps   answered   SILENT   worst run of silent taps');

let anySilent = 0;
for (const [label, w, h] of VIEWS) {
  // A fresh page per viewport, so the accumulated side effects of one sweep
  // never carry into the next one's starting scene.
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

  const r = await page.evaluate(
    ([step, cw, ch]) => {
      let taps = 0;
      let answered = 0;
      let run = 0;
      let worstRun = 0;
      const silent = [];
      for (let y = step / 2; y < ch; y += step) {
        for (let x = step / 2; x < cw; x += step) {
          const n = window.__tapLive(x, y);
          taps++;
          if (n > 0) {
            answered++;
            run = 0;
          } else {
            run++;
            worstRun = Math.max(worstRun, run);
            if (silent.length < 12) silent.push([Math.round(x), Math.round(y)]);
          }
        }
      }
      return { taps, answered, worstRun, silent };
    },
    [STEP, w, h],
  );
  await page.close();

  const silentCount = r.taps - r.answered;
  anySilent += silentCount;
  console.log(
    `  ${label.padEnd(24)} ${String(r.taps).padStart(6)} ${String(r.answered).padStart(10)} ${String(silentCount).padStart(8)} ${String(r.worstRun).padStart(26)}`,
  );
  if (silentCount > 0) console.log(`      first silent samples: ${r.silent.map(([x, y]) => `${x},${y}`).join('  ')}`);
}

console.log('');
console.log(
  anySilent === 0
    ? '  RESULT: no silent tap anywhere. The contract holds at every shipping viewport.'
    : `  RESULT: ${anySilent} SILENT TAPS. soul.md#6 is still violated.`,
);

await browser.close();
