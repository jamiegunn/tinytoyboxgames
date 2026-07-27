/**
 * Which exported symbols does nothing reference — including their own file?
 *
 * WHY THIS SWEEP EXISTS. Three rounds of static analysis each found the same
 * shape by hand: a symbol that is exported, documented, fully type-checked, and
 * read by nothing — `PlayAnimationOptions.speed`, the SFX polyphony cap,
 * `swayAmplitude`/`swayFrequency`/`chainPopRadius`. `tsc` cannot report any of
 * them, because an export with no importers is not an error; ESLint cannot
 * either, for the same reason. To a model reading the file they look like
 * working, intentional code — which is exactly why they mislead.
 *
 * THE FIRST VERSION OF THIS SCRIPT WAS WRONG, AND ITS OUTPUT WAS WORSE THAN
 * NOTHING. It searched only OTHER files, so it reported 213 "unreferenced"
 * symbols — and the top entries were things like `buildBrainCoral` and
 * `SCENE_SPARKLE`, both of which are very much alive, called by a dispatcher or
 * a registry table sitting further down their OWN file. Its docstring even
 * claimed the search erred toward over-reporting usage. It errs the other way,
 * hard. A 213-line list that is mostly false is not a work list; it is a
 * generator of confident wrong deletions, which is the very failure this whole
 * exercise is supposed to be hunting.
 *
 * So the file's own body counts now, and the result splits into two tiers that
 * deserve completely different reactions:
 *
 *   DEAD          Nothing names it anywhere, its own file included. This is
 *                 the hunt. Read each one.
 *   EXPORT-ONLY   Live code, used inside its own file, but exported to nobody.
 *                 Not a defect — at most an over-broad public surface. Listed
 *                 separately and quietly, because deleting from this tier
 *                 breaks a working game.
 *
 * WHAT THIS IS AND IS NOT. It is a TEXT search. A symbol counts as referenced
 * if any source file names it outside a comment, which cannot see through
 * dynamic access (`registry[key]`, string-keyed lookups) — so the DEAD tier is
 * a list of CANDIDATES, and every entry still has to be read before anything is
 * deleted. Its value is that it is short enough to read.
 *
 * Comments are stripped first, and that matters: documenting a previous removal
 * names the removed symbol, so an un-stripped search scores "we deleted this
 * because nothing used it" as a use. That mistake already cost one mutation
 * escape in tests/minigames/balanceCurvesWired.test.mjs.
 *
 * Run from inside the package: `node .probe/static/r8-orphan-exports.mjs`
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('src');

function sources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const files = sources(SRC);
const bodies = new Map(files.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]));

function exportsOf(src) {
  const found = [];
  const patterns = [
    [/^export (?:async )?function (\w+)/gm, 'function'],
    [/^export const (\w+)/gm, 'const'],
    [/^export class (\w+)/gm, 'class'],
    [/^export interface (\w+)/gm, 'interface'],
    [/^export type (\w+)/gm, 'type'],
    [/^export enum (\w+)/gm, 'enum'],
  ];
  for (const [re, kind] of patterns) {
    for (const m of src.matchAll(re)) found.push({ name: m[1], kind });
  }
  return found;
}

/** How many times a name appears in a body, so the declaration can be discounted. */
function countIn(body, name) {
  return (body.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
}

const dead = [];
const exportOnly = [];

for (const [file, body] of bodies) {
  for (const { name, kind } of exportsOf(body)) {
    let external = 0;
    for (const [other, otherBody] of bodies) {
      if (other === file) continue;
      external += countIn(otherBody, name);
    }
    if (external > 0) continue;

    // Discount the declaration itself; anything left is real intra-file use.
    const internal = countIn(body, name) - 1;
    const row = { file: path.relative(SRC, file), name, kind, internal };
    if (internal > 0) exportOnly.push(row);
    else dead.push(row);
  }
}

const group = (rows) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.file)) m.set(r.file, []);
    m.get(r.file).push(r);
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
};

console.log(`Scanned ${files.length} files under src/.\n`);
console.log('================ DEAD: named nowhere, own file included ================\n');
if (dead.length === 0) {
  console.log('  (none)\n');
} else {
  for (const [file, items] of group(dead)) {
    console.log(`  ${file}  (${items.length})`);
    for (const it of items) console.log(`      ${it.kind.padEnd(9)} ${it.name}`);
  }
  console.log('');
}
console.log(`  ${dead.length} candidates. Read each — a text search cannot see dynamic access.\n`);

console.log('======= EXPORT-ONLY: live inside its file, imported by nobody =======\n');
console.log(`  ${exportOnly.length} symbols. NOT a defect list — this code runs. An over-broad`);
console.log('  public surface at most. Deleting from here breaks a working game.\n');
for (const [file, items] of group(exportOnly).slice(0, 8)) {
  console.log(`  ${file}  (${items.length})`);
}
if (group(exportOnly).length > 8) console.log(`  ... and ${group(exportOnly).length - 8} more files`);

console.log('\n================ WHAT TO LOOK FOR ================');
console.log('In the DEAD tier, the entries that matter most are the ones that DUPLICATE');
console.log('or CONTRADICT something the app does run: a tuning curve beside a live');
console.log('constant, an option a caller reads but nobody sets, a factory whose output');
console.log('was replaced. Those are the ones that read as working code.');
console.log('An entry that is merely unused — a helper nobody got around to calling —');
console.log('is cheaper to leave alone than to remove carelessly.');
console.log('==================================================');
