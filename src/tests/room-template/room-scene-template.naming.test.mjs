import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureRoom, readFixtureFile } from './testUtils.mjs';

test('generator replaces room template placeholder tokens', async () => {
  const fixture = await generateFixtureRoom({
    sceneId: 'kitchen-demo',
    displayName: 'Kitchen Demo',
  });

  try {
    const indexSource = await readFixtureFile(fixture.sceneDir, 'index.ts');
    const roomSource = await readFixtureFile(fixture.sceneDir, 'room.ts');

    assert.match(indexSource, /sceneId: 'kitchen-demo'/);
    assert.doesNotMatch(indexSource, /__SCENE_ID__/);
    assert.doesNotMatch(roomSource, /__SCENE_DISPLAY_NAME__/);
  } finally {
    await fixture.cleanup();
  }
});
