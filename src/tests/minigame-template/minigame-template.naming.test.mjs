import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectFiles, generateFixtureMiniGame, readFixtureFile } from './testUtils.mjs';

test('generator replaces all minigame placeholder tokens', async () => {
  const fixture = await generateFixtureMiniGame({
    gameId: 'template-demo',
    displayName: 'Template Demo',
  });

  try {
    const files = await collectFiles(fixture.gameDir);

    for (const filePath of files) {
      const contents = await readFixtureFile(fixture.tempRoot, path.relative(fixture.tempRoot, filePath));
      assert.equal(contents.includes('__GAME_ID__'), false, `expected ${filePath} to replace __GAME_ID__`);
      assert.equal(contents.includes('__GAME_DISPLAY_NAME__'), false, `expected ${filePath} to replace __GAME_DISPLAY_NAME__`);
    }
  } finally {
    await fixture.cleanup();
  }
});
