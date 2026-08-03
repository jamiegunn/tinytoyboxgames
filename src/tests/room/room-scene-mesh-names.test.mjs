/**
 * Every object a room puts in the scene has a name.
 *
 * THE DEFECT THIS FOUND, AND HOW
 * ------------------------------
 * `tests/room/room-opening-framing.test.mjs` classifies each cell of the frame
 * by the NAME of what the ray hits — ceiling, floor, wall, or props — and its
 * verdict was that the Kitchen was the best-composed room in the app: 82.5%
 * props, 0% floor, 0% ceiling. It is a generated room, and the generator's
 * template named neither its ceiling nor its floor. Both were being counted as
 * PROPS. An 11 x 20 ceiling slab and an 18 x 24 floor plane, scored as content.
 *
 * The number that made it visible was unrelated: a histogram of prop volume by
 * height put 53.7% of the Kitchen's "props" in a single half-metre band at
 * ceiling level, in a mesh with no name.
 *
 * WHY THIS IS A CONTRACT AND NOT A TIDINESS RULE
 * ----------------------------------------------
 * Names are load-bearing in this repo. The perch classifier, the frame
 * composition guard, the prop inventory and every probe that has ever asked
 * "what is this room made of" read them. An unnamed mesh is not anonymous — it
 * is silently reclassified as whatever the default branch happens to be, which
 * is how a missing name became a room that scored best on the metric it was
 * corrupting.
 *
 * The rule is scoped to objects added at the SCENE ROOT rather than to every
 * mesh in the graph. A mesh inside a named group is identifiable through its
 * ancestors, and the composition guard walks up to find one; a root-level object
 * has nothing above it but the scene.
 */

import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import gsap from 'gsap';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';

after(() => gsap.ticker.sleep());

const M = await bundleEntry(
  'room-scene-mesh-names',
  `
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
`,
);

const noop = () => {};
const stubCanvas = () => ({
  width: 1280,
  height: 720,
  clientWidth: 1280,
  clientHeight: 720,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  addEventListener: noop,
  removeEventListener: noop,
  style: {},
});

/**
 * Builds a room and hands back its scene.
 *
 * @param build - The room's real `buildContents`.
 * @returns The populated scene and its teardown.
 */
function buildRoom(build) {
  const scene = new Scene();
  const contents = build({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher: { register: () => noop, registerWithPoint: () => noop, setMissHandler: noop, dispose: noop },
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);
  return { scene, cleanup: () => contents?.cleanup?.() };
}

const ROOMS = [
  ['playroom', M.buildPlayroomContents],
  ['kitchen', M.buildKitchenContents],
  ['living-room', M.buildLivingRoomContents],
];

for (const [sceneId, build] of ROOMS) {
  test(`${sceneId}: every object at the scene root is named`, () => {
    const { scene, cleanup } = buildRoom(build);
    try {
      // Only things that RENDER. The Playroom parks a bare `Object3D` at the
      // root with no geometry and no children — an anchor, not scenery — and no
      // classifier can ever mistake it for content because no ray can hit it.
      // Requiring a name there would be tidiness dressed as a contract.
      const renders = (object) => object.isMesh || object.isPoints || object.isLine || object.children.some(renders);
      const anonymous = scene.children
        .filter((child) => !child.name && renders(child))
        .map((child) => `${child.type} (${child.children.length} children, geometry ${child.geometry?.type ?? 'none'})`);
      assert.deepEqual(
        anonymous,
        [],
        `${sceneId}: ${anonymous.length} unnamed object(s) at the scene root — ${anonymous.join('; ')}. ` +
          `Anything unnamed is classified by fallback, and the Kitchen's ceiling and floor were scored as PROPS for exactly this reason.`,
      );
    } finally {
      cleanup();
    }
  });

  test(`${sceneId}: the shell meshes are named for what they are`, () => {
    // Not just "has a name" — the composition guard matches on the WORDS
    // ceiling / floor / wall, so a shell mesh named `slab7` would pass the test
    // above and still be counted as content.
    const { scene, cleanup } = buildRoom(build);
    try {
      const names = scene.children.map((c) => (c.name || '').toLowerCase());
      for (const word of ['ceiling', 'floor', 'wall']) {
        assert.ok(
          names.some((n) => n.includes(word)),
          `${sceneId}: no root object's name contains "${word}", so the frame-composition guard cannot recognise that part of the shell`,
        );
      }
    } finally {
      cleanup();
    }
  });
}

test('the room template names its shell, so the next generated room does not repeat this', () => {
  // The Kitchen is generated. Fixing the Kitchen alone would leave the defect
  // waiting in the template for the next room anyone creates.
  for (const [file, token] of [
    ['templates/room-scene/room/ceiling.ts', 'ceiling.name'],
    ['templates/room-scene/room/floor.ts', 'floor.name'],
  ]) {
    assert.match(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), new RegExp(token.replace('.', '\\.')), `${file} no longer names its mesh`);
  }
});
