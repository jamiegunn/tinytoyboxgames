import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureScene, readFixtureFile } from './testUtils.mjs';

test('generated documentation and key files include the instructional scaffolding', async () => {
  const fixture = await generateFixtureScene({
    sceneId: 'docs-demo',
    displayName: 'Docs Demo',
  });

  try {
    const readme = await readFixtureFile(fixture.sceneDir, 'README.md');
    const indexFile = await readFixtureFile(fixture.sceneDir, 'index.ts');
    const playroomStub = await readFixtureFile(fixture.sceneDir, 'parent-scene-stubs', 'playroom.toybox.stub.ts');

    assert.match(readme, /ADR-0012/);
    assert.match(readme, /How To Use The Generator/);
    assert.match(readme, /parent-scene-stubs\/playroom\.toybox\.stub\.ts/);
    assert.match(readme, /How To Use The Authoring Prompt/);
    assert.match(indexFile, /ADR-0011/);
    assert.match(indexFile, /orchestration boundary/);
    assert.match(playroomStub, /PLAYROOM_TOYBOX_STUB/);
    assert.match(playroomStub, /destination: 'docs-demo'/);
  } finally {
    await fixture.cleanup();
  }
});
