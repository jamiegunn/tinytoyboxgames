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
  const code = esbuild.transformSync(readFileSync(abs, 'utf8'), { loader: 'ts', format: 'esm', target: 'es2022' }).code;
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
  mkdirSync(tmpDir, { recursive: true });
  const outName = relPath.replace(/[\\/]/g, '_').replace(/\.ts$/, '.bundle.mjs');
  const outPath = path.join(tmpDir, outName);
  await esbuild.build({
    entryPoints: [path.join(packageRoot, relPath)],
    outfile: outPath,
    bundle: true,
    format: 'esm',
    target: 'es2022',
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
    ],
    logLevel: 'silent',
  });
  return import(pathToFileURL(outPath).href);
}
