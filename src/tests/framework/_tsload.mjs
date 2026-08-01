/**
 * Minimal TypeScript loader for framework contract tests.
 *
 * The framework/standardization primitives are pure logic (no DOM, no WebGL),
 * so they can be unit-tested behaviourally rather than by parsing source. Plain
 * `node --test` cannot import `.ts`, so this transforms a single util file with
 * esbuild (no bundling) and dynamic-imports the result. The transformed file is
 * written under `.tstest-tmp/` *inside the package* so its own imports (e.g.
 * `three` in disposal.ts) resolve against the project's node_modules.
 *
 * Only use `loadTs` for files whose imports are either none or real npm
 * packages. For a module that imports the `@app/*` alias or sibling `.ts`
 * files, use `bundleTs`, which resolves the alias exactly as vite.config.ts
 * does and inlines the dependency graph.
 */

import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmpDir = path.join(packageRoot, '.tstest-tmp');

/**
 * Transforms and imports a TypeScript util by its package-relative path.
 *
 * @param relPath - Path relative to the package root, e.g. `src/utils/math.ts`.
 * @returns The loaded module namespace.
 */
export async function loadTs(relPath) {
  mkdirSync(tmpDir, { recursive: true });
  const abs = path.join(packageRoot, relPath);
  // `sourcemap: 'inline'` + `sourcefile` are what make coverage measurable at all:
  // without them V8 attributes every executed line to the temp file under
  // .tstest-tmp/ and no .ts source ever appears in the report. Measure with
  //   node --enable-source-maps --test --experimental-test-coverage ...
  // The flag is not optional — without it the maps are emitted and ignored.
  const code = esbuild.transformSync(readFileSync(abs, 'utf8'), { loader: 'ts', format: 'esm', target: 'es2022', sourcemap: 'inline', sourcefile: abs }).code;
  const outName = relPath.replace(/[\\/]/g, '_').replace(/\.ts$/, '.mjs');
  const outPath = path.join(tmpDir, outName);
  writeFileSync(outPath, code);
  return import(pathToFileURL(outPath).href);
}

/**
 * Bundles and imports a TypeScript module along with its local dependency
 * graph, resolving `@app/*`, `@scenes/*` and `@game/*` exactly as
 * `vite.config.ts` does.
 *
 * `three` and `gsap` are left external so the bundle and the test share one
 * module instance. For `three` that is what makes `instanceof Vector3` work
 * across the boundary. For `gsap` there are two reasons, both learned the hard
 * way: a test could not see the module's tweens via `gsap.getTweensOf()` when it
 * held a second copy, and — more sharply — gsap's ticker keeps a live timer
 * while any `repeat: -1` tween exists, so a suite that starts an idle animation
 * never lets its own process exit. With one shared instance a test can end with
 * `gsap.ticker.sleep()` and terminate. Killing the tweens is not sufficient; the
 * ticker keeps one timer regardless.
 *
 * Use this for framework modules that are pure logic but import siblings or
 * the alias (e.g. CelebrationSystem, which reaches the particle presets).
 *
 * SHADERS ARE STUBBED TO AN EMPTY STRING, NOT EXTERNALISED. Anything reaching
 * `sceneCatalog.ts` pulls in every scene, and several scenes import
 * `.glsl?raw`. Marking those external does not work: the import is a static
 * top-level one, so esbuild hoists it into the bundle and node then fails to
 * resolve a `.glsl` file at load time. A module whose shader source is `''`
 * still loads, which is all a logic test needs — so do not use this loader to
 * assert anything about shader text.
 *
 * @param relPath - Path relative to the package root, e.g.
 *   `src/minigames/framework/CelebrationSystem.ts`.
 * @returns The loaded module namespace.
 */
export async function bundleTs(relPath) {
  const outName = relPath.replace(/[\\/]/g, '_').replace(/\.ts$/, '.bundle.mjs');
  return runBundle({ entryPoints: [path.join(packageRoot, relPath)] }, outName);
}

/**
 * Bundles a synthetic entry module — a snippet of TypeScript that exists only
 * for the test — together with everything it imports, into ONE bundle.
 *
 * WHY THIS EXISTS, WHICH IS NOT OBVIOUS. `bundleTs` produces a self-contained
 * module graph per call, so two `bundleTs` calls that both reach
 * `src/utils/idle/registry.ts` end up with two copies of its module-private
 * `WeakMap`. A test that bundles a scene rig one way and the registry another
 * can call `setSceneIdleAnimator` all it likes: the rig's `getIdleAnimator`
 * consults a different map, finds nothing, and silently falls back to the no-op
 * animator. Every assertion still passes, because the no-op returns a well-formed
 * handle for every preset — the test proves nothing while looking green.
 *
 * Passing one entry that re-exports both sides fixes that: internal singletons
 * are shared because there is only one instance of each module.
 *
 * The entry is compiled from a string via esbuild's `stdin`, with `resolveDir`
 * set to the package root, so its import specifiers are written exactly as a
 * source file in the package root would write them (`./src/...`, or the
 * `@app`/`@scenes`/`@game` aliases).
 *
 * @param name - Short slug used for the emitted temp filename; must be unique
 *   per distinct source within a suite.
 * @param source - TypeScript source of the entry module, typically a handful of
 *   `export { … } from '…';` lines.
 * @returns The loaded module namespace.
 */
export async function bundleEntry(name, source) {
  return runBundle({ stdin: { contents: source, resolveDir: packageRoot, sourcefile: `${name}.ts`, loader: 'ts' } }, `entry_${name}.bundle.mjs`);
}

/**
 * Source of the fake `react` that `bundleComponent` substitutes for the real
 * one. It is deliberately not a renderer: it implements the hooks the component
 * under test uses and nothing else.
 *
 * WHY A STUB AND NOT REACT ITSELF. React's hooks dispatch through an internal
 * renderer, so importing the real package and calling a component function
 * throws "invalid hook call" — you need `react-dom` or `react-test-renderer` to
 * supply a dispatcher, and this package ships neither. The stub gives the one
 * thing a lifecycle test actually needs: `useEffect` bodies captured as values,
 * so the test can run an effect, run its cleanup, and run it again — which is
 * exactly what mount, unmount, and a StrictMode double-invoke do.
 *
 * `useState` returns the initial value and a no-op setter, so anything asserted
 * must be observable OUTSIDE React state (a closed AudioContext, a removed
 * listener). That is a feature: it keeps these tests pointed at real side
 * effects rather than at re-render bookkeeping the stub cannot model.
 */
const REACT_STUB = `
export const EFFECTS = [];
export function __resetEffects() { EFFECTS.length = 0; }
export function createContext(v) { const C = { _v: v }; C.Provider = (p) => ({ __provider: true, value: p.value }); return C; }
export function useContext(C) { return C._v; }
export function useRef(init) { return { current: init }; }
export function useState(init) { return [typeof init === 'function' ? init() : init, () => {}]; }
export function useCallback(fn) { return fn; }
export function useMemo(fn) { return fn(); }
export function useEffect(fn, deps) { EFFECTS.push({ fn, deps }); }
export default { createContext, useContext, useRef, useState, useCallback, useMemo, useEffect };
`;

/** esbuild plugin swapping the real `react` for `REACT_STUB`. */
const stubReactPlugin = {
  name: 'stub-react',
  setup(build) {
    build.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, () => ({ path: 'react', namespace: 'react-stub' }));
    build.onLoad({ filter: /.*/, namespace: 'react-stub' }, () => ({ contents: REACT_STUB, loader: 'js' }));
  },
};

/**
 * Bundles a `.tsx` component together with a fake `react`, so a test can drive
 * its effect lifecycle by hand.
 *
 * The entry is a synthetic module (as in `bundleEntry`) and must re-export both
 * the component and the stub's `EFFECTS` / `__resetEffects`, e.g.
 *
 *   export { AudioProvider } from './src/components/AudioProvider';
 *   export { EFFECTS, __resetEffects } from 'react';
 *
 * Re-exporting through the entry is not a style choice: an esbuild `footer` is
 * appended AFTER bundling, so a `from 'react'` re-export written there would
 * resolve to the real package at import time and fail to find the stub's names.
 *
 * JSX compiles to a plain object factory injected by the banner — the returned
 * element is inspectable data, never rendered. `import.meta.env.DEV` is defined
 * to `false` because `platform: 'neutral'` leaves `import.meta.env` undefined at
 * runtime, which would throw inside any dev-only warning branch.
 *
 * @param name - Short slug for the emitted temp filename; unique per suite.
 * @param source - TypeScript source of the synthetic entry module.
 * @returns The loaded module namespace.
 */
export async function bundleComponent(name, source) {
  return runBundle(
    {
      stdin: { contents: source, resolveDir: packageRoot, sourcefile: `${name}.ts`, loader: 'ts' },
      jsx: 'transform',
      jsxFactory: '__jsx',
      jsxFragment: '__frag',
      banner: { js: 'const __jsx = (type, props, ...children) => ({ type, props, children }); const __frag = "fragment";' },
      define: { 'import.meta.env.DEV': 'false' },
      plugins: [stubReactPlugin],
    },
    `component_${name}.bundle.mjs`,
  );
}

// Shared esbuild invocation for `bundleTs`, `bundleEntry` and `bundleComponent`.
// The alias table mirrors vite.config.ts; `three` and `gsap` stay external so
// the bundle and the test share one instance of each (see bundleTs's docblock
// for why that matters). Caller-supplied plugins run after the shader stub.
async function runBundle({ plugins: extraPlugins = [], ...inputOptions }, outName) {
  mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, outName);
  await esbuild.build({
    ...inputOptions,
    outfile: outPath,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    // See loadTs above: without these, coverage names the bundle, not the source.
    sourcemap: 'inline',
    sourcesContent: true,
    platform: 'neutral',
    external: ['three', 'gsap'],
    alias: {
      '@app': path.join(packageRoot, 'src'),
      '@scenes': path.join(packageRoot, 'src/scenes'),
      '@game': path.join(packageRoot, 'src/minigames'),
    },
    plugins: [
      {
        name: 'stub-shaders',
        setup(build) {
          build.onResolve({ filter: /\.glsl(\?raw)?$/ }, (a) => ({ path: a.path, namespace: 'glsl-stub' }));
          build.onLoad({ filter: /.*/, namespace: 'glsl-stub' }, () => ({ contents: 'export default ""', loader: 'js' }));
        },
      },
      ...extraPlugins,
    ],
    logLevel: 'silent',
  });
  return import(pathToFileURL(outPath).href);
}
