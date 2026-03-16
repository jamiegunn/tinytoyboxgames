import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureMiniGame, readFixtureFile } from './testUtils.mjs';

test('generator registers the new minigame in the manifest with template defaults', async () => {
  const fixture = await generateFixtureMiniGame({
    gameId: 'template-demo',
    displayName: 'Template Demo',
  });

  try {
    const manifest = await readFixtureFile(fixture.tempRoot, 'src', 'minigames', 'framework', 'MiniGameManifest.ts');

    assert.match(manifest, /id:\s*'template-demo'/);
    assert.match(manifest, /displayName:\s*'Template Demo'/);
    assert.match(manifest, /launchableFrom:\s*\['nature'\]/);
    assert.match(manifest, /inputModes:\s*\['tap'\]/);
    assert.match(manifest, /mode:\s*'endless'/);
    assert.match(manifest, /load:\s*\(\)\s*=>\s*import\('@app\/minigames\/games\/template-demo'\)/);
  } finally {
    await fixture.cleanup();
  }
});
