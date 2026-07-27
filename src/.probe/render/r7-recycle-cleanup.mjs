import { PerspectiveCamera, Group, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';
const S = '@scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold';
const M = await bundleEntry('r7b', `export { createSeaRipples } from '${S}/sea/ripple';`);
const canvas = { clientWidth: 1280, clientHeight: 720, width: 1280, height: 720 };
const cam = new PerspectiveCamera(50, 16 / 9, 0.1, 500);
cam.position.set(0, 6, 14);
cam.lookAt(0, -0.6, -10);
cam.updateMatrixWorld(true);
const parent = new Group();
const r = M.createSeaRipples(parent, cam, canvas);
const rings = () => parent.children.filter((c) => c.name.startsWith('ship_seaRipple'));
const sleep = (ms) => new Promise((x) => setTimeout(x, ms));

console.log('--- A: single splash, allowed to finish naturally ---');
r.splash(new Vector3(0, -0.6, -12));
await sleep(1400);
let vis = rings().filter((m) => m.visible);
console.log('visible rings 1400ms after ONE splash:', vis.length, vis.map((m) => m.name).join(',') || '(none)');
console.log(vis.length === 0 ? '  PASS: cleanup still works.' : '  FAIL: ring left on screen — the guard broke teardown.');

console.log('\n--- B: recycled ring must still hide when ITS OWN launch ends ---');
for (let i = 0; i < 4; i++) {
  r.splash(new Vector3(i, -0.6, -12 - i));
  await sleep(60);
}
await sleep(1500);
vis = rings().filter((m) => m.visible);
console.log('visible rings 1500ms after the last of 4 rapid splashes:', vis.length, vis.map((m) => m.name).join(',') || '(none)');
console.log(vis.length === 0 ? '  PASS: recycled rings hide on their own completion.' : '  FAIL: ring stuck visible.');
r.dispose();
gsap.globalTimeline.clear();
gsap.ticker.sleep();
