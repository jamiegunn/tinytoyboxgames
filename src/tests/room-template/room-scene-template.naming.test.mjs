import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { collectFiles, generateFixtureRoom, readFixtureFile } from './testUtils.mjs';

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

    // EVERY generated file, not just the two TypeScript ones. The three nested
    // READMEs carry __SCENE_DISPLAY_NAME__ and were checked by nothing.
    for (const filePath of await collectFiles(fixture.sceneDir)) {
      const contents = await readFixtureFile(fixture.tempRoot, path.relative(fixture.tempRoot, filePath));
      assert.equal(contents.includes('__SCENE_ID__'), false, `expected ${filePath} to replace __SCENE_ID__`);
      assert.equal(contents.includes('__SCENE_DISPLAY_NAME__'), false, `expected ${filePath} to replace __SCENE_DISPLAY_NAME__`);
      // Markdown reads __x__ as bold, so `prettier --write` rewrites the token
      // to **SCENE_DISPLAY_NAME** and the generator can no longer replace it.
      // That happened to all thirteen template READMEs on 2026-08-01; the
      // templates are in .prettierignore now, and this is the assertion that
      // notices if that protection is ever lost.
      assert.equal(contents.includes('**SCENE_DISPLAY_NAME**'), false, `${filePath} contains the Prettier-broken display-name token`);
    }
  } finally {
    await fixture.cleanup();
  }
});
