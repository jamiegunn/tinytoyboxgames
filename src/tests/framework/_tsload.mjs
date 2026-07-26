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
 * graph, resolving `@app/*` to `src/*` exactly as `vite.config.ts` does.
 *
 * `three` is left external so the bundle and the test share one module
 * instance — otherwise `instanceof Vector3` checks across the boundary fail.
 * Use this for framework modules that are pure logic but import siblings or
 * the alias (e.g. CelebrationSystem, which reaches the particle presets).
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
    external: ['three'],
    alias: { '@app': path.join(packageRoot, 'src') },
    logLevel: 'silent',
  });
  return import(pathToFileURL(outPath).href);
}
