/**
 * A `layout.ts` may not export a coordinate nothing reads.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * These files are the worst possible hiding place for dead code, and they are
 * the hiding place dead code keeps choosing. Each one opens by declaring
 * itself the single source of truth for a room's spatial zones, which is an
 * invitation to read a number out of it and believe it. The Playroom's was
 * carrying eighteen exported constants that nothing imported, several of which
 * disagreed with the room the game actually builds — a TOYBOX_POSITIONS table
 * with a fourth entry for a toybox that had been deleted, a rug centre and
 * radius that were not the rug's, three wall pictures where one exists, and a
 * "viewport-safe content box" that no object was inside.
 *
 * The Living Room's was carrying BOOK_STACK_X and BOOK_STACK_Z, "stack of
 * picture books on the front floor". There is no floor book stack. That pair
 * sat between CAT_X/CAT_Z and the toybox slots, in the same JSDoc voice and the
 * same SCREAMING_CASE X/Z shape as its eight live neighbours, each of which is
 * imported two to six times by the module that builds the thing it names.
 *
 * WHY A READER COUNT IS THE RIGHT TEST
 * ------------------------------------
 * Because nothing in the text separates the two. A dead coordinate and a live
 * one are written identically — that is the entire problem, and it is why a
 * careful human reading the file top to bottom does not find these, and why a
 * model asked to "move the book stack" will happily edit a number that has no
 * effect and report success. The import graph is the only thing that knows,
 * and it is not written in the file.
 *
 * WHAT COUNTS AS A READER
 * -----------------------
 * Any other file under `src/` or `tests/`. Tests count deliberately: a
 * constant a test asserts against is load-bearing even if the game reaches it
 * some other way, and deleting it would be a regression.
 *
 * A constant used only inside its own file is not a finding — the value is
 * live, only the `export` keyword is redundant. So the fix in that case is to
 * drop the keyword, which is what happened to the trim insets and decal layers
 * this suite first flagged. That is why the check is on exports and not on
 * declarations: an unexported helper constant is nobody's business but the
 * file's, while an exported one is a promise that someone is calling.
 *
 * COMMENTS ARE NOT READERS
 * ------------------------
 * Bodies are stripped of comments before the search, and finding that out was
 * the point of mutation-testing this file. The first version counted any
 * textual occurrence, so putting BOOK_STACK_X back into the Living Room's
 * layout did not turn the suite red: the paragraph above, explaining that
 * BOOK_STACK_X was dead, was itself the reader that kept it alive. A prose
 * mention is the opposite of a use, and a check that cannot tell them apart is
 * disarmed by its own documentation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PKG = new URL('../../', import.meta.url).pathname;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

// Block comments, then line comments. Over-stripping is the safe direction: it
// can only cost a reader and turn the suite red, never hide a dead export.
function code(body) {
  return body.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = [...walk(join(PKG, 'src')), ...walk(join(PKG, 'tests'))];
const bodies = new Map(files.map((file) => [file, code(readFileSync(file, 'utf8'))]));
const layouts = files.filter((file) => file.endsWith('/layout.ts'));

test('there are layout files to check — a silent zero would make this suite vacuous', () => {
  assert.ok(layouts.length >= 3, `expected the room layout files, found ${layouts.length}`);
});

for (const layout of layouts) {
  const label = relative(join(PKG, 'src'), layout);

  test(`${label} exports nothing that no other file reads`, () => {
    const names = [...bodies.get(layout).matchAll(/^export const ([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]);
    assert.ok(names.length > 0, `${label} declares no exported constants; the pattern changed and this check is now blind`);

    const orphans = names.filter((name) => {
      const used = new RegExp(`\\b${name}\\b`);
      for (const [file, body] of bodies) {
        if (file === layout) continue;
        if (used.test(body)) return false;
      }
      return true;
    });

    assert.deepEqual(
      orphans,
      [],
      `${label} exports these and no other file under src/ or tests/ mentions them: ${orphans.join(', ')}. ` +
        `Either the prop they describe was never built or has since moved its own coordinates, in which case delete them and say so; ` +
        `or they are used only inside this file, in which case drop the \`export\` keyword. An exported constant with no reader reads exactly like one with fifty.`,
    );
  });
}
