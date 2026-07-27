/**
 * Does the SFX polyphony limit limit anything a child can hear?
 *
 * THE CLAIM UNDER TEST. `audioEngine.registerSound` enforces `MAX_SFX = 4` by
 * calling the evicted sound's `stop()` — but `AudioProvider.playSound` passes
 * `const stopFn = () => {}`, because the `SfxFn` contract returns no stop
 * handle. So eviction removes a bookkeeping row and silences nothing, and
 * `registerSound` never returns `false` (its JSDoc says it does), so the caller
 * never skips a voice. The cap is therefore inert: every SFX a child triggers
 * plays, however many are already sounding.
 *
 * The question that decides whether that matters is not "is the code inert" —
 * it plainly is — but "does an uncapped pile-up reach a child's ears as
 * distortion?" The engine also builds a bus compressor at -14 dB / 5:1 whose
 * comment says it exists for exactly this, so the answer is not obvious from
 * reading either piece alone.
 *
 * HOW THIS MEASURES IT. Chromium renders the REAL engine graph through an
 * OfflineAudioContext: `initEngine` builds the real compressor, gains and
 * reverb; the real `SFX_REGISTRY` synth is fired N times at a realistic tap
 * cadence; the render is then scanned for peak sample value and for how many
 * samples exceed full scale. Nothing here re-implements the audio path.
 *
 * Run from inside the package: `node .probe/audio/r7-sfx-pileup.mjs`
 */

import { chromium } from 'playwright';
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// One IIFE bundle so it can be injected into the page as a plain script.
const built = await esbuild.build({
  stdin: {
    contents: [
      `export { SFX_REGISTRY } from './src/assets/audio/index';`,
      `export { initEngine, getSfxGain } from './src/assets/audio/utils/audioEngine';`,
    ].join('\n'),
    resolveDir: packageRoot,
    sourcefile: 'sfxPileup.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  globalName: 'AUDIO',
  target: 'es2022',
  platform: 'browser',
  write: false,
  alias: {
    '@app': path.join(packageRoot, 'src'),
    '@scenes': path.join(packageRoot, 'src/scenes'),
    '@game': path.join(packageRoot, 'src/minigames'),
  },
  plugins: [
    {
      // Same stub as tests/framework/_tsload.mjs: the audio registry's module
      // graph reaches scene code that imports `.glsl?raw`, and no shader text
      // is needed to render a sine burst.
      name: 'stub-shaders',
      setup(build) {
        build.onResolve({ filter: /\.glsl(\?raw)?$/ }, (a) => ({ path: a.path, namespace: 'glsl-stub' }));
        build.onLoad({ filter: /.*/, namespace: 'glsl-stub' }, () => ({ contents: 'export default ""', loader: 'js' }));
      },
    },
  ],
  logLevel: 'silent',
});
const bundleSource = built.outputFiles[0].text;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent('<!doctype html><title>sfx</title>');
await page.addScriptTag({ content: bundleSource });

/**
 * Renders `count` taps of one SFX through the real engine graph and reports
 * what came out of the destination.
 */
const measure = (soundId, count, gapMs) =>
  page.evaluate(
    async ({ soundId, count, gapMs }) => {
      const SR = 44100;
      const seconds = 4;
      const octx = new OfflineAudioContext(2, SR * seconds, SR);
      window.AUDIO.initEngine(octx);
      const dest = window.AUDIO.getSfxGain();
      const synth = window.AUDIO.SFX_REGISTRY[soundId];
      if (!synth) return { error: `no synth for ${soundId}` };

      // Fire the taps on the offline clock. `currentTime` does not advance in an
      // offline context until rendering, so the synths must schedule themselves
      // relative to it — which is what a burst of real taps does too, since the
      // real context's clock barely moves across a fast multi-tap.
      for (let i = 0; i < count; i += 1) {
        // Each call is one `playSound`: the cap never rejects, so all N run.
        synth(octx, dest);
        await new Promise((r) => setTimeout(r, gapMs));
      }

      const buf = await octx.startRendering();
      let peak = 0;
      let over = 0;
      for (let ch = 0; ch < buf.numberOfChannels; ch += 1) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < data.length; i += 1) {
          const v = Math.abs(data[i]);
          if (v > peak) peak = v;
          if (v > 1) over += 1;
        }
      }
      return { peak, over, samples: buf.length * buf.numberOfChannels };
    },
    { soundId, count, gapMs },
  );

const SOUND = process.env.SFX_ID || 'sfx_shared_tap_fallback';
console.log(`sound: ${SOUND}   (MAX_SFX = 4, and nothing enforces it)\n`);
console.log('taps   peak      dBFS      samples over full scale');
console.log('-----  --------  --------  -----------------------');

const rows = [];
for (const n of [1, 2, 4, 6, 8, 12, 20]) {
  const r = await measure(SOUND, n, 5);
  if (r.error) {
    console.log(r.error);
    break;
  }
  const db = 20 * Math.log10(r.peak || 1e-9);
  rows.push({ n, ...r, db });
  console.log(`${String(n).padEnd(5)}  ${r.peak.toFixed(4).padEnd(8)}  ${db.toFixed(2).padStart(7)}  ${r.over}`);
}

console.log('\n================ VERDICT ================');
const clipping = rows.filter((r) => r.over > 0);
const one = rows.find((r) => r.n === 1);
const many = rows[rows.length - 1];
if (clipping.length > 0) {
  const first = clipping[0];
  console.log(`DEFECT CONFIRMED: output exceeds full scale from ${first.n} overlapping taps (${first.over} samples clipped).`);
  console.log('  The cap that was supposed to stop this evicts a row from an array and silences nothing.');
} else {
  console.log('NOT REPRODUCED as clipping: the bus compressor holds the pile-up inside full scale.');
  if (one && many) {
    console.log(
      `  1 tap peaks at ${one.peak.toFixed(4)} (${one.db.toFixed(2)} dBFS); ${many.n} taps peak at ${many.peak.toFixed(4)} (${many.db.toFixed(2)} dBFS).`,
    );
    console.log(`  ${many.n}x the voices buys ${(many.db - one.db).toFixed(2)} dB, so the limiter is doing the job MAX_SFX is not.`);
  }
  console.log('  The inert cap is therefore a lie in the code, not a defect in the ears.');
}
console.log('=========================================');

await browser.close();
