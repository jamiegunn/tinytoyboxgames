/**
 * Music-coverage contract test.
 *
 * Enforces the rule in docs/ai-guidance/audio-standards.md: every scene and
 * every minigame ships its own registered music bed. If a scene catalog entry
 * or minigame manifest entry is missing a music id, or points at an id that
 * is not registered in MUSIC_REGISTRY, this suite fails.
 *
 * Like the other contract tests, this parses source text rather than
 * importing TS modules, so it runs under plain `node --test`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const sceneCatalogSource = readFileSync(path.join(packageRoot, 'src', 'scenes', 'sceneCatalog.ts'), 'utf8');
const manifestSource = readFileSync(path.join(packageRoot, 'src', 'minigames', 'framework', 'MiniGameManifest.ts'), 'utf8');
const registrySource = readFileSync(path.join(packageRoot, 'src', 'assets', 'audio', 'index.ts'), 'utf8');

/**
 * Extracts the registered music ids from the MUSIC_REGISTRY object literal.
 *
 * @returns Set of registered music id strings.
 */
function registeredMusicIds() {
  const registryBlock = registrySource.match(/MUSIC_REGISTRY[^=]*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(registryBlock, 'MUSIC_REGISTRY object literal not found in assets/audio/index.ts');
  const ids = new Set();
  for (const match of registryBlock[1].matchAll(/^\s*(?:'([^']+)'|([A-Za-z0-9_]+)):/gm)) {
    ids.add(match[1] ?? match[2]);
  }
  return ids;
}

test('every scene in the catalog has a registered music bed and ambient', () => {
  const musicIds = registeredMusicIds();

  const entries = [...sceneCatalogSource.matchAll(/^ {2}(?:'([^']+)'|([A-Za-z0-9-]+)):\s*\{/gm)].map((m) => m[1] ?? m[2]);
  assert.ok(entries.length >= 4, `Expected at least 4 scene entries, found ${entries.length}`);

  const audioFields = [...sceneCatalogSource.matchAll(/audio:\s*(null|\{\s*musicId:\s*'([^']*)',\s*ambientId:\s*'([^']*)'\s*\})/g)];
  assert.equal(audioFields.length, entries.length, 'Every scene entry must declare an audio field');

  for (const field of audioFields) {
    assert.notEqual(field[1], 'null', 'Scenes must not declare audio: null — every scene ships music and ambient');
    const musicId = field[2];
    const ambientId = field[3];
    assert.ok(musicId && musicId.length > 0, 'Scene musicId must not be empty — every scene ships its own music');
    assert.ok(ambientId && ambientId.length > 0, 'Scene ambientId must not be empty');
    assert.ok(musicIds.has(musicId), `Scene musicId "${musicId}" is not registered in MUSIC_REGISTRY`);
  }
});

test('every minigame manifest entry declares a registered music bed', () => {
  const musicIds = registeredMusicIds();

  const gameIds = [...manifestSource.matchAll(/^\s*id:\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.ok(gameIds.length >= 5, `Expected at least 5 manifest entries, found ${gameIds.length}`);

  const gameMusicIds = [...manifestSource.matchAll(/^\s*musicId:\s*'([^']*)'/gm)].map((m) => m[1]);
  assert.equal(gameMusicIds.length, gameIds.length, 'Every minigame manifest entry must declare a musicId — every game ships its own music');

  for (let i = 0; i < gameMusicIds.length; i++) {
    const musicId = gameMusicIds[i];
    assert.ok(musicId.length > 0, `Minigame "${gameIds[i]}" has an empty musicId`);
    assert.ok(musicIds.has(musicId), `Minigame "${gameIds[i]}" musicId "${musicId}" is not registered in MUSIC_REGISTRY`);
  }
});

test('the minigame generator emits a musicId so new games inherit the rule', () => {
  const generatorSource = readFileSync(path.join(packageRoot, 'scripts', 'lib', 'minigameGenerator.mjs'), 'utf8');
  assert.match(generatorSource, /musicId: 'mus_shared_music_box'/, 'Generated manifest entries must include a default musicId');

  const musicIds = registeredMusicIds();
  assert.ok(musicIds.has('mus_shared_music_box'), 'The generator default musicId must be registered in MUSIC_REGISTRY');
});
