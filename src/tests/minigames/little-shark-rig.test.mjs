// Contract tests for little-shark's light rig and the irradiance it produces.
//
// THE DEFECT THESE EXIST TO PREVENT COMING BACK. The reef's rig irradiance is
// the input to every colour decision in this game — the fish palette in
// `types.ts`, the sand albedo in `terrain.ts`, the water colour and fog in
// `setup.ts`. Until round 10 it was derived in a COMMENT and existed nowhere
// else. Three hops later it was wrong:
//
//   reefIrradiance()                       (0.222551, 0.253994, 0.288233)
//   setup.ts   exposure-budget table   (0.2226, 0.2540, 0.2883)   rounded retelling
//   types.ts   fish-palette docblock   (0.2225, 0.2540, 0.2889)   hand transcription
//   .probe/render/r8-species-palette.mjs   `// types.ts:16`       copied the copy
//
// EXACTLY ONE OF THOSE SIX DIGITS WAS HAND-CHANGED, and finding out which took
// this file falsifying its own author. The first version of this header said the
// blue had drifted 0.00067 and the red 0.0001 "in opposite directions, which no
// rounding rule produces" — a tidy story, written into three source files before
// a line of it was checked. Then test 5 below ran and refuted it. A four-decimal
// table admits two correct last digits: computing at full precision and rounding
// once gives 0.2226, 0.2540, 0.2882, while adding the printed rows as printed
// gives 0.2225, 0.2540, 0.2883. The old total row silently took red from the
// first method and blue from the second. So types.ts's red, 0.2225, is an honest
// row-sum reading and never drifted at all. Its blue is the whole defect: 0.2889
// against a table saying 0.2883 and an expression saying 0.2882, worth 0.00067,
// hiding inside a last-place ambiguity wide enough that no reader would look
// twice. The probe then cited that docblock as though it were code, and reported
// on live rendering from a number that appears nowhere in the program.
//
// Nothing could have caught it, because there was no expression to disagree
// with. There is one now — `reefIrradiance()` — and these tests pin the prose to
// it. The fourth test below is the one that would have failed in 2026-07; it
// reads the docblock and compares it to the function.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Color, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(path.join(PACKAGE_ROOT, rel), 'utf8');

// bundleEntry rather than loadTs: setup.ts reaches the shared lighting rig
// through the `@app` alias, which only the bundler resolves.
const { REEF_RIG, reefIrradiance } = await bundleEntry(
  'r10_reef_rig',
  `export { REEF_RIG, reefIrradiance } from './src/minigames/games/little-shark/environment/setup';`,
);

/** Strips `//` and ` * ` comment leaders so a docblock can be regex'd as one string. */
const flattenComments = (src) =>
  src
    .split('\n')
    .map((line) => line.replace(/^\s*(\/\/|\*|\/\*\*?)\s?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ');

// ---------------------------------------------------------------------------
// The number itself
// ---------------------------------------------------------------------------

test('the rig lands the irradiance the whole colour chain was built on', () => {
  // Full precision, not four places, because the point of moving this out of a
  // comment is that it stops being a rounded retelling. Any change to the rig
  // fails here first and loudly, which is correct: every rendered figure in
  // types.ts and terrain.ts was measured against this exact light.
  const [r, g, b] = reefIrradiance();
  assert.equal(r.toFixed(6), '0.222551');
  assert.equal(g.toFixed(6), '0.253994');
  assert.equal(b.toFixed(6), '0.288233');
});

test('every term in the derivation is load-bearing', () => {
  // Written because a pin on a returned number cannot tell you whether the
  // expression behind it is the expression you think it is. Round 9's lesson,
  // applied before it can bite: a green assertion on a constant is
  // indistinguishable from a green assertion on a constant that ignores its
  // inputs. Each perturbation below must move the result, or the corresponding
  // term is not actually being read.
  const base = {
    keyDirection: REEF_RIG.keyDirection,
    keyIntensity: REEF_RIG.keyIntensity,
    hemiIntensity: REEF_RIG.hemiIntensity,
    keyColor: REEF_RIG.keyColor,
    hemiSkyColor: REEF_RIG.hemiSkyColor,
    environmentIntensity: REEF_RIG.environmentIntensity,
    environmentRadiance: REEF_RIG.environmentRadiance,
  };
  const green = () => reefIrradiance(base)[1];
  const moved = (patch, why) => {
    assert.notEqual(reefIrradiance({ ...base, ...patch })[1].toFixed(6), green().toFixed(6), why);
  };

  moved({ keyIntensity: 0.9 }, 'key intensity must reach the result');
  moved({ hemiIntensity: 0.9 }, 'hemisphere intensity must reach the result');
  moved({ environmentIntensity: 0.02 }, 'environment intensity must reach the result');
  moved({ environmentRadiance: 4.2 }, 'the fitted environment radiance must reach the result');
  moved({ keyColor: new Color(1.0, 0.5, 0.88) }, 'the key colour must reach the result per channel');
  moved({ hemiSkyColor: new Color(0.06, 0.9, 0.6) }, 'the sky colour must reach the result per channel');
  // Direction enters only as |y| after normalising, so a change that preserves
  // that must NOT move the number — otherwise the cosine is being taken from
  // the wrong quantity.
  moved({ keyDirection: new Vector3(0.8, -2, 0.45) }, 'the key elevation must reach the result');
  assert.equal(
    reefIrradiance({ ...base, keyDirection: new Vector3(-0.45, -1, -0.8) })[1].toFixed(9),
    green().toFixed(9),
    'only the normalised |y| may matter; swapping x and z must be invisible',
  );
});

test('the key sits where the exposure budget says it does', () => {
  // 0.737 is quoted in the budget's arithmetic and again in the Snell's-window
  // paragraph that justifies the 42.5-degree tilt. Both are downstream of this
  // vector, and neither would notice if it moved.
  const cosine = Math.abs(REEF_RIG.keyDirection.clone().normalize().y);
  assert.equal(cosine.toFixed(4), '0.7367');
  const degreesOffVertical = (Math.acos(cosine) * 180) / Math.PI;
  assert.equal(degreesOffVertical.toFixed(1), '42.5');
  // Snell's window: asin(1/1.333) = 48.6 degrees is the hard ceiling for any
  // underwater key. The budget claims this sits close to but inside it.
  assert.ok(degreesOffVertical < 48.6, 'the key must stay inside Snell’s window');
});

// ---------------------------------------------------------------------------
// The prose, pinned to the number
// ---------------------------------------------------------------------------

test('the fish-palette docblock quotes the irradiance the rig actually produces', () => {
  // THIS IS THE TEST THAT WOULD HAVE CAUGHT IT. `types.ts:16` read
  // (0.2225, 0.2540, 0.2889) against a real value of (0.2226, 0.2540, 0.2882),
  // and the probe that scores the fish palette copied it verbatim while citing
  // it as source. Four decimal places, because that is the precision the
  // docblock states — the assertion is that the prose is a correct rounding of
  // the expression, not that prose can carry full precision.
  const doc = flattenComments(read('src/minigames/games/little-shark/types.ts'));
  const quoted = /rig irradiance \(([\d.]+), ([\d.]+), ([\d.]+)\)/.exec(doc);
  assert.ok(quoted, 'types.ts must still state the rig irradiance it scored the palette against');

  const [r, g, b] = reefIrradiance();
  assert.deepEqual(
    [quoted[1], quoted[2], quoted[3]],
    [r.toFixed(4), g.toFixed(4), b.toFixed(4)],
    'the fish palette docblock has drifted from the rig it claims to describe',
  );
});

test('every row of the exposure budget is the row the rig actually produces', () => {
  // THIS TEST EARNED ITSELF ON ITS FIRST RUN. It was originally written to check
  // the table against ITSELF — do the three printed rows add up to the printed
  // total — and it failed, on a table that had been read by several people and
  // quoted downstream twice. The total row was taking its red from the
  // full-precision sum (0.2226) and its blue from the printed-row sum (0.2883),
  // one method per channel, and no reader could have caught that because both
  // methods are correct and the table did not say which it meant.
  //
  // So it now checks the table against the EXPRESSION instead. A comment may be
  // a rounding of `reefIrradiance()`; it may not be a rounding of two different
  // things at once. That is the only version of this check that would have
  // caught the digit `types.ts` went on to corrupt, because the corruption hid
  // inside exactly that last-place ambiguity.
  const budget = flattenComments(read('src/minigames/games/little-shark/environment/setup.ts'));
  const four = (v) => v.toFixed(4);

  const key = /key \(([\d.]+), ([\d.]+), ([\d.]+)\) \* ([\d.]+) \* ([\d.]+) \/ PI = \(([\d.]+), ([\d.]+), ([\d.]+)\)/.exec(budget);
  assert.ok(key, 'the exposure budget must still show its key row');
  const [, kr, kg, kb, intensity, cosine, outR, outG, outB] = key;

  // The stated inputs must be the rig's, or the table is internally consistent
  // about a light the scene does not have.
  assert.deepEqual([kr, kg, kb].map(Number), [REEF_RIG.keyColor.r, REEF_RIG.keyColor.g, REEF_RIG.keyColor.b], 'key colour');
  assert.equal(Number(intensity), REEF_RIG.keyIntensity, 'key intensity');
  const trueCosine = Math.abs(REEF_RIG.keyDirection.clone().normalize().y);
  assert.equal(cosine, trueCosine.toFixed(4), 'the printed cosine must be a rounding of the real one');

  // And the stated outputs must be what those inputs give, computed the way the
  // program computes them — at full precision, rounded once, at the end.
  const keyTerm = (c) => (c * REEF_RIG.keyIntensity * trueCosine) / Math.PI;
  assert.deepEqual(
    [outR, outG, outB],
    [REEF_RIG.keyColor.r, REEF_RIG.keyColor.g, REEF_RIG.keyColor.b].map((c) => four(keyTerm(c))),
    'the key row does not equal its own inputs',
  );

  const hemi = /hemi \(([\d.]+), ([\d.]+), ([\d.]+)\) \* ([\d.]+) \/ PI = \(([\d.]+), ([\d.]+), ([\d.]+)\)/.exec(budget);
  assert.ok(hemi, 'the exposure budget must still show its hemisphere row');
  assert.deepEqual([hemi[1], hemi[2], hemi[3]].map(Number), [REEF_RIG.hemiSkyColor.r, REEF_RIG.hemiSkyColor.g, REEF_RIG.hemiSkyColor.b], 'sky colour');
  assert.equal(Number(hemi[4]), REEF_RIG.hemiIntensity, 'hemisphere intensity');
  assert.deepEqual(
    [hemi[5], hemi[6], hemi[7]],
    [REEF_RIG.hemiSkyColor.r, REEF_RIG.hemiSkyColor.g, REEF_RIG.hemiSkyColor.b].map((c) => four((c * REEF_RIG.hemiIntensity) / Math.PI)),
    'the hemisphere row does not equal its own inputs',
  );

  const env = /env ([\d.]+) \* ([\d.]+) = ([\d.]+) flat/.exec(budget);
  assert.ok(env, 'the exposure budget must still show its environment row');
  assert.equal(Number(env[1]), REEF_RIG.environmentIntensity, 'environment intensity');
  assert.equal(Number(env[2]), REEF_RIG.environmentRadiance, 'the fitted environment radiance');
  assert.equal(env[3], four(REEF_RIG.environmentIntensity * REEF_RIG.environmentRadiance), 'environment row');

  const total = /total \(([\d.]+), ([\d.]+), ([\d.]+)\)/.exec(budget);
  assert.ok(total, 'the exposure budget must still show its total');
  assert.deepEqual([total[1], total[2], total[3]], reefIrradiance().map(four), 'the exposure budget total is not a rounding of reefIrradiance()');
});
