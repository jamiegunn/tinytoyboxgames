/**
 * Nothing a playroom toy starts may outlive the playroom.
 *
 * THE DEFECT THIS EXISTS TO STOP, WHICH TYPE-CHECKED AND READ AS FINISHED CODE.
 * Three builders started gsap timers and threw the handle away:
 *
 *   - `toyTrain` smoke: `gsap.to({}, { repeat: -1, onRepeat: emitPuff })`. The
 *     tween target is an anonymous object literal, so not even a
 *     `killTweensOf` sweep has anything to aim at.
 *   - `toyTrain` horn: a `delayedCall` whose callback schedules the next one.
 *     Killing any single call is useless; the chain re-seeds itself.
 *   - both `toyCar`s: a 15s `delayedCall` that fires `driveHandler`, which calls
 *     `triggerSound('sfx_shared_tap_fallback')`.
 *
 * Measured before the fix (`.probe/render/r7-orphan-timers.mjs`): after
 * `scope.dispose()` and `scene.clear()`, FIFTEEN gsap animations were still
 * running and three sounds fired from the destroyed room.
 *
 * WHY THE SOUND IS THE SHARP END AND THE ANIMATION IS NOT. `triggerSound`
 * (`assets/audio/sceneBridge.ts`) is a module-level singleton with no scene
 * binding — the handler belongs to the app, not the scene, so a stale caller is
 * heard everywhere. The orbit tween in `driveHandler` was ALREADY safe, because
 * registering on an already-disposed scope kills immediately
 * (`utils/disposal.ts:102`). So the animation self-cancelled and only the audio
 * escaped: a child who walked out to the beach heard a train horn from a room
 * that no longer existed, and heard the "you tapped something" chirp with
 * nothing tapped. That asymmetry is precisely why reading the file did not
 * reveal it, and why this test asserts on BOTH the sound and the animation
 * count.
 *
 * This drives the REAL builders through the REAL disposal scope. It does not
 * parse source and it does not re-implement anything it checks.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, DirectionalLight } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../framework/_tsload.mjs';

const PLAYROOM = '@scenes/world/places/house/subplaces/playroom';

const M = await bundleEntry(
  'playroomTimerOwnership',
  [
    `export { createToyTrain } from '${PLAYROOM}/floorToys/toyTrain';`,
    `export { createToyCar as createFloorCar } from '${PLAYROOM}/floorToys/toyCar';`,
    `export { createToyCar as createShelfCar } from '${PLAYROOM}/bookshelf-items/toyCar';`,
    `export { registerSoundHandler, unregisterSoundHandler } from '@app/assets/audio/sceneBridge';`,
    `export { setSceneIdleAnimator } from '@app/utils/idle/registry';`,
    `export { createDisposalScope } from '@app/utils/disposal';`,
  ].join('\n'),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Builds the toys into a scene, tears the scene down the way leaving the room
 * does, and reports what was still running afterwards.
 *
 * gsap's global timeline is time-scaled so the 6s horn and the 15s car timers
 * come due in real milliseconds. That changes WHEN a callback is reached, not
 * WHETHER teardown can reach it first — which is the only property asserted.
 */
async function afterLeavingTheRoom(build) {
  const heard = [];
  M.registerSoundHandler((id) => heard.push(id));
  const scene = new Scene();
  const scope = M.createDisposalScope();
  M.setSceneIdleAnimator(scene, scope);

  build(scene, new DirectionalLight());

  const before = gsap.globalTimeline.timeScale();
  gsap.globalTimeline.timeScale(60);
  try {
    await sleep(120);
    scope.dispose();
    scene.clear();
    heard.length = 0;
    // Long enough at 60x for several horn cycles and both car timers.
    await sleep(900);
    return { heard: [...heard], live: gsap.globalTimeline.getChildren(true, true, true).length };
  } finally {
    gsap.globalTimeline.timeScale(before);
    M.unregisterSoundHandler();
    gsap.globalTimeline.clear();
  }
}

test('the toy train takes its horn and its smoke with it when the playroom closes', async () => {
  const { heard, live } = await afterLeavingTheRoom((scene, light) => M.createToyTrain(scene, light));

  assert.deepEqual(heard, [], `a disposed playroom was still making noise: ${heard.join(', ')} — the horn's delayedCall chain is unowned again`);
  assert.equal(live, 0, `${live} gsap animation(s) outlived the scene; the repeat:-1 smoke tween is the usual culprit`);
});

test('neither toy car honks from a room the child has already left', async () => {
  const { heard, live } = await afterLeavingTheRoom((scene, light) => {
    M.createFloorCar(scene, light);
    M.createShelfCar(scene);
  });

  assert.ok(!heard.includes('sfx_shared_tap_fallback'), 'a tap-confirmation sound played after teardown, with nothing tapped and the room gone');
  assert.deepEqual(heard, [], `sounds escaped a disposed playroom: ${heard.join(', ')}`);
  assert.equal(live, 0, `${live} gsap animation(s) outlived the scene`);
});

test('CONTROL: the harness can actually hear a sound, so the assertions above are not vacuous', async () => {
  // Without this, deleting the sound handler wiring would turn both tests above
  // into `assert.deepEqual([], [])` and they would pass forever.
  const heard = [];
  M.registerSoundHandler((id) => heard.push(id));
  const scene = new Scene();
  const scope = M.createDisposalScope();
  M.setSceneIdleAnimator(scene, scope);
  M.createToyTrain(scene, new DirectionalLight());

  const before = gsap.globalTimeline.timeScale();
  gsap.globalTimeline.timeScale(60);
  try {
    // Same elapsed time as the tests above, but WITHOUT disposing. The horn is
    // due at 6s, which is 100ms at this scale.
    await sleep(1000);
    assert.ok(heard.length > 0, 'the train never sounded its horn even with the room alive — the harness is deaf and the tests above prove nothing');
  } finally {
    gsap.globalTimeline.timeScale(before);
    scope.dispose();
    M.unregisterSoundHandler();
    gsap.globalTimeline.clear();
  }
});

test.after(() => {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
});
