import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureMiniGame, readFixtureFile } from './testUtils.mjs';

test('generated minigame includes a real playable baseline instead of dead placeholders', async () => {
  const fixture = await generateFixtureMiniGame({
    gameId: 'template-demo',
    displayName: 'Template Demo',
  });

  try {
    const indexSource = await readFixtureFile(fixture.tempRoot, 'src', 'minigames', 'games', 'template-demo', 'index.ts');
    const rulesSource = await readFixtureFile(fixture.tempRoot, 'src', 'minigames', 'games', 'template-demo', 'rules', 'scoring.ts');

    assert.match(indexSource, /context\.spawner\.register/);
    assert.match(indexSource, /createMissPulse/);
    assert.match(rulesSource, /context\.score\.addPoints/);
    assert.match(rulesSource, /context\.combo\.registerHit/);
  } finally {
    await fixture.cleanup();
  }
});
