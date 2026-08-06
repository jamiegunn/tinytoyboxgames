/**
 * Renders each room with the halos at their SHIPPED settings, stepped to the top
 * of a breath, so the chosen numbers can be LOOKED at as well as measured.
 *
 * WHY THE CLOCK IS WALKED AND NOT JUMPED, twice over. `requestAnimationFrame`
 * does not run under this harness's software GL, so nothing here happens on its
 * own; and gsap's `updateRoot` evaluates the timeline at the time you name
 * without simulating the times between, so a fade-in tween created from inside a
 * `delayedCall` is born with zero progress at the moment the jump lands.
 *
 * WHY IT WALKS UNTIL THE HALOS ARE UP RATHER THAN A FIXED NUMBER OF SECONDS. A
 * `delayedCall`'s start time is taken from `gsap.ticker.time` at CREATION, which
 * in a browser is however many seconds of real time the page spent loading and
 * building the room -- and the root timeline this probe drives is far behind
 * that, because the ticker has barely run. The offset is different for every
 * toybox, since they are built one after another. A fixed 4.5 s walk showed the
 * Kitchen's halo, one of the Living Room's two, and neither of the Playroom's,
 * which looks exactly like a bug in the feature and is not one.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = '/tmp/halo-final/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
for (const [room, w, h] of process.env.SHOTS
  ? JSON.parse(process.env.SHOTS)
  : [
      ['playroom', 1440, 900],
      ['living-room', 1440, 900],
      ['kitchen', 1440, 900],
    ]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`http://localhost:5199/.probe/render/room.html?room=${room}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });
  const state = await page.evaluate(() => {
    const probe = window.__haloProbe();
    const up = () => probe.list().every((s) => s.opacity > 0.01);
    let walked = 0;
    while (!up() && walked < 60) {
      window.__gsapAdvance(0.05);
      walked += 0.05;
    }
    // A further breath and a half so nothing is caught mid-fade. The clock is
    // never stepped BACKWARDS to hunt for a peak: `updateRoot` with a negative
    // delta rewinds the root timeline and re-seeds tweens from their start, which
    // silently returned two of the Playroom's halos to opacity 0 and looked, once
    // again, exactly like a bug in the feature.
    for (let i = 0; i < 100; i++) window.__gsapAdvance(0.05);
    return {
      walked,
      list: probe
        .list()
        .map((s) => [s.name.replace('tapInvitation_', ''), +s.opacity.toFixed(3), s.visible, Math.round(s.cx), Math.round(s.cy), Math.round(s.radius)]),
    };
  });
  console.log(room, 'walked', state.walked.toFixed(2) + 's', JSON.stringify(state.list));
  await page.evaluate(() => window.__redraw());
  await page.screenshot({ path: `${OUT}${room}-${w}x${h}.png` });
  await page.close();
}
await browser.close();
process.exit(0);
