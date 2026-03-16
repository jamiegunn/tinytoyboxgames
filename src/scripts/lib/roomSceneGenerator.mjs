import path from 'node:path';
import { promises as fs } from 'node:fs';
import { copyTemplateDirectory, validateDisplayName, validateSceneId } from './generatorUtils.mjs';

const TEMPLATE_ROOT = path.join('templates', 'room-scene');
const OUTPUT_ROOT = path.join('src', 'scenes', 'world', 'places', 'house', 'subplaces');
const SCENE_CATALOG_PATH = path.join('src', 'scenes', 'sceneCatalog.ts');
const SCENE_CATALOG_MARKER = '// __ROOM_SCENE_GENERATOR_ENTRY_MARKER__';

/**
 * Inserts a new room scene registration entry into the central scene catalog.
 *
 * @param {string} source - Current contents of `sceneCatalog.ts`.
 * @param {{ sceneId: string, displayName: string }} params - Room scene metadata.
 * @returns {string} Updated catalog source.
 */
export function addRoomSceneCatalogEntry(source, { sceneId, displayName }) {
  if (!source.includes(SCENE_CATALOG_MARKER)) {
    throw new Error('Room scene catalog marker was not found. Generator cannot update sceneCatalog.ts safely.');
  }

  if (source.includes(`'${sceneId}': {`) || source.includes(`${sceneId}: {`)) {
    throw new Error(`Scene "${sceneId}" is already registered in sceneCatalog.ts.`);
  }

  const escapedDisplayName = displayName.replaceAll("'", "\\'");
  const entry = [
    `  '${sceneId}': {`,
    `    displayName: '${escapedDisplayName}',`,
    `    kind: 'landing',`,
    `    loader: () => import('@app/scenes/world/places/house/subplaces/${sceneId}'),`,
    '    cameraPreset: { azimuth: 0, polar: 1.19, distance: 14, target: [0, 0.5, 0] },',
    `    audio: { musicId: '', ambientId: '' },`,
    '  },',
  ].join('\n');

  return source.replace(SCENE_CATALOG_MARKER, `${entry}\n  ${SCENE_CATALOG_MARKER}`);
}

/**
 * Generates a new room scene from the canonical room template and updates the
 * central scene catalog.
 *
 * @param {{
 *   packageRoot: string,
 *   sceneId: string,
 *   displayName: string,
 * }} params - Generator configuration.
 * @returns {Promise<{ outputDir: string, createdFiles: string[], updatedFiles: string[] }>}
 */
export async function generateRoomScene({ packageRoot, sceneId, displayName }) {
  validateSceneId(sceneId);
  validateDisplayName(displayName);

  const templateDir = path.join(packageRoot, TEMPLATE_ROOT);
  const outputDir = path.join(packageRoot, OUTPUT_ROOT, sceneId);
  const sceneCatalogPath = path.join(packageRoot, SCENE_CATALOG_PATH);

  const templateStat = await fs.stat(templateDir).catch(() => null);
  if (!templateStat?.isDirectory()) {
    throw new Error(`Template directory was not found: ${templateDir}`);
  }

  const existingOutput = await fs.stat(outputDir).catch(() => null);
  if (existingOutput) {
    throw new Error(`Output directory already exists: ${outputDir}`);
  }

  const replacements = {
    __SCENE_ID__: sceneId,
    __SCENE_DISPLAY_NAME__: displayName,
  };

  const createdFiles = [];
  await copyTemplateDirectory(templateDir, outputDir, replacements, createdFiles, {
    skipFiles: ['README.md'],
    renameMap: { 'GENERATED_README.md.template': 'README.md' },
  });

  const currentSceneCatalog = await fs.readFile(sceneCatalogPath, 'utf8');
  const nextSceneCatalog = addRoomSceneCatalogEntry(currentSceneCatalog, { sceneId, displayName });
  await fs.writeFile(sceneCatalogPath, nextSceneCatalog, 'utf8');

  return {
    outputDir,
    createdFiles,
    updatedFiles: [sceneCatalogPath],
  };
}
