import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectFiles, generateFixtureScene } from './testUtils.mjs';

test('generator replaces template tokens and avoids unresolved placeholders', async () => {
  const fixture = await generateFixtureScene({
    sceneId: 'moonlit-garden',
    displayName: 'Moonlit Garden',
  });

  try {
    const files = await collectFiles(fixture.sceneDir);
    assert.ok(files.length > 0, 'expected generated files to exist');

    for (const filePath of files) {
      const content = await import('node:fs/promises').then(({ readFile }) => readFile(filePath, 'utf8'));
      assert.equal(content.includes('__SCENE_ID__'), false, `${path.basename(filePath)} still contains __SCENE_ID__`);
      assert.equal(content.includes('__SCENE_DISPLAY_NAME__'), false, `${path.basename(filePath)} still contains __SCENE_DISPLAY_NAME__`);
      assert.equal(content.includes('**SCENE_DISPLAY_NAME**'), false, `${path.basename(filePath)} still contains the broken display-name heading token`);
      assert.equal(content.includes('templates/immersive-scene'), false, `${path.basename(filePath)} still points at the template source`);
    }
  } finally {
    await fixture.cleanup();
  }
});
