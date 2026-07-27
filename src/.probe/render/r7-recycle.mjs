/**
 * Does recycling a ripple ring blank the splash that recycled it?
 *
 * The claim under test: `launch()` sets `visible = true`, then kills every tween
 * belonging to the ring's PREVIOUS timeline — `gsap.killTweensOf(ring.material)`
 * explicitly, and `gsap.killTweensOf(mesh)` / `killTweensOf(mesh.scale)` inside
 * `playAnimations`. A gsap timeline whose children have all been killed reports
 * zero remaining duration and fires its `onComplete` on the next tick. That
 * `onComplete` is the OLD launch's `onEnd`, and its body is
 * `ring.mesh.visible = false` — applied to the ring the NEW launch just lit.
 *
 * The pool holds CONCURRENT_SPLASHES * RINGS_PER_SPLASH = 6 rings and consumes 2
 * per splash, so the 4th tap inside one 0.9s lifetime recycles rings 0 and 1
 * mid-flight. This drives the REAL shipped `createSeaRipples`, not a replica.
 */
import { PerspectiveCamera, Group } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';
import { Vector3 } from 'three';

const SCAFFOLD = '@scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold';
const M = await bundleEntry('r7Recycle', [`export { createSeaRipples } from '${SCAFFOLD}/sea/ripple';`].join('\n'));

const WIDTH = 1280;
const HEIGHT = 720;
const canvas = { clientWidth: WIDTH, clientHeight: HEIGHT, width: WIDTH, height: HEIGHT };

const camera = new PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 500);
camera.position.set(0, 6, 14);
camera.lookAt(0, -0.6, -10);
camera.updateMatrixWorld(true);

const parent = new Group();
const ripples = M.createSeaRipples(parent, camera, canvas);

const rings = () => parent.children.filter((c) => c.name.startsWith('ship_seaRipple'));
const shot = (label) => {
  const r = rings().map((m) => ({
    name: m.name,
    visible: m.visible,
    sx: Number(m.scale.x.toFixed(3)),
    op: Number(m.material.opacity.toFixed(3)),
  }));
  console.log(`\n[${label}]`);
  for (const e of r) console.log(`   ${e.name}  visible=${String(e.visible).padEnd(5)} scale.x=${String(e.sx).padEnd(7)} opacity=${e.op}`);
  return r;
};

const at = (x, z) => new Vector3(x, -0.6, z);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`pool size = ${rings().length} rings`);

// Four taps well inside one 0.9s ring lifetime. Taps 1-3 fill the pool; tap 4
// recycles rings 0 and 1, which are still in flight.
ripples.splash(at(0, -12));
await sleep(60);
ripples.splash(at(2, -13));
await sleep(60);
ripples.splash(at(-2, -14));
await sleep(60);
shot('after 3 taps — 6 rings in flight, all should be visible');

ripples.splash(at(1, -12.5));
await sleep(50);
const mid = shot('50ms after the 4th tap — rings 0 and 1 were just relaunched');

// The relaunched pair is rings 0 and 1. They were lit by the 4th splash and are
// only 50ms into a 900ms animation, so anything but visible=true is the defect.
const relaunched = mid.filter((e) => e.name === 'ship_seaRipple_0' || e.name === 'ship_seaRipple_1');
const blanked = relaunched.filter((e) => e.visible === false);

await sleep(300);
const later = shot('350ms after the 4th tap — still mid-animation');
const stillBlank = later.filter((e) => (e.name === 'ship_seaRipple_0' || e.name === 'ship_seaRipple_1') && e.visible === false && e.op > 0);

console.log('\n================ VERDICT ================');
if (blanked.length > 0) {
  console.log(`DEFECT CONFIRMED: ${blanked.length} of the 2 relaunched rings were blanked by their own predecessor's onEnd.`);
  console.log(`  ${blanked.map((e) => e.name).join(', ')}`);
  if (stillBlank.length > 0) {
    console.log(
      `  And they are STILL invisible at 350ms while animating — opacity ${stillBlank.map((e) => e.op).join(', ')}, scale ${stillBlank.map((e) => e.sx).join(', ')}.`,
    );
    console.log('  That is a fully-running, fully-invisible ripple: the child taps and sees nothing.');
  }
} else {
  console.log('NOT REPRODUCED: both relaunched rings are visible. The claim is wrong as stated.');
}
console.log('=========================================');

ripples.dispose();
gsap.globalTimeline.clear();
gsap.ticker.sleep();
