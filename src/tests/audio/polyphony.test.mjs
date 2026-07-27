/**
 * The audio engine must never refuse to answer a tap.
 *
 * WHAT THIS REPLACED, AND WHY THE REPLACEMENT IS THE CONSERVATIVE CHOICE.
 * `registerSound` used to advertise a polyphony limit: a `MAX_SFX = 4` cap, an
 * eviction branch that called the oldest SFX's `stop()`, and a doc line
 * promising "returns false if the polyphony limit is exceeded". None of it was
 * connected to anything. The function had one `return` and it was `return true`;
 * eviction only ever selected SFX entries, and every SFX arrives with
 * `AudioProvider`'s `const stopFn = () => {}` because the `SfxFn` contract
 * hands back no stop handle. So the cap removed a row from an array and
 * silenced nothing — while reading, and type-checking, as a working safety net.
 *
 * The tempting repair was to make the cap real. It was measured instead:
 * `.probe/audio/r7-sfx-pileup.mjs` renders the real engine graph through
 * Chromium's OfflineAudioContext and reads the samples. Twenty overlapping taps
 * peak at -14.6 dBFS (`sfx_shared_tap_fallback`), -8.0 dBFS
 * (`sfx_cannonball_fire`), -1.1 dBFS (`sfx_shared_chomp`). Nothing clips. The
 * bus compressor is the thing protecting small ears, and it works.
 *
 * A real `MAX_SFX = 4`, on the other hand, would refuse a child's fifth tap
 * inside five seconds, because that is how long an SFX row lingers before
 * `AudioProvider` unregisters it. Silence in answer to a deliberate press is
 * precisely the defect this codebase spent a round removing from the water
 * ripples. So the cap is gone, and this file exists to keep it gone: if someone
 * reinstates a voice limit, the first test below fails and says why.
 *
 * These drive the real module. `registerSound` and friends touch the
 * AudioContext only for `currentTime`, so they run headless with no shim.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleTs } from '../framework/_tsload.mjs';

const E = await bundleTs('src/assets/audio/utils/audioEngine.ts');

/**
 * Registers `n` SFX and reports WHEN each one's stop function ran: during the
 * burst, or only when the caller asked for silence afterwards.
 *
 * WHY THE TIMING AND NOT THE COUNT — THIS TEST'S FIRST DRAFT WAS WRONG.
 * The obvious observable is "how many stops does `stopCategory` fire", on the
 * reasoning that it reaches exactly the live rows. That is true and still
 * useless: an evicting `registerSound` CALLS the victim's `stop()` on the way
 * out, so a reinstated `MAX_SFX = 4` fires 16 stops during the burst and 4 at
 * the end, and a test counting stops sees 20 either way. The mutation was run
 * and it survived. Eviction is distinguished from no-eviction only by the
 * moment the stop happens, so that is what gets recorded here.
 */
function registerBurst(n) {
  const duringBurst = [];
  const all = [];
  let burstOver = false;
  for (let i = 0; i < n; i += 1) {
    E.registerSound(`sfx_test_${i}`, 'sfx', () => {
      all.push(i);
      if (!burstOver) duringBurst.push(i);
    });
  }
  burstOver = true;
  E.stopCategory('sfx');
  return { duringBurst, all };
}

test('a burst of taps is never thinned — the twentieth tap is as alive as the first', () => {
  const { duringBurst, all } = registerBurst(20);

  assert.deepEqual(
    duringBurst,
    [],
    `${duringBurst.length} of 20 taps were stopped while the burst was still going — a voice cap has been reinstated, and it will hand a child silence for their fifth tap in five seconds`,
  );
  assert.equal(all.length, 20, `only ${all.length} of 20 taps were still registered at the end of the burst`);
  assert.deepEqual(all, [...Array(20).keys()], 'the surviving taps were not the ones registered, in order');
});

test('registerSound reports nothing, because it never had a decision to report', () => {
  // The old signature returned `boolean`, always `true`, and its doc claimed a
  // `false` case that the body could not produce. Nothing may depend on a
  // return value again without the behaviour to back it.
  const result = E.registerSound('sfx_test_ret', 'sfx', () => {});
  assert.equal(result, undefined, 'registerSound returned a value; if it can refuse a sound now, the test above must be revisited first');
  E.stopCategory('sfx');
});

test('stopCategory reaches every live sound of its category and leaves the others', () => {
  const stopped = [];
  E.registerSound('sfx_a', 'sfx', () => stopped.push('sfx_a'));
  E.registerSound('music_a', 'music', () => stopped.push('music_a'));
  E.registerSound('ambient_a', 'ambient', () => stopped.push('ambient_a'));

  E.stopCategory('sfx');
  assert.deepEqual(stopped, ['sfx_a'], 'stopCategory(sfx) touched the wrong categories');

  E.stopCategory('music');
  E.stopCategory('ambient');
  assert.deepEqual(stopped, ['sfx_a', 'music_a', 'ambient_a']);
});

test('unregisterSound removes exactly the one sound, matched by its own stop function', () => {
  const stopped = [];
  const stopA = () => stopped.push('a');
  const stopB = () => stopped.push('b');
  E.registerSound('sfx_a', 'sfx', stopA);
  E.registerSound('sfx_b', 'sfx', stopB);

  E.unregisterSound(stopA);
  E.stopCategory('sfx');

  assert.deepEqual(stopped, ['b'], 'unregisterSound removed the wrong entry, or none');
});

test('disposeEngine stops everything still registered, whatever its category', () => {
  const stopped = [];
  E.registerSound('sfx_x', 'sfx', () => stopped.push('sfx_x'));
  E.registerSound('music_x', 'music', () => stopped.push('music_x'));
  E.registerSound('ambient_x', 'ambient', () => stopped.push('ambient_x'));

  E.disposeEngine();

  assert.deepEqual(stopped.sort(), ['ambient_x', 'music_x', 'sfx_x'], 'disposeEngine left sounds registered');

  // And the list really is empty afterwards, not merely walked.
  const after = [];
  E.registerSound('sfx_after', 'sfx', () => after.push('sfx_after'));
  E.stopCategory('sfx');
  assert.deepEqual(after, ['sfx_after']);
});

test('a stop function that throws does not stop disposeEngine reaching the rest', () => {
  const stopped = [];
  E.registerSound('sfx_boom', 'sfx', () => {
    throw new Error('synth already torn down');
  });
  E.registerSound('sfx_after_boom', 'sfx', () => stopped.push('sfx_after_boom'));

  E.disposeEngine();

  assert.deepEqual(stopped, ['sfx_after_boom'], 'one throwing stop stranded every sound after it');
});
