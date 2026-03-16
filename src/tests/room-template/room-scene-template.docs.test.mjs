import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureRoom, readFixtureFile } from './testUtils.mjs';

test('generated room README contains substituted scene id and display name', async () => {
  const fixture = await generateFixtureRoom({
    sceneId: 'kitchen-demo',
    displayName: 'Kitchen Demo',
  });

  try {
    const readme = await readFixtureFile(fixture.sceneDir, 'README.md');

    // Must contain the substituted values
    assert.match(readme, /kitchen-demo/, 'README should contain the substituted scene id');
    assert.match(readme, /Kitchen Demo/, 'README should contain the substituted display name');

    // Must NOT contain raw template tokens
    assert.doesNotMatch(readme, /__SCENE_ID__/, 'README must not contain raw __SCENE_ID__ token');
    assert.doesNotMatch(readme, /__SCENE_DISPLAY_NAME__/, 'README must not contain raw __SCENE_DISPLAY_NAME__ token');

    // Should contain room-specific content, not generator instructions
    assert.match(readme, /localhost:5173\/#\/kitchen-demo/, 'README should have the correct browser URL');
    assert.match(readme, /toyboxes are tappable/, 'README should describe toybox behavior');
  } finally {
    await fixture.cleanup();
  }
});

test('generated room does not receive the template-only README', async () => {
  const fixture = await generateFixtureRoom({
    sceneId: 'docs-check',
    displayName: 'Docs Check',
  });

  try {
    const readme = await readFixtureFile(fixture.sceneDir, 'README.md');

    // Template-only content should NOT appear in the generated README
    assert.doesNotMatch(readme, /npm run create:room-scene/, 'Generated README must not contain generator usage instructions');
    assert.doesNotMatch(readme, /GENERATED_README/, 'Generated README must not reference the template file');
  } finally {
    await fixture.cleanup();
  }
});
