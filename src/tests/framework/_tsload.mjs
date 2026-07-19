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
 * Only use this for files whose imports are either none or real npm packages —
 * files importing the `@app/*` alias or sibling `.ts` would not resolve here.
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
