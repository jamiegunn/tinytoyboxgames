/**
 * Do the playroom's toy timers survive the playroom?
 *
 * The claim: `createToyTrain` starts two gsap timers with no owner — a
 * `repeat: -1` puff tween on an anonymous `{}` target, and a self-rescheduling
 * `delayedCall` horn — and both toy cars start an unowned 15s `delayedCall` that
 * calls `triggerSound`. Nothing holds a handle, so scene teardown cannot reach
 * them. The horn then plays in whatever scene the child walked into next.
 *
 * This drives the REAL shipped builders through the REAL disposal scope and the
 * REAL `sceneBridge`, disposes the scope the way the scene teardown does, and
 * then asks the only question that matters: does the sound handler still fire?
 *
 * gsap's global timeline is time-scaled so the 6s / 15s waits pass in real
 * milliseconds. That changes WHEN the callbacks run, not WHETHER teardown can
 * kill them, which is the property under test.
 */
import { Scene, DirectionalLight } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';

const PLAYROOM = '@scenes/world/places/house/subplaces/playroom';
const M = await bundleEntry(
  'r7OrphanTimers',
  [
    `export { createToyTrain } from '${PLAYROOM}/floorToys/toyTrain';`,
    `export { createToyCar } from '${PLAYROOM}/floorToys/toyCar';`,
    `export { registerSoundHandler, unregisterSoundHandler } from '@app/assets/audio/sceneBridge';`,
    `export { setSceneIdleAnimator } from '@app/utils/idle/registry';`,
    `export { createDisposalScope } from '@app/utils/disposal';`,
  ].join('\n'),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const heard = [];
M.registerSoundHandler((id) => heard.push(id));

const scene = new Scene();
const light = new DirectionalLight();
const scope = M.createDisposalScope();
M.setSceneIdleAnimator(scene, scope);

M.createToyTrain(scene, light);
try {
  M.createToyCar(scene, light);
} catch (e) {
  console.log('(toy car builder needs different args; testing the train alone)', e.message);
}

// Speed the world up so the 6s first horn and the 15s car timer land quickly.
gsap.globalTimeline.timeScale(60);

await sleep(120);
const beforeTeardown = heard.length;
console.log(`sounds heard while the playroom is alive: ${beforeTeardown} ${JSON.stringify(heard)}`);

// Tear the scene down exactly as leaving the room does.
scope.dispose();
scene.clear();
heard.length = 0;

// The child is now in a different scene. Anything that arrives here is a toy
// from a room that no longer exists.
await sleep(900);

console.log(`\nsounds heard AFTER teardown: ${heard.length} ${JSON.stringify(heard)}`);

// Count what is still scheduled on gsap's global timeline.
const live = gsap.globalTimeline.getChildren(true, true, true).length;
console.log(`gsap animations still alive after teardown: ${live}`);

console.log('\n================ VERDICT ================');
if (heard.length > 0) {
  const unique = [...new Set(heard)];
  console.log(`DEFECT CONFIRMED: ${heard.length} sound(s) fired from a disposed playroom: ${unique.join(', ')}`);
  console.log('  A child who leaves the playroom keeps hearing its toys.');
} else {
  console.log('NOT REPRODUCED via sound: no audio escaped teardown.');
}
if (live > 0) {
  console.log(`LEAK CONFIRMED: ${live} gsap animation(s) outlived the scene and nothing holds a handle to them.`);
}
console.log('=========================================');

M.unregisterSoundHandler();
gsap.globalTimeline.timeScale(1);
gsap.globalTimeline.clear();
gsap.ticker.sleep();
