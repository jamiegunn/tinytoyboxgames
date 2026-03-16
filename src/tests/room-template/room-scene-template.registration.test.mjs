import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureRoom, readFixtureFile } from './testUtils.mjs';

test('room scene generator updates the central scene catalog as a landing scene', async () => {
  const fixture = await generateFixtureRoom({
    sceneId: 'kitchen-demo',
    displayName: 'Kitchen Demo',
  });

  try {
    const sceneCatalog = await readFixtureFile(fixture.tempRoot, 'src', 'scenes', 'sceneCatalog.ts');

    assert.match(sceneCatalog, /'kitchen-demo': \{/);
    assert.match(sceneCatalog, /displayName: 'Kitchen Demo'/);
    assert.match(sceneCatalog, /kind: 'landing'/);
    assert.match(sceneCatalog, /@app\/scenes\/world\/places\/house\/subplaces\/kitchen-demo/);
  } finally {
    await fixture.cleanup();
  }
});
