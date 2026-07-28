/**
 * The AudioContext must die with the component that made it.
 *
 * THE DEFECT THIS FILE EXISTS TO KEEP FIXED. `AudioProvider` constructed an
 * `AudioContext` on the first gesture and, on unmount, called `disposeEngine()`
 * — which drops the engine's *references* (`ctx = null`, gains nulled) and stops
 * registered sounds, but never closes the hardware context. `.close()` appeared
 * nowhere in `src/`. The context therefore stayed alive, running, forever.
 *
 * WHY THAT IS REACHABLE AND NOT THEORETICAL. `App.tsx` mounts `AudioProvider`
 * only in the `view === 'app'` branch, and `view` is derived from the URL hash
 * with `hashchange`/`popstate` listeners. So the browser BACK BUTTON — hash
 * `#/nature` → `#` → `view = 'landing'` — unmounts the provider, and pressing
 * Play remounts it and builds another context. Every Play→Back cycle leaks one.
 * Chrome caps a document at six: the seventh `new AudioContext()` throws
 * "The number of hardware contexts provided (6) is greater than or equal to the
 * maximum bound (6)".
 *
 * AND THE FAILURE IS SILENT, WHICH IS THE WORST PART. That throw lands in the
 * bare `catch {}` in `tryUnlock` ("Audio not available — app remains playable").
 * Nothing is logged, nothing crashes, no error boundary fires. A child who
 * bounces between the landing page and scenes six times simply finds that the
 * sound stopped, permanently, until they reload. That is the "audio just died"
 * class of bug, and it is invisible to every other test in this suite.
 *
 * WHERE THE FIX BELONGS, WHICH IS NOT WHERE IT FIRST LOOKED. The obvious repair
 * was to add `ctx.close()` inside `disposeEngine()`. That is wrong: `initEngine`
 * RECEIVES a context it does not own, and closing a borrowed handle is a defect
 * of its own — the engine cannot know whether its caller still wants it. The
 * constructor closes. `AudioProvider` is the only `new AudioContext()` in the
 * tree (the last test below keeps that true), so the close belongs in its
 * effect cleanup, next to the listener teardown that is already there.
 *
 * HOW THIS IS DRIVEN. `bundleComponent` swaps in a fake `react` that captures
 * `useEffect` bodies instead of scheduling them, so the test can run an effect,
 * run its cleanup, and run it again — mount, unmount, and StrictMode's
 * double-invoke, by hand. Everything asserted is a real side effect on a fake
 * `AudioContext` (was `close()` called; is a second context running), never
 * React state, which the stub cannot model.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleComponent } from '../framework/_tsload.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every `AudioContext` the component built during this process, in order. */
const created = [];

/** An AudioParam that accepts every scheduling call and remembers nothing. */
class FakeParam {
  constructor(value) {
    this.value = value;
  }
  setValueAtTime() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  setTargetAtTime() {
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

/** One node standing in for gains and the bus compressor alike. */
class FakeNode {
  constructor() {
    this.gain = new FakeParam(1);
    this.threshold = new FakeParam(0);
    this.knee = new FakeParam(0);
    this.ratio = new FakeParam(1);
    this.attack = new FakeParam(0);
    this.release = new FakeParam(0);
  }
  connect() {
    return this;
  }
  disconnect() {}
}

/**
 * A minimal AudioContext that records the two things this file is about:
 * how many were constructed, and whether each was closed.
 *
 * `state` starts 'suspended' and only becomes 'running' after `resume()`,
 * mirroring an autoplay-blocked browser — which is what makes the gesture path
 * in `tryUnlock` actually execute rather than short-circuit.
 */
class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = new FakeNode();
    this.closeCalls = 0;
    this.listeners = {};
    created.push(this);
  }
  createGain() {
    return new FakeNode();
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  async resume() {
    this.state = 'running';
  }
  async close() {
    this.closeCalls++;
    this.state = 'closed';
  }
}

/** Window listeners the provider arms, so the test can fire a gesture. */
const windowListeners = {};

globalThis.window = {
  addEventListener(type, fn) {
    (windowListeners[type] ??= []).push(fn);
  },
  removeEventListener(type, fn) {
    windowListeners[type] = (windowListeners[type] ?? []).filter((f) => f !== fn);
  },
};
globalThis.AudioContext = FakeAudioContext;

const { AudioProvider, EFFECTS, __resetEffects } = await bundleComponent(
  'audioProvider',
  ["export { AudioProvider } from './src/components/AudioProvider';", "export { EFFECTS, __resetEffects } from 'react';"].join('\n'),
);

/**
 * Calls the component, runs its effects, and hands back the handles a lifecycle
 * test needs.
 *
 * `rerunEffects` re-invokes the SAME effect bodies, closing over the SAME refs
 * the component created — which is precisely what `<StrictMode>` does in dev
 * after tearing the first pass down.
 *
 * @returns `{ unmount, rerunEffects }`.
 */
function mount() {
  __resetEffects();
  AudioProvider({ children: null });
  const effects = EFFECTS.map((e) => e.fn);
  let cleanups = effects.map((fn) => fn());
  return {
    unmount() {
      for (const c of cleanups) if (typeof c === 'function') c();
      cleanups = [];
    },
    rerunEffects() {
      cleanups = effects.map((fn) => fn());
    },
  };
}

/** Fires the gesture that unlocks audio, then lets the resume() promise settle. */
async function gesture() {
  for (const fn of [...(windowListeners.pointerdown ?? [])]) fn();
  await Promise.resolve();
  await Promise.resolve();
}

/** Contexts that exist and have not been closed — the leak, counted. */
function openContexts() {
  return created.filter((c) => c.state !== 'closed');
}

test('the harness drives the real provider: one gesture, one running context', async () => {
  const app = mount();
  assert.equal(created.length, 0, 'a context was built before any gesture — audio must wait for the user');
  assert.equal((windowListeners.pointerdown ?? []).length, 1, 'the unlock listener was not armed');

  await gesture();

  assert.equal(created.length, 1, 'one gesture should build exactly one AudioContext');
  assert.equal(created[0].state, 'running', 'the context was never resumed, so nothing would be audible');
  app.unmount();
});

test('unmounting AudioProvider closes the AudioContext it constructed', async () => {
  const before = created.length;
  const app = mount();
  await gesture();
  const ctx = created[before];

  app.unmount();

  assert.equal(ctx.closeCalls, 1, 'unmount did not close the context — it leaks until the tab is reloaded');
  assert.equal(ctx.state, 'closed', 'the context is still holding hardware after unmount');
});

test('back-and-forth between the landing page and a scene never accumulates contexts', async () => {
  // Six is not an arbitrary number: it is Chrome's per-document cap, the point
  // at which the next `new AudioContext()` throws into the provider's bare
  // catch and audio dies silently for the rest of the session.
  for (let cycle = 0; cycle < 8; cycle++) {
    const app = mount();
    await gesture();
    assert.equal(openContexts().length, 1, `cycle ${cycle}: more than one context was open at once`);
    app.unmount();
    assert.equal(openContexts().length, 0, `cycle ${cycle}: unmount left a context open — this is the leak`);
  }
});

test('a StrictMode double-invoke gets a fresh context, not the closed one', async () => {
  // React 19 in dev mounts, runs effects, tears them down, and runs them again
  // on the SAME component instance. If cleanup closes the context but leaves it
  // in the ref, the second pass reuses a closed handle and dev audio is dead
  // for good — a fix that trades a leak for a worse bug. So cleanup must null
  // the ref as well as close.
  const before = created.length;
  const app = mount();
  await gesture();
  app.unmount();

  app.rerunEffects();
  await gesture();

  assert.equal(created.length, before + 2, 'the second effect pass did not build a new context');
  assert.equal(created[before].state, 'closed', 'the first pass left its context open');
  assert.equal(created[before + 1].state, 'running', 'the second pass is stuck on a dead context — audio would never return');
  app.unmount();
});

test('AudioProvider is still the only place that constructs an AudioContext', () => {
  const srcDir = path.join(packageRoot, 'src');
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(name) ? [full] : [];
    });

  const constructors = walk(srcDir)
    .filter((file) => /new\s+(webkit)?AudioContext\s*\(/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(srcDir, file).replace(/\\/g, '/'));

  assert.deepEqual(
    constructors,
    ['components/AudioProvider.tsx'],
    'Something other than AudioProvider now builds an AudioContext. The tests above only cover AudioProvider, so a second constructor is an uncovered leak: give it a close() on the same teardown path and extend this suite.',
  );
});
