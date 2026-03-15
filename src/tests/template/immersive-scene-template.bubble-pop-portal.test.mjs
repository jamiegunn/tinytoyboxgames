import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureScene, readFixtureFile } from './testUtils.mjs';

test('generated environment includes Bubble Pop by default and no extra minigame portals', async () => {
  const fixture = await generateFixtureScene({
    sceneId: 'bubble-demo',
    displayName: 'Bubble Demo',
  });

  try {
    const environmentFile = await readFixtureFile(fixture.sceneDir, 'environment.ts');

    assert.match(environmentFile, /gameId: 'bubble-pop'/);
    assert.equal(environmentFile.includes('little-shark'), false);
    assert.equal(environmentFile.includes('fireflies'), false);
  } finally {
    await fixture.cleanup();
  }
});
