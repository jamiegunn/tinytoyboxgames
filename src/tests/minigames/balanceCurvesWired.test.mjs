/**
 * Every curve balance.ts exports must actually be wired into the game.
 *
 * THE DEFECT CLASS THIS EXISTS TO STOP, WHICH TYPE-CHECKS AND READS AS WORKING.
 * `bubble-pop/types.ts` carries a doctrine block telling every reader — human or
 * model — that balance questions are answered by balance.ts. That makes an
 * unimported curve in balance.ts worse than ordinary dead code: the doctrine
 * actively sends people there to be misled. Three of them had accumulated:
 *
 *   swayAmplitude(ed)      0.3 → 0.8     game: SWAY_AMPLITUDE   = 0.6
 *   swayFrequency(ed)      0.8 → 1.6     game: SWAY_FREQUENCY   = 1.2
 *   chainPopRadius(ed, n)  2.0 → 3.0     game: CHAIN_POP_RADIUS = 2.5
 *
 * Each live constant sat at or beside the midpoint of the curve meant to replace
 * it — an unfinished swap. Every one of them was exported, documented, and fully
 * type-checked, and none of it reached a bubble. `tsc` cannot see this: an
 * exported function with no importers is not an error.
 *
 * The three were deleted rather than connected, for reasons measured in
 * `.probe/gameplay/r8-bubble-sway-lever.mjs` and recorded in balance.ts. This
 * test does not re-litigate that. It enforces the weaker, permanent rule that
 * would have caught them on the day they appeared: if it lives in the balance
 * file, the game has to read it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const GAME_DIR = path.resolve(import.meta.dirname, '../../src/minigames/games/bubble-pop');
const BALANCE = path.join(GAME_DIR, 'balance.ts');

/** Every `.ts` file under the game, so "is it used" is asked of the whole game. */
function gameSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...gameSources(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/**
 * Strips comments, because a curve's name being WRITTEN somewhere is not the
 * same as the game reading it.
 *
 * This is not hypothetical tidiness — the first draft of this test omitted it
 * and let the mutation through. Removing those three curves meant documenting
 * why, and the "NOT HERE, DELIBERATELY" blocks in balance.ts and types.ts name
 * all three. A plain text search then found `swayAmplitude` in types.ts, in
 * prose explaining that nothing uses it, and scored it as wired. The act of
 * recording the fix would have disarmed the test that protects it, for that
 * curve and for any future one unlucky enough to be mentioned in a comment.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('every exported balance curve is read by the game it balances', () => {
  const balanceSrc = readFileSync(BALANCE, 'utf8');
  const exported = [...balanceSrc.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);

  assert.ok(exported.length > 0, 'found no exported curves in balance.ts — has the file moved?');

  // Read the rest of the game as one blob; a curve is wired if anything outside
  // balance.ts names it. Checking against the real files rather than a hardcoded
  // list means a curve cannot be "used" only by a consumer that was itself
  // deleted.
  const consumers = gameSources(GAME_DIR)
    .filter((f) => f !== BALANCE)
    .map((f) => stripComments(readFileSync(f, 'utf8')))
    .join('\n');

  const orphans = exported.filter((name) => !new RegExp(`\\b${name}\\b`).test(consumers));

  assert.deepEqual(
    orphans,
    [],
    `balance.ts exports ${orphans.length} curve(s) that no bubble-pop file reads: ${orphans.join(', ')}.\n` +
      'types.ts tells every reader that balance questions are answered here, so a curve nothing imports\n' +
      'is a documented difficulty ramp the game does not have. Either wire it in, or delete it and record\n' +
      'why — see the "NOT HERE, DELIBERATELY" blocks in balance.ts and types.ts for the two worked examples.',
  );
});

test('the deleted sway and chain curves have not crept back', () => {
  const balanceSrc = readFileSync(BALANCE, 'utf8');

  for (const gone of ['swayAmplitude', 'swayFrequency', 'chainPopRadius']) {
    assert.ok(
      !new RegExp(`^export function ${gone}\\b`, 'm').test(balanceSrc),
      `${gone} is exported again. It was removed on measurement, not on taste: the sway pair scales ` +
        'amplitude and frequency in lockstep so its hard end is arithmetically identical to the shipping ' +
        'constant (excursion is 0.6*A/F, and 0.8/1.6 === 0.6/1.2), while chainPopRadius cuts the youngest ' +
        "player's chain reach by 20%. Read balance.ts before reinstating either.",
    );
  }
});
