/**
 * The landing page must describe the product the catalog actually ships.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * On 2026-08-01 `LandingPage.tsx` rendered four scene cards. The catalog had
 * five: Living Room had been registered on 2026-07-19 and the landing page was
 * never told. The same card grid described Nature as offering "Bubble Pop,
 * Fireflies, and Little Shark" while Nature's portal array had surfaced Star
 * Catcher for just as long.
 *
 * Neither error was reachable by any existing test. `docs/status/current-state.md`
 * names the landing page's claim counts as a thing to keep in sync, and the
 * README had both facts right — so the only surface that was wrong was the one
 * a visitor actually reads, and the only enforcement was a bullet point asking
 * a human to remember.
 *
 * WHAT IS ASSERTED, AND WHAT IS NOT
 * ---------------------------------
 * That every registered scene's display name appears in the page, and that
 * every game a scene surfaces through a portal is named wherever that scene is
 * described. Not layout, not copy quality, not ordering — this is a
 * completeness check against the catalog, deliberately blind to prose.
 *
 * Source is read as TEXT rather than imported, the same way
 * `music-coverage.test.mjs` reads the catalog: the page is a .tsx module with
 * React imports, and this suite runs under bare `node --test`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...segments) => readFileSync(path.join(PACKAGE_ROOT, ...segments), 'utf8');

const landingSource = read('src', 'components', 'LandingPage.tsx');
const catalogSource = read('src', 'scenes', 'sceneCatalog.ts');
const manifestSource = read('src', 'minigames', 'framework', 'MiniGameManifest.ts');

/** Display names of every registered scene, read from the catalog source. */
function registeredSceneNames() {
  const names = [...catalogSource.matchAll(/displayName:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= 5, `expected at least 5 scene display names, found ${names.length}`);
  return names;
}

/** Display names of every registered minigame, keyed by id. */
function registeredGameNames() {
  const byId = new Map();
  for (const block of manifestSource.split(/\n\s*\{\s*\n/)) {
    const id = block.match(/id:\s*'([^']+)'/);
    const name = block.match(/displayName:\s*'([^']+)'/);
    if (id && name) byId.set(id[1], name[1]);
  }
  assert.ok(byId.size >= 5, `expected at least 5 manifest entries, found ${byId.size}`);
  return byId;
}

/**
 * The scene names the worlds grid actually renders as cards.
 *
 * Deliberately NOT `landingSource.includes(name)`. That weaker form passed when
 * the Living Room card was renamed away, because the words "Living Room" still
 * appeared in a prose paragraph higher up the page — a test that a card exists
 * must look at the cards.
 *
 * @returns {string[]} Display names rendered in the worlds grid.
 */
function renderedSceneCards() {
  return [...landingSource.matchAll(/landing-world-name">([^<]+)</g)].map((m) => m[1].trim());
}

test('every registered scene has a card in the landing page worlds grid', () => {
  const cards = renderedSceneCards();
  assert.ok(cards.length >= 5, `expected at least 5 scene cards, found ${cards.length}: ${cards.join(', ')}`);
  const missing = registeredSceneNames().filter((name) => !cards.includes(name));
  assert.deepEqual(
    missing,
    [],
    `these scenes are registered in sceneCatalog.ts but have no card in the landing page worlds grid: ${missing.join(', ')}.\n` +
      `A visitor reading the landing page is being told the product is smaller than it is.`,
  );
});

/**
 * The description text of one scene's card in the worlds grid.
 *
 * @param {string} sceneId Registered scene id.
 * @returns {string} That card's description, or '' when it has no card.
 */
function cardText(sceneId) {
  const displayName = {
    nature: 'Nature',
    'pirate-cove': 'Pirate Cove',
    'baseball-park': 'Baseball Park',
    playroom: 'Playroom',
    kitchen: 'Kitchen',
    'living-room': 'Living Room',
  }[sceneId];
  const pattern = new RegExp(`landing-world-name">${displayName}</div>\\s*<div className="landing-world-desc">([^<]*)<`);
  return landingSource.match(pattern)?.[1] ?? '';
}

test("every game a scene surfaces is named in that scene's own card", () => {
  const gameNames = registeredGameNames();
  const problems = [];

  for (const [sceneId, envPath] of [
    ['nature', ['src', 'scenes', 'immersive-toybox-scenes', 'naturescene', 'environment.ts']],
    ['pirate-cove', ['src', 'scenes', 'immersive-toybox-scenes', 'pirate-cove', 'environment.ts']],
    ['baseball-park', ['src', 'scenes', 'immersive-toybox-scenes', 'baseball-park', 'environment.ts']],
  ]) {
    const portalIds = [...read(...envPath).matchAll(/gameId:\s*'([^']+)'/g)].map((m) => m[1]);
    assert.ok(portalIds.length > 0, `${sceneId} declares no portals — did environment.ts move?`);

    for (const id of portalIds) {
      const displayName = gameNames.get(id);
      assert.ok(displayName, `${sceneId} surfaces '${id}', which is not in MiniGameManifest.ts`);
      // Scoped to the SCENE'S OWN CARD, not the whole page. The first version
      // asked whether the name appeared anywhere in the file, and on 2026-08-01
      // that let Little Shark move from Nature to Pirate Cove with the Nature
      // card still advertising it — wrong copy, green test.
      if (!cardText(sceneId).includes(displayName)) {
        problems.push(`${sceneId} surfaces ${displayName} (${id}), not named in the ${sceneId} card`);
      }
    }
  }

  assert.deepEqual(problems, [], `the landing page under-describes what a player can reach:\n  ${problems.join('\n  ')}`);
});

test("no scene's card advertises a game that scene does not surface", () => {
  // The converse of the test above, and it is not symmetric. The first version
  // only asked whether every surfaced game was NAMED, so a card could keep
  // advertising a game after it moved scenes and stay green — which is exactly
  // what happened when Little Shark moved to Pirate Cove: the Nature card still
  // offered it, the test passed, and a child tapping into Nature would go
  // looking for a portal that is not there.
  const gameNames = registeredGameNames();
  const problems = [];

  for (const [sceneId, envPath] of [
    ['nature', ['src', 'scenes', 'immersive-toybox-scenes', 'naturescene', 'environment.ts']],
    ['pirate-cove', ['src', 'scenes', 'immersive-toybox-scenes', 'pirate-cove', 'environment.ts']],
    ['baseball-park', ['src', 'scenes', 'immersive-toybox-scenes', 'baseball-park', 'environment.ts']],
  ]) {
    const surfaced = new Set([...read(...envPath).matchAll(/gameId:\s*'([^']+)'/g)].map((m) => gameNames.get(m[1])));
    const text = cardText(sceneId);
    for (const [id, displayName] of gameNames) {
      if (surfaced.has(displayName)) continue;
      if (text.includes(displayName)) problems.push(`the ${sceneId} card names ${displayName} (${id}), which ${sceneId} does not surface`);
    }
  }

  assert.deepEqual(problems, [], `the landing page promises games a scene cannot launch:\n  ${problems.join('\n  ')}`);
});
