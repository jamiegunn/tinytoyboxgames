// A constant that `src/` exports must be IMPORTED by the corpus, never restated.
//
// THE DEFECT THIS GUARDS
// ----------------------
// Round 11 measured how the test and probe corpus obtains one shipped constant,
// `PROXIMITY_PX` (`src/utils/interaction/gestureRules.ts`, 70 — the radius the
// tap controller treats as "near enough"). It was obtained FOUR different ways
// across SEVENTEEN sites:
//
//   MODULE          a real import through bundleEntry                2 sites
//   REGEX-BESPOKE   a 6-line `shippedProximityPx()` resolver,
//                   duplicated verbatim                              7 sites
//   REGEX-GENERIC   a local `shipped(file, name)` reader             1 site
//   REGEX-INLINE    an IIFE doing the same thing                     1 site
//   LITERAL         `const PROXIMITY_PX = 70;`                       6 sites
//
// Nothing had drifted. That is the uncomfortable part, and it is why this guard
// fails on EXISTENCE rather than on disagreement: seventeen copies agreeing is
// not seventeen copies being correct, it is seventeen copies that have not been
// asked a hard question yet. The first change to PROXIMITY_PX would have made
// fifteen of them silently wrong, and the six literals would not even have had
// the decency to throw.
//
// The finding was not "the repository lacks a way to do this properly". The
// right instrument — `bundleEntry` in ./_tsload.mjs — already existed, already
// worked, and had two adopters out of seventeen candidates. A migration that
// stops partway leaves the codebase worse than either end state, because now
// there are two conventions and the wrong one has the majority. This test is the
// inversion: with every site migrated, the guard makes the old way unavailable.
//
// WHY THIS IS AN AST WALK AND NOT A REGEX
// ---------------------------------------
// Because the regex version of this scan was wrong three times in one round, in
// three different ways, and it was MY regex, written for this round, to measure
// this exact population:
//
//   1. It matched `PROXIMITY_PX = (\d+)` inside the resolvers' own REGEX
//      LITERALS, inventing 8 copies that were the search for copies.
//   2. It matched `VISIBLE_BAND_HEIGHT = 7.08` inside a TEMPLATE LITERAL — the
//      error message in noUnusedExports.test.mjs that warns against this very
//      practice.
//   3. It matched `GOLDEN_DODGE_DURATION = 0.3` inside a DOCBLOCK in
//      little-shark-dodge.test.mjs, which quotes the declaration it is about;
//      that file imports the constant properly on line 42.
//
// Three false positives, each from source text that was discussing constants
// rather than binding them. A guard with a 100% false-positive rate on its first
// run gets an allowlist within a week, and an allowlist is where a real one
// hides. `ts.createSourceFile` cannot make any of those three mistakes, because
// a comment is not a node and a string is not an initializer.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.tstest-tmp') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const parse = (file) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

/** `3`, `-3`, and `0.3` are all numeric literals; `3 * FOO` is not. */
const numericValue = (node) => {
  if (!node) return undefined;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    if (node.operator === ts.SyntaxKind.MinusToken) return -Number(node.operand.text);
    if (node.operator === ts.SyntaxKind.PlusToken) return Number(node.operand.text);
  }
  return undefined;
};

const isShoutCase = (name) => /^[A-Z][A-Z0-9_]*$/.test(name);

/**
 * Every SHOUT_CASE numeric-literal export under src/, grouped by name.
 *
 * Returns `{ shipped, ambiguous }`. A name lands in `ambiguous` when two or more
 * modules export it with DIFFERENT values, because then there is no such thing as
 * "the value src/ exports for this name" and the guard has nothing to compare a
 * corpus copy against. See NAMES THAT ARE NOT CONSTANTS in the footer: this is not
 * a rare edge, it is 28 names, and collapsing them was a real defect in the first
 * version of this file.
 */
const shippedConstants = () => {
  const byName = new Map();
  for (const file of walk(path.join(PACKAGE_ROOT, 'src'))) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = parse(file);
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const value = numericValue(declaration.initializer);
        if (value === undefined || !isShoutCase(declaration.name.text)) continue;
        const name = declaration.name.text;
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push({ value, file: path.relative(PACKAGE_ROOT, file) });
      }
    }
  }

  const shipped = new Map();
  const ambiguous = new Map();
  for (const [name, declarations] of byName) {
    const distinct = new Set(declarations.map((d) => d.value));
    if (distinct.size === 1) shipped.set(name, declarations[0]);
    else ambiguous.set(name, declarations);
  }
  return { shipped, ambiguous, declarations: [...byName.values()].flat().length };
};

/** Every `const NAME = <number>` in the corpus, wherever it is nested. */
const corpusLiteralBindings = () => {
  const bindings = [];
  const roots = [path.join(PACKAGE_ROOT, 'tests'), path.join(PACKAGE_ROOT, '.probe')];
  for (const file of roots.flatMap((r) => walk(r))) {
    if (!/\.(mjs|js|tsx?)$/.test(file)) continue;
    const source = parse(file);
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const value = numericValue(node.initializer);
        if (value !== undefined && isShoutCase(node.name.text)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          bindings.push({ name: node.name.text, value, file: path.relative(PACKAGE_ROOT, file), line: line + 1 });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return bindings;
};

test('no test or probe restates a constant that src/ exports', () => {
  const { shipped } = shippedConstants();
  const offenders = corpusLiteralBindings()
    .filter((b) => shipped.has(b.name))
    .map((b) => {
      const src = shipped.get(b.name);
      const agrees = src.value === b.value ? 'agrees today' : `ALREADY DRIFTED, src says ${src.value}`;
      return `  ${b.file}:${b.line}  const ${b.name} = ${b.value};  (${src.file} — ${agrees})`;
    });

  assert.deepEqual(
    offenders,
    [],
    `A constant that src/ exports is restated as a literal in the corpus:\n\n${offenders.join('\n')}\n\n` +
      `Import it instead. From a test or probe that needs the bundler's aliases:\n\n` +
      `  const M = await bundleEntry('some_unique_name', \`export { NAME } from '@app/path/to/module';\`);\n` +
      `  const { NAME } = M;\n\n` +
      `"But it agrees" is not a defence — round 11 found seventeen copies of one constant, all agreeing, ` +
      `and that is precisely the state in which the next edit breaks fifteen of them silently.`,
  );
});

test('the guard can see a copy at all — it is not green because it looks at nothing', () => {
  // Round 9's lesson, and the reason this file has a second test: a green
  // assertion over an empty set is indistinguishable from a green assertion over
  // a set that was never populated. The first test above passes if `walk` throws
  // its way to nothing, if the AST walk never descends, or if `shipped` is empty.
  // So: synthesise the exact defect and require the machinery to catch it.
  const { shipped, ambiguous, declarations } = shippedConstants();
  assert.ok(shipped.size > 100, `expected src/ to export many numeric constants, found ${shipped.size}`);
  assert.ok(shipped.has('PROXIMITY_PX'), 'PROXIMITY_PX is the constant this round was about; it must still be findable');

  // Two counts, two predicates, pinned together because Round 11 wrote one of
  // them into the review under the other's sentence: `declarations` counts export
  // SITES (530), `shipped.size + ambiguous.size` counts distinct NAMES (488). The
  // gap is real and is the subject of the next test, so require it to be nonzero
  // — if these ever come out equal, the collision handling below is dead code and
  // the reader deserves to be told rather than reassured.
  assert.ok(
    declarations > shipped.size + ambiguous.size,
    `expected some names to be exported by more than one module; got ${declarations} sites for ${shipped.size + ambiguous.size} names`,
  );

  const source = ts.createSourceFile(
    'synthetic.mjs',
    ['const PROXIMITY_PX = 70;', 'function f() { const PROXIMITY_PX = 999; }', 'const NOT_SHIPPED_ANYWHERE = 12;'].join('\n'),
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const seen = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const value = numericValue(node.initializer);
      if (value !== undefined && isShoutCase(node.name.text)) seen.push([node.name.text, value]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.deepEqual(
    seen,
    [
      ['PROXIMITY_PX', 70],
      ['PROXIMITY_PX', 999],
      ['NOT_SHIPPED_ANYWHERE', 12],
    ],
    'the walk must find copies at top level AND nested inside functions',
  );
  assert.equal(seen.filter(([name]) => shipped.has(name)).length, 2, 'and the shipped-name filter must select exactly the two copies');
});

test('the guard is not fooled by source that merely discusses a constant', () => {
  // The three false positives that killed the regex version of this scan, as a
  // fixture. Each is a real shape from this repository: a regex literal inside a
  // resolver, a template-literal error message, and a docblock quoting the
  // declaration it documents. All three must be invisible.
  const source = ts.createSourceFile(
    'discussion.mjs',
    [
      'const m = /export const PROXIMITY_PX = (\\d+)/.exec(src);',
      'const msg = `const VISIBLE_BAND_HEIGHT = 7.08; // do not do this`;',
      '/** Documented as:  const GOLDEN_DODGE_DURATION = 0.3;  which is fine. */',
      '// const PROXIMITY_PX = 70;',
      'const REAL_ONE = 5;',
    ].join('\n'),
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const seen = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const value = numericValue(node.initializer);
      if (value !== undefined && isShoutCase(node.name.text)) seen.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.deepEqual(seen, ['REAL_ONE'], 'comments, strings and regex literals are not bindings');
});

test('a name exported with two different values is not treated as a constant', () => {
  // THE DEFECT THIS TEST EXISTS FOR, found after the guard was already written and
  // green: `shippedConstants` used to be a plain `found.set(name, ...)` Map, so
  // when two modules export the same name with different values, the LAST ONE THE
  // DIRECTORY WALK REACHED silently won. 28 names in this repository are in that
  // state — `CEILING_Y` is 6.2 in the kitchen and living room and 6.75 in the
  // playroom; `BODY_HEIGHT` is 0.15 on a butterfly and 0.18 on a parrot.
  //
  // Under the old Map, a probe binding `const CEILING_Y = 6.2` would have been
  // reported as "ALREADY DRIFTED, src says 6.75", citing the playroom — an
  // accusation that is false, about a file the author never touched, produced by
  // filesystem ordering. Nothing was failing, because no corpus file happens to
  // bind one of the 28 today. That is luck, not correctness, and luck is what this
  // test converts into a check.
  //
  // These names are not constants; they are a per-module naming convention that
  // sibling modules share. The guard must decline to have an opinion about them.
  const { shipped, ambiguous } = shippedConstants();

  assert.ok(ambiguous.size > 0, 'the collision path must be exercised by the real tree, or it is untested code');
  for (const [name, declarations] of ambiguous) {
    assert.ok(new Set(declarations.map((d) => d.value)).size > 1, `${name} is in ambiguous but its values agree`);
    assert.ok(!shipped.has(name), `${name} must not also be offered as an unambiguous constant`);
  }
  // The one this round is about must NOT be ambiguous — exactly one module exports
  // it — or every claim made above about it is about the wrong thing.
  assert.ok(!ambiguous.has('PROXIMITY_PX'), 'PROXIMITY_PX must be exported by exactly one module');
  assert.equal(shipped.get('PROXIMITY_PX').value, 70);
});

// ---------------------------------------------------------------------------
// WHAT THIS GUARD DOES NOT CHECK
// ---------------------------------------------------------------------------
// Stated here rather than left implicit, because round 11's own census reported
// a count without saying what it could not count, and the count was wrong.
//
// 1. RENAMED COPIES. `const READABLE_PX = 70;` binds PROXIMITY_PX's value under
//    a different name and is invisible to every check above. This is not
//    hypothetical: `.probe/render/frame-census.mjs` did exactly that, and it
//    escaped every name-matching scan in this round. It surfaced only because it
//    happened to share a regex resolver with six siblings — i.e. by luck. A
//    probe author renames when the local meaning differs slightly, which is
//    good practice, so this blind spot sits precisely where careful people work.
//
// 2. BARE INLINE LITERALS. `if (distance < 70)` never binds a name. Measured at
//    42 lines, under this predicate and no other:
//
//      grep -rInE '(^|[^A-Za-z0-9_.])70([^0-9.]|$)' tests .probe \
//        --include='*.mjs' --include='*.js' --include='*.ts' --include='*.tsx' \
//        --include='*.cjs' | grep -v PROXIMITY_PX | wc -l
//
//    The predicate is written out because the first attempt at this number came
//    back 85 and the difference was 48 PNGs and 10 probe .txt logs under
//    .probe/*/out/ — grep matching bytes in binaries and matching a probe's
//    RECORDED OUTPUT as though it were source. A probe log saying "within 70?" is
//    an observation of the program, not a copy of a constant.
//
//    Of the 42, ten are in gestureRules.test.mjs — which tests the function, so
//    passing it 70 is a PIN, not a copy — and three are in this file's own footer,
//    which is to say the measurement counts its own documentation. Most of the
//    rest are docblock prose and console.log headers. A value-based scan cannot
//    tell a copy from a coincidence. That is not a threshold to tune; it is what a
//    bare number is. The response is to make copying unnecessary, which is what
//    the migration did, not to build a better detector.
//
// 3. EXPORTS THAT ARE EXPRESSIONS. `export const X = BASE * 2;` is not collected
//    by `shippedConstants`, so a literal copy of X's value is not flagged. This
//    one is self-limiting in a useful direction: an expression is exactly what a
//    regex resolver could never have read either, and it is the reason imports
//    beat resolvers.
//
// 4. ANYTHING OUTSIDE tests/ AND .probe/. Copies in src/ itself are a different
//    problem with a different fix, and noUnusedExports.test.mjs is the file that
//    watches that boundary.
//
// 5. NAMES THAT ARE NOT CONSTANTS. 28 SHOUT_CASE names are exported by more than
//    one module with DIFFERENT values — CEILING_Y, FLOOR_WIDTH, ROOM_DEPTH and
//    friends across the three room layouts; BODY_HEIGHT, CAP_RADIUS, STEM_Y and
//    friends across sibling prop folders. These are a shared naming convention,
//    not a shared value, and the guard deliberately has no opinion about them (see
//    the fourth test). So a probe that copies the kitchen's CEILING_Y is NOT
//    caught. This is the honest trade: the alternative was the guard citing an
//    arbitrary module chosen by directory-walk order, which is worse than silence
//    because it reads as authority.
//
// THREE COUNTS, THREE PREDICATES
// ------------------------------
//   530  export SITES under src/ that bind a SHOUT_CASE name to a numeric literal
//   488  distinct NAMES among them (530 minus the repeat declarations)
//   460  of those names exported with one agreed value — what the guard checks
//    28  exported with values that disagree — what the guard skips
//   191  corpus files under tests/ and .probe/ matching /\.(mjs|js|tsx?)$/
//
// Stated as a block, with the predicate attached to each, because the first draft
// of this round reported "488 numeric-literal exports" — which is the name count
// wearing the site count's sentence, and neither number was wrong.
