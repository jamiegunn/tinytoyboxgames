import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureMiniGame, readFixtureFile } from './testUtils.mjs';

test('template README explains generator usage and browser testing', async () => {
  const fixture = await generateFixtureMiniGame({
    gameId: 'template-demo',
    displayName: 'Template Demo',
  });

  try {
    const readme = await readFixtureFile(fixture.tempRoot, 'src', 'minigames', 'games', 'template-demo', 'README.md');

    assert.match(readme, /npm run create:minigame/);
    assert.match(readme, /MiniGameManifest\.ts/);
    assert.match(readme, /http:\/\/localhost:5173\/#\/nature\/template-demo/);
  } finally {
    await fixture.cleanup();
  }
});
