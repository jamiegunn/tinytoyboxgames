import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { generateFixtureRoom, readFixtureFile } from './testUtils.mjs';

test('generated index.ts exports createScene and imports createRoomScene', async () => {
  const fixture = await generateFixtureRoom({
    sceneId: 'compile-check',
    displayName: 'Compile Check',
  });

  try {
    const index = await readFixtureFile(fixture.sceneDir, 'index.ts');

    assert.match(index, /export function createScene/, 'index.ts must export createScene');
    assert.match(
      index,
      /import.*createRoomScene.*from\s+['"]@app\/utils\/roomSceneFactory['"]/,
      'index.ts must import createRoomScene from @app/utils/roomSceneFactory',
    );
  } finally {
    await fixture.cleanup();
  }
});

test('generated room.ts imports RoomBuildContext and exports buildRoomContents', async () => {
  const fixture = await generateFixtureRoom({
    sceneId: 'compile-room',
    displayName: 'Compile Room',
  });

  try {
    const room = await readFixtureFile(fixture.sceneDir, 'room.ts');

    assert.match(room, /RoomBuildContext/, 'room.ts must import RoomBuildContext');
    assert.match(room, /export function buildRoomContents/, 'room.ts must export buildRoomContents');
  } finally {
    await fixture.cleanup();
  }
});

test('no unreplaced __SCENE_ID__ or __SCENE_DISPLAY_NAME__ tokens in any generated .ts file', async () => {
  const fixture = await generateFixtureRoom({
    sceneId: 'token-check',
    displayName: 'Token Check',
  });

  try {
    const tsFiles = await collectTsFiles(fixture.sceneDir);
    assert.ok(tsFiles.length > 0, 'Expected at least one .ts file in the generated scene');

    for (const filePath of tsFiles) {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = path.relative(fixture.sceneDir, filePath);

      assert.doesNotMatch(content, /__SCENE_ID__/, `${relativePath} must not contain raw __SCENE_ID__ token`);
      assert.doesNotMatch(content, /__SCENE_DISPLAY_NAME__/, `${relativePath} must not contain raw __SCENE_DISPLAY_NAME__ token`);
    }
  } finally {
    await fixture.cleanup();
  }
});

/**
 * Recursively collects all `.ts` file paths under the given directory.
 *
 * @param {string} dir - Directory to scan.
 * @returns {Promise<string[]>} Absolute paths of `.ts` files found.
 */
async function collectTsFiles(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectTsFiles(fullPath)));
    } else if (entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}
