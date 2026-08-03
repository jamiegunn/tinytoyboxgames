/**
 * Nothing in the app may assume it is served from the origin root.
 *
 * THE BUG THIS PINS
 * -----------------
 * `LandingPage.tsx` shipped its call to action as `href="/#/playroom"`. The app
 * is not served from the root: on tinytoyboxgames.com it lives under `/game/`,
 * because the Pages site puts the marketing page at the root and the game beside
 * it. So the one big button on the landing page navigated to
 * `tinytoyboxgames.com/#/playroom` — the marketing home page — and a child who
 * pressed "Open the Toybox" was thrown straight back out of the app.
 *
 * `NotFoundPage.tsx` had the same defect in `href="/"`, one round of clicks
 * further along.
 *
 * WHY THIS IS THE SAME BUG AS THE BLANK DEPLOY
 * -------------------------------------------
 * A week's worth of framing work shipped behind a white screen because the CI
 * build passed `--base=/tinytoyboxgames/game/` while the site is served from a
 * custom domain that strips the repo prefix. Same root assumption — "we are at
 * the origin root" — expressed in a different file. Vite rewrites `index.html`
 * against the base and does it correctly; what it cannot do is rewrite a string
 * literal inside a `.tsx` file. That gap is exactly where both bugs lived, so it
 * gets a test rather than a comment.
 *
 * WHAT COUNTS
 * -----------
 * A leading-slash `href`, `src` or `action` in app source, and any assignment of
 * a root-relative path to `location`. Protocol-relative (`//host`) and absolute
 * URLs (`https://…`) are external links and are fine — they were never claims
 * about where this app is mounted.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk, SRC } from './_moduleGraph.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** `href="/x"`, `src='/x'`, `action="/x"` — but not `//host` and not a bare `"/"` inside a regex. */
const ATTRIBUTE = /\b(href|src|action)\s*=\s*["'`]\/(?!\/)/g;

/** `location.href = '/x'`, `location.assign('/x')`, `location.replace('/x')`. */
const NAVIGATION = /location\s*\.\s*(href\s*=|assign\s*\(|replace\s*\()\s*["'`]\/(?!\/)/g;

test('no component links to an absolute path from the origin root', () => {
  const offenders = [];
  for (const file of walk(SRC)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    const rel = path.relative(PACKAGE_ROOT, file);
    for (const pattern of [ATTRIBUTE, NAVIGATION]) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${rel}:${line}  ${source.split('\n')[line - 1].trim()}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these assume the app is served from the origin root:\n  ${offenders.join('\n  ')}\n\n` +
      `It is not — the Pages site serves the game from a sub-path beside the marketing page. ` +
      `Use a fragment ("#/playroom") or a document-relative path so the link works wherever the app is mounted.`,
  );
});

test('the landing page still has a way into the game', () => {
  // The rule above is satisfiable by deleting every link. This is the assertion
  // that says the call to action must still exist and must still point at a
  // scene — the defect being fixed was a button that went to the wrong place,
  // not a button that was too dangerous to have.
  const landing = readFileSync(path.join(PACKAGE_ROOT, 'src/components/LandingPage.tsx'), 'utf8');
  const ctas = [...landing.matchAll(/href="#\/([a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(ctas.length >= 1, 'the landing page has no fragment link into any scene');
  for (const scene of ctas) {
    assert.match(scene, /^[a-z-]+$/, `"${scene}" does not look like a scene id`);
  }
});
