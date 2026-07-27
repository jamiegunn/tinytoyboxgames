/**
 * Which modules under src/ does the shipping app never load?
 *
 * WHY A SECOND SWEEP, WHEN r8-orphan-exports.mjs ALREADY LISTS DEAD SYMBOLS.
 * That one is a text search over names, and a text search has a failure mode it
 * cannot detect: file A imports a symbol from file B, so the name is "used" —
 * but nothing imports file A either. The reference is real and the code is
 * still unreachable. Two of this repo's dead clusters hide behind exactly that.
 * `fish/meshes.ts` imports `FishSpeciesId` from `fish/species.ts`, and
 * `waves/templates.ts` imports it too, so `species.ts` looks referenced from
 * two directions while all three files are orphans together.
 *
 * Reachability does not have that hole. It starts at the real entry point the
 * browser loads (index.html -> src/main.tsx), follows every static import edge,
 * and reports the modules never arrived at. A whole unreachable FILE is far
 * stronger evidence than an unreferenced symbol: there is no dispatcher, no
 * registry table and no dynamic-access story that saves a module nothing
 * imports.
 *
 * WHAT IT CANNOT SEE, STATED PLAINLY SO THE OUTPUT IS NOT OVERTRUSTED:
 *   - `import()` with a computed specifier. Literal dynamic imports ARE
 *     followed; a template-string one is not, and is reported separately so it
 *     can be judged by hand rather than silently widening the graph.
 *   - Anything loaded by a path that is not an import at all (a worker URL, a
 *     string fed to a bundler plugin). None exist here today; if one appears,
 *     this sweep will call its target unreachable and be wrong.
 *
 * Test-only and probe-only modules are NOT unreachable-by-mistake — they are
 * reached by `tests/` and `.probe/`, which the browser never loads. Those roots
 * are walked too and their reach is subtracted, so the final list is modules
 * that NOTHING loads: not the app, not a test, not a probe.
 *
 * Run from inside the package: `node .probe/static/r8-reachability.mjs`
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const SRC = path.join(ROOT, 'src');

const ALIASES = [
  ['@app/', 'src/'],
  ['@scenes/', 'src/scenes/'],
  ['@game/', 'src/minigames/'],
];

const EXTS = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];

/** All source files under a directory, recursively. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'out') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.includes(path.extname(entry))) out.push(full);
  }
  return out;
}

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * Every static import/export-from specifier in a file, plus literal `import()`.
 * Computed dynamic imports are returned separately rather than dropped, because
 * a silently-ignored edge is how a reachability sweep lies.
 */
function specifiersOf(src) {
  const body = stripComments(src);
  const literal = [];
  const patterns = [
    /(?:^|\n)\s*import\s[^;'"]*?from\s*['"]([^'"]+)['"]/g, // import x from 'y'
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g, // side-effect import 'y'
    /(?:^|\n)\s*export\s[^;'"]*?from\s*['"]([^'"]+)['"]/g, // export ... from 'y'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // import('y')
  ];
  for (const re of patterns) {
    for (const m of body.matchAll(re)) literal.push(m[1]);
  }
  const computed = [...body.matchAll(/\bimport\s*\(\s*[^'")][^)]*\)/g)].map((m) => m[0].trim());
  return { literal, computed };
}

/** Resolves a specifier to a real file, or null for anything outside the repo. */
function resolve(spec, fromFile) {
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
    if (rel === null) return null; // bare specifier: a node_modules package
  }
  if (existsSync(rel) && statSync(rel).isFile()) return rel;
  for (const ext of EXTS) if (existsSync(rel + ext)) return rel + ext;
  for (const ext of EXTS) {
    const idx = path.join(rel, 'index' + ext);
    if (existsSync(idx)) return idx;
  }
  return null;
}

const unresolved = [];
const computedImports = [];

/** Walks the import graph from a set of roots and returns everything reached. */
function reachFrom(roots, recordProblems) {
  const seen = new Set();
  const queue = roots.filter((r) => existsSync(r));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const { literal, computed } = specifiersOf(readFileSync(file, 'utf8'));
    if (recordProblems) {
      for (const c of computed) computedImports.push({ file: path.relative(ROOT, file), expr: c });
    }
    for (const spec of literal) {
      const target = resolve(spec, file);
      if (target) queue.push(target);
      else if (recordProblems && (spec.startsWith('.') || ALIASES.some(([a]) => spec.startsWith(a)))) {
        unresolved.push({ file: path.relative(ROOT, file), spec });
      }
    }
  }
  return seen;
}

const APP_ENTRY = [path.join(SRC, 'main.tsx'), path.join(SRC, 'main.ts')];
const appReach = reachFrom(APP_ENTRY, true);
const testReach = reachFrom(walk(path.join(ROOT, 'tests')), false);
const probeReach = reachFrom(walk(path.join(ROOT, '.probe')), false);

const all = walk(SRC);
const orphans = all.filter((f) => !appReach.has(f) && !testReach.has(f) && !probeReach.has(f));
const testOnly = all.filter((f) => !appReach.has(f) && (testReach.has(f) || probeReach.has(f)));

console.log(`Entry: ${APP_ENTRY.filter(existsSync).map((f) => path.relative(ROOT, f))}`);
console.log(`${all.length} modules under src/. App loads ${[...appReach].filter((f) => f.startsWith(SRC)).length}.\n`);

if (unresolved.length) {
  console.log('!! UNRESOLVED IMPORTS — the graph below is incomplete until these are explained:');
  for (const u of unresolved) console.log(`   ${u.file}  ->  ${u.spec}`);
  console.log('');
}
if (computedImports.length) {
  console.log('!! COMPUTED import() — these edges were NOT followed. Judge by hand:');
  for (const c of computedImports) console.log(`   ${c.file}  ${c.expr}`);
  console.log('');
}

console.log('======== UNREACHABLE: no app, test or probe path leads here ========\n');
if (orphans.length === 0) console.log('  (none)\n');
const byDir = new Map();
for (const f of orphans) {
  const d = path.dirname(path.relative(SRC, f));
  if (!byDir.has(d)) byDir.set(d, []);
  byDir.get(d).push(path.basename(f));
}
let deadLines = 0;
for (const [dir, names] of [...byDir.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const lines = names.reduce((n, b) => n + readFileSync(path.join(SRC, dir, b), 'utf8').split('\n').length, 0);
  deadLines += lines;
  console.log(`  ${dir}/  (${names.length} files, ${lines} lines)`);
  for (const b of names.sort()) {
    const l = readFileSync(path.join(SRC, dir, b), 'utf8').split('\n').length;
    console.log(`      ${b.padEnd(28)} ${String(l).padStart(5)} lines`);
  }
}
console.log(`\n  ${orphans.length} unreachable modules, ${deadLines} lines the browser never loads.\n`);

console.log('===== REACHED ONLY BY tests/ OR .probe/ (not a defect, but not shipped) =====\n');
if (testOnly.length === 0) console.log('  (none)');
for (const f of testOnly) console.log(`  ${path.relative(SRC, f)}`);

console.log('\n================ HOW TO READ THIS ================');
console.log('An unreachable module is stronger evidence than an unreferenced symbol:');
console.log('no dispatcher, registry or dynamic-access story rescues a file nothing');
console.log('imports. The ones that matter most are the modules that DESCRIBE a');
console.log('feature the game appears to have — a named difficulty arc, a species');
console.log('table, a formation system — because a reader who finds them concludes');
console.log('the game does something it does not.');
console.log('==================================================');
