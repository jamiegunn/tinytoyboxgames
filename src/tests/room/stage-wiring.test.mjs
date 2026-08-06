/**
 * That the stage rectangle is actually WIRED, not merely computed.
 *
 * WHAT CHANGED, AND WHY THE FIXTURES LOOK ODD
 * -------------------------------------------
 * The band is now [0.4, 2.6], which contains every phone, tablet and laptop in
 * both orientations — so a real device gets the whole viewport and NO chrome
 * band. The letterbox is a backstop for shapes a desktop window can be dragged
 * into. That is why the viewports below are 300x900 and 3840x1080 rather than a
 * phone: a phone no longer exercises this path, and a fixture that no longer
 * reaches the branch it names is a test that has quietly stopped testing.
 *
 * The wiring still has to be checked, and now in both directions: that the
 * canvas takes the measured rectangle when there is one to take, and that the
 * measured rectangle really is the whole viewport on the devices this is played
 * on.
 *
 * WHY THIS EXISTS
 * ---------------
 * A mutation run found the hole. `src/utils/scene/stageRect.ts` has nine tests
 * of its own, every room framing is solved against the band it defines, and
 * every framing guard sweeps the aspects it produces — and with all of that
 * green, changing SceneFrame's canvas back to `width: '100%', height: '100%'`
 * broke nothing. The whole apparatus rests on one component applying one
 * rectangle, and nothing was checking that it did.
 *
 * HOW THIS IS DRIVEN
 * ------------------
 * `bundleComponent` swaps in a fake `react` whose JSX factory returns plain
 * `{ type, props, children }` objects, so a component can be CALLED and its
 * returned element tree inspected as data. Nothing is rendered and no DOM is
 * involved; what is asserted is the style the component asks for, which is the
 * only thing standing between the solved framings and the screen.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleComponent } from '../framework/_tsload.mjs';

/** A phone. Inside the band now, so the stage is the whole screen. */
const PHONE = { width: 393, height: 852 };
/** A browser window dragged into a column: below the floor, letterbox bites. */
const COLUMN = { width: 300, height: 900 };
/** A 32:9 monitor: past the ceiling, so the pillarbox bites. */
const ULTRAWIDE = { width: 3840, height: 1080 };
/** A shape already inside the band, where the stage is the whole viewport. */
const INSIDE_BAND = { width: 1200, height: 1000 };

// The provider's context default calls `getResponsiveState()`, which reads
// `window`, and the module is evaluated at import time — so the globals have to
// exist before the bundle is loaded, not before the component is called.
let viewport = INSIDE_BAND;
globalThis.window = {
  get innerWidth() {
    return viewport.width;
  },
  get innerHeight() {
    return viewport.height;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
};

const M = await bundleComponent(
  'stage-wiring',
  `
  export { SceneFrame } from './src/components/SceneFrame';
  export { UIOverlay } from './src/components/UIOverlay';
  export { resolveStageRect, resolveChromeBand, MIN_CHROME_BAND } from './src/utils/scene/stageRect';
  export { EFFECTS, __resetEffects, CONTEXTS } from 'react';
`,
);

// STAND THE CONTEXTS UP. `SceneRouterCtx` and `AudioCtx` are module-private and
// both default to null, so `useNavigation()` throws before the component reaches
// its first line of layout. Every null-defaulted context gets the same
// duck-typed stand-in rather than being matched up by creation order, which
// would silently re-pair itself the day a provider is added.
const STUB_CONTEXT = {
  currentScene: 'kitchen',
  activeMiniGame: null,
  isTransitioning: false,
  navigateTo: () => {},
  launchMiniGame: () => {},
  exitMiniGame: () => {},
  isMuted: false,
  toggleMute: () => {},
  playSound: () => {},
  startSceneAudio: () => {},
  stopSceneAudio: () => {},
  isAudioUnlocked: true,
};
for (const context of M.CONTEXTS) {
  if (context._v === null) context._v = STUB_CONTEXT;
}

// The one context that is NOT null-defaulted: the responsive state. Found by the
// shape of its default rather than by position, for the same reason.
const responsiveContext = M.CONTEXTS.find((c) => c._v && typeof c._v.viewportWidth === 'number');
if (!responsiveContext) throw new Error('no responsive context found — ResponsiveProvider no longer defaults to a viewport state');

/**
 * Calls a component at a given viewport and returns its element tree.
 *
 * @param component - The component function.
 * @param at - Viewport to report through the stubbed `window`.
 * @returns The returned element tree.
 */
function renderAt(component, at) {
  viewport = at;
  // The responsive context's default is computed ONCE, when the provider module
  // is evaluated — the stub has no re-render, so moving `window` afterwards
  // changes nothing on its own. Setting the context is what a resize does in the
  // real app, and it is the input under test here.
  responsiveContext._v = {
    viewportWidth: at.width,
    viewportHeight: at.height,
    orientation: at.width >= at.height ? 'landscape' : 'portrait',
    scaleFactor: Math.min(at.width / 1440, 1),
    isMobile: at.width < 768,
  };
  M.__resetEffects();
  return component({ children: null });
}

/**
 * Depth-first search of an element tree.
 *
 * @param node - Element, array, or primitive.
 * @param predicate - Match test.
 * @returns The first matching element, or null.
 */
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, predicate);
      if (hit) return hit;
    }
    return null;
  }
  if (predicate(node)) return node;
  return find(node.children ?? [], predicate);
}

/**
 * Every element in a tree, flattened.
 *
 * @param node - Element, array, or primitive.
 * @returns All element objects, in document order.
 */
function all(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(all);
  return [node, ...all(node.children ?? [])];
}

const canvasOf = (tree) => find(tree, (n) => n.type === 'canvas');

for (const [label, at] of [
  ['a phone', PHONE],
  ['an ultrawide desktop', ULTRAWIDE],
  ['a viewport inside the band', INSIDE_BAND],
]) {
  test(`SceneFrame sizes its canvas to the stage rect on ${label}`, () => {
    const canvas = canvasOf(renderAt(M.SceneFrame, at));
    assert.ok(canvas, 'SceneFrame no longer renders a canvas');
    const rect = M.resolveStageRect(at.width, at.height);
    assert.equal(canvas.props.style.width, rect.width, `${label}: canvas width is not the stage width`);
    assert.equal(canvas.props.style.height, rect.height, `${label}: canvas height is not the stage height`);
    assert.equal(canvas.props.style.left, rect.offsetX, `${label}: canvas is not at the stage offset`);
    assert.equal(canvas.props.style.top, rect.offsetY);
  });
}

test('the canvas is a measured box, not a percentage of the window', () => {
  // The exact regression a mutation reintroduced with nothing failing: a canvas
  // at 100% x 100% takes whatever aspect the device has, which is the state
  // every framing in this app was re-solved to escape.
  for (const at of [PHONE, ULTRAWIDE, INSIDE_BAND]) {
    const style = canvasOf(renderAt(M.SceneFrame, at)).props.style;
    for (const key of ['width', 'height']) {
      assert.equal(typeof style[key], 'number', `canvas ${key} is "${String(style[key])}" — a percentage tracks the window, not the stage`);
    }
  }
});

test('a letterboxed viewport really does lose height rather than width', () => {
  // Belt and braces on the direction of the letterbox. Squeezing the width
  // instead would also satisfy "the canvas is a measured box" while shrinking
  // the scene, which is the complaint the letterbox answers.
  const style = canvasOf(renderAt(M.SceneFrame, COLUMN)).props.style;
  assert.equal(style.width, COLUMN.width, 'the stage gave up width rather than height');
  assert.ok(style.height < COLUMN.height, 'nothing was taken, so this fixture is not letterboxed at all');
});

test('a phone gets the whole screen, canvas included', () => {
  // THE POINT OF REMOVING THE LETTERBOX, checked at the one place it can be
  // undone: the canvas style. `stage-rect.test.mjs` says the RECTANGLE is the
  // whole viewport on real devices; this says the canvas is given it.
  for (const at of [PHONE, { width: 852, height: 393 }, { width: 834, height: 1194 }, { width: 1440, height: 900 }]) {
    const style = canvasOf(renderAt(M.SceneFrame, at)).props.style;
    assert.equal(style.width, at.width, `the canvas is ${style.width} wide on a ${at.width}x${at.height} screen`);
    assert.equal(style.height, at.height, `the canvas is ${style.height} tall on a ${at.width}x${at.height} screen`);
    assert.equal(style.left, 0);
    assert.equal(style.top, 0);
  }
});

test('UIOverlay puts its controls in the chrome band when there is one', () => {
  // The other half of letterboxing: where a band exists, the buttons belong in
  // it. If they stay pinned to the viewport corners they sit on the scene a
  // child is meant to be able to touch and the band below it stays empty.
  const band = M.resolveChromeBand(COLUMN.width, COLUMN.height);
  assert.ok(band.below > 0, 'the fixture is wrong: this viewport has no band below the stage');
  const row = find(renderAt(M.UIOverlay, COLUMN), (n) => n.props?.style?.height === band.below);
  assert.ok(row, `no element is laid out at the chrome band height ${band.below} — the HUD is still floating over the scene`);
  const stage = M.resolveStageRect(COLUMN.width, COLUMN.height);
  assert.equal(row.props.style.top, stage.height, 'the control row does not start where the stage ends');
});

test('UIOverlay floats over the scene when there is no band, and stays out of the middle', () => {
  // The case that is now normal. With no band the controls have nowhere to go
  // but on top of the scene, so what matters is that they stay in a corner
  // rather than over the toys — a button across the middle of the frame is a
  // toy a child cannot reach.
  for (const at of [PHONE, { width: 852, height: 393 }, { width: 1440, height: 900 }]) {
    assert.deepEqual(M.resolveChromeBand(at.width, at.height), { below: 0, beside: 0 }, `${at.width}x${at.height} is not a no-band fixture`);
    const buttons = all(renderAt(M.UIOverlay, at)).filter((n) => n.type === 'button');
    assert.ok(buttons.length >= 2, `expected at least two controls at ${at.width}x${at.height}`);
    for (const b of buttons) {
      const { width, height } = b.props.style;
      assert.ok(
        width <= at.width * 0.2 && height <= at.height * 0.2,
        `a control is ${width}x${height} on a ${at.width}x${at.height} screen — that is not a corner, that is the scene`,
      );
    }
    // Every control together must leave the frame's middle third alone.
    const rowWidth = buttons.reduce((sum, b) => sum + b.props.style.width, 0) * 1.35;
    assert.ok(rowWidth < at.width, `the control row is ${rowWidth.toFixed(0)} across a ${at.width}px screen`);
  }
});

test('every control is at least a finger wide, at every viewport', () => {
  // The old HUD was a fixed 48-56px however large or small the screen was. The
  // floor matters more than the ceiling here: platform guidance puts a touch
  // target around 44px for an adult, and this app is aimed at three-year-olds,
  // who aim worse.
  // The last two are the fixtures a mutation run demanded: dropping MIN_CONTROL
  // from 56 to 24 changed nothing until this swept viewports whose chrome band
  // is SMALL, because everywhere else the band-proportional size is far above
  // either floor and the floor is never the binding constraint.
  for (const at of [PHONE, ULTRAWIDE, INSIDE_BAND, { width: 320, height: 480 }, { width: 400, height: 420 }, { width: 1000, height: 700 }]) {
    for (const node of all(renderAt(M.UIOverlay, at))) {
      if (node.type !== 'button') continue;
      const { width, height } = node.props.style;
      assert.ok(width >= 44 && height >= 44, `a control is ${width}x${height} at ${at.width}x${at.height} — smaller than a fingertip`);
      assert.equal(width, height, 'a round control that is not round');
    }
  }
});

test('SceneFrame resizes the renderer when the stage box changes, not only on a window event', () => {
  // A window `resize` listener alone reads the canvas before React has laid it
  // out at the new size, so the renderer keeps the previous box for a frame and
  // the camera keeps the previous aspect. The effect that depends on the stage
  // dimensions is what closes that.
  renderAt(M.SceneFrame, PHONE);
  const stageEffects = M.EFFECTS.filter((e) => Array.isArray(e.deps) && e.deps.length === 2 && e.deps.every((d) => typeof d === 'number'));
  assert.equal(stageEffects.length, 1, 'expected exactly one effect keyed on the stage width and height');
  const rect = M.resolveStageRect(PHONE.width, PHONE.height);
  assert.deepEqual(stageEffects[0].deps, [rect.width, rect.height], 'the effect is keyed on something other than the stage box');
});

test('a band too thin to hold a control is not used as one', () => {
  // A viewport where the aspect invariant and the band floor cannot both be
  // satisfied. The region is narrow — the short axis has to be under about 266px
  // — but the branch is real, and laying the row out in a 73px band would put
  // 56px buttons hard against both its edges and over the scene.
  // THIS FIXTURE IS ABSURD ON PURPOSE. Widening the band to [0.4, 2.6] shrank the
  // region where the aspect invariant and the 76px band floor cannot both hold
  // down to viewports under about 36 CSS pixels on the short axis: the stage has
  // to be capped at 2.5x the width to stay in the band, and above w=36 there is
  // always room for a full band under that cap. 250x252 used to reach this branch
  // and is now comfortably inside the band with no sliver at all.
  //
  // The branch is still in `resolveStageRect` and `UIOverlay` still checks for it,
  // so it still gets a test — but the honest thing to say is that no device
  // reaches it, and this fixture is here to keep the code path from rotting rather
  // than because anyone will see it.
  const SLIVER = { width: 30, height: 80 };
  const band = M.resolveChromeBand(SLIVER.width, SLIVER.height);
  assert.ok(band.below > 0 && band.below < M.MIN_CHROME_BAND, `the fixture is wrong: this viewport's band is ${band.below}, not a sliver`);
  const row = find(renderAt(M.UIOverlay, SLIVER), (n) => n.props?.style?.height === band.below);
  assert.equal(row, null, 'the HUD laid itself out inside a band too thin to hold it instead of floating');
});

test('no control is ever clipped by the edge of the screen', () => {
  // FOUND BY LOOKING, NOT BY MEASURING. Sizing the HUD from the chrome band's
  // DEPTH alone produced 132px controls on a 393-wide phone — a row 450px across
  // in a 393px window, with the back and mute buttons sliced off by the screen
  // edges. Every existing assertion passed: the buttons were big enough, in the
  // band, and the right shape. None of them knew how wide the row was.
  for (const at of [PHONE, ULTRAWIDE, INSIDE_BAND, { width: 320, height: 480 }, { width: 360, height: 900 }]) {
    const tree = renderAt(M.UIOverlay, at);
    const buttons = all(tree).filter((n) => n.type === 'button');
    assert.ok(buttons.length >= 2, `expected at least two controls at ${at.width}x${at.height}`);
    const band = M.resolveChromeBand(at.width, at.height);
    // The row runs ACROSS a band below the stage and DOWN a band beside it, so
    // which dimension can clip depends on which band exists. Checking the wrong
    // one is how the first version of this reported a false failure on an
    // ultrawide, where the controls stack vertically in a 524px-wide strip and
    // summing their widths is meaningless.
    const vertical = band.beside > 0;
    const runLength = buttons.reduce((sum, b) => sum + (vertical ? b.props.style.height : b.props.style.width), 0);
    const gaps = (buttons.length + 1) * buttons[0].props.style.width * 0.35;
    const runSpan = vertical ? at.height : at.width;
    assert.ok(
      runLength + gaps <= runSpan + 1e-6,
      `at ${at.width}x${at.height} the control ${vertical ? 'column' : 'row'} needs ${(runLength + gaps).toFixed(0)}px along a ${runSpan}px span — ` +
        `${buttons.length} controls of ${buttons.map((b) => b.props.style.width.toFixed(0)).join(', ')}px would be clipped`,
    );
    // And the cross-axis: a control wider than the strip it sits in overhangs
    // onto the scene even when the column itself fits.
    if (vertical) {
      for (const b of buttons) {
        assert.ok(
          b.props.style.width <= band.beside + 1e-6,
          `a ${b.props.style.width.toFixed(0)}px control does not fit a ${band.beside.toFixed(0)}px side band`,
        );
      }
    }
  }
});

test('the chrome band never paints over the stage', () => {
  // ALSO FOUND BY LOOKING. The band's surface used `width: 100%` for the
  // side-band case, so on an ultrawide it covered the entire viewport — canvas
  // included — and the app rendered as a completely blank brown screen. Nothing
  // in the suite noticed, because nothing else asks what is drawn ON TOP of the
  // canvas. A full-bleed opaque element in an overlay is worth an assertion of
  // its own.
  for (const at of [PHONE, ULTRAWIDE, INSIDE_BAND]) {
    const stage = M.resolveStageRect(at.width, at.height);
    const opaque = all(renderAt(M.UIOverlay, at)).filter((n) => n.type === 'div' && n.props?.style?.background && n.props.style.position === 'absolute');
    for (const surface of opaque) {
      const { left = 0, right = 0, top = 0, width, height } = surface.props.style;
      // A surface that starts left of the stage must stop before it, and one
      // that starts at the top must start at or below the stage's bottom edge.
      const startsAtLeft = left === 0 && right !== 0;
      const spansFullWidth = width === '100%' || (typeof width === 'number' && width >= at.width);
      assert.ok(
        !spansFullWidth || top >= stage.height - 1e-6,
        `at ${at.width}x${at.height} a chrome surface spans the full width starting at y=${top}, over a stage ${stage.width}x${stage.height}. It is painting on the scene.`,
      );
      if (startsAtLeft && typeof width === 'number') {
        assert.ok(width <= stage.offsetX + 1e-6, `a left chrome strip is ${width}px wide but the stage starts at x=${stage.offsetX}`);
      }
      void height;
    }
  }
});
