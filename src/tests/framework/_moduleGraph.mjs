/**
 * Shared module-graph machinery for the reachability guards.
 *
 * WHY IT IS SHARED
 * ----------------
 * `noUnreachableModules.test.mjs` and `noUnusedExports.test.mjs` ask two
 * different questions of the same graph, and they must ask them of the SAME
 * graph. Two hand-maintained copies of a resolver drift, and when they drift
 * the two tests disagree about what the app loads — at which point the pair is
 * worse than either alone, because whichever one is wrong is the one you will
 * believe.
 *
 * WHAT THIS PARSES, AND WITH WHAT
 * -------------------------------
 * Regexes, not a TypeScript parser. That is a real limitation and it is stated
 * rather than hidden: the repo has no `export default`, no namespace import of
 * a local module, and six `export * from` re-exports, all of which were counted
 * before this file was written and are asserted in the consuming tests. A
 * pattern outside that set will be silently mis-parsed, so every consumer is
 * expected to assert the shape of the codebase it depends on rather than trust
 * this module to notice.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SRC = path.join(ROOT, 'src');
export const EXTS = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];

const ALIASES = [
  ['@app/', 'src/'],
  ['@scenes/', 'src/scenes/'],
  ['@game/', 'src/minigames/'],
];

/**
 * Every source file under a directory, recursively.
 *
 * @param {string} dir Directory to walk.
 * @param {string[]} [out] Accumulator.
 * @returns {string[]} Absolute paths of every source file found.
 */
export function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'out') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.includes(path.extname(entry))) out.push(full);
  }
  return out;
}

/**
 * Strips block and line comments so a commented-out import is not counted.
 *
 * @param {string} src File contents.
 * @returns {string} The source with comments removed.
 */
export const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * Static import specifiers in a file, plus any computed `import()` found.
 *
 * @param {string} src File contents.
 * @returns {{literal: string[], computed: string[]}} Literal specifiers, and the
 *   text of every computed `import()` — which the caller must treat as a hole in
 *   the graph rather than as an absence of edges.
 */
export function specifiersOf(src) {
  const body = stripComments(src);
  const literal = [];
  const patterns = [
    /(?:^|\n)\s*import\s[^;'"]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s[^;'"]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of body.matchAll(re)) literal.push(m[1]);
  const computed = [...body.matchAll(/\bimport\s*\(\s*[^'")][^)]*\)/g)].map((m) => m[0].trim());
  return { literal, computed };
}

/**
 * Resolves a specifier to a real file, or null for anything outside the repo.
 *
 * @param {string} spec The import specifier as written.
 * @param {string} fromFile Absolute path of the importing file.
 * @returns {string|null} Absolute path of the target, or null if it is a package.
 */
export function resolve(spec, fromFile) {
  let rel = null;
  if (spec.startsWith('.')) {
    rel = path.resolve(path.dirname(fromFile), spec);
  } else {
    for (const [alias, target] of ALIASES) {
      if (spec.startsWith(alias)) {
        rel = path.join(ROOT, target, spec.slice(alias.length));
        break;
      }
    }
    if (rel === null) return null;
  }
  if (existsSync(rel) && statSync(rel).isFile()) return rel;
  for (const ext of EXTS) if (existsSync(rel + ext)) return rel + ext;
  for (const ext of EXTS) {
    const idx = path.join(rel, 'index' + ext);
    if (existsSync(idx)) return idx;
  }
  return null;
}

/**
 * Walks the import graph from a set of roots and returns every file reached.
 *
 * @param {string[]} roots Absolute paths to start from.
 * @param {Array<{file: string, expr: string}>} [computedSink] If given, every
 *   computed `import()` encountered is pushed here. A caller that passes
 *   nothing is choosing not to know, which is only safe for roots whose
 *   verdicts nobody reads.
 * @returns {Set<string>} Absolute paths of every file reachable from the roots.
 */
export function reachFrom(roots, computedSink) {
  const seen = new Set();
  const queue = roots.filter((r) => existsSync(r));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const { literal, computed } = specifiersOf(readFileSync(file, 'utf8'));
    if (computedSink) for (const c of computed) computedSink.push({ file: path.relative(ROOT, file), expr: c });
    for (const spec of literal) {
      const target = resolve(spec, file);
      if (target) queue.push(target);
    }
  }
  return seen;
}

/**
 * The names a file takes from each module it imports from.
 *
 * `import x, * as ns` forms are NOT handled and the repo has none; consumers
 * assert that. A bare `import 'x'` contributes an edge with no names, which is
 * correct — a side-effect import uses no export.
 *
 * @param {string} src File contents.
 * @returns {{named: Array<{spec: string, name: string}>, wildcard: string[]}}
 *   Every (module, symbol) pair the file names, and the specifiers it re-exports
 *   wholesale with `export * from`.
 */
export function namedImportsOf(src) {
  const body = stripComments(src);
  const named = [];
  const wildcard = [];

  // `export * from 'x'` — takes everything, names nothing. Recorded separately
  // because it makes every export of the target look used, which is a hole a
  // consumer must decide what to do about rather than absorb silently.
  for (const m of body.matchAll(/(?:^|\n)\s*export\s*\*\s*(?:as\s+\w+\s*)?from\s*['"]([^'"]+)['"]/g)) {
    wildcard.push(m[1]);
  }

  // `import { a, b as c }` / `import type { T }` / `export { a } from 'x'`.
  const braced = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  for (const m of body.matchAll(braced)) {
    const spec = m[2];
    for (const piece of m[1].split(',')) {
      // `b as c` binds c locally but USES b — the left-hand name is the export.
      const name = piece
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim();
      if (name) named.push({ spec, name });
    }
  }
  return { named, wildcard };
}

/**
 * Specifiers whose ENTIRE export surface must be assumed used.
 *
 * Three forms give a consumer every name at once without writing any of them
 * down: `export * from 'x'`, `import * as ns from 'x'`, and a literal
 * `import('x')`, whose promise resolves to a namespace object. An unused-export
 * check that only reads brace lists sees none of these and concludes the target
 * has no consumers.
 *
 * The dynamic form is not hypothetical here and the cost of missing it is not
 * cosmetic: every lazily-loaded scene in sceneCatalog.ts is reached exactly
 * that way, so the first run of the export guard reported `createScene` dead
 * for the kitchen, the living room and the playroom — three scenes the game
 * ships and a child can walk into. Acting on that verdict would have deleted
 * them, and the build would have stayed green, because the only reference is a
 * string.
 *
 * @param {string} src File contents.
 * @returns {string[]} Specifiers whose whole surface is opaquely consumed.
 */
export function opaqueTargetsOf(src) {
  const body = stripComments(src);
  const out = [];
  const patterns = [
    /(?:^|\n)\s*export\s*\*\s*(?:as\s+\w+\s*)?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s+\*\s+as\s+\w+\s+from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of body.matchAll(re)) out.push(m[1]);
  return out;
}

/**
 * The names a module re-exports from somewhere else rather than defining.
 *
 * `export { a } from './b'` is a different fact from `export function a`, and
 * they need different fixes: the first is a barrel line to delete, the second
 * is a body of code to delete. Reporting them in one bucket invites the reader
 * to do the second when the first was meant.
 *
 * @param {string} src File contents.
 * @returns {Set<string>} Names this module re-exports from another module.
 */
export function reexportedNames(src) {
  const body = stripComments(src);
  const out = new Set();
  for (const m of body.matchAll(/(?:^|\n)\s*export\s*\{([^}]*)\}\s*from\s*['"]/g)) {
    for (const piece of m[1].split(',')) {
      const parts = piece
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/);
      const name = (parts[1] ?? parts[0] ?? '').trim();
      if (name) out.add(name);
    }
  }
  return out;
}

/**
 * The symbols a module exports.
 *
 * Covers `export function|const|let|class|interface|type|enum NAME`, the local
 * list form `export { a, b }`, and the re-export form `export { a } from 'y'`
 * (a re-export IS an export of this module — that is what makes a barrel a
 * barrel). Deliberately does NOT cover `export default`; the repo has none and
 * the consumers assert it.
 *
 * @param {string} src File contents.
 * @returns {string[]} Exported symbol names, deduplicated.
 */
export function exportsOf(src) {
  const body = stripComments(src);
  const names = new Set();

  for (const m of body.matchAll(/(?:^|\n)\s*export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }

  // Both `export { a, b };` and `export { a } from 'y';` — the trailing
  // `from` clause changes where the value comes from, not whether this module
  // offers the name.
  for (const m of body.matchAll(/(?:^|\n)\s*export\s*\{([^}]*)\}/g)) {
    for (const piece of m[1].split(',')) {
      // `a as b` EXPORTS b — the right-hand name is the public one, which is
      // the mirror image of the import case above and easy to get backwards.
      const parts = piece
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/);
      const name = (parts[1] ?? parts[0] ?? '').trim();
      if (name) names.add(name);
    }
  }

  return [...names];
}
